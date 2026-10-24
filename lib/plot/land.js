import { isolines, length } from "./contours.js";
import { add, mul, norm } from "./math.js";
import { clip, hidden, noise2, pickBand } from "./world.js";

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
  const mark = (cx, cy, rx, ry) => ctx.marks.push({ box: [cx - rx, cy - ry, cx + rx, y + 1], inside: (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 < 1 || (Math.abs(px - cx) < 1.5 && py > cy) });
  if (kind === "pine") {
    const tiers = 3;
    for (let t = 0; t < tiers; t++) {
      const top = y - s * (1 - t * 0.28);
      const half = s * (0.16 + t * 0.09);
      add([x - half, top + s * 0.38, x, top, x + half, top + s * 0.38]);
    }
    add([x, y, x, y - s * 0.2]);
    mark(x, y - s * 0.6, s * 0.36, s * 0.5);
    return;
  }
  if (kind === "hedge") {
    add(loop(x, y - s * 0.22, s * 0.5, s * 0.24, 12, 0.18, rng.range(0, 6)));
    add([x - s * 0.35, y - s * 0.14, x + s * 0.35, y - s * 0.14], 0.75);
    mark(x, y - s * 0.22, s * 0.56, s * 0.3);
    return;
  }
  const tall = kind === "poplar";
  const rx = s * (tall ? 0.2 : 0.4);
  const ry = s * (tall ? 0.55 : 0.36);
  const cy = y - s * 0.22 - ry;
  mark(x, cy, rx * 1.15, ry * 1.15);
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

function seen(ctx, P) {
  const { F, cam, blocked, w, h } = ctx;
  const [x, y] = cam.project(P);
  if (x < 0 || y < 0 || x >= w || y >= h || blocked(x, y)) return null;
  const i = F.index(x, y);
  if (F.code[i] >= 16) return null;
  if (F.code[i] === 8 && F.depth[i] < Math.hypot(P[0] - cam.eye[0], P[1] - cam.eye[1], P[2] - cam.eye[2]) * 0.97) return null;
  return [x, y];
}

function fenceLines(ctx, path, lines) {
  const { rng, pal } = ctx;
  const side = rng.chance(0.5) ? 1 : -1;
  const a = rng.range(-5, 5);
  const b = rng.range(-0.5, 0.5);
  const lat = path ? (s) => path.lat(s) + side * (path.half + 0.6) : (s) => a + b * s;
  const at = path ? path.at : makePath(ctx).at;
  const tall = rng.range(0.9, 1.25);
  const rails = rng.pick([[0.4, 0.85], [0.3, 0.62, 0.92], [0.55, 0.95]]);
  const gap = rng.range(1.5, 2.2);
  const posts = [];
  for (let s = rng.range(3.5, 6); s < 36; s += gap) posts.push(at(s, lat(s)));
  const draw = (A, B, n, width, order) => {
    let run = [];
    const flush = () => {
      if (run.length >= 4) lines.push({ pts: run, pen: pal.ink, width, layer: "props", order });
      run = [];
    };
    for (let t = 0; t <= n; t++) {
      const p = seen(ctx, [A[0] + (B[0] - A[0]) * (t / n), A[1] + (B[1] - A[1]) * (t / n), A[2] + (B[2] - A[2]) * (t / n)]);
      if (p) run.push(...p);
      else flush();
    }
    flush();
  };
  posts.forEach((P, j) => {
    const near = 1 - j / posts.length;
    draw(P, add(P, [0, tall, 0]), 6, 0.9 + near * 0.5, j * 0.01);
    if (j === 0) return;
    for (const r of rails) draw(add(posts[j - 1], [0, r * tall, 0]), add(P, [0, r * tall, 0]), 10, 0.8 + near * 0.3, j * 0.01 + 0.005);
  });
}

export function meadowLines(ctx) {
  const { F, pal, rng, wind, w, h, horizon } = ctx;
  const lines = [];
  ctx.marks ||= [];
  const G = grid(ctx);
  const path = rng.chance(0.4) ? makePath(ctx) : null;
  const rows = groundRows(ctx, G, lines, path);
  if (path) pathLines(ctx, G, path, lines);
  hillContours(ctx, G, lines);
  ridgeLines(ctx, G, lines);
  if (rng.chance(0.75)) treeLine(ctx, G, lines);
  if (rng.chance(path ? 0.55 : 0.3)) fenceLines(ctx, path, lines);
  combedGrass(ctx, rows, lines, path);

  if (ctx.flowers) {
    const colors = [pal.accent, pal.sun[1], pal.dress[0][0], pal.skin[0]];
    const spots = [];
    const every = rng.int(2, 4);
    for (const r of rows) if (r.u > 0.3 && r.k % every === 0) walk(r.pts, rng.range(40, 90) * (1.3 - r.u * 0.5), (x, y) => spots.push([x, y]), rng.range(5, 40));
    for (let i = 0; i < Math.min(ctx.flowers, spots.length); i++) {
      const [x, y] = spots.splice(rng.int(0, spots.length - 1), 1)[0];
      const g = groundPoint(ctx, x, y);
      if (!g || (path && Math.abs(path.side(g.P[0], g.P[2])) < path.half + 0.2)) continue;
      const height = rng.range(0.12, 0.3);
      const lean = mul(wind, rng.range(0.1, 0.4) * height);
      const stem = plant(ctx, g.P, height, lean, 5);
      if (!stem) continue;
      const u = Math.min(1, (y - horizon) / (h - horizon));
      const tx = stem[stem.length - 2];
      const ty = stem[stem.length - 1];
      if (ctx.blocked(tx, ty)) continue;
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

function island(ctx, lines) {
  const { rng, w, horizon, pal, blocked, figureBox } = ctx;
  const width = rng.range(70, 260);
  const left = figureBox ? figureBox[0] : w / 2;
  const right = figureBox ? w - figureBox[2] : w / 2;
  const room = Math.max(left, right);
  if (room < width + 60) return;
  const x0 = left >= right ? rng.range(20, left - width - 40) : rng.range(w - right + 40, w - width - 20);
  const height = width * rng.range(0.07, 0.2);
  const humps = Array.from({ length: rng.int(1, 3) }, () => [rng.range(0.2, 0.8), rng.range(0.12, 0.3), rng.range(0.5, 1)]);
  const top = (t) => {
    if (t <= 0 || t >= 1) return 0;
    let v = 0;
    for (const [c, sd, a] of humps) v = Math.max(v, a * Math.exp(-(((t - c) / sd) ** 2)));
    return v * height * Math.min(1, t * 6, (1 - t) * 6);
  };
  const T = (x) => (x - x0) / width;
  ctx.marks.push({ box: [x0, horizon - height - 2, x0 + width, horizon + 1], inside: (x, y) => y > horizon - top(T(x)) - 1.5 });
  const ok = (x, y) => !blocked(x, y);
  const put = (pts, pen, width, layer = "far") => {
    for (const run of clip(pts, ok, 2)) lines.push({ pts: run, pen, width, layer, order: x0 / w });
  };
  const outline = [];
  for (let x = x0; x <= x0 + width; x += 2) outline.push(x, horizon - top(T(x)));
  put(outline, pal.ink, 1.1);
  const shade = pickBand(pal.ground, 0.3, rng, 0.3);
  for (let y = horizon - 2.2; y > horizon - height; y -= 2.6) {
    let run = [];
    for (let x = x0; x <= x0 + width; x += 1.5) {
      if (horizon - top(T(x)) < y - 1) run.push(x, y);
      else if (run.length) {
        put(run, shade, 0.75);
        run = [];
      }
    }
    if (run.length) put(run, shade, 0.75);
  }
  for (let j = 1; j <= 4; j++) {
    const yy = horizon + 1.5 + j * 1.9;
    for (let x = x0 + width * (0.08 + j * 0.07); x < x0 + width * (0.92 - j * 0.07); x += rng.range(8, 20)) put([x, yy, x + rng.range(4, 12), yy], shade, 0.7, "sea");
  }
  if (!rng.chance(0.45)) return;
  let lt = 0.5;
  for (let t = 0.1; t < 0.9; t += 0.02) if (top(t) > top(lt)) lt = t;
  const bx = x0 + lt * width;
  const by = horizon - top(lt) + 1;
  const H = rng.range(18, 34);
  const bw = H * 0.12;
  const tw = H * 0.075;
  ctx.marks.push({ box: [bx - bw - 2, by - H * 1.35, bx + bw + 2, by], inside: () => true });
  put([bx - bw, by, bx - tw, by - H, bx + tw, by - H, bx + bw, by], pal.ink, 1.1);
  for (const f of [0.3, 0.62]) {
    const half = bw + (tw - bw) * f;
    put([bx - half, by - H * f, bx + half, by - H * f], pal.ink, 0.9);
    put([bx - half, by - H * (f + 0.12), bx + half, by - H * (f + 0.12)], pal.ink, 0.9);
  }
  put([bx - tw * 0.8, by - H, bx - tw * 0.8, by - H * 1.16, bx + tw * 0.8, by - H * 1.16, bx + tw * 0.8, by - H], pal.ink, 0.9);
  put([bx - tw * 1.2, by - H * 1.16, bx, by - H * 1.32, bx + tw * 1.2, by - H * 1.16], pal.ink, 1);
  if (pal.time === "night") {
    for (const d of [-1, 1]) put([bx + d * tw, by - H * 1.08, bx + d * rng.range(90, 170), by - H * 1.08 + rng.range(-4, 10)], pal.sun[1], 0.9);
  }
}

function boat(ctx, lines, shoreY) {
  const { rng, w, horizon, pal, blocked } = ctx;
  const y = horizon + rng.range(0.15, 0.6) * (shoreY - horizon);
  const s = 5 + (y - horizon) * 0.3;
  const x = rng.range(0.08, 0.92) * w;
  if (blocked(x, y) || blocked(x, y - s * 1.6) || hidden(ctx, x, y - s)) return;
  ctx.marks.push({ box: [x - s * 1.1, y - s * 1.7, x + s * 1.1, y + s * 0.25], inside: () => true });
  const put = (pts, width) => lines.push({ pts, pen: pal.ink, width, layer: "far", order: x / w });
  put([x - s, y - s * 0.12, x - s * 0.6, y + s * 0.2, x + s * 0.6, y + s * 0.2, x + s, y - s * 0.12, x - s, y - s * 0.12], 1);
  put([x, y - s * 0.12, x, y - s * 1.6], 0.9);
  put([x + 1, y - s * 1.5, x + s * 0.85, y - s * 0.3, x + 1, y - s * 0.3], 0.9);
  if (rng.chance(0.6)) put([x - 1, y - s * 1.25, x - s * 0.6, y - s * 0.3, x - 1, y - s * 0.3], 0.9);
}

export function shoreLines(ctx) {
  const { F, pal, rng, w, h, horizon, sun, blocked } = ctx;
  const lines = [];
  const shore = ctx.shore;
  ctx.marks ||= [];
  const raw = [];
  for (let x = 0; x <= w; x += 3) {
    let ys = -1;
    let prev = -1;
    for (let y = Math.max(0, Math.ceil(horizon)); y < h; y += 1) {
      const i = F.index(x, y);
      if (F.code[i] !== 8) {
        prev = -1;
        continue;
      }
      if (F.depth[i] <= shore) {
        ys = prev > 0 ? y - 1 + (prev - shore) / (prev - F.depth[i]) : y;
        break;
      }
      prev = F.depth[i];
    }
    raw.push(ys);
  }
  const edge = raw.map((v, j) => {
    if (v < 0) return v;
    let sum = 0;
    let n = 0;
    for (let d = -3; d <= 3; d++) {
      if (raw[j + d] < 0 || raw[j + d] === undefined) continue;
      sum += raw[j + d];
      n++;
    }
    return sum / n;
  });
  const shoreAt = (x) => edge[Math.max(0, Math.min(edge.length - 1, Math.round(x / 3)))];
  const valid = edge.filter((v) => v >= 0).sort((a, b) => a - b);
  const shoreY = valid.length ? valid[valid.length >> 1] : h;
  if (rng.chance(0.55)) island(ctx, lines);
  if (rng.chance(0.3)) boat(ctx, lines, shoreY);
  const n = noise2(ctx.seed + 5);
  const [sx, , R] = sun || [w / 2, 0, 0];
  const night = pal.time === "night";
  const q = rng.range(1.07, 1.1);
  const gap = rng.range(2.2, 3);
  const thresh = rng.range(0.42, 0.55);
  const scale = rng.range(6, 12);
  const curl = rng.range(0.3, 0.7);
  const most = rng.range(7, 11);
  let k = 0;
  for (let dy = gap; horizon + dy < h; dy += Math.min(most, Math.max(gap, dy * (q - 1))), k++) {
    const y = horizon + dy;
    const u = Math.min(1, dy / Math.max(1, h - horizon));
    const seaPen = pickBand(pal.sky, 0.08 + u * 0.75, rng, 0.2);
    const sandPen = rng.chance(0.7) ? pal.sand : pal.ground[2];
    let run = [];
    let kind = null;
    const flush = () => {
      if (run.length >= 4 && length(run) > 3) {
        const glint = kind === "glint";
        lines.push({ pts: run, pen: glint ? pal.sun[k % 2] : kind === "sea" ? seaPen : sandPen, width: glint ? 1.25 : kind === "sea" ? 0.85 + u * 0.45 : 0.8 + u * 0.4, layer: kind === "sand" ? "grass" : "sea", order: u });
        if (kind === "sea" && u > 0.3 && rng() < curl) {
          const ex = run[run.length - 2];
          const r = 1.5 + u * 4;
          const hook = [];
          for (let a = 0; a <= 1.0001; a += 0.2) hook.push(ex + Math.sin(a * Math.PI * 1.2) * r * 0.9, y - (1 - Math.cos(a * Math.PI * 1.2)) * r * 0.55);
          lines.push({ pts: hook, pen: seaPen, width: 0.8 + u * 0.3, layer: "sea", order: u + 0.001 });
        }
      }
      run = [];
      kind = null;
    };
    for (let x = 0; x <= w; x += 3) {
      const sy = shoreAt(x);
      const sea = sy < 0 || y < sy - 2;
      const wet = !sea && y < sy + 14 + u * 10;
      if (blocked(x, y) || hidden(ctx, x, y) || wet || (!sea && k % 2)) {
        flush();
        continue;
      }
      const p = ((x - w / 2) / dy) * scale;
      const glint = sea && sun && !night && Math.abs(x - sx) < R * (0.45 + 1.3 * u);
      const want = sea ? (glint ? "glint" : "sea") : "sand";
      const on = want === "glint" ? n(p * 0.6, k * 0.9) > 0.45 : want === "sea" ? n(p * 0.08 + k * 0.37, k * 0.21) > thresh - u * 0.22 : n(p * 0.05, k * 0.5) > 0.3;
      if (!on || (kind && kind !== want)) flush();
      if (!on) continue;
      kind = want;
      run.push(x, want === "sand" ? y + Math.sin(p * 0.5 + k) * (0.6 + u * 1.6) : y);
    }
    flush();
  }
  const foam = [[0, pal.ink, 1.3, 0], [2.2, pickBand(pal.sky, 0.2, rng, 0.2), 0.9, 0.18], [6, pickBand(pal.sky, 0.4, rng, 0.2), 0.75, 0.09]];
  for (const [off, pen, width, freq] of foam) {
    const pts = [];
    for (let x = 0; x <= w; x += 3) {
      const sy = shoreAt(x);
      if (sy < 0) continue;
      pts.push(x, sy + off + (freq ? Math.abs(Math.sin(x * freq)) * (1 + off * 0.3) : 0));
    }
    for (const run of clip(pts, (x, y) => !blocked(x, y) && !hidden(ctx, x, y), 6)) lines.push({ pts: run, pen, width, layer: "horizon", order: 0.5 + off * 0.01 });
  }
  for (let j = 1; j <= 4; j++) {
    const pen = j % 2 ? pickBand(pal.sky, 0.15, rng, 0.3) : pal.sun[1];
    for (let x = rng.range(0, 20); x < w; x += rng.range(12, 34)) {
      const sy = shoreAt(x);
      if (sy < 0) continue;
      const yy = sy + 6 + j * 3.2;
      const len = rng.range(5, 16);
      for (const run of clip([x, yy, x + len * 0.5, yy, x + len, yy], (px, py) => !blocked(px, py), 3)) lines.push({ pts: run, pen, width: 0.8, layer: "sea", order: 0.9 });
    }
  }
  return lines;
}
