import { MARK } from "../mark.js";

// the outline of a stroke whose width changes along its length, as a closed polygon
export function ribbon(p, w, from = 0, to = w.length - 1) {
  const n = to - from + 1;
  const out = new Float32Array(n * 4);
  for (let q = 0; q < n; q++) {
    const i = from + q;
    const a = Math.max(from, i - 1);
    const b = Math.min(to, i + 1);
    let dx = p[b * 2] - p[a * 2];
    let dy = p[b * 2 + 1] - p[a * 2 + 1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const h = w[i] / 2;
    out[q * 2] = p[i * 2] - dy * h;
    out[q * 2 + 1] = p[i * 2 + 1] + dx * h;
    const m = (2 * n - 1 - q) * 2;
    out[m] = p[i * 2] + dy * h;
    out[m + 1] = p[i * 2 + 1] - dx * h;
  }
  return out;
}

const f = (v) => (Math.round(v * 100) / 100).toString();

// the finished piece as a vector file: one path per ink and pen width, ribbons as filled outlines
export function toSVG(art, { scale = 10, margin = 0, signed = false } = {}) {
  const { W, H, paper, inks, strokes } = art;
  const lines = new Map();
  const fills = new Map();
  const dots = new Map();
  const add = (map, key, d) => {
    const list = map.get(key);
    if (list) list.push(d);
    else map.set(key, [d]);
  };
  for (const s of strokes) {
    if (s.kind === "block") continue;
    const p = s.p;
    const a = s.a ?? 1;
    if (p.length === 2) {
      add(dots, `${s.ink}|${a}`, `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(s.w / 2)}"/>`);
      continue;
    }
    if (typeof s.w === "number") {
      let d = `M${f(p[0])} ${f(p[1])}`;
      for (let i = 2; i < p.length; i += 2) d += `L${f(p[i])} ${f(p[i + 1])}`;
      add(lines, `${s.ink}|${Math.round(s.w * 100) / 100}|${a}`, d);
    } else {
      const r = ribbon(p, s.w);
      let d = `M${f(r[0])} ${f(r[1])}`;
      for (let i = 2; i < r.length; i += 2) d += `L${f(r[i])} ${f(r[i + 1])}`;
      add(fills, `${s.ink}|${a}`, d + "Z");
    }
  }
  const out = [];
  for (const [key, list] of fills) {
    const [ink, a] = key.split("|");
    out.push(`<path d="${list.join("")}" fill="${inks[ink]}"${a < 1 ? ` fill-opacity="${a}"` : ""}/>`);
  }
  for (const [key, list] of lines) {
    const [ink, w, a] = key.split("|");
    out.push(`<path d="${list.join("")}" fill="none" stroke="${inks[ink]}" stroke-width="${w}"${a < 1 ? ` stroke-opacity="${a}"` : ""}/>`);
  }
  for (const [key, list] of dots) {
    const [ink, a] = key.split("|");
    out.push(`<g fill="${inks[ink]}"${a < 1 ? ` fill-opacity="${a}"` : ""}>${list.join("")}</g>`);
  }
  if (signed) {
    const k = 2.3 / MARK.h;
    const c = MARK.cursor;
    out.push(`<g transform="translate(${f(W - MARK.w * k)} ${f(H + 1.5)}) scale(${k.toFixed(5)})" fill="${inks[art.key]}"><path d="${MARK.c}"/><rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"/></g>`);
  }
  const w = W + margin * 2;
  const h = H + margin * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" viewBox="${-margin} ${-margin} ${w} ${h}"><rect x="${-margin}" y="${-margin}" width="${w}" height="${h}" fill="${paper}"/><g stroke-linecap="round" stroke-linejoin="round">${out.join("")}</g></svg>`;
}
