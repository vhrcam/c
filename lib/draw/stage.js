import { random } from "../random.js";
import { BACKDROPS, FORMATS, ROLES, TIMES, WEATHER, hex, parseShape } from "./director.js";
import { bounds } from "./geometry.js";
import { clamp, lerp } from "./noise.js";

const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);
const text = (value, max) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const finite = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

// what the server keeps of the director's answer: a small plain object that is safe to store and share
export function cleanScore(raw, words, seed) {
  const format = pick(raw?.format, Object.keys(FORMATS), "wide");
  const [W, H] = FORMATS[format];
  const forms = (Array.isArray(raw?.forms) ? raw.forms : [])
    .slice(0, 40)
    .map((f) => {
      const shapes = (Array.isArray(f?.shapes) ? f.shapes : []).filter((s) => typeof s === "string" && parseShape(s)).slice(0, 48).map((s) => s.slice(0, 400));
      const sc = f?.scatter;
      const scatter = sc && finite(sc.count, 0) >= 1 ? { count: Math.min(80, Math.round(sc.count)), x0: finite(sc.x0, 0), y0: finite(sc.y0, H * 0.5), x1: finite(sc.x1, W), y1: finite(sc.y1, H), far: clamp(finite(sc.far, 0.5), 0.1, 1) } : undefined;
      return { name: text(f?.name, 60) || "form", role: pick(f?.role, ROLES, "support"), shapes, ...(scatter ? { scatter } : {}) };
    })
    .filter((f) => f.shapes.length);
  return {
    v: 2,
    text: text(words, 600),
    seed: seed >>> 0,
    title: text(raw?.title, 48).toLowerCase() || "untitled",
    reading: text(raw?.reading, 220),
    format,
    time: pick(raw?.time, TIMES, "day"),
    weather: pick(raw?.weather, WEATHER, "clear"),
    backdrop: pick(raw?.backdrop, BACKDROPS, "sky"),
    mood: text(raw?.mood, 60),
    energy: clamp(finite(raw?.energy, 0.4)),
    palette: (Array.isArray(raw?.palette) ? raw.palette : []).slice(0, 5).map((c) => hex(c, null)).filter(Boolean),
    light: { x: finite(raw?.light?.x, W * 0.3), y: finite(raw?.light?.y, -H * 0.2), color: hex(raw?.light?.color, "#fff1d6") },
    layout: text(raw?.layout, 500),
    forms,
  };
}

const moved = (s, fn, scale = 1, flip = false) => {
  if (s.type === "blob") {
    const [x, y] = fn(s.x, s.y);
    return { ...s, x, y, rx: s.rx * scale, ry: s.ry * scale, tilt: flip ? -s.tilt : s.tilt };
  }
  return { ...s, pts: s.pts.map((p) => (p.length > 2 ? [...fn(p[0], p[1]), p[2] * scale] : fn(p[0], p[1]))) };
};

const reach = (s) => (s.type === "blob" ? [s.x - Math.max(s.rx, s.ry), s.y - Math.max(s.rx, s.ry), s.x + Math.max(s.rx, s.ry), s.y + Math.max(s.rx, s.ry)] : bounds(s.pts));

function box(shapes) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) {
    if (s.type === "band") continue;
    const r = reach(s);
    b = [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])];
  }
  return Number.isFinite(b[0]) ? b : null;
}

// a score becomes a scene: parsed shapes in drawing order, framed so the focus carries the picture
export function stage(score, seed = score.seed) {
  const rand = random((seed ^ 0x51a9e) >>> 0);
  const [W, H] = FORMATS[score.format] || FORMATS.wide;
  const forms = [];
  let shapes = [];
  let inst = 0;
  for (const f of score.forms) {
    const parsed = f.shapes.map(parseShape).filter(Boolean);
    if (!parsed.length) continue;
    const form = { name: f.name, role: f.role, index: forms.length, parts: parsed.length };
    forms.push(form);
    const solid = parsed.filter((s) => s.type !== "band");
    const b = box(solid);
    const copies = [{ shapes: parsed, base: b ? b[3] : 0, inst: inst++ }];
    if (f.scatter && b) {
      const sc = f.scatter;
      const ax = (b[0] + b[2]) / 2;
      const ay = b[3];
      const span = Math.max(0.001, sc.y1 - sc.y0);
      for (let c = 0; c < sc.count; c++) {
        const x = lerp(sc.x0, sc.x1, rand());
        const y = lerp(sc.y0, sc.y1, rand());
        const k = lerp(sc.far, 1, clamp((y - sc.y0) / span)) * lerp(0.82, 1.15, rand());
        const flip = rand() < 0.5;
        copies.push({ shapes: solid.map((s) => moved(s, (px, py) => [x + (flip ? -1 : 1) * (px - ax) * k, y + (py - ay) * k], k, flip)), base: y, inst: inst++ });
      }
      copies.sort((p, q) => p.base - q.base);
    }
    for (const c of copies) for (const s of c.shapes) shapes.push({ ...s, form: form.index, inst: c.inst, role: form.role });
  }

  let light = { ...score.light };
  const apply = (fn, scale, flip) => {
    shapes = shapes.map((s) => moved(s, fn, scale, flip));
    [light.x, light.y] = fn(light.x, light.y);
  };

  // frame: when the director left the focus small, move the camera in
  const focal = shapes.filter((s) => s.role === "focus" && s.type !== "band");
  const fb = box(focal.length ? focal : shapes.filter((s) => s.role === "support"));
  let zoom = 1;
  if (fb) {
    const fw = (fb[2] - fb[0]) / W;
    const fh = (fb[3] - fb[1]) / H;
    const want = lerp(0.6, 0.72, rand());
    zoom = Math.min(want / Math.max(fh, 0.01), 0.84 / Math.max(fw, 0.01), 2.3);
    if (zoom > 1.1) {
      const cx = (fb[0] + fb[2]) / 2;
      const half = ((fb[2] - fb[0]) * zoom) / 2;
      const tx = clamp(W * (0.5 + (cx / W - 0.5) * 0.75), half + W * 0.06, W - half - W * 0.06);
      const ty = lerp(fb[3], Math.max(fb[3], H * 0.9), clamp(zoom - 1));
      apply((x, y) => [(x - cx) * zoom + tx, (y - fb[3]) * zoom + ty], zoom, false);
    } else zoom = 1;
  }
  const flipped = rand() < 0.5;
  if (flipped) apply((x, y) => [W - x, y], 1, true);
  for (const s of shapes) if (s.type === "band") s.pts.sort((p, q) => p[0] - q[0]);

  return {
    W,
    H,
    seed,
    title: score.title,
    reading: score.reading,
    time: score.time,
    weather: score.weather,
    backdrop: score.backdrop,
    mood: score.mood,
    energy: score.energy,
    palette: score.palette,
    light,
    forms,
    shapes,
    zoom,
    flipped,
    focus: box(shapes.filter((s) => s.role === "focus")) || box(shapes) || [W * 0.3, H * 0.3, W * 0.7, H * 0.7],
  };
}
