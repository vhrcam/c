const HOSTS = new Set(["upload.wikimedia.org"]);
const MAX = 8 * 1024 * 1024;

export async function GET(request) {
  const raw = new URL(request.url).searchParams.get("u") || "";
  let target;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !HOSTS.has(target.hostname) || !target.pathname.startsWith("/wikipedia/commons/")) return new Response("not allowed", { status: 400 });
  const res = await fetch(target, { headers: { "user-agent": "c-art/0.1 (https://github.com/vhrcam/c)" }, signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!res?.ok) return new Response("not found", { status: 404 });
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("image/")) return new Response("not an image", { status: 415 });
  if (Number(res.headers.get("content-length") || 0) > MAX) return new Response("too large", { status: 413 });
  const body = await res.arrayBuffer();
  if (body.byteLength > MAX) return new Response("too large", { status: 413 });
  return new Response(body, { headers: { "content-type": type, "cache-control": "public, max-age=604800, immutable" } });
}
