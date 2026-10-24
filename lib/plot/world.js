import { length } from "./contours.js";
import { add, mul, norm } from "./math.js";

export function noise2(seed) {
  const table = new Float32Array(512);
  let a = seed >>> 0;
  for (let i = 0; i < 512; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    table[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const at = (x, y) => {
    let k = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return table[(k ^ (k >>> 16)) & 511];
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = x - xi;
    const v = y - yi;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    return (at(xi, yi) * (1 - su) + at(xi + 1, yi) * su) * (1 - sv) + (at(xi, yi + 1) * (1 - su) + at(xi + 1, yi + 1) * su) * sv;
  };
}

export function occupancy(F, halo) {
  const w = Math.ceil(F.w);
  const h = Math.ceil(F.h);
  const base = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) base[y * w + x] = F.codeAt(x + 0.5, y + 0.5) >= 16 ? 1 : 0;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (base[y * w + x]) last = x;
      if (x - last <= halo) tmp[y * w + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (base[y * w + x]) last = x;
      if (last - x <= halo) tmp[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y;
      if (y - last <= halo) out[y * w + x] = 1;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y;
      if (last - y <= halo) out[y * w + x] = 1;
    }
  }
  return (x, y) => {
    const xi = x | 0;
    const yi = y | 0;
    return xi < 0 || yi < 0 || xi >= w || yi >= h ? false : out[yi * w + xi] === 1;
  };
}

export function clip(pts, ok, minLength = 3) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length >= 4 && length(run) >= minLength) out.push(run);
    run = [];
  };
  for (let i = 0; i < pts.length; i += 2) {
    if (ok(pts[i], pts[i + 1])) run.push(pts[i], pts[i + 1]);
    else flush();
  }
  flush();
  return out;
}

export const pickBand = (colors, u, rng, spread = 0.75) => colors[Math.max(0, Math.min(colors.length - 1, Math.round(u * (colors.length - 1) + rng.range(-spread, spread))))];

export function horizonOf(cam) {
  const f = norm([cam.fwd[0], 0, cam.fwd[2]]);
  return cam.project(add(cam.eye, mul(f, 5000)))[1];
}

export function constructionLines(ctx) {
  const { scene, cam, pal, horizon, w, sun } = ctx;
  const lines = [];
  const P = (p) => cam.project(p).slice(0, 2);
  const seg = (a, b, order) => {
    const [ax, ay] = P(a);
    const [bx, by] = P(b);
    lines.push({ pts: [ax, ay, bx, by], pen: pal.pencil, width: 0.7, layer: "construct", order });
  };
  lines.push({ pts: [0, horizon, w, horizon], pen: pal.pencil, width: 0.6, layer: "construct", order: 0 });
  if (sun) {
    const pts = [];
    for (let i = 0; i <= 64; i++) pts.push(sun[0] + Math.cos((i / 64) * Math.PI * 2) * sun[2] * 1.03, sun[1] + Math.sin((i / 64) * Math.PI * 2) * sun[2] * 1.03);
    lines.push({ pts, pen: pal.pencil, width: 0.6, layer: "construct", order: 0.1 });
  }
  scene.people.forEach((sk, i) => {
    const o = 0.2 + i * 0.4;
    const spine = [sk.P0, sk.P1, sk.P2, sk.P3, sk.neckTop, sk.head.o];
    spine.slice(1).forEach((p, j) => seg(spine[j], p, o + j * 0.01));
    for (const A of [sk.arms.L, sk.arms.R]) {
      seg(sk.P2, A.S, o + 0.1);
      seg(A.S, A.elbow, o + 0.12);
      seg(A.elbow, A.wrist, o + 0.14);
    }
    for (const L of [sk.legs.L, sk.legs.R]) {
      seg(sk.P0, L.H, o + 0.2);
      seg(L.H, L.knee, o + 0.22);
      seg(L.knee, L.ankle, o + 0.24);
    }
    const [hx, hy] = P(sk.head.o);
    const r = Math.abs(P(add(sk.head.o, mul(cam.up, 0.1 * sk.hk)))[1] - hy);
    const pts = [];
    for (let k = 0; k <= 40; k++) pts.push(hx + Math.cos((k / 40) * Math.PI * 2) * r * 0.86, hy + Math.sin((k / 40) * Math.PI * 2) * r);
    lines.push({ pts, pen: pal.pencil, width: 0.7, layer: "construct", order: o + 0.3 });
  });
  return lines;
}

export function hidden(ctx, x, y) {
  for (const m of ctx.marks || []) if (x >= m.box[0] && x <= m.box[2] && y >= m.box[1] && y <= m.box[3] && m.inside(x, y)) return true;
  return false;
}
