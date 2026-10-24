import { isolines, length } from "./contours.js";
import { add, mul, norm } from "./math.js";
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

function grid(ctx, cell = 2) {
  const { F, cam, w, h } = ctx;
  const W = Math.ceil(w / cell);
  const H = Math.ceil(h / cell);
  const X = new Float32Array(W * H);
  const Y = new Float32Array(W * H);
  const Z = new Float32Array(W * H);
  const D = new Float32Array(W * H);
  const ok = new Uint8Array(W * H);
  const [ex, ey, ez] = cam.eye;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5) * cell;
      const sy = (y + 0.5) * cell;
      const i = F.index(sx, sy);
      if (F.code[i] !== 8) continue;
      const r = cam.ray(sx, sy);
      const d = F.depth[i];
      const j = y * W + x;
      X[j] = ex + r[0] * d;
      Y[j] = ey + r[1] * d;
      Z[j] = ez + r[2] * d;
      D[j] = d;
      ok[j] = 1;
    }
  }
  return { W, H, ss: 1 / cell, cell, X, Y, Z, D, ok };
}

function walk(pts, step, fn, start = step * 0.5) {
  let left = start;
  for (let i = 2; i < pts.length; i += 2) {
    const ax = pts[i - 2];
    const ay = pts[i - 1];
    const d = Math.hypot(pts[i] - ax, pts[i + 1] - ay);
    let t = 0;
    while (left <= d - t) {
      t += left;
      fn(ax + ((pts[i] - ax) * t) / d, ay + ((pts[i + 1] - ay) * t) / d);
      left = step;
    }
    left -= d - t;
  }
}

function groundRows(ctx, G, lines, path) {
  const { cam, h, horizon, rng, pal, blocked } = ctx;
  const q = rng.range(1.06, 1.11);
  const gap = rng.range(2.4, 3.4);
  const levels = [];
  for (let dy = gap; dy < h - horizon + 40; dy += Math.max(gap, dy * (q - 1))) levels.push(dy);
  const flat = (i) => cam.project([G.X[i], 0, G.Z[i]])[1] - horizon;
  const rows = [];
  isolines(G, flat, (i) => G.ok[i] === 1 && (!path || Math.abs(path.side(G.X[i], G.Z[i])) > path.half), levels, { minLength: 6, smooth: 2, eps: 0.3 }).forEach((set, k) => {
    const u = Math.min(1, levels[k] / Math.max(1, h - horizon));
    const pen = pickBand(pal.ground, 1 - u, rng, 0.15);
    for (const l of set) {
      for (const run of clip(resample(l.pts, 4), (x, y) => !blocked(x, y), 4)) {
        lines.push({ pts: run, pen, width: 0.75 + u * 0.6, layer: "ground", order: 1 - u });
        rows.push({ pts: run, u, k });
      }
    }
  });
  return rows;
}

function hillContours(ctx, G, lines) {
  const { rng, pal, blocked, h, horizon } = ctx;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < G.ok.length; i++) {
    if (!G.ok[i]) continue;
    lo = Math.min(lo, G.Y[i]);
    hi = Math.max(hi, G.Y[i]);
  }
  if (hi < 1.2) return;
  const step = rng.range(0.3, 0.5);
  const levels = [];
  for (let v = 0.8; v < hi; v += step) levels.push(v);
  isolines(G, (i) => G.Y[i], (i) => G.ok[i] === 1, levels, { minLength: 16, smooth: 4, eps: 0.4 }).forEach((set) => {
    for (const l of set) {
      const u = Math.min(1, Math.max(0, (l.pts[1] - horizon) / Math.max(1, h - horizon)));
      for (const run of clip(resample(l.pts, 4), (x, y) => !blocked(x, y), 4)) lines.push({ pts: run, pen: pickBand(pal.ground, 0.7 - u * 0.5, rng, 0.3), width: 0.8 + u * 0.3, layer: "ground", order: 0.2 + u * 0.1 });
    }
  });
}

function ridgeLines(ctx, G, lines) {
  const { pal, blocked } = ctx;
  const { W, H, D, ok, cell } = G;
  const chains = [];
  let open = [];
  for (let x = 0; x < W; x++) {
    const next = [];
    for (let y = 1; y < H; y++) {
      const a = (y - 1) * W + x;
      const b = y * W + x;
      if (!ok[a] || !ok[b] || D[a] < D[b] * 1.2) continue;
      let chain = open.find((c) => Math.abs(c.y - y) <= 2);
      if (chain) open = open.filter((c) => c !== chain);
      else chains.push((chain = { pts: [] }));
      chain.pts.push((x + 0.5) * cell, y * cell);
      chain.y = y;
      next.push(chain);
    }
    open = next;
  }
  for (const c of chains) {
    if (c.pts.length < 10) continue;
    for (const run of clip(c.pts, (x, y) => !blocked(x, y), 8)) lines.push({ pts: run, pen: pal.ground[0], width: 1.2, layer: "horizon", order: 0.3 });
  }
}

function loop(cx, cy, rx, ry, n, bump = 0, phase = 0) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2;
    const r = 1 + bump * Math.abs(Math.sin(a * 3.5 + phase));
    pts.push(cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r);
  }
  return pts;
}

function tree(ctx, lines, x, y, s, kind) {
  const { pal, rng, blocked, F } = ctx;
  const ok = (px, py) => !blocked(px, py) && F.codeAt(px, py) < 16;
  const pen = pickBand(pal.ground, 0.1, rng, 0.35);
  const add = (pts, width = 0.9) => {
    for (const run of clip(pts, ok, 1.5)) lines.push({ pts: run, pen, width, layer: "far", order: x / ctx.w });
  };
  if (kind === "pine") {
    const tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const top = y - s * (1 - t * 0.28);
      const half = s * (0.16 + t * 0.09);
      add([x - half, top + s * 0.38, x, top, x + half, top + s * 0.38]);
    }
    add([x, y, x, y - s * 0.2]);
    return;
  }
  if (kind === "hedge") {
    add(loop(x, y - s * 0.22, s * 0.5, s * 0.24, 12, 0.18, rng.range(0, 6)));
    add([x - s * 0.35, y - s * 0.14, x + s * 0.35, y - s * 0.14], 0.75);
    return;
  }
  const tall = kind === "poplar";
  const rx = s * (tall ? 0.2 : 0.4);
  const ry = s * (tall ? 0.55 : 0.36);
  const cy = y - s * 0.22 - ry;
  add(loop(x, cy, rx, ry, 16, tall ? 0.06 : 0.14, rng.range(0, 6)));
  add([x, y, x, cy + ry * 0.8]);
  for (let j = 1; j <= 2; j++) {
    const yy = cy + ry * (0.15 + j * 0.25);
    const half = rx * Math.sqrt(Math.max(0, 1 - ((yy - cy) / ry) ** 2)) * 0.8;
    add([x - half, yy, x + half, yy], 0.7);
  }
}

function treeLine(ctx, G, lines) {
  const { rng, w } = ctx;
  const top = new Float32Array(G.W).fill(-1);
  for (let x = 0; x < G.W; x++) {
    for (let y = 0; y < G.H; y++) {
      if (!G.ok[y * G.W + x]) continue;
      top[x] = y * G.cell;
      break;
    }
  }
  const kind = rng.pick(["round", "round", "poplar", "pine", "hedge"]);
  const size = rng.range(7, 15);
  for (let r = rng.int(2, 5); r > 0; r--) {
    let x = rng.range(0, w);
    const end = x + rng.range(0.08, 0.3) * w;
    while (x < end) {
      const gx = Math.floor(x / G.cell);
      if (gx >= G.W) break;
      if (top[gx] >= 0) tree(ctx, lines, x, top[gx] + 1, size * rng.range(0.75, 1.25), kind);
      x += size * rng.range(0.55, 1.1) * (kind === "poplar" ? 0.6 : kind === "hedge" ? 0.8 : 1);
    }
  }
}

function combedGrass(ctx, rows, lines, path) {
  const { rng, wind, pal, w } = ctx;
  if (!ctx.grass) return;
  const near = rows.filter((r) => r.u > 0.22);
  const total = near.reduce((s, r) => s + length(r.pts), 0);
  const step = Math.max(6, total / (ctx.grass / 2.5));
  const comb = rng.range(0.4, 0.9);
  for (const r of near) {
    const gap = step * (1.4 - r.u * 0.6);
    walk(r.pts, gap, (x, y) => {
      const g = groundPoint(ctx, x + rng.range(-2, 2), y);
      if (!g || (path && Math.abs(path.side(g.P[0], g.P[2])) < path.half + 0.15)) return;
      for (let b = rng.int(2, 3); b > 0; b--) {
        const height = rng.range(0.05, 0.15) * (1 + r.u * 0.5);
        const lean = add(mul(wind, comb * height), [rng.range(-0.08, 0.08) * height, 0, rng.range(-0.08, 0.08) * height]);
        const pts = plant(ctx, add(g.P, [rng.range(-0.02, 0.02), 0, rng.range(-0.02, 0.02)]), height, lean, 4);
        if (!pts || length(pts) < 2.5) continue;
        lines.push({ pts, pen: pickBand(pal.ground, r.u * 0.85 + 0.1, rng, 0.5), width: 0.8 + r.u * 0.5, layer: "grass", order: x / w });
      }
    }, gap * ((r.k % 2) * 0.5 + rng.range(0.1, 0.3)));
  }
}

function makePath(ctx) {
  const { cam, rng } = ctx;
  const f = norm([cam.fwd[0], 0, cam.fwd[2]]);
  const r = norm([cam.right[0], 0, cam.right[2]]);
  const [ox, , oz] = cam.eye;
  const a = rng.range(-3, 3);
  const b = rng.range(-0.35, 0.35);
  const c = rng.range(0.5, 2.5);
  const om = rng.range(0.05, 0.15);
  const ph = rng.range(0, 6.28);
  const lat = (s) => a + b * s + c * Math.sin(s * om + ph);
  const local = (X, Z) => [(X - ox) * f[0] + (Z - oz) * f[2], (X - ox) * r[0] + (Z - oz) * r[2]];
  const at = (s, u) => [ox + f[0] * s + r[0] * u, 0, oz + f[2] * s + r[2] * u];
  return { lat, at, half: rng.range(0.6, 1.1), side: (X, Z) => {
    const [s, u] = local(X, Z);
    return u - lat(s);
  } };
}

function pathLines(ctx, G, path, lines) {
  const { pal, rng, blocked, h, horizon } = ctx;
  const { half } = path;
  const levels = [-half, half, -half * 0.35, half * 0.35];
  isolines(G, (i) => path.side(G.X[i], G.Z[i]), (i) => G.ok[i] === 1, levels, { minLength: 10, smooth: 2, eps: 0.3 }).forEach((set, k) => {
    for (const l of set) {
      for (const run of clip(resample(l.pts, 4), (x, y) => !blocked(x, y) && (k < 2 || y > horizon + (h - horizon) * 0.25), 6)) {
        const u = Math.min(1, Math.max(0, (run[1] - horizon) / Math.max(1, h - horizon)));
        lines.push({ pts: run, pen: k < 2 ? pal.ground[0] : pickBand(pal.ground, 0.5, rng, 0.3), width: k < 2 ? 1.1 + u * 0.3 : 0.8, layer: "ground", order: k < 2 ? 0.05 : 0.6 });
      }
    }
  });
}



export function meadowLines(ctx) {
  const { F, pal, rng, wind, w, h, horizon } = ctx;
  const lines = [];
  const G = grid(ctx);
  const path = rng.chance(0.4) ? makePath(ctx) : null;
  const rows = groundRows(ctx, G, lines, path);
  if (path) pathLines(ctx, G, path, lines);
  hillContours(ctx, G, lines);
  ridgeLines(ctx, G, lines);
  if (rng.chance(0.75)) treeLine(ctx, G, lines);
  combedGrass(ctx, rows, lines, path);

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
