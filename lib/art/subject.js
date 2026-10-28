import { random } from "../random";
import { camera } from "../plot/camera.js";
import { frameShot, pensFor } from "../plot/compose.js";
import { couple } from "../plot/couple.js";
import { fields } from "../plot/fields.js";
import { gbuffer } from "../plot/gbuffer.js";
import { add, mul, norm } from "../plot/math.js";
import { PALETTES as FIGURE_PALETTES } from "../plot/palettes.js";
import { horizonOf } from "../plot/world.js";

export async function stage(seed, { shot, width = 1500, height = 1000, ss = 1.5, key } = {}) {
  const rng = random(seed);
  const scene = couple(seed);
  const figPal = rng.pick(FIGURE_PALETTES.filter((p) => p.time !== "night"));
  const { view, shot: framed } = frameShot(scene, rng, width, height, shot);
  const cam = camera(view, width, height);
  const [kx, ky] = cam.project(scene.kiss);
  const light = key || [kx + rng.range(-0.1, 0.1) * width, ky - height * 0.05];
  const keyDir = norm(add(add(mul(cam.fwd, -0.9), mul(cam.right, rng.pick([-0.7, 0.7]))), [0, 0.8, 0]));
  const W = Math.round(width * ss);
  const H = Math.round(height * ss);
  const g = await gbuffer({ nodes: scene.nodes, cam: camera(view, W, H), W, H, key: keyDir, sun: cam.ray(light[0], light[1]), hills: [0, 0.03, 0, 0], bound: [scene.kiss[0], 0.95, 0, 1.6] });
  const F = fields(g, ss);
  return { rng, scene, figPal, pens: pensFor(figPal, rng), cam, F, kx, ky, light, horizon: horizonOf(cam), width, height, shot: framed, person: (x, y) => F.codeAt(x, y) >> 4, mat: (x, y) => F.codeAt(x, y) & 15 };
}
