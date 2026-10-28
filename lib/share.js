const toBase64 = (bytes) => {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const fromBase64 = (code) => Uint8Array.from(atob(code.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

export async function encode(plan) {
  const bytes = new TextEncoder().encode(JSON.stringify(plan));
  if (typeof CompressionStream === "undefined") return "j" + toBase64(bytes);
  return "z" + toBase64(await pipe(bytes, new CompressionStream("deflate-raw")));
}

export async function decode(code) {
  try {
    let bytes = fromBase64(code.slice(1));
    if (code[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    else if (code[0] !== "j") return null;
    const raw = JSON.parse(new TextDecoder().decode(bytes));
    if (raw?.art) {
      const { normalizePlan, withView } = await import("./art/plan");
      const plan = normalizePlan(raw);
      return withView(plan, raw.direction);
    }
    const { normalizePlan } = await import("./engine");
    return normalizePlan(raw);
  } catch {
    return null;
  }
}
