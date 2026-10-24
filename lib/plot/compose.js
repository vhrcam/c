import { random } from "../random.js";
import { camera } from "./camera.js";
import { length } from "./contours.js";
import { couple } from "./couple.js";
import { fields } from "./fields.js";
import { faceLines, figureLines, toneField } from "./figurelines.js";
import { gbuffer } from "./gbuffer.js";
import { add, cross, mul, norm, sub } from "./math.js";
import { PALETTES } from "./palettes.js";
import { birdLines, constructionLines, groundLines, horizonOf, occupancy, skyLines, starLines, sunLines } from "./world.js";

export const PLAN = {
  construct: [0.2, 2.6, 900],
  outline: [1.4, 7.6, 520],
  face: [6.6, 8.0, 150],
  hair: [3.6, 10.8, 420],
  hatch: [5.4, 12.6, 480],
  sun: [8.4, 12.2, 700],
  sky: [9.4, 16.6, 760],
  stars: [14.2, 17.2, 200],
  horizon: [11.2, 12.6, 900],
  ground: [12.0, 17.6, 800],
  grass: [14.0, 19.4, 300],
  birds: [16.6, 17.8, 110],
};
export const END = 20.2;

function frameShot(scene, rng, w, h) {
  const shot = rng.pick(["wide", "wide", "medium", "medium", "close"]);
  const yaw = rng.range(-0.5, 0.5);
  const elev = shot === "wide" ? rng.range(-0.1, 0.06) : rng.range(-0.06, 0.1);
  const fov = shot === "wide" ? rng.range(30, 40) : rng.range(24, 32);
  const top = Math.max(...scene.people.map((p) => p.head.o[1])) + 0.17;
  const lo = { wide: -0.02, medium: 0.48, close: 0.86 }[shot];
  const fill = { wide: rng.range(0.42, 0.56), medium: rng.range(0.74, 0.86), close: rng.range(0.82, 0.92) }[shot];
  const lens = 2 * Math.tan((fov * Math.PI) / 360);
  const span = top - lo;
  const D = span / (lens * fill);
  const target = [scene.kiss[0], lo + span / 2, 0];
  const eye = [target[0] + D * Math.sin(yaw) * Math.cos(elev), target[1] + D * Math.sin(elev), D * Math.cos(yaw) * Math.cos(elev)];
  const fwd = norm(sub(target, eye));
  const right = norm(cross(fwd, [0, 1, 0]));
  const frameH = span / fill;
  const side = rng.range(-0.17, 0.17) * frameH * (w / h);
  const lift = shot === "wide" ? rng.range(0.12, 0.24) * frameH : rng.range(0, 0.05) * frameH;
  const look = add(add(target, mul(right, side)), [0, lift, 0]);
  return { shot, view: { eye, look, fov }, yaw };
}

function pensFor(pal, rng) {
  const top = rng.pick(pal.top);
  const bottom = rng.pick(pal.bottom);
  const dress = rng.pick(pal.dress);
  const fill = (mat) => {
    if (mat === 1) return pal.skin;
    if (mat === 2) return pal.hairA;
    if (mat === 3) return pal.hairB;
    if (mat === 4) return top;
    if (mat === 5) return bottom;
    if (mat === 6) return dress;
    return [pal.shoe, pal.ink];
  };
  return {
    ink: pal.ink,
    accent: pal.accent,
    mouth: pal.skin[1],
    outline: () => pal.ink,
    fill: (mat) => fill(mat),
    hairDark: (person) => (person === 1 ? pal.hairA[1] : pal.hairB[1]),
  };
}

export async function compose(seed, { width = 1500, height = 1000, ss = 1.5, onProgress } = {}) {
  const rng = random(seed);
  const scene = couple(seed);
  const pal = rng.pick(PALETTES);
  const night = pal.time === "night";
  const { shot, view } = frameShot(scene, rng, width, height);
  const cam = camera(view, width, height);
  const horizon = horizonOf(cam);
  const [kx, ky] = cam.project(scene.kiss);

  const R = (night ? rng.range(0.045, 0.07) : rng.range(0.075, 0.15)) * height;
  const behind = rng.chance(0.65);
  let sx = behind ? kx + rng.range(-0.06, 0.06) * width : rng.pick([0.22, 0.78]) * width + rng.range(-0.05, 0.05) * width;
  let sy = behind ? ky + rng.range(-0.02, 0.1) * height : rng.range(0.18, 0.42) * height;
  sy = Math.min(sy, horizon - R * rng.range(0.15, 1.1));
  sx = Math.min(width - R - 40, Math.max(R + 40, sx));
  const sunDir = cam.ray(sx, sy);
  const keyDir = norm(add(add(mul(cam.fwd, -0.9), mul(cam.right, rng.pick([-0.7, 0.7]))), [0, 0.8, 0]));
  const hills = [rng.range(0, 7), rng.range(0.02, 0.06), rng.range(0, 100), 0];

  const W = Math.round(width * ss);
  const H = Math.round(height * ss);
  const camG = camera(view, W, H);
  const g = await gbuffer({ nodes: scene.nodes, cam: camG, W, H, key: keyDir, sun: sunDir, hills, bound: [scene.kiss[0], 0.95, 0, 1.6], onProgress });
  const F = fields(g, ss);

  const pens = pensFor(pal, rng);
  const tone = toneField(F, night ? 0.4 : 0.9);
  const blocked = occupancy(F, 5);
  const isSky = (x, y) => F.codeAt(x, y) === 0;
  const ctx = { F, cam, scene, pal, rng, w: width, h: height, horizon, blocked, isSky, wind: scene.wind, seed, sun: [sx, sy, R], style: rng.pick(["spiral", "rings", "rings", "stripes"]), furrow: rng.range(1.12, 1.22), grass: shot === "close" ? 0 : rng.int(500, 1400) };

  const lines = [
    ...constructionLines(ctx),
    ...figureLines(F, { pens, rng, tone }),
    ...faceLines(scene, cam, F, pens),
    ...sunLines(ctx),
    ...skyLines(ctx),
    ...(night ? starLines(ctx) : rng.chance(0.6) ? birdLines(ctx) : []),
    ...groundLines(ctx),
  ];
  schedule(lines, [kx, ky], rng);
  return { lines, pal, end: END, meta: { seed, shot, palette: pal.name, sun: ctx.style, lines: lines.length, ms: Math.round(g.renderMs) } };
}

function schedule(lines, focus, rng) {
  const groups = new Map();
  for (const l of lines) {
    l.len = length(l.pts);
    const list = groups.get(l.layer);
    if (list) list.push(l);
    else groups.set(l.layer, [l]);
  }
  for (const [layer, list] of groups) {
    const [a, b, speed] = PLAN[layer] || [10, 15, 500];
    const key = (l) => {
      if (l.order !== undefined) return l.order;
      const n = l.pts.length / 2;
      const mx = l.pts[Math.floor(n / 2) * 2];
      const my = l.pts[Math.floor(n / 2) * 2 + 1];
      return Math.hypot(mx - focus[0], my - focus[1]) + rng.range(0, 40);
    };
    list.forEach((l) => (l.key = key(l)));
    list.sort((x, y) => x.key - y.key);
    const span = b - a;
    list.forEach((l, i) => {
      l.dur = Math.min(span * 0.45, Math.max(0.05, l.len / speed));
      l.t0 = a + (i / Math.max(1, list.length)) * (span - l.dur * 0.6) + rng.range(-0.05, 0.05);
      l.alpha = layer === "construct" ? 0.5 : rng.range(0.82, 0.96);
    });
  }
}
