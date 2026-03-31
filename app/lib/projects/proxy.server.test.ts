// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

const getProjectOrThrowMock = vi.fn();
const getSharedOpencodeServerUrlMock = vi.fn();

vi.mock("~/lib/projects/runtime.server", () => ({
  getProjectOrThrow: (...args: unknown[]) => getProjectOrThrowMock(...args),
}));

vi.mock("~/lib/opencode/shared-runtime.server", () => ({
  createProjectScopedHeaders(directory: string, headers?: HeadersInit) {
    const nextHeaders = new Headers(headers);
    nextHeaders.set("x-opencode-directory", encodeURIComponent(directory));
    return nextHeaders;
  },
  getSharedOpencodeServerUrl: (...args: unknown[]) => getSharedOpencodeServerUrlMock(...args),
}));

import { proxyProjectRequest } from "~/lib/projects/proxy.server";

describe("proxyProjectRequest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    getProjectOrThrowMock.mockReset();
    getSharedOpencodeServerUrlMock.mockReset();
  });

  it("strips stale compression headers from decoded upstream responses", async () => {
    getProjectOrThrowMock.mockResolvedValue({
      id: "project-1",
      name: "scriptorium",
      directory: "/Users/jon/repos/scriptorium",
    });
    getSharedOpencodeServerUrlMock.mockResolvedValue("http://127.0.0.1:44556");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("hello", {
      status: 200,
      headers: {
        "content-encoding": "gzip",
        "content-length": "123",
        "content-type": "text/plain; charset=utf-8",
      },
    }));

    const response = await proxyProjectRequest(
      new Request("http://localhost/projects/project-1/proxy/session/abc/message?limit=50", {
        headers: { Accept: "application/json" },
      }),
      "project-1",
      "session/abc/message",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:44556/session/abc/message?limit=50",
      expect.objectContaining({
        headers: expect.any(Headers),
        method: "GET",
      }),
    );

    const forwardedHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);

    expect(forwardedHeaders.get("x-opencode-directory")).toBe("%2FUsers%2Fjon%2Frepos%2Fscriptorium");
    expect(forwardedHeaders.get("host")).toBeNull();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe("hello");
  });
});
