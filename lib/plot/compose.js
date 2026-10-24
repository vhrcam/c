import { random } from "../random.js";
import { camera } from "./camera.js";
import { length } from "./contours.js";
import { couple } from "./couple.js";
import { fields } from "./fields.js";
import { faceLines, figureLines, foldLines, toneField } from "./figurelines.js";
import { handLines } from "./handlines.js";
import { hairLines } from "./hairlines.js";
import { gbuffer } from "./gbuffer.js";
import { add, cross, mul, norm, sub } from "./math.js";
import { PALETTES } from "./palettes.js";
import { horizonLines, meadowLines, shoreLines } from "./land.js";
import { castShadow, reflection } from "./shadows.js";
import { atmosLines } from "./atmos.js";
import { birdLines, cloudLines, clouds, moonLines, skyLines, starLines, sunLines } from "./sky.js";
import { constructionLines, horizonOf, occupancy } from "./world.js";

export const PLAN = {
  construct: [0.2, 2.6, 900],
  outline: [1.4, 7.6, 520],
  face: [6.6, 8.0, 150],
  hands: [7.0, 8.8, 180],
  folds: [6.2, 10.4, 260],
  hair: [3.6, 10.8, 420],
  shine: [10.9, 11.6, 400],
  flyaway: [10.4, 11.4, 200],
  hatch: [5.4, 12.6, 480],
  sun: [8.4, 12.2, 700],
  clouds: [9.0, 14.0, 520],
  sky: [9.4, 16.6, 760],
  stars: [14.2, 17.2, 200],
  horizon: [11.2, 12.6, 900],
  sea: [11.8, 17.2, 700],
  ground: [12.0, 17.6, 800],
  far: [11.0, 13.0, 500],
  shadow: [11.6, 13.6, 700],
  reflect: [12.2, 14.6, 600],
  props: [13.0, 16.0, 400],
  grass: [14.0, 19.4, 300],
  flowers: [16.2, 19.6, 160],
  birds: [16.6, 17.8, 110],
  drift: [17.4, 19.8, 200],
};
export const END = 20.2;

function frameShot(scene, rng, w, h, force) {
  const picked = rng.pick(["wide", "wide", "medium", "medium", "close"]);
  const shot = force || picked;
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

const shade = (hex, t) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const to = t > 0 ? 255 : 30;
  return `#${c.map((v) => Math.round(v + (to - v) * Math.abs(t)).toString(16).padStart(2, "0")).join("")}`;
};

function pensFor(pal, rng) {
  const people = [1, 2].map(() => {
    const tint = rng.range(-0.16, 0.2);
    const skin = pal.skin.map((c) => shade(c, tint));
    const top = rng.pick(pal.top);
    const coat = rng.pick([...pal.bottom, ...pal.top].filter((c) => c !== top));
    return { skin, top, bottom: rng.pick(pal.bottom), dress: rng.pick(pal.dress), coat, trim: [pal.accent, pal.ink] };
  });
  const fill = (mat, person) => {
    const p = people[(person || 1) - 1];
    if (mat === 1) return p.skin;
    if (mat === 2) return pal.hairA;
    if (mat === 3) return pal.hairB;
    if (mat === 4) return p.top;
    if (mat === 5) return p.bottom;
    if (mat === 6) return p.dress;
    if (mat === 9) return p.coat;
    if (mat === 10) return p.trim;
    return [pal.shoe, pal.ink];
  };
  return {
    ink: pal.ink,
    accent: pal.accent,
    mouth: pal.skin[1],
    outline: () => pal.ink,
    fill,
    hairDark: (person) => (person === 1 ? pal.hairA[1] : pal.hairB[1]),
  };
}

export async function compose(seed, { width = 1500, height = 1000, ss = 1.5, shot: force, onProgress } = {}) {
  const rng = random(seed);
  const scene = couple(seed);
  const pal = rng.pick(PALETTES);
  const night = pal.time === "night";
  const { shot, view } = frameShot(scene, rng, width, height, force);
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
  const setting = rng.chance(0.35) ? "shore" : "meadow";
  const hills = setting === "shore" ? [0, 0.05, 0, 0] : [rng.chance(0.6) ? rng.range(1, 8) : 0, rng.range(0.02, 0.06), rng.range(0, 100), 0];

  const T = [performance.now()];
  const W = Math.round(width * ss);
  const H = Math.round(height * ss);
  const camG = camera(view, W, H);
  const g = await gbuffer({ nodes: scene.nodes, cam: camG, W, H, key: keyDir, sun: sunDir, hills, bound: [scene.kiss[0], 0.95, 0, 1.6], onProgress });
  const F = fields(g, ss);
  T.push(performance.now());

  const pens = pensFor(pal, rng);
  const tone = toneField(F, night ? 0.4 : 0.9);
  const blocked = occupancy(F, 5);
  const isSky = (x, y) => F.codeAt(x, y) === 0;
  const feet = Math.hypot(...sub(cam.eye, [scene.kiss[0], 0, 0]));
  const ctx = {
    F,
    cam,
    scene,
    pal,
    rng: random((seed ^ 0x9e3779b9) >>> 0),
    w: width,
    h: height,
    horizon,
    blocked,
    isSky,
    wind: scene.wind,
    seed,
    sun: [sx, sy, R],
    style: rng.pick(["spiral", "rings", "rings", "stripes"]),
    mood: night ? "calm" : rng.pick(["flow", "flow", "bands", "calm"]),
    furrow: rng.range(1.12, 1.22),
    grass: shot === "close" ? 0 : rng.int(500, 1400),
    flowers: rng.chance(0.45) ? rng.int(25, 80) : 0,
    shore: feet + rng.range(3, 9),
    marks: [],
    pens,
  };
  ctx.figureBox = figureBox(F);
  const cloud = clouds(ctx);
  const cl = cloudLines(ctx, cloud);

  const timed = (fn) => {
    const out = fn();
    T.push(performance.now());
    return out;
  };
  const lines = [
    ...timed(() => constructionLines(ctx)),
    ...timed(() => figureLines(F, { pens, rng, tone, patterns: patternsOf(scene) })),
    ...timed(() => faceLines(scene, cam, F, pens)),
    ...handLines(scene, cam, F, pens),
    ...hairLines(scene, cam, F, pens, pal, seed),
    ...foldLines(scene, cam, F, pens, rng),
    ...timed(() => (setting === "shore" ? shoreLines(ctx) : meadowLines(ctx))),
    ...timed(() => (setting === "shore" ? reflection(ctx) : castShadow(ctx))),
    ...timed(() => (night ? moonLines(ctx) : sunLines(ctx))),
    ...cl.lines,
    ...timed(() => skyLines(ctx, cl.field)),
    ...timed(() => (night ? starLines(ctx, cl.field) : rng.chance(0.6) ? birdLines(ctx) : [])),
    ...horizonLines(ctx),
    ...timed(() => atmosLines(ctx, setting)),
  ];
  schedule(lines, [kx, ky], rng);
  const steps = T.slice(1).map((t, i) => Math.round(t - T[i]));
  return { lines, pal, end: END, meta: { seed, shot, setting, outfits: scene.choices.outfits, mood: ctx.mood, palette: pal.name, sun: ctx.style, lines: lines.length, ms: steps } };
}

function patternsOf(scene) {
  const out = new Map();
  scene.people.forEach((sk, i) => {
    for (const [mat, kind] of Object.entries(sk.outfit?.pattern || {})) if (kind !== "plain") out.set((i + 1) * 16 + Number(mat), kind);
  });
  return out;
}

function figureBox(F) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let y = 0; y < F.h; y += 4) {
    for (let x = 0; x < F.w; x += 4) {
      if (F.codeAt(x, y) < 16) continue;
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
    }
  }
  return box;
}

const TAPER = new Set(["outline", "hair", "hatch", "face", "hands", "grass", "folds"]);

function schedule(lines, focus, rng) {
  const groups = new Map();
  for (const l of lines) {
    l.len = length(l.pts);
    l.taper = TAPER.has(l.layer);
    if (l.taper) l.width *= 1.3;
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
