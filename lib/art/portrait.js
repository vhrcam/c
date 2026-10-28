import { random } from "../random";
import { noise3 } from "../engine/noise";
import { camera } from "../plot/camera.js";
import { frameShot, pensFor, patternsOf, schedule } from "../plot/compose.js";
import { couple } from "../plot/couple.js";
import { detailLines, halo } from "../plot/details.js";
import { fields } from "../plot/fields.js";
import { faceLines, figureLines, foldLines, toneField } from "../plot/figurelines.js";
import { gbuffer } from "../plot/gbuffer.js";
import { hairLines } from "../plot/hairlines.js";
import { handLines } from "../plot/handlines.js";
import { add, mul, norm } from "../plot/math.js";
import { PALETTES as FIGURE_PALETTES } from "../plot/palettes.js";
import { horizonOf, occupancy } from "../plot/world.js";
import { direct } from "./compose";
import { PALETTES, ramp } from "./palettes";
import { SYSTEMS, clipLine } from "./systems";

const M = [56, 46];

export async function portrait(memory, seed, { width = 1500, height = 1000, ss = 1.5 } = {}) {
  const rng = random(seed);
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const scene = couple(seed);
  const figPal = rng.pick(FIGURE_PALETTES.filter((p) => p.time !== "night"));
  const pal = PALETTES[figPal.name] || PALETTES.editorial;
  const shot = memory.shot || rng.pick(["close", "medium", "wide"]);
  const { view } = frameShot(scene, rng, width, height, shot);
  const cam = camera(view, width, height);
  const horizon = horizonOf(cam);
  const [kx, ky] = cam.project(scene.kiss);

  const R = height * (shot === "close" ? rng.range(0.22, 0.3) : rng.range(0.14, 0.22));
  const behind = rng.chance(0.7);
  const sun = { r: R, x: behind ? kx + rng.range(-0.05, 0.05) * width : rng.pick([0.25, 0.75]) * width, y: 0 };
  sun.y = Math.min(behind ? ky + rng.range(-0.05, 0.08) * height : horizon - R * 0.6, horizon - R * rng.range(0.1, 0.6));
  sun.x = Math.min(width - M[0] - R * 0.6, Math.max(M[0] + R * 0.6, sun.x));
  const keyDir = norm(add(add(mul(cam.fwd, -0.9), mul(cam.right, rng.pick([-0.7, 0.7]))), [0, 0.8, 0]));
  const camG = camera(view, Math.round(width * ss), Math.round(height * ss));
  const g = await gbuffer({ nodes: scene.nodes, cam: camG, W: Math.round(width * ss), H: Math.round(height * ss), key: keyDir, sun: cam.ray(sun.x, sun.y), hills: [0, 0.03, 0, 0], bound: [scene.kiss[0], 0.95, 0, 1.6] });
  const F = fields(g, ss);
  const pens = pensFor(figPal, rng);
  const near = occupancy(F, 7);

  const figure = [
    ...figureLines(F, { pens, rng, tone: toneField(F, 0.9), patterns: patternsOf(scene), avoid: halo([], width, height) }),
    ...faceLines(scene, cam, F, pens),
    ...handLines(scene, cam, F, pens),
    ...detailLines(scene, cam, F, pens, seed),
    ...hairLines(scene, cam, F, pens, figPal, seed),
    ...foldLines(scene, cam, F, pens, rng),
  ];
  schedule(figure, [kx, ky], rng);

  const lines = [...figure];
  const add2 = (pts, o) => {
    if (pts.length < 4) return;
    let len = 0;
    for (let k = 2; k < pts.length; k += 2) len += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    lines.push({ pts, alpha: 0.9, width: 1, layer: "ink", taper: false, ...o, dur: o.dur ?? Math.min(2.4, Math.max(0.3, len / 520)) });
  };

  const inFrame = (x, y) => x > M[0] && x < width - M[0] && y > M[1] && y < height - M[1];
  const sunD = (x, y) => Math.hypot(x - sun.x, y - sun.y);
  const bottom = height - M[1];
  const shore = horizon + (bottom - horizon) * rng.range(0.35, 0.6);
  const sea = rng.chance(0.6);
  const focus = (x, y) => Math.exp(-Math.hypot(x - kx, y - ky) / (height * 0.55));
  const warm = (x, y) => Math.min(1, Math.max(0, Math.exp(-sunD(x, y) / (height * 0.45)) * 0.85, (1 - Math.min(1, Math.abs(horizon - y) / (horizon - M[1] || 1))) ** 1.5 * 0.75, focus(x, y) * 0.5));
  const skyRamp = [pal.cool[1], pal.cool[0], pal.warm[2], pal.warm[1], pal.warm[0]];
  const pensBy = {
    sun: (x, y) => ramp([pal.warm[0], pal.warm[1], pal.warm[2], pal.accent], Math.min(1, Math.max(0, (y - (sun.y - sun.r)) / (sun.r * 1.6)))),
    sky: (x, y) => ramp(skyRamp, warm(x, y)),
    water: (x, y) => ramp([pal.cool[2], pal.cool[0], pal.cool[1]], (y - horizon) / (shore - horizon + 1)),
    land: () => ramp([pal.ink, pal.cool[1], pal.cool[2]], rng() * 0.6),
  };
  const free = (x, y) => inFrame(x, y) && !near(x, y) && F.codeAt(x, y) < 16;
  const masks = {
    sun: (x, y) => free(x, y) && sunD(x, y) < sun.r && y < horizon - 1,
    sky: (x, y) => free(x, y) && y < horizon - 3 && sunD(x, y) > sun.r + 7,
    water: (x, y) => free(x, y) && y > horizon + 3 && y < (sea ? shore : horizon),
    land: (x, y) => free(x, y) && y > (sea ? shore : horizon) + 3,
  };
  const boxes = {
    sun: [sun.x - sun.r, sun.y - sun.r, sun.x + sun.r, Math.min(horizon, sun.y + sun.r)],
    sky: [M[0], M[1], width - M[0], Math.max(M[1] + 1, horizon)],
    water: [M[0], horizon, width - M[0], shore],
    land: [M[0], sea ? shore : horizon, width - M[0], bottom],
  };
  const windows = { sun: [8, 11], sky: [9.5, 15.5], water: [11, 14.5], land: [11.5, 15.5] };
  const orders = {
    sun: (x, y) => (sun.y + sun.r - y) / (sun.r * 2),
    sky: (x, y) => Math.hypot(x - kx, y - ky) / Math.hypot(width, height) * 1.5,
    water: (x, y) => Math.abs(x - kx) / width * 1.5,
    land: (x, y) => Math.abs(x - kx) / width * 1.5,
  };
  const choice = memory.choice || direct(seed);
  for (const key of ["sun", "sky", "water", "land"]) {
    if (key === "water" && !sea) continue;
    if (boxes[key][3] - boxes[key][1] < 8) continue;
    const { system, opts } = choice[key];
    SYSTEMS[system]({ rand: rng, n, warm, pen: pensBy[key], mask: masks[key], box: boxes[key], add: add2, t: windows[key], order: orders[key] }, opts);
  }

  let run = [];
  for (let x = M[0]; x <= width - M[0]; x += 2) {
    const on = (n(x / 34, 0, 40) + 1) / 2 < 0.62 + warm(x, horizon) * 0.3 && free(x, horizon);
    if (on) run.push(x, horizon);
    if ((!on || x + 2 > width - M[0]) && run.length) {
      add2(run, { pen: Math.abs(x - sun.x) < sun.r * 1.3 ? pal.accent : pal.ink, width: 1.2, alpha: 0.9, t0: 8.5 + Math.abs(x - kx) / width * 2, dur: 0.4 });
      run = [];
    }
  }
  if (sea) {
    const depth = shore - horizon;
    for (let y = horizon + 5; y < shore - 4; y += 3 + ((y - horizon) / depth) * 4) {
      const t = (y - horizon) / depth;
      const half = sun.r * (0.9 - t * 0.4) * (0.55 + rng() * 0.45);
      let x = sun.x - half + n(y / 30, 0, 50) * sun.r * 0.2;
      while (x < sun.x + half) {
        const len = 6 + rng() * sun.r * 0.4 * (1 - t);
        for (const p of clipLine([x, y, Math.min(x + len, sun.x + half), y], masks.water)) add2(p, { pen: ramp([pal.warm[0], pal.warm[1], pal.accent], t + rng() * 0.3), width: 1.4 - t * 0.5, alpha: 0.95 - t * 0.3, t0: 11 + t * 3, dur: 0.3 });
        x += len + 3 + rng() * 10 * (0.4 + t);
      }
    }
  }

  const end = Math.max(...lines.map((l) => l.t0 + l.dur)) + 0.5;
  return { lines, pal: { ...figPal, paper: pal.paper }, end, width, height, choice: { ...choice, shot: { system: shot } } };
}
