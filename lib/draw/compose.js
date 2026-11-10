import { random } from "../random.js";
import { rain, snow, stars } from "./air.js";
import { mix } from "./color.js";
import { ground } from "./ground.js";
import { inkwell } from "./inks.js";
import { blocking, edges, slender } from "./marks.js";
import { lerp, noise2 } from "./noise.js";
import { relief } from "./relief.js";
import { slice } from "./slices.js";
import { stage } from "./stage.js";
import { blades, coat, flames, hair } from "./strands.js";
import { schedule } from "./timeline.js";

// A score becomes an artwork: a list of strokes on a sheet of paper. Nothing here knows what a person or a dog is;
// the score says where things are and what they are made of, and every system below works from that alone.
export function compose(score, seed = score.seed, opts = {}) {
  const scene = stage(score, seed);
  const rand = random(seed);
  const n = noise2(seed);
  const G = ground(scene, n, opts.res || 5);
  const well = inkwell(scene, G, rand);
  const windy = scene.weather === "wind" || scene.weather === "storm";
  const style = {
    tilt: rand() < 0.62 ? 0 : (rand() - 0.5) * 0.56,
    kappa: lerp(0.3, 0.44, rand()),
    bow: rand() < 0.78 ? 1 : -1,
    delta: 0.2,
    cap: lerp(2.6, 4.6, rand()),
    lift: lerp(0.8, 1.3, rand()),
    micro: lerp(0.7, 1.25, rand()),
    wind: (rand() < 0.5 ? -1 : 1) * (windy ? lerp(0.6, 1.2, rand()) : lerp(0, 0.3, rand())),
    frame: rand() < 0.5 ? "worn" : "sheet",
  };

  const R = relief(scene, G, well, n, rand, style);
  const strokes = [...stars(G, well, scene, seed), ...slice(G, R.F, R.A, R.regions, { delta: style.delta, seed, sub: R.sub })];

  for (const s of G.shapes) {
    if (!s.seen || s.thin) continue;
    const mat = s.mat;
    if (mat.kind === "hair") strokes.push(...hair(G, s, well, n, seed, scene, style));
    else if (mat.kind === "flame") strokes.push(...flames(G, s, well, n, seed));
    else if (mat.coat === "fur") strokes.push(...coat(G, s, well, n, seed, false));
    else if (mat.coat === "feather") strokes.push(...coat(G, s, well, n, seed, true));
    else if (mat.coat === "grass") strokes.push(...blades(G, s, well, n, seed, style));
  }
  strokes.push(...slender(G, well, seed));
  strokes.push(...edges(G, well, scene, seed));
  strokes.push(...rain(G, well, scene, seed, style), ...snow(G, well, scene, seed));

  strokes.push(...blocking(G, well, well.ink(mix(well.inks[well.key], well.paper, 0.5))));

  const { duration, phases } = schedule(strokes, G, R.horizon, rand);
  return {
    W: scene.W,
    H: scene.H,
    paper: well.paper,
    dark: well.dark,
    inks: well.inks,
    key: well.key,
    strokes,
    duration,
    phases,
    title: scene.title,
    seed,
    meta: { lines: strokes.length, inks: well.inks.length, tilt: Math.round((style.tilt * 180) / Math.PI), frame: style.frame, paper: well.kind, forms: scene.forms.length, zoom: scene.zoom },
  };
}
