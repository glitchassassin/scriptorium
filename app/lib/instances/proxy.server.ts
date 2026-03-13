import { getInstanceOrThrow } from "~/lib/instances/runtime.server";

export async function proxyInstanceRequest(request: Request, instanceId: string, splat: string | undefined) {
  const instance = await getInstanceOrThrow(instanceId);
  const url = new URL(request.url);
  const path = splat ? `/${splat}` : "/";
  const target = `http://127.0.0.1:${instance.port}${path}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    duplex: request.method === "GET" || request.method === "HEAD" ? undefined : "half",
  } as RequestInit & { duplex?: "half" });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
