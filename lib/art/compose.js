import { noise3 } from "../engine/noise";
import { random } from "../random";
import { isolines } from "./fields";
import { PALETTES, ramp } from "./palettes";
import { SYSTEMS, clipLine } from "./systems";

export const W = 1500;
export const H = 1000;
const M = [56, 46];

const LANGUAGE = {
  sun: [["cells", { size: 11, spacing: [1.3, 2], empty: 0, outline: 0.9 }], ["strata", { gap: 3.6, keep: 0.95, wobble: 0, scale: 40 }], ["stipple", { size: [1.6, 2.4] }]],
  sky: [["strata", { gap: 8, keep: 0.4, wobble: 1.5 }], ["constellation", { size: [12, 46], links: 2, reach: 70 }], ["cracks", { count: 180 }], ["cells", { size: 40, empty: 0.5, outline: 0.7 }], ["stipple", { size: [3.4, 14] }]],
  water: [["strata", { gap: 4, grow: 0.35, keep: 0.6, wobble: 0.4, scale: 140 }], ["contours", { levels: 20, stretch: 6, ridge: 0.3 }], ["strata", { gap: 6, keep: 0.42, wobble: 0.2, scale: 30 }]],
  land: [["contours", { levels: 30, stretch: 2.4, ridge: 0.9 }], ["strata", { gap: 3.2, keep: 0.85, wobble: 2.5, scale: 60 }], ["cells", { size: 15, spacing: [1.8, 3], empty: 0.05 }], ["cracks", { count: 700, turn: 0.4, angle: 0.3 }], ["blocks", { depth: 9, gutter: 2.5 }], ["branches", { roots: 12, from: "bottom", reach: 80, step: 4 }], ["stipple", { size: [2.2, 3.6] }]],
};

const sdCapsule = (x, y, ax, ay, bx, by, r) => {
  const px = x - ax;
  const py = y - ay;
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.min(1, Math.max(0, (px * vx + py * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(px - vx * t, py - vy * t) - r;
};
const sdEllipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);

function couple(him, her, h, dir) {
  const parts = [];
  const person = (px, py, k, girl) => {
    const s = h * k;
    const w = girl ? 0.84 : 1;
    parts.push((x, y) => sdEllipse(x, y, px, py - 0.04 * s, 0.2 * s * w, 0.07 * s));
    parts.push((x, y) => sdCapsule(x, y, px, py - 0.1 * s, px, py - 0.42 * s, 0.125 * s * w));
    parts.push((x, y) => sdCapsule(x, y, px - 0.165 * s * w, py - 0.44 * s, px - 0.05 * s, py - 0.54 * s, 0.06 * s));
    parts.push((x, y) => sdCapsule(x, y, px + 0.165 * s * w, py - 0.44 * s, px + 0.05 * s, py - 0.54 * s, 0.06 * s));
    parts.push((x, y) => sdCapsule(x, y, px - 0.17 * s * w, py - 0.44 * s, px - 0.19 * s * w, py - 0.12 * s, 0.04 * s));
    parts.push((x, y) => sdCapsule(x, y, px + 0.17 * s * w, py - 0.44 * s, px + 0.19 * s * w, py - 0.12 * s, 0.04 * s));
    const hx = px - (girl ? dir * 0.1 * s : 0);
    const hy = py - (girl ? 0.66 : 0.71) * s;
    parts.push((x, y) => sdCapsule(x, y, px, py - 0.54 * s, hx, hy, 0.038 * s));
    parts.push((x, y) => sdEllipse(x, y, hx, hy, 0.082 * s, 0.098 * s));
    if (girl) parts.push((x, y) => sdCapsule(x, y, hx, hy, px - dir * 0.02 * s, py - 0.36 * s, 0.075 * s));
  };
  person(him.x, him.y, 1, false);
  person(her.x, her.y, 0.9, true);
  parts.push((x, y) => sdCapsule(x, y, him.x + dir * 0.12 * h, him.y - 0.5 * h, her.x + dir * 0.13 * h, her.y - 0.3 * h, 0.035 * h));
  return (x, y) => {
    let d = Infinity;
    for (const p of parts) d = Math.min(d, p(x, y));
    return d;
  };
}

export function direct(seed) {
  const rand = random((Math.imul(seed, 2654435761) ^ 0x9e3779b9) >>> 0);
  const pool = (key, used) => LANGUAGE[key].filter(([name]) => !used.includes(name));
  const used = [];
  const choice = {};
  for (const key of ["sun", "sky", "water", "land"]) {
    const [name, opts] = rand.pick(pool(key, used));
    used.push(name);
    choice[key] = { system: name, opts };
  }
  return choice;
}

export function compose(memory, seed) {
  const rand = random(seed);
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const pal = PALETTES[memory.palette || rand.pick(["ember", "dusk", "editorial", "riso"])];
  const lines = [];
  const add = (pts, o) => {
    if (pts.length < 4) return;
    let len = 0;
    for (let k = 2; k < pts.length; k += 2) len += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    lines.push({ pts, alpha: 0.9, width: 1, layer: "ink", taper: false, ...o, dur: o.dur ?? Math.min(2.4, Math.max(0.3, len / 520)) });
  };

  const horizon = H * rand.range(0.48, 0.64);
  const crest = horizon + (H - horizon) * rand.range(0.38, 0.66);
  const fx = W * rand.pick([0.28, 0.36, 0.64, 0.72]);
  const side = rand.chance(0.5) ? 1 : -1;
  const sun = { r: H * rand.range(0.085, 0.15) };
  sun.x = Math.min(W - M[0] - sun.r * 1.5, Math.max(M[0] + sun.r * 1.5, fx + side * W * rand.range(0, 0.22)));
  sun.y = horizon - sun.r * rand.range(-0.15, 0.5);
  const ground = rand.pick(["hill", "shore", "cliff"]);
  const curve = H * rand.range(0.2, 0.55);
  const slope = rand.range(-0.12, 0.12);
  const edge = fx + side * W * rand.range(0.05, 0.12);
  const hill = (x) => {
    if (ground === "hill") return crest + ((x - fx) / W) ** 2 * curve * 4 + n(x / 320, 0, 21) * 10;
    if (ground === "shore") return crest + (x - fx) * slope + n(x / 260, 0, 21) * 14;
    return (x - edge) * side > 0 ? H * 2 : crest + Math.abs(x - fx) * 0.05 + n(x / 200, 0, 21) * 6;
  };
  const sea = rand.chance(0.6);
  const h = H * rand.range(0.075, 0.12);
  const gap = h * 0.27;
  const him = { x: fx - (side * gap) / 2, y: hill(fx - (side * gap) / 2) + h * 0.02 };
  const her = { x: fx + (side * gap) / 2, y: hill(fx + (side * gap) / 2) + h * 0.02 };
  const sd = couple(him, her, h, Math.sign(him.x - her.x));
  const inFrame = (x, y) => x > M[0] && x < W - M[0] && y > M[1] && y < H - M[1];
  const sunD = (x, y) => Math.hypot(x - sun.x, y - sun.y);

  const warm = (x, y) => Math.min(1, Math.max(0, Math.exp(-sunD(x, y) / (H * 0.4)) * 0.8, (1 - Math.min(1, Math.abs(horizon - y) / (horizon - M[1]))) ** 1.6 * 0.78));
  const skyRamp = [pal.cool[1], pal.cool[0], pal.warm[2], pal.warm[1], pal.warm[0]];
  const pens = {
    sun: (x, y) => ramp([pal.warm[0], pal.warm[1], pal.warm[2], pal.accent], Math.min(1, Math.max(0, (y - (sun.y - sun.r)) / (sun.r * 1.6)))),
    sky: (x, y) => ramp(skyRamp, warm(x, y)),
    water: (x, y) => (sea && Math.abs(x - sun.x) < sun.r * (1.1 - ((y - horizon) / (crest - horizon)) * 0.4) ? ramp(pal.warm, rand()) : ramp([pal.cool[2], pal.cool[0], pal.cool[1]], (y - horizon) / (crest - horizon + 1))),
    land: () => ramp([pal.ink, pal.cool[1], pal.cool[2]], rand() * 0.6),
  };
  const masks = {
    sun: (x, y) => inFrame(x, y) && sunD(x, y) < sun.r && y < horizon - 1 && sd(x, y) > 5,
    sky: (x, y) => inFrame(x, y) && y < horizon - 3 && sunD(x, y) > sun.r + 7 && sd(x, y) > 6,
    water: (x, y) => inFrame(x, y) && y > horizon + 3 && y < Math.min(H, hill(x)) - 3 && sd(x, y) > 6,
    land: (x, y) => inFrame(x, y) && y > hill(x) + 3 && sd(x, y) > 6,
  };
  const boxes = {
    sun: [sun.x - sun.r, sun.y - sun.r, sun.x + sun.r, Math.min(horizon, sun.y + sun.r)],
    sky: [M[0], M[1], W - M[0], horizon],
    water: [M[0], horizon, W - M[0], H - M[1]],
    land: [M[0], Math.min(crest, hill(M[0]), hill(W - M[0])) - 12, W - M[0], H - M[1]],
  };
  const windows = { sun: [1.6, 4.5], sky: [3, 8.5], water: [5.5, 9], land: [6.5, 10] };
  const orders = {
    sun: (x, y) => (sun.y + sun.r - y) / (sun.r * 2),
    sky: (x, y) => sunD(x, y) / Math.hypot(W, H) * 1.6,
    water: (x, y) => (y - horizon) / (crest - horizon + 1),
    land: (x, y) => (y - crest) / (H - crest),
  };
  const choice = memory.choice || direct(seed);
  if (!sea) choice.water = choice.water.system === "strata" ? { system: "contours", opts: { levels: 16, stretch: 3, ridge: 1 } } : choice.water;

  let run = [];
  for (let x = M[0]; x <= W - M[0]; x += 2) {
    const on = (n(x / 34, 0, 40) + 1) / 2 < 0.62 + warm(x, horizon) * 0.3 && sd(x, horizon) > 5;
    if (on) run.push(x, horizon);
    else if (run.length) {
      add(run, { pen: Math.abs(x - sun.x) < sun.r * 1.4 ? pal.accent : pal.ink, width: 1.2, alpha: 0.9, t0: 0.3 + Math.abs(x - sun.x) / W * 2, dur: 0.4 });
      run = [];
    }
  }
  if (run.length) add(run, { pen: pal.ink, width: 1.2, alpha: 0.9, t0: 1.5, dur: 0.4 });
  const crestPts = [];
  for (let x = M[0]; x <= W - M[0]; x += 4) if (hill(x) < H) crestPts.push(x, hill(x));
  if (ground === "cliff") crestPts.splice(...(side > 0 ? [crestPts.length, 0, edge, H - M[1]] : [0, 0, edge, H - M[1]]));
  for (const p of clipLine(crestPts, (x, y) => sd(x, y) > 2)) add(p, { pen: pal.ink, width: 1.6, alpha: 0.95, t0: 0.8 + Math.abs(p[0] - fx) / W * 2, dur: 1.2 });

  for (const key of ["sun", "sky", "water", "land"]) {
    const { system, opts } = choice[key];
    const ctx = { rand, n, warm, pen: pens[key], mask: masks[key], box: boxes[key], add, t: windows[key], order: orders[key] };
    SYSTEMS[system](ctx, opts);
  }

  if (sea) {
    const depth = Math.min(H - M[1], Math.max(...[sun.x - sun.r, sun.x, sun.x + sun.r].map(hill))) - horizon;
    for (let y = horizon + 5; y < horizon + depth * 0.92; y += 3.2 + ((y - horizon) / depth) * 4) {
      const t = (y - horizon) / depth;
      const half = sun.r * (1.05 - t * 0.55) * (0.55 + rand() * 0.45);
      let x = sun.x - half + n(y / 30, 0, 50) * sun.r * 0.25;
      while (x < sun.x + half) {
        const len = 6 + rand() * sun.r * 0.45 * (1 - t);
        for (const p of clipLine([x, y, Math.min(x + len, sun.x + half), y], masks.water)) add(p, { pen: ramp([pal.warm[0], pal.warm[1], pal.accent], t + rand() * 0.3), width: 1.4 - t * 0.5, alpha: 0.95 - t * 0.3, t0: 4.5 + t * 3, dur: 0.3 });
        x += len + 3 + rand() * 10 * (0.4 + t);
      }
    }
  }

  const angle = rand.pick([Math.PI / 2, Math.PI / 2.4, Math.PI / 1.7]);
  const fig = { rand, n, warm, pen: () => pal.ink, mask: (x, y) => sd(x, y) < 0, box: [fx - h * 1.2, Math.min(him.y, her.y) - h * 1.05, fx + h * 1.2, Math.max(him.y, her.y) + h * 0.15], add, t: [10, 12.5], order: (x, y) => (Math.max(him.y, her.y) - y) / h };
  SYSTEMS.fill(fig, { angle, gap: 1.3, pen: pal.ink });
  const [bx0, by0, bx1, by1] = fig.box;
  for (const l of isolines((x, y) => sd(x + bx0, y + by0), { w: bx1 - bx0, h: by1 - by0, cell: 1.5, levels: [0] })) add(l.pts.map((v, i) => v + (i % 2 ? by0 : bx0)), { pen: pal.ink, width: 1.2, alpha: 1, t0: 9.6, dur: 1.4 });

  const end = Math.max(...lines.map((l) => l.t0 + l.dur)) + 0.5;
  return { lines, pal, end, width: W, height: H, choice, layout: { horizon, crest, fx, sun, sea, h } };
}
