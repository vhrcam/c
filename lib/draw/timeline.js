import { clamp } from "./noise.js";

export const PHASES = [
  { id: "block", label: "blocking" },
  { id: "world", label: "ground" },
  { id: "forms", label: "forms" },
  { id: "detail", label: "detail" },
  { id: "air", label: "air" },
];

const measure = (p) => {
  let len = 0;
  for (let i = 2; i < p.length; i += 2) len += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return len;
};

// Give every stroke a moment to start and a time to take, so the piece builds the way it was thought:
// the blocking first, then the world laid outward from the horizon, each body printed from its base up,
// hair and grass grown over it, then weather. Returns the strokes in drawing order.
export function schedule(strokes, G, horizon, rand) {
  const total = clamp(10 + strokes.length / 2600, 12.5, 19);
  const span = (a, b) => [total * a, total * b];
  const WIN = { block: span(0, 0.09), world: span(0.05, 0.46), forms: span(0.36, 0.8), detail: span(0.66, 0.92), air: span(0.86, 1) };
  const SPEED = { block: 220, world: 120, forms: 70, detail: 34, air: 90 };
  const byId = [null, ...G.shapes];

  // bodies take turns, far to near, each in a slot sized by how much there is to draw
  const load = new Map();
  for (const s of strokes) {
    const shape = byId[s.r];
    if (!shape || shape.type === "band" || s.kind === "block") continue;
    load.set(shape.g.id, (load.get(shape.g.id) || 0) + 1);
  }
  const order = [...load.keys()].sort((a, b) => a - b);
  const sum = order.reduce((a, id) => a + Math.sqrt(load.get(id)), 0) || 1;
  const slot = new Map();
  let at = 0;
  for (const id of order) {
    const share = Math.sqrt(load.get(id)) / sum;
    slot.set(id, [Math.max(0, at - share * 0.35), Math.min(1, at + share)]);
    at += share;
  }

  for (const s of strokes) {
    s.len ??= measure(s.p);
    const shape = byId[s.r];
    const y = s.p[1];
    let phase;
    let u;
    if (s.kind === "block") {
      phase = "block";
      u = clamp(s.u ?? rand());
    } else if (s.kind === "dot" || s.kind === "air") {
      phase = "air";
      u = rand();
    } else if (!shape || shape.type === "band") {
      phase = s.kind === "strand" ? "detail" : "world";
      u = s.kind === "strand" ? rand() : clamp((!shape ? (horizon - y) / Math.max(1, horizon) : (y - horizon) / Math.max(1, G.H - horizon)) * 0.85 + rand() * 0.15);
    } else {
      const g = shape.g;
      const [a, b] = slot.get(g.id) || [0, 1];
      const up = clamp((g.y1 - y) / Math.max(0.5, g.y1 - g.y0));
      if (s.kind === "slice") {
        phase = "forms";
        u = a + (b - a) * clamp(up * 0.82 + rand() * 0.1);
      } else if (s.kind === "edge") {
        phase = "forms";
        u = a + (b - a) * clamp(0.86 + rand() * 0.14);
      } else {
        phase = "detail";
        u = clamp(a * 0.6 + (1 - up) * 0.25 + rand() * 0.3);
      }
    }
    const [from, to] = WIN[phase];
    s.dur = clamp(s.len / SPEED[phase], 0.05, phase === "world" ? 1.1 : 0.7);
    s.at = from + u * Math.max(0.01, to - from - s.dur);
    s.phase = phase;
  }
  strokes.sort((p, q) => p.at - q.at);
  return { duration: total + 0.4, phases: PHASES.map((p) => ({ ...p, at: WIN[p.id][0] })) };
}
