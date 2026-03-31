import { getProjectOrThrow } from "~/lib/projects/runtime.server";
import { createProjectScopedHeaders, getSharedOpencodeServerUrl } from "~/lib/opencode/shared-runtime.server";

function getProxyResponseHeaders(upstream: Response) {
  const headers = new Headers(upstream.headers);

  // Node fetch transparently decodes compressed upstream bodies, so we must not
  // forward the original compression metadata to the browser.
  headers.delete("content-encoding");
  headers.delete("content-length");

  return headers;
}

export async function proxyProjectRequest(request: Request, projectId: string, splat: string | undefined) {
  const project = await getProjectOrThrow(projectId);
  const baseUrl = await getSharedOpencodeServerUrl();
  const url = new URL(request.url);
  const path = splat ? `/${splat}` : "/";
  const target = `${baseUrl}${path}${url.search}`;
  const headers = createProjectScopedHeaders(project.directory, request.headers);
  headers.delete("host");

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half",
  } as RequestInit & { duplex?: "half" });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: getProxyResponseHeaders(upstream),
  });
}
