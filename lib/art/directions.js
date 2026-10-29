import { noise3 } from "../engine/noise";
import { random } from "../random";
import { CONSTRUCTIONS } from "./build";
import { figures } from "./figure2d";
import { composition } from "./plan";
import { figureLayer, sceneBuffer } from "./scene";
import { H, W, tone, world } from "./world";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const ramp = (list, t) => {
  const k = Math.min(list.length - 1.0001, Math.max(0, t * (list.length - 1)));
  const i = Math.floor(k);
  return mix(list[i], list[i + 1], k - i);
};

function setup(P) {
  const { world: wd } = P;
  const sky = wd.sky.map(rgb);
  const sun = wd.lights[0];
  const hz = Math.max(1, Math.min(wd.horizon, H * 1.2));
  P.skyAt = (x, y) => {
    const v = Math.min(1, Math.max(0, (hz - y) / hz));
    const d = sun ? Math.min(1, Math.hypot(x - sun.x, y - sun.y) / (W * 0.7)) : 0.5;
    return ramp(sky, Math.min(1, v * 0.62 + d * 0.5));
  };
  P.colorOf = (L) => (L.hex ? rgb(L.hex) : mix(rgb(tone(L.material, wd.time)), sky[0], (1 - L.depth) * 0.42));
  P.sky = sky;
  P.dark = wd.time === "night";
}

export async function prepare(plan, seed, override = {}) {
  const comp = { ...composition(plan, seed), ...override };
  const rand = random((seed ^ 0x3c6ef372) >>> 0);
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const wd = world(plan, comp, rand, n);
  const fig = figures(plan, comp, wd, seed);
  const P = { plan, comp, world: wd, fig, rand, n };
  setup(P);
  return P;
}

// the part of the picture the second construction builds: open sky outdoors, the walls of a room indoors
const UPPER = new Set(["sky", "light", "cloud", "wall"]);

function upperMask(B) {
  const m = document.createElement("canvas");
  m.width = B.w;
  m.height = B.h;
  const x = m.getContext("2d");
  const img = x.createImageData(B.w, B.h);
  const keep = B.regions.map((r) => UPPER.has(r.kind));
  for (let i = 0; i < B.w * B.h; i++) if (keep[B.ids[i]]) img.data[i * 4 + 3] = 255;
  x.putImageData(img, 0, 0);
  return m;
}

export async function paint(plan, seed, { scale = 0.5, mark, ...override } = {}) {
  const P = await prepare(plan, seed, override);
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  P.mark = mark && ((key) => mark(key, canvas));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.lineCap = "round";
  const B = sceneBuffer(P, Math.min(1, Math.max(0.5, scale)));
  P.finish = [];
  P.B = B;
  (CONSTRUCTIONS[P.comp.direction] || CONSTRUCTIONS.expressive)(ctx, B, P);
  const second = CONSTRUCTIONS[P.comp.sky];
  if (second && P.comp.sky !== P.comp.direction) {
    const off = document.createElement("canvas");
    off.width = canvas.width;
    off.height = canvas.height;
    const o = off.getContext("2d");
    o.setTransform(scale, 0, 0, scale, 0, 0);
    o.lineCap = "round";
    second(o, B, { ...P, finish: [] });
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = "destination-in";
    o.drawImage(upperMask(B), 0, 0, off.width, off.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
  // the world is built by the construction; the characters stay crisp on top, then weather and the frame finish the piece
  const layer = figureLayer(P, scale);
  if (layer) ctx.drawImage(layer, 0, 0, W, H);
  for (const fn of P.finish) fn();
  canvas.meta = { direction: P.comp.direction, sky: P.comp.sky, layout: P.comp.layout, framing: P.comp.framing, place: plan.setting.place, time: plan.setting.time, pose: plan.people.pose, focus: P.fig?.focus || [P.comp.focusX, P.world.horizon], light: P.world.lights[0] ? [P.world.lights[0].x, P.world.lights[0].y] : [P.comp.lightX, P.world.horizon * 0.5], horizon: P.world.horizon };
  return canvas;
}
