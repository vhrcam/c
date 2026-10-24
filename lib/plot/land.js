import { isolines, length } from "./contours.js";
import { add, mul } from "./math.js";
import { clip, pickBand } from "./world.js";

export function resample(pts, step) {
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2];
    const ay = pts[i - 1];
    const d = Math.hypot(pts[i] - ax, pts[i + 1] - ay);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) out.push(ax + ((pts[i] - ax) * k) / n, ay + ((pts[i + 1] - ay) * k) / n);
  }
  return out;
}

export function dashes(pts, rng, on, off) {
  const p = resample(pts, 4);
  const out = [];
  let run = [];
  let drawing = rng() < 0.85;
  let budget = drawing ? rng.range(...on) : rng.range(...off);
  for (let i = 0; i < p.length; i += 2) {
    if (i > 0) budget -= Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    if (drawing) run.push(p[i], p[i + 1]);
    if (budget <= 0) {
      if (drawing) {
        if (run.length >= 4) out.push(run);
        run = [];
      }
      drawing = !drawing;
      budget = drawing ? rng.range(...on) : rng.range(...off);
    }
  }
  if (drawing && run.length >= 4) out.push(run);
  return out;
}

export function horizonLines(ctx) {
  const { F, pal } = ctx;
  return isolines(F, (i) => (F.code[i] === 8 ? 1 : 0), (i) => F.code[i] < 16, 0.5, { minLength: 8 }).map((l) => ({ pts: l.pts, pen: pal.ink, width: 1.3, layer: "horizon", order: 0 }));
}

function groundPoint(ctx, x, y) {
  const { F, cam } = ctx;
  const idx = F.index(x, y);
  if (F.code[idx] !== 8) return null;
  return { P: add(cam.eye, mul(cam.ray(x, y), F.depth[idx])), depth: F.depth[idx] };
}

function plant(ctx, P, height, lean, steps = 6) {
  const { F, cam } = ctx;
  const pts = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const Q = add(P, add(mul([0, height, 0], t), mul(lean, t * t)));
    const [qx, qy, qz] = cam.project(Q);
    const j = F.index(qx, qy);
    if (F.code[j] >= 16 && F.depth[j] < qz) return null;
    pts.push(qx, qy);
  }
  return pts;
}

export function meadowLines(ctx) {
  const { F, pal, rng, cam, wind, w, h, horizon } = ctx;
  const lines = [];
  const levels = [];
  for (let t = Math.max(0.6, cam.eye[1] * 0.9); t < 420; t *= ctx.furrow) levels.push(Math.log(t));
  isolines(F, (i) => Math.log(F.depth[i]), (i) => F.code[i] === 8, levels, { minLength: 10, smooth: 2, eps: 0.3 }).forEach((runs, k) => {
    const u = k / Math.max(1, levels.length - 1);
    for (const l of runs) {
      for (const d of dashes(l.pts, rng, [40, 260], [5, 40])) lines.push({ pts: d, pen: pickBand(pal.ground, 1 - u, rng, 0.6), width: 0.95 + (1 - u) * 0.4, layer: "ground", order: 1 - u });
    }
  });

  for (let i = 0; i < ctx.grass; i++) {
    const x = rng.range(0, w);
    const y = h - (1 - Math.sqrt(rng())) * (h - horizon) * 0.9;
    const g = groundPoint(ctx, x, y);
    if (!g) continue;
    const height = rng.range(0.05, 0.22) * (rng() < 0.15 ? 1.8 : 1);
    const lean = add(mul(wind, rng.range(0.2, 0.9) * height), [rng.range(-0.16, 0.16) * height, 0, rng.range(-0.16, 0.16) * height]);
    const pts = plant(ctx, g.P, height, lean);
    if (!pts || length(pts) < 2.5) continue;
    const u = Math.min(1, (y - horizon) / (h - horizon));
    lines.push({ pts, pen: pickBand(pal.ground, u * 0.85 + 0.1, rng, 0.9), width: 0.8 + u * 0.5, layer: "grass", order: x / w });
  }

  if (ctx.flowers) {
    const colors = [pal.accent, pal.sun[1], pal.dress[0][0], pal.skin[0]];
    for (let i = 0; i < ctx.flowers; i++) {
      const x = rng.range(0, w);
      const y = h - (1 - Math.sqrt(rng())) * (h - horizon) * 0.75;
      const g = groundPoint(ctx, x, y);
      if (!g) continue;
      const height = rng.range(0.12, 0.3);
      const lean = mul(wind, rng.range(0.1, 0.4) * height);
      const stem = plant(ctx, g.P, height, lean, 5);
      if (!stem) continue;
      const u = Math.min(1, (y - horizon) / (h - horizon));
      const tx = stem[stem.length - 2];
      const ty = stem[stem.length - 1];
      const size = 1.4 + u * 4.2;
      const pen = rng.pick(colors);
      lines.push({ pts: stem, pen: pal.ground[1], width: 0.8 + u * 0.4, layer: "flowers", order: x / w });
      const petals = rng.int(5, 7);
      const spin = rng.range(0, Math.PI);
      for (let p = 0; p < petals; p++) {
        const a = spin + (p / petals) * Math.PI * 2;
        const cx = tx + Math.cos(a) * size;
        const cy = ty + Math.sin(a) * size * 0.75;
        const loop = [];
        for (let q = 0; q <= 10; q++) loop.push(cx + Math.cos((q / 10) * Math.PI * 2) * size * 0.75, cy + Math.sin((q / 10) * Math.PI * 2) * size * 0.55);
        lines.push({ pts: loop, pen, width: 0.8 + u * 0.4, layer: "flowers", order: x / w + p * 0.0001 });
      }
      lines.push({ pts: [tx - size * 0.3, ty, tx + size * 0.3, ty], pen: pal.sun[0], width: 1.2 + u, layer: "flowers", order: x / w + 0.001 });
    }
  }
  return lines;
}

export function shoreLines(ctx) {
  const { F, pal, rng, w, h, horizon, sun, blocked } = ctx;
  const lines = [];
  const shore = ctx.shore;
  const sea = (x, y) => {
    const i = F.index(x, y);
    return F.code[i] === 8 && F.depth[i] > shore && !blocked(x, y);
  };
  let y = horizon + 1.5;
  let shoreY = horizon;
  for (let yy = horizon; yy < h; yy += 2) {
    const i = F.index(w / 2, yy);
    if (F.code[i] === 8 && F.depth[i] < shore) break;
    shoreY = yy;
  }
  const [sx, , R] = sun || [w / 2, 0, 0];
  while (y < Math.min(h, shoreY + 40)) {
    const u = Math.min(1, (y - horizon) / Math.max(20, shoreY - horizon));
    for (let x = rng.range(-30, 0); x < w; ) {
      const glint = sun && Math.abs(x - sx) < R * (0.45 + 1.3 * u);
      const len = (glint ? rng.range(4, 18) : rng.range(10, 70)) * (0.5 + u);
      const pts = [];
      for (let t = 0; t <= len; t += 3) pts.push(x + t, y + Math.sin((t / len) * Math.PI) * -0.8 * (0.4 + u));
      for (const run of clip(pts, sea, 2)) lines.push({ pts: run, pen: glint ? rng.pick(pal.sun) : pickBand(pal.sky, 0.08 + u * 0.75, rng, 0.8), width: glint ? 1.25 : 0.9 + u * 0.4, layer: "sea", order: u + x / w * 0.02 });
      x += len + rng.range(4, 26) * (0.6 + u);
    }
    y += 1.7 + (y - horizon) * 0.055 + rng.range(0, 1.2);
  }
  for (const [lv, pen, width] of [[shore, pal.ink, 1.2], [shore * 0.96, pickBand(pal.sky, 0.3, rng, 0.2), 0.9]]) {
    for (const l of isolines(F, (i) => F.depth[i], (i) => F.code[i] === 8, lv, { minLength: 10, smooth: 3, eps: 0.3 })) {
      const wav = l.pts.map((v, i) => (i % 2 ? v + Math.sin(l.pts[i - 1] * 0.05) * 1.2 : v));
      for (const d of dashes(wav, rng, [60, 300], [3, 18])) lines.push({ pts: d, pen, width, layer: "horizon", order: 0.5 });
    }
  }
  for (let i = 0; i < 2600; i++) {
    const x = rng.range(0, w);
    const y2 = shoreY + 6 + (1 - Math.sqrt(rng())) * (h - shoreY);
    const g = groundPoint(ctx, x, y2);
    if (!g || g.depth > shore * 0.95 || blocked(x, y2)) continue;
    const u = Math.min(1, (y2 - shoreY) / Math.max(1, h - shoreY));
    const s = 0.6 + u * 1.6;
    lines.push({ pts: [x, y2, x + s, y2 + s * 0.2], pen: rng() < 0.7 ? pal.sand : pal.ground[2], width: 0.9 + u * 0.5, layer: "grass", order: x / w });
  }
  return lines;
}
