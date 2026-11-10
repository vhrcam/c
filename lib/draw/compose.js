import { random } from "../random.js";
import { rain, snow, stars } from "./air.js";
import { mix } from "./color.js";
import { ground } from "./ground.js";
import { inkwell } from "./inks.js";
import { blocking, echoes, edges, slender, threads } from "./marks.js";
import { lerp, noise2 } from "./noise.js";
import { relief } from "./relief.js";
import { slice } from "./slices.js";
import { stage } from "./stage.js";
import { blades, coat, flames, hair } from "./strands.js";
import { schedule } from "./timeline.js";

// Each piece rolls its own way of being made: how the cutting planes lean, how the sky behaves, how heavy the pen is,
// how many inks go on the press, how the sheet is finished and what small accident it keeps.
function temper(scene, rand, forced = {}) {
  const roll = (table) => {
    let t = rand();
    for (const [name, p] of table) if ((t -= p) < 0) return name;
    return table[0][0];
  };
  const wet = scene.weather === "rain" || scene.weather === "storm";
  const windy = scene.weather === "wind" || scene.weather === "storm";
  const lightInSky = scene.backdrop === "sky" && scene.light.x > 0 && scene.light.x < scene.W && scene.light.y > -scene.H * 0.1 && scene.light.y < scene.H * 0.75;
  const side = rand() < 0.5 ? -1 : 1;
  const cut = forced.cut || roll(wet ? [["plumb", 0.3], ["steep", 0.3], ["level", 0.25], ["lean", 0.15]] : [["level", 0.48], ["lean", 0.3], ["steep", 0.15], ["plumb", 0.07]]);
  const tilts = { level: 0, lean: side * lerp(0.05, 0.25, rand()), steep: side * lerp(0.5, 1.05, rand()), plumb: Math.PI / 2 + (rand() - 0.5) * 0.14 };
  let sky = forced.sky || roll([["strata", 0.42], ["drift", 0.22], ["calm", 0.2], ["halo", 0.16]]);
  if (sky === "calm" && scene.weather !== "clear") sky = "strata";
  if (sky === "halo" && !lightInSky) sky = "drift";
  const weight = forced.weight || roll([["mixed", 0.5], ["fine", 0.25], ["bold", 0.25]]);
  return {
    cut,
    tilt: tilts[cut],
    sky,
    pen: weight,
    weight: { mixed: 1, fine: 0.8, bold: 1.3 }[weight],
    delta: { mixed: 0.2, fine: 0.17, bold: 0.25 }[weight],
    ink: forced.ink || roll([["full", 0.56], ["spot", 0.24], ["duo", 0.2]]),
    frame: forced.frame || roll([["worn", 0.45], ["sheet", 0.35], ["ruled", 0.2]]),
    event: forced.event || roll([["none", 0.42], ["threads", 0.36], ["echo", 0.22]]),
    kappa: lerp(0.3, 0.44, rand()),
    bow: rand() < 0.78 ? 1 : -1,
    cap: lerp(2.6, 4.6, rand()),
    lift: lerp(0.8, 1.3, rand()),
    micro: lerp(0.7, 1.25, rand()),
    wind: (rand() < 0.5 ? -1 : 1) * (windy ? lerp(0.6, 1.2, rand()) : lerp(0.05, 0.3, rand())),
  };
}

// A score becomes an artwork: a list of strokes on a sheet of paper. Nothing here knows what a person or a dog is;
// the score says where things are and what they are made of, and every system below works from that alone.
export function compose(score, seed = score.seed, opts = {}) {
  const scene = stage(score, seed);
  const rand = random(seed);
  const n = noise2(seed);
  const G = ground(scene, n, opts.res || 5);
  const style = temper(scene, rand, opts.style);
  const well = inkwell(scene, G, rand, style.ink);

  const R = relief(scene, G, well, n, rand, style);
  const strokes = [...stars(G, well, scene, seed), ...slice(G, R.F, R.A, R.regions, { delta: style.delta, seed, sub: R.sub })];
  if (style.event === "threads") strokes.push(...threads(G, strokes, style.wind, seed));

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
  const contours = edges(G, well, scene, seed);
  strokes.push(...contours);
  if (style.event === "echo") strokes.push(...echoes(G, contours, well, style.wind, seed));
  strokes.push(...rain(G, well, scene, seed, style), ...snow(G, well, scene, seed));
  if (style.frame === "ruled") {
    const { W, H } = scene;
    const m = 1.4;
    strokes.push({ p: Float32Array.of(-m, -m, W + m, -m, W + m, H + m, -m, H + m, -m, -m), w: 0.07, ink: well.key, r: 0, kind: "air" });
  }
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
    meta: { lines: strokes.length, inks: well.inks.length, tilt: Math.round((style.tilt * 180) / Math.PI), cut: style.cut, sky: style.sky, pen: style.pen, press: style.ink, frame: style.frame, event: style.event, paper: well.kind, forms: scene.forms.length, zoom: scene.zoom },
  };
}
