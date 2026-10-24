import { isolines } from "./contours.js";
import { streamlines } from "./hatch.js";
import { clip, noise2, pickBand } from "./world.js";

const reverse = (p) => {
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
};

const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

export function clouds(ctx) {
  const { w, horizon, rng, sun } = ctx;
  const list = [];
  const count = ctx.mood === "flow" ? rng.int(0, 2) : rng.int(2, 5);
  for (let i = 0; i < count * 3 && list.length < count; i++) {
    const cy = rng.range(horizon * 0.14, horizon * 0.78);
    const cx = rng.range(-0.05, 1.05) * w;
    const width = rng.range(170, 520) * (0.6 + 0.6 * (cy / horizon));
    const height = width * rng.range(0.16, 0.3);
    if (sun && Math.hypot(cx - sun[0], cy - sun[1]) < sun[2] + width * 0.45) continue;
    if (list.some((c) => Math.abs(c.cx - cx) < (c.width + width) * 0.45 && Math.abs(c.cy - cy) < 70)) continue;
    if (ctx.figureBox && cx + width * 0.6 > ctx.figureBox[0] - 50 && cx - width * 0.6 < ctx.figureBox[2] + 50 && cy + 40 > ctx.figureBox[1] - 60) continue;
    const n = rng.int(4, 8);
    const puffs = [];
    for (let j = 0; j < n; j++) {
      const t = j / (n - 1);
      const r = height * (0.4 + 0.6 * Math.sin(Math.PI * (0.1 + t * 0.8))) * rng.range(0.7, 1.12);
      puffs.push([cx + (t - 0.5) * width + rng.range(-12, 12), cy - r * rng.range(0.2, 0.5), r]);
    }
    list.push({ cx, cy, width, puffs, base: cy + height * 0.1, k: height * 0.5 });
  }
  return list;
}

export function cloudField(list) {
  return (x, y) => {
    let best = 1e9;
    for (const c of list) {
      if (Math.abs(x - c.cx) > c.width * 0.75 + 40 || y > c.base + 40 || y < c.cy - c.width * 0.6) continue;
      let d = 1e9;
      for (const [px, py, r] of c.puffs) d = smin(d, Math.hypot(x - px, y - py) - r, c.k);
      best = Math.min(best, Math.max(d, y - c.base));
    }
    return best;
  };
}

export function cloudLines(ctx, list) {
  const { pal, rng, blocked, isSky, horizon } = ctx;
  const field = cloudField(list);
  const lines = [];
  for (const c of list) {
    const x0 = Math.floor(c.cx - c.width * 0.75);
    const y0 = Math.floor(c.cy - c.width * 0.6);
    const W = Math.ceil(c.width * 1.5);
    const H = Math.ceil(c.base + 4 - y0);
    const vals = new Float32Array(W * H);
    let deepest = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = field(x0 + x, y0 + y);
        vals[y * W + x] = d;
        deepest = Math.min(deepest, d);
      }
    }
    const gap = rng.range(3.6, 6.5);
    const levels = [];
    for (let l = -1.5; l > deepest + gap * 0.6; l -= gap) levels.push(l);
    const u = Math.min(1, Math.max(0, (horizon - c.cy) / horizon));
    const runs = isolines({ W, H, ss: 1 }, (i) => -vals[i], () => true, levels.map((l) => -l), { minLength: 6, smooth: 2, eps: 0.25 });
    runs.forEach((set, k) => {
      for (const r of set) {
        const pts = r.pts.map((v, i) => v + (i % 2 ? y0 : x0));
        const pen = k === 0 ? pickBand(pal.sky, Math.min(1, u + 0.25), rng, 0.2) : pickBand(pal.sky, Math.max(0, u - 0.15 - k * 0.04), rng, 0.6);
        for (const run of clip(pts, (x, y) => isSky(x, y) && !blocked(x, y))) lines.push({ pts: run, pen, width: k === 0 ? 1.2 : 0.95, layer: "clouds", order: c.cx / ctx.w + k * 0.01 });
      }
    });
  }
  return { lines, field };
}

export function skyLines(ctx, field) {
  const { w, h, horizon, sun, pal, rng, blocked, wind, seed, mood } = ctx;
  const n = noise2(seed);
  const band = noise2(seed + 17);
  const [sx, sy, R] = sun || [w / 2, -1e4, 0];
  const slope = Math.max(-0.12, Math.min(0.12, -wind[0] * 0.08));
  const swirl = mood === "calm" ? 0.5 : 0.95;
  const dir = (x, y, out) => {
    const a = (n(x * 0.0024, y * 0.006) - 0.5) * (mood === "calm" ? 0.5 : 0.9) + slope;
    let vx = Math.cos(a);
    let vy = Math.sin(a);
    if (sun) {
      const dx = x - sx;
      const dy = y - sy;
      const r = Math.hypot(dx, dy) || 1;
      const wgt = Math.exp(-(((r - R * 1.25) / (R * 1.1)) ** 2)) * swirl;
      vx = vx * (1 - wgt) + (-dy / r) * wgt;
      vy = vy * (1 - wgt) + (dx / r) * wgt;
    }
    const l = Math.hypot(vx, vy) || 1;
    out[0] = vx / l;
    out[1] = vy / l;
    return out;
  };
  const top = Math.max(1, horizon);
  const height = (y) => Math.min(1, Math.max(0, (horizon - y) / top));
  const spacing = (x, y) => {
    const u = height(y);
    if (mood === "calm") return u > 0.9 ? 0 : 3.2 + 22 * u ** 1.6;
    if (mood === "bands") return 2.9 + 8 * u ** 1.2;
    return 3.0 + 10.6 * u ** 1.25;
  };
  const inside = (x, y) => {
    if (y > horizon + 2 || !ctx.isSky(x, y) || blocked(x, y)) return false;
    if (sun && Math.hypot(x - sx, y - sy) < R * 1.08) return false;
    if (field && field(x, y) < 5) return false;
    if (mood === "bands" && band(x * 0.0012, y * 0.018) < 0.4) return false;
    return true;
  };
  const shim = { w, h, depthAt: () => 1 };
  const lines = [];
  for (const l of streamlines(shim, { rng, inside, dir, spacing, step: 2, test: 0.7, turn: 0.6, maxLength: 900, minLength: 14, seedStep: 14, cell: 3 })) {
    const u = height(l.seed[1]);
    lines.push({ pts: l.pts, pen: pickBand(pal.sky, u, rng), width: 0.95 + (1 - u) * 0.35, layer: "sky", order: u });
  }
  return lines;
}

export function sunLines(ctx) {
  const { sun, pal, rng, blocked, style } = ctx;
  const [sx, sy, R] = sun;
  const lines = [];
  const ok = (x, y) => !blocked(x, y) && ctx.isSky(x, y);
  const ring = (r, start, pen, width, order, dash = 0) => {
    const n = Math.max(12, Math.ceil(r * 0.9));
    let pts = [];
    for (let i = 0; i <= n; i++) {
      const th = start + (i / n) * Math.PI * 2;
      if (!dash || Math.sin(th * dash + order * 7) > 0.15) pts.push(sx + Math.cos(th) * r, sy + Math.sin(th) * r);
      else if (pts.length) {
        for (const run of clip(pts, ok)) lines.push({ pts: run, pen, width, layer: "sun", order });
        pts = [];
      }
    }
    for (const run of clip(pts, ok)) lines.push({ pts: run, pen, width, layer: "sun", order });
  };
  if (style === "spiral") {
    const gap = rng.range(3.2, 4.4);
    const pts = [];
    const turns = R / gap;
    const n = Math.ceil(turns * 90);
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * turns * Math.PI * 2;
      const r = (th / (Math.PI * 2)) * gap;
      pts.push(sx + Math.cos(th) * r, sy + Math.sin(th) * r);
    }
    for (const run of clip(pts, ok)) lines.push({ pts: run, pen: pal.sun[0], width: 1.15, layer: "sun", order: 0 });
  } else if (style === "stripes") {
    for (let y = sy - R; y < sy + R; ) {
      const u = (y - (sy - R)) / (2 * R);
      const half = Math.sqrt(Math.max(0, R * R - (y - sy) ** 2));
      const pts = [];
      for (let x = sx - half; x <= sx + half; x += 3) pts.push(x, y);
      pts.push(sx + half, y);
      for (const run of clip(pts, ok)) lines.push({ pts: run, pen: u < 0.55 ? pal.sun[1] : pal.sun[0], width: 1.4, layer: "sun", order: u });
      y += 2.6 + u * u * 7;
    }
  } else {
    const gap = rng.range(3.6, 5);
    for (let r = gap * 0.6; r <= R; r += gap) ring(r, rng.range(0, Math.PI * 2), r / R < 0.62 ? pal.sun[1] : pal.sun[0], 1.1, r / R);
  }
  for (let k = 0; k < 3; k++) ring(R * (1.18 + k * 0.16), 0, pal.sun[1], 0.8, 1 + k * 0.1, 5 + k * 2);
  return lines;
}

export function moonLines(ctx) {
  const { sun, pal, rng, blocked } = ctx;
  const [sx, sy, R] = sun;
  const lines = [];
  const ok = (x, y) => !blocked(x, y) && ctx.isSky(x, y);
  const ox = sx + R * rng.range(0.4, 0.65) * (rng.chance(0.5) ? 1 : -1);
  const oy = sy - R * rng.range(0.05, 0.3);
  for (let y = sy - R; y <= sy + R; y += 2.4) {
    let run = [];
    for (let x = sx - R; x <= sx + R; x += 1.5) {
      const inDisk = Math.hypot(x - sx, y - sy) < R - 1.5;
      const shadow = Math.hypot(x - ox, y - oy) < R * 1.02;
      if (inDisk && shadow && ok(x, y)) run.push(x, y);
      else if (run.length) {
        if (run.length >= 4) lines.push({ pts: run, pen: pickBand(pal.sky, 0.75, rng, 0.3), width: 0.9, layer: "sun", order: (y - sy + R) / (2 * R) });
        run = [];
      }
    }
    if (run.length >= 4) lines.push({ pts: run, pen: pickBand(pal.sky, 0.75, rng, 0.3), width: 0.9, layer: "sun", order: (y - sy + R) / (2 * R) });
  }
  const pts = [];
  for (let i = 0; i <= 90; i++) {
    const th = (i / 90) * Math.PI * 2;
    pts.push(sx + Math.cos(th) * R, sy + Math.sin(th) * R);
  }
  for (const run of clip(pts, ok)) lines.push({ pts: run, pen: pal.sun[0], width: 1.3, layer: "sun", order: 1.1 });
  return lines;
}

export function starLines(ctx, field) {
  const { w, horizon, pal, rng, blocked, sun } = ctx;
  const lines = [];
  for (let i = 0; i < 220; i++) {
    const x = rng.range(10, w - 10);
    const y = rng.range(8, horizon - 24) * (rng() < 0.6 ? rng.range(0.05, 0.6) : 1);
    if (blocked(x, y) || !ctx.isSky(x, y) || (sun && Math.hypot(x - sun[0], y - sun[1]) < sun[2] * 1.6) || (field && field(x, y) < 6)) continue;
    const big = rng() < 0.12;
    const s = rng.range(1.4, 3.2) * (big ? 2 : 1);
    const pen = rng() < 0.75 ? pal.sun[1] : pal.sun[0];
    const order = rng();
    lines.push({ pts: [x - s, y, x + s, y], pen, width: big ? 1.2 : 0.95, layer: "stars", order });
    lines.push({ pts: [x, y - s, x, y + s], pen, width: big ? 1.2 : 0.95, layer: "stars", order: order + 0.001 });
    if (big) {
      const d = s * 0.5;
      lines.push({ pts: [x - d, y - d, x + d, y + d], pen, width: 0.8, layer: "stars", order: order + 0.002 });
      lines.push({ pts: [x - d, y + d, x + d, y - d], pen, width: 0.8, layer: "stars", order: order + 0.003 });
    }
  }
  return lines;
}

export function birdLines(ctx) {
  const { w, horizon, pal, rng, blocked, sun } = ctx;
  const lines = [];
  const cx = rng.range(w * 0.15, w * 0.85);
  const cy = rng.range(horizon * 0.18, horizon * 0.55);
  const count = rng.int(3, 7);
  for (let i = 0; i < count; i++) {
    const x = cx + rng.range(-90, 90);
    const y = cy + rng.range(-40, 40);
    if (blocked(x, y) || (sun && Math.hypot(x - sun[0], y - sun[1]) < sun[2] * 1.3)) continue;
    const s = rng.range(5, 10);
    const flap = rng.range(0.2, 0.7);
    const wing = (dir) => {
      const pts = [];
      for (let t = 0; t <= 1.0001; t += 0.125) pts.push(x + dir * s * (1 - t), y - Math.sin((1 - t) * Math.PI) * s * flap + (1 - t) * s * 0.25);
      return pts;
    };
    lines.push({ pts: wing(-1), pen: pal.ink, width: 1.1, layer: "birds", order: i });
    lines.push({ pts: reverse(wing(1)), pen: pal.ink, width: 1.1, layer: "birds", order: i + 0.5 });
  }
  return lines;
}
