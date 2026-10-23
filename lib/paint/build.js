import { rgba } from "../color.js";
import { hash, noise, random } from "../random.js";
import { H, W, lengths, ribbon, vector } from "./brush.js";
import { extras, light, weather } from "./atmos.js";
import { groundWash, land, layout } from "./land.js";
import { palette } from "./palette.js";
import { people } from "./people.js";
import { skyShapes, skyWash } from "./sky.js";
import { STYLE } from "./styles.js";

export const PHASES = {
  sketch: [0.2, 3, 0.5],
  wash: [2.5, 8, 0.25],
  shapes: [7.3, 14, 0.35],
  details: [13.2, 18, 0.45],
  moment: [17.5, 21.2, 0.2],
  light: [20.6, 23.3, 0.45],
};

const SIGN = { t0: 23.8, dur: 0.95 };
const END = 25.2;

function sketch(kit) {
  const r = kit.rng("sketch");
  const color = kit.pal.mono ? "#6d655c" : "#5a5048";
  const lines = kit.sketch.filter((l) => l.length > 1);
  const strokes = lines.map((line, i) => {
    const pts = line.map(([x, y]) => [x + r.gauss() * 1.1, y + r.gauss() * 1.1]);
    const lens = lengths(pts);
    return vector((ctx, p) => {
      ctx.fillStyle = rgba(color, 0.42);
      ribbon(ctx, pts, 1.5, p, [0.04, 0.1], lens);
    }, (i / lines.length) * 0.7, 0.3);
  });
  return { id: "sketch", phase: "sketch", deps: kit.deps(), strokes, weight: 1 };
}

function schedule(elements) {
  for (const [phase, [start, end, overlap]] of Object.entries(PHASES)) {
    const list = elements.filter((e) => e.phase === phase);
    const total = list.reduce((s, e) => s + e.weight, 0) || 1;
    const span = end - start;
    let done = 0;
    for (const e of list) {
      e.t0 = start + (done / total) * span * (1 - overlap);
      e.len = (e.weight / total) * span * (1 - overlap) + span * overlap;
      done += e.weight;
    }
  }
  return elements.flatMap((e, element) => e.strokes.map((s) => ({ ...s, element, t0: e.t0 + s.a * e.len, dur: Math.max(0.05, s.d * e.len) })));
}

export function build(scene) {
  const style = STYLE[scene.style];
  const pal = palette(scene);
  const base = [scene.style, scene.time, scene.mood, scene.weather, scene.seed, scene.place, scene.people.length > 0];
  const elements = [];
  const kit = {
    scene,
    pal,
    style,
    L: layout(scene, random(hash(`${scene.seed}:layout`))),
    sketch: [],
    rng: (id) => random(hash(`${scene.seed}:${id}`)),
    noise: (id) => noise(hash(`${scene.seed}:${id}`)),
    seed: (id) => hash(`${scene.seed}:${id}:mask`),
    deps: (...keys) => JSON.stringify([...base, ...keys.map((k) => scene[k])]),
    add: (id, phase, deps, strokes, weight = 1) => elements.push({ id, phase, deps, strokes, weight }),
  };

  skyWash(kit);
  groundWash(kit);
  skyShapes(kit);
  land(kit);
  people(kit);
  extras(kit);
  weather(kit);
  light(kit);
  if (style.sketch) elements.unshift(sketch(kit));

  return {
    scene,
    strokes: schedule(elements),
    elements: elements.map((e) => `${e.id}|${e.deps}`),
    soft: Boolean(style.soft),
    pixel: style.pixel || 0,
    rounded: Boolean(style.rounded),
    paper: pal.paper,
    sign: { ...SIGN, seed: scene.seed, x: W - 196, y: H - 136, w: 112, rot: random(hash(`${scene.seed}:sign`)).range(-0.07, 0.03) },
    end: END,
  };
}

export function firstChange(prev, next) {
  if (!prev || prev.scene.style !== next.scene.style) return 0;
  const i = next.elements.findIndex((key, index) => prev.elements[index] !== key);
  if (i < 0 && prev.elements.length === next.elements.length) return -1;
  const element = i < 0 ? next.elements.length : i;
  const at = next.strokes.findIndex((s) => s.element >= element);
  return at < 0 ? next.strokes.length : at;
}
