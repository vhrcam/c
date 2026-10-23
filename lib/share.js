import { normalize } from "./scene";

const trim = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== false && !(Array.isArray(v) && !v.length)));

export function encode(scene) {
  const data = { ...trim(scene), people: scene.people.map((f) => trim({ ...f, height: f.height === 1 ? "" : f.height })) };
  let bin = "";
  new TextEncoder().encode(JSON.stringify(data)).forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decode(code) {
  try {
    const bin = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    return normalize(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))));
  } catch {
    return null;
  }
}
