import { noise3 } from "../engine/noise";
import { random } from "../random";
import { colonize, isolines, streamlines } from "./fields";
import { PALETTES, ramp } from "./palettes";

export const W = 1500;
export const H = 1000;
const M = [56, 46];

const length = (pts) => {
  let l = 0;
  for (let k = 2; k < pts.length; k += 2) l += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
  return l;
};

function sheet(pal) {
  const lines = [];
  const add = (pts, o) => {
    if (pts.length < 4) return;
    const len = length(pts);
    lines.push({ pts, alpha: 0.9, width: 1, layer: "ink", taper: false, ...o, dur: o.dur ?? Math.min(2.4, Math.max(0.35, len / 520)) });
  };
  return { lines, add, pal };
}

const circle = (cx, cy, r, from = 0, to = Math.PI * 2) => {
  const pts = [];
  const n = Math.max(12, Math.ceil((Math.abs(to - from) * r) / 4));
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
};

const inFrame = (x, y) => x > M[0] && x < W - M[0] && y > M[1] && y < H - M[1];

function flowPiece(spec, rand, n, s) {
  const { sun, horizon, people } = spec;
  const pal = s.pal;
  const figure = (x, y) => people.some((p) => Math.abs(x - p.x) < 11 && y > p.y - 62 && y < p.y + 4) || people.some((p) => Math.hypot(x - p.x, y - (p.y - 72)) < 10);
  const vec = (x, y) => {
    const dx = x - sun.x;
    const dy = y - sun.y;
    const r = Math.hypot(dx, dy) || 1;
    if (y < horizon) {
      const a = n(x / 520, y / 420, 1.3) * 1.4;
      const swirl = Math.exp(-((r - sun.r * 1.6) ** 2) / (2 * (sun.r * 2.2) ** 2)) * 2.2;
      return [Math.cos(a) + (-dy / r) * swirl, Math.sin(a) * 0.35 + (dx / r) * swirl];
    }
    let vx = 1;
    let vy = Math.sin(x / 70 + n(x / 300, y / 120, 5) * 3) * 0.18;
    for (const p of people) {
      const px = p.x - x;
      const py = p.y - y;
      const d = Math.hypot(px, py) + 30;
      vx += (px / d) * (2600 / (d * d)) * 30;
      vy += (py / d) * (2600 / (d * d)) * 30;
    }
    return [vx, vy];
  };
  const inside = (x, y) => inFrame(x, y) && Math.hypot(x - sun.x, y - sun.y) > sun.r && !figure(x, y) && Math.abs(y - horizon) > 3;
  const lines = streamlines(vec, { w: W, h: H, sep: 6.5, test: 3.4, step: 2.2, minLen: 24, inside, rand });
  for (const l of lines) {
    const sky = l.y < horizon;
    const d = Math.hypot(l.x - sun.x, l.y - sun.y);
    const glow = Math.max(0, 1 - d / 620);
    const reflect = !sky && Math.abs(l.x - sun.x) < sun.r * 1.3 * (1 + (l.y - horizon) / 300);
    const pen = sky ? ramp([...pal.cool].reverse().concat(pal.warm), 0.2 + glow * 0.8 - (horizon - l.y) / 3000) : reflect ? ramp(pal.warm, rand()) : ramp(pal.cool, Math.min(1, (l.y - horizon) / 400 + rand() * 0.2));
    s.add(l.pts, { pen, width: sky ? 1.05 : 1.25, alpha: 0.85, t0: 1 + (Math.abs(l.x - W / 2) / W) * 4 + (sky ? 0 : 3) + rand() * 1.5 });
  }
}

function growthPiece(spec, rand, n, s) {
  const { sun, horizon, people } = spec;
  const pal = s.pal;
  for (let r = 8; r < sun.r; r += 7) s.add(circle(sun.x, sun.y, r), { pen: ramp(pal.warm, r / sun.r), width: 1, alpha: 0.8, t0: 0.5 + r / 60 });
  const attractors = [];
  while (attractors.length < 520) {
    const a = Math.PI + rand() * Math.PI;
    const r = sun.r * 1.5 + Math.sqrt(rand()) * 430;
    const x = sun.x + Math.cos(a) * r * 1.35;
    const y = sun.y + Math.sin(a) * r * 0.9;
    if (inFrame(x, y) && y < horizon - 30) attractors.push([x, y]);
  }
  const paths = colonize({ roots: people.map((p) => ({ x: p.x, y: p.y, dx: 0, dy: -1 })), attractors, influence: 150, kill: 14, step: 6, iterations: 220 });
  const top = Math.max(...paths.map((p) => p.weight));
  for (const p of paths) {
    const w = 0.7 + 7 * Math.sqrt(p.weight / top);
    const cols = p.root ? pal.cool : pal.warm;
    s.add(p.pts, { pen: ramp(cols, Math.min(1, p.depth / 140)), width: w, taper: w > 2.2, alpha: 0.92, t0: 2 + p.depth * 0.045, dur: Math.max(0.25, length(p.pts) / 260) });
  }
  for (let k = 0; k < 14; k++) {
    const y = horizon + 6 + k * k * 2.6;
    const pts = [];
    for (let x = M[0]; x <= W - M[0]; x += 8) pts.push(x, y + n(x / 260, k, 2) * (2 + k));
    s.add(pts, { pen: pal.ink, width: 0.9, alpha: 0.75 - k * 0.03, t0: 1 + k * 0.25 });
  }
}

function hybridPiece(spec, rand, n, s) {
  const { sun, horizon, people } = spec;
  const pal = s.pal;
  for (let x = M[0]; x <= W - M[0]; x += 25) s.add([x, M[1], x, H - M[1]], { pen: pal.pencil, width: 0.6, alpha: 0.35, layer: "construct", t0: 0.1 + x / 1500 });
  for (let y = M[1]; y <= H - M[1]; y += 25) s.add([M[0], y, W - M[0], y], { pen: pal.pencil, width: 0.6, alpha: 0.35, layer: "construct", t0: 0.1 + y / 1000 });
  const F = (x, y) => {
    let v = n(x / 380, y / 260, 9) * 0.35;
    for (const p of people) v += Math.exp(-((x - p.x) ** 2 / (2 * 150 ** 2) + ((y - p.y) * 1.8) ** 2 / (2 * 150 ** 2)));
    return v;
  };
  const levels = Array.from({ length: 22 }, (_, i) => -0.3 + i * 0.075);
  for (const c of isolines(F, { w: W, h: H, cell: 5, levels })) {
    const pts = [];
    for (let k = 0; k < c.pts.length; k += 2) if (c.pts[k + 1] > horizon + 4 && inFrame(c.pts[k], c.pts[k + 1])) pts.push(c.pts[k], c.pts[k + 1]);
      else if (pts.length) break;
    const t = (c.level + 0.3) / 1.65;
    s.add(pts, { pen: t > 0.62 ? ramp(pal.warm, (t - 0.62) / 0.38) : ramp(pal.cool, 1 - t), width: t > 0.62 ? 1.3 : 1, alpha: 0.9, t0: 4 + t * 4 });
  }
  const vec = (x, y) => {
    const dx = x - sun.x;
    const dy = y - sun.y;
    const r = Math.hypot(dx, dy) || 1;
    const a = n(x / 600, y / 500, 2) * 0.8;
    return [Math.cos(a) * 0.4 - dy / r, Math.sin(a) * 0.4 + dx / r];
  };
  for (const l of streamlines(vec, { w: W, h: H, sep: 15, test: 7, step: 3, minLen: 80, inside: (x, y) => inFrame(x, y) && y < horizon - 20 && Math.hypot(x - sun.x, y - sun.y) > sun.r * 1.5, rand })) {
    const d = Math.hypot(l.x - sun.x, l.y - sun.y);
    s.add(l.pts, { pen: ramp([pal.accent, ...pal.warm.slice(0, 2), pal.cool[0]], Math.min(1, d / 700)), width: 1.1, alpha: 0.85, t0: 8 + (d / 700) * 3 });
  }
  for (let r = 12; r < sun.r; r += 9) s.add(circle(sun.x, sun.y, r), { pen: pal.accent, width: 1.1, alpha: 0.85, t0: 2 + r / 50 });
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const r0 = sun.r * 1.12;
    const r1 = sun.r * (i % 4 ? 1.22 : 1.38);
    if (sun.y + Math.sin(a) * r1 > horizon) continue;
    s.add([sun.x + Math.cos(a) * r0, sun.y + Math.sin(a) * r0, sun.x + Math.cos(a) * r1, sun.y + Math.sin(a) * r1], { pen: pal.ink, width: 0.9, alpha: 0.85, t0: 3 + i / 60, dur: 0.3 });
  }
  s.add([M[0], horizon, W - M[0], horizon], { pen: pal.ink, width: 1.2, t0: 1.5, dur: 1.4 });
  for (const [k, p] of people.entries()) {
    for (let j = 0; j < 26; j++) {
      let x = p.x + (rand() - 0.5) * 30;
      let y = p.y - rand() * 40;
      const pts = [x, y];
      for (let step = 0; step < 220; step++) {
        const tx = sun.x - x;
        const ty = sun.y - y;
        const d = Math.hypot(tx, ty) || 1;
        if (d < sun.r * 1.05) break;
        const a = n(x / 90, y / 90, 20 + k) * 1.6;
        x += (tx / d) * 2.4 + Math.cos(a) * 1.4;
        y += (ty / d) * 2.4 + Math.sin(a) * 1.4;
        pts.push(x, y);
      }
      s.add(pts, { pen: k ? pal.cool[0] : pal.accent, width: 0.8, alpha: 0.6, t0: 11 + j * 0.08 });
    }
  }
}

export const PIECES = { flow: flowPiece, growth: growthPiece, hybrid: hybridPiece };

export function prototype(spec, seed) {
  const rand = random(seed);
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const pal = PALETTES[spec.palette] || PALETTES.editorial;
  const s = sheet(pal);
  const scene = { sun: { x: W * (0.5 + (rand() - 0.5) * 0.2), y: H * 0.4, r: 92 }, horizon: H * 0.6, ...spec.scene };
  scene.people = scene.people || [{ x: scene.sun.x - 24, y: H * 0.66 }, { x: scene.sun.x + 22, y: H * 0.66 }];
  PIECES[spec.piece](scene, rand, n, s);
  const end = Math.max(...s.lines.map((l) => l.t0 + l.dur)) + 0.5;
  return { lines: s.lines, pal, end, width: W, height: H };
}
