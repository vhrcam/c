import { hash, random } from "../random.js";
import { clamp, lerp } from "./noise.js";

// what a mark belonging to shape k meets at a point: 1 its own shape, 2 something behind it, 0 something in front (or off the sheet)
export function see(G, k, x, y) {
  const i = Math.round(x * G.RES);
  const j = Math.round(y * G.RES);
  if (i < 0 || j < 0 || i >= G.nw || j >= G.nh) return 0;
  const r = G.rid[j * G.nw + i];
  return r === k ? 1 : r < k ? 2 : 0;
}

// the inward slope of a shape's distance field at a point, or null where it is flat or outside
function slope(G, s, x, y) {
  const b = s.box;
  const i = Math.round(x * G.RES) - b.i0;
  const j = Math.round(y * G.RES) - b.j0;
  if (i < 1 || j < 1 || i >= b.w - 1 || j >= b.h - 1) return null;
  const m = j * b.w + i;
  if (s.d[m] <= 0) return null;
  const l = Math.max(0, s.d[m - 1]);
  const r = Math.max(0, s.d[m + 1]);
  const u = Math.max(0, s.d[m - b.w]);
  const d = Math.max(0, s.d[m + b.w]);
  const gx = r - l;
  const gy = d - u;
  const len = Math.hypot(gx, gy);
  return len < 0.02 ? null : [gx / len, gy / len, s.d[m]];
}

function walk(G, s, x, y, step, max, over, dir) {
  const pts = [x, y];
  let px = 0;
  let py = 0;
  let out = 0;
  for (let len = 0; len < max; len += step) {
    const d = dir(x, y, px, py);
    if (!d) break;
    x += d[0] * step;
    y += d[1] * step;
    const v = see(G, s.k, x, y);
    if (!v) break;
    if (v === 2) {
      out += step;
      if (out > over) break;
    }
    px = d[0];
    py = d[1];
    pts.push(x, y);
  }
  return pts.length >= 4 ? Float32Array.from(pts) : null;
}

function seeds(G, s, spacing, rand, each) {
  const b = s.type === "band" ? { i0: 0, j0: 0, w: G.nw, h: G.nh } : s.box;
  const x0 = b.i0 / G.RES;
  const y0 = b.j0 / G.RES;
  const cols = Math.ceil(b.w / G.RES / spacing);
  const rows = Math.ceil(b.h / G.RES / spacing);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const x = x0 + (c + rand()) * spacing;
      const y = y0 + (r + rand()) * spacing;
      if (see(G, s.k, x, y) === 1) each(x, y);
    }
}

const tones = (s, well, rand) => {
  const t = rand();
  return t < 0.55 ? s.cut.body : t < 0.88 ? s.cut.deep : s.cut.polar > 0 ? s.cut.deep : s.cut.body;
};

// hair: long strands that run with the outline of the mass and fall with gravity and wind
export function hair(G, s, well, n, seed, scene, style) {
  const rand = random(hash(`hair:${seed}:${s.k}`));
  const out = [];
  const wind = style.wind;
  const span = Math.max(2, Math.hypot(s.box.w, s.box.h) / G.RES);
  const curl = lerp(0.25, 0.75, rand());
  const freq = lerp(0.12, 0.3, rand());
  const spacing = s.role === "setting" ? 0.7 : lerp(0.34, 0.46, rand());
  const dir = (x, y, px, py) => {
    const g = slope(G, s, x, y);
    let tx = 0;
    let ty = 1;
    if (g) {
      tx = -g[1];
      ty = g[0];
      if (px || py ? tx * px + ty * py < 0 : ty < 0) {
        tx = -tx;
        ty = -ty;
      }
      const hug = clamp(1.4 - g[2] * 0.25, 0.35, 1);
      tx = tx * hug + wind * 0.3;
      ty = ty * hug + (1 - hug) + 0.3;
    } else if (px || py) {
      tx = px + wind * 0.12;
      ty = py + 0.16;
    }
    const a = n(x * freq + s.k, y * freq - s.k) * curl;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const rx = tx * c - ty * sn;
    const ry = tx * sn + ty * c;
    const len = Math.hypot(rx, ry) || 1;
    return [rx / len, ry / len];
  };
  seeds(G, s, spacing, rand, (x, y) => {
    const p = walk(G, s, x, y, 0.3, span * lerp(0.25, 0.8, rand()), rand() < 0.3 ? lerp(0.4, 1.8, rand()) : 0.3, dir);
    if (p) out.push({ p, w: lerp(0.045, 0.1, rand() * rand()), ink: tones(s, well, rand), r: s.k, kind: "strand" });
  });
  return out;
}

// a coat of short strokes lying along a body and lifting off its edge: fur, feathers
export function coat(G, s, well, n, seed, long) {
  const rand = random(hash(`coat:${seed}:${s.k}`));
  const out = [];
  const tube = s.type === "tube";
  const segs = tube ? s.line.length - 1 : 0;
  let ax = s.axis.x;
  let ay = s.axis.y;
  if (ay < 0 || (Math.abs(ay) < 0.3 && ax < 0)) {
    ax = -ax;
    ay = -ay;
  }
  const flip = tube && s.line[segs][1] < s.line[0][1] ? -1 : 1;
  const dirAt = (x, y) => {
    let tx = ax;
    let ty = ay;
    const g = slope(G, s, x, y);
    if (tube) {
      const b = s.box;
      const m = (Math.round(y * G.RES) - b.j0) * b.w + Math.round(x * G.RES) - b.i0;
      const q = clamp(Math.round((s.u[m] || 0) * segs), 0, segs - 1);
      tx = (s.line[q + 1][0] - s.line[q][0]) * flip;
      ty = (s.line[q + 1][1] - s.line[q][1]) * flip;
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
    }
    if (g) {
      const edge = clamp(1 - g[2] / Math.max(0.6, s.rmax * 0.8));
      tx -= g[0] * edge * 0.75;
      ty -= g[1] * edge * 0.75;
    }
    const a = (rand() - 0.5) * 0.7 + n(x * 0.3, y * 0.3 + s.k) * 0.4;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const rx = tx * c - ty * sn;
    const ry = tx * sn + ty * c;
    const len = Math.hypot(rx, ry) || 1;
    return [rx / len, ry / len];
  };
  seeds(G, s, s.role === "setting" ? 0.85 : 0.5, rand, (x, y) => {
    const d = dirAt(x, y);
    const p = walk(G, s, x, y, 0.25, long ? lerp(1.4, 3.2, rand()) : lerp(0.5, 1.35, rand()), long ? 0.9 : 0.55, (qx, qy, px, py) => (px || py ? [px * 0.94 + d[0] * 0.06, py * 0.94 + d[1] * 0.06 + 0.02] : d));
    if (p) out.push({ p, w: lerp(0.05, 0.11, rand()), ink: tones(s, well, rand), r: s.k, kind: "strand" });
  });
  return out;
}

// blades standing off a band or a shape, taller toward the viewer
export function blades(G, s, well, n, seed, style) {
  const rand = random(hash(`blades:${seed}:${s.k}`));
  const out = [];
  const band = s.type === "band";
  const lean = style.wind * 0.5;
  const plant = (x, y, t) => {
    const a = -Math.PI / 2 + lean + n(x * 0.12 + s.k, y * 0.12) * 0.45 + (rand() - 0.5) * 0.5;
    const bend = (rand() - 0.5) * 0.09 + lean * 0.05;
    let ang = a;
    const p = walk(G, s, x, y, 0.25, lerp(0.5, 3.4, t) * lerp(0.45, 1.2, rand()), 4, () => {
      ang += bend;
      return [Math.cos(ang), Math.sin(ang)];
    });
    if (p) out.push({ p, w: lerp(0.05, 0.1, rand()) * (0.7 + 0.5 * t), ink: tones(s, well, rand), r: s.k, kind: "strand" });
  };
  if (!band) {
    seeds(G, s, 0.55, rand, (x, y) => plant(x, y, 0.4));
    return out;
  }
  // rows of tufts that thin out and shrink toward the far edge
  let y = 0;
  for (let row = 0; row < 400; row++) {
    const t = row ? clamp(y) : 0;
    const gapX = lerp(0.3, 1.6, t);
    for (let x = rand() * gapX; x < G.W; x += gapX * lerp(0.5, 1.6, rand())) {
      const i = clamp(Math.round(x * G.RES), 0, G.nw - 1);
      const py = lerp(s.edge[i], s.floor[i], t) + (rand() - 0.5) * 0.5;
      if (rand() < 0.75 - t * 0.3 && see(G, s.k, x, py + 0.2) === 1) plant(x, py + 0.2, t);
    }
    y += lerp(0.012, 0.075, t);
    if (y > 1) break;
  }
  return out;
}

// flames: tapering tongues that climb and waver
export function flames(G, s, well, n, seed) {
  const rand = random(hash(`flame:${seed}:${s.k}`));
  const out = [];
  const b = s.box;
  const height = b.h / G.RES;
  const hot = well.ink(well.light);
  seeds(G, s, 0.4, rand, (x, y) => {
    const phase = rand() * 6.28;
    let ang = -Math.PI / 2;
    let len = 0;
    const p = walk(G, s, x, y, 0.25, height * lerp(0.3, 0.9, rand()), 1.2, (qx, qy) => {
      len += 0.25;
      ang = -Math.PI / 2 + Math.sin(len * 1.4 + phase) * 0.5 + n(qx * 0.4, qy * 0.4 + s.k) * 0.5;
      return [Math.cos(ang), Math.sin(ang)];
    });
    if (!p) return;
    const m = p.length / 2;
    const w = new Float32Array(m);
    const base = lerp(0.1, 0.24, rand());
    for (let i = 0; i < m; i++) w[i] = base * (1 - i / m) + 0.02;
    out.push({ p, w, ink: rand() < 0.3 ? hot : rand() < 0.5 ? s.cut.deep : s.cut.body, r: s.k, kind: "strand" });
  });
  return out;
}
