import { isolines, length } from "./contours.js";
import { streamlines } from "./hatch.js";
import { add, mul, norm } from "./math.js";

export function noise2(seed) {
  const table = new Float32Array(512);
  let a = seed >>> 0;
  for (let i = 0; i < 512; i++) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    table[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const at = (x, y) => {
    let k = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return table[(k ^ (k >>> 16)) & 511];
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = x - xi;
    const v = y - yi;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    return (at(xi, yi) * (1 - su) + at(xi + 1, yi) * su) * (1 - sv) + (at(xi, yi + 1) * (1 - su) + at(xi + 1, yi + 1) * su) * sv;
  };
}

export function occupancy(F, halo) {
  const w = Math.ceil(F.w);
  const h = Math.ceil(F.h);
  const base = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) base[y * w + x] = F.codeAt(x + 0.5, y + 0.5) >= 16 ? 1 : 0;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    for (let x = 0; x < w; x++) {
      if (base[y * w + x]) last = x;
      if (x - last <= halo) tmp[y * w + x] = 1;
    }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) {
      if (base[y * w + x]) last = x;
      if (last - x <= halo) tmp[y * w + x] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) {
      if (tmp[y * w + x]) last = y;
      if (y - last <= halo) out[y * w + x] = 1;
    }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) {
      if (tmp[y * w + x]) last = y;
      if (last - y <= halo) out[y * w + x] = 1;
    }
  }
  return (x, y) => {
    const xi = x | 0;
    const yi = y | 0;
    return xi < 0 || yi < 0 || xi >= w || yi >= h ? false : out[yi * w + xi] === 1;
  };
}

export function clip(pts, ok, minLength = 3) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length >= 4 && length(run) >= minLength) out.push(run);
    run = [];
  };
  for (let i = 0; i < pts.length; i += 2) {
    if (ok(pts[i], pts[i + 1])) run.push(pts[i], pts[i + 1]);
    else flush();
  }
  flush();
  return out;
}

const pickBand = (colors, u, rng, spread = 0.75) => colors[Math.max(0, Math.min(colors.length - 1, Math.round(u * (colors.length - 1) + rng.range(-spread, spread))))];

export function horizonOf(cam) {
  const f = norm([cam.fwd[0], 0, cam.fwd[2]]);
  return cam.project(add(cam.eye, mul(f, 5000)))[1];
}

export function sunLines(ctx) {
  const { sun, pal, rng, blocked, style } = ctx;
  const [sx, sy, R] = sun;
  const lines = [];
  const ok = (x, y) => !blocked(x, y) && ctx.isSky(x, y);
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
    for (let r = gap * 0.6; r <= R; r += gap) {
      const pts = [];
      const n = Math.max(12, Math.ceil(r * 0.9));
      const start = rng.range(0, Math.PI * 2);
      for (let i = 0; i <= n; i++) {
        const th = start + (i / n) * Math.PI * 2;
        pts.push(sx + Math.cos(th) * r, sy + Math.sin(th) * r);
      }
      for (const run of clip(pts, ok)) lines.push({ pts: run, pen: r / R < 0.62 ? pal.sun[1] : pal.sun[0], width: 1.1, layer: "sun", order: r / R });
    }
  }
  for (let k = 0; k < 3; k++) {
    const r = R * (1.18 + k * 0.16);
    const n = Math.ceil(r * 0.8);
    let pts = [];
    for (let i = 0; i <= n; i++) {
      const th = (i / n) * Math.PI * 2;
      if (Math.sin(th * (5 + k * 2) + k) > 0.15) {
        pts.push(sx + Math.cos(th) * r, sy + Math.sin(th) * r);
      } else if (pts.length) {
        for (const run of clip(pts, ok)) lines.push({ pts: run, pen: pal.sun[1], width: 0.8, layer: "sun", order: 1 + k * 0.1 });
        pts = [];
      }
    }
    for (const run of clip(pts, ok)) lines.push({ pts: run, pen: pal.sun[1], width: 0.8, layer: "sun", order: 1 + k * 0.1 });
  }
  return lines;
}

export function skyLines(ctx) {
  const { w, h, horizon, sun, pal, rng, blocked, wind, seed } = ctx;
  const n = noise2(seed);
  const [sx, sy, R] = sun || [w / 2, -1e4, 0];
  const slope = Math.max(-0.12, Math.min(0.12, -wind[0] * 0.08));
  const dir = (x, y, out) => {
    const a = (n(x * 0.0024, y * 0.006) - 0.5) * 0.9 + slope;
    let vx = Math.cos(a);
    let vy = Math.sin(a);
    if (sun) {
      const dx = x - sx;
      const dy = y - sy;
      const r = Math.hypot(dx, dy) || 1;
      const wgt = Math.exp(-(((r - R * 1.25) / (R * 1.1)) ** 2)) * 0.95;
      vx = vx * (1 - wgt) + (-dy / r) * wgt;
      vy = vy * (1 - wgt) + (dx / r) * wgt;
    }
    const l = Math.hypot(vx, vy) || 1;
    out[0] = vx / l;
    out[1] = vy / l;
    return out;
  };
  const top = Math.max(1, horizon);
  const spacing = (x, y) => {
    const u = Math.min(1, Math.max(0, (horizon - y) / top));
    return 2.6 + 11 * u ** 1.25;
  };
  const inside = (x, y) => y < horizon + 2 && ctx.isSky(x, y) && !blocked(x, y) && (!sun || Math.hypot(x - sx, y - sy) > R * 1.08);
  const shim = { w, h, depthAt: () => 1 };
  const lines = [];
  for (const l of streamlines(shim, { rng, inside, dir, spacing, step: 2, test: 0.7, turn: 0.6, maxLength: 900, minLength: 14, seedStep: 14, cell: 3 })) {
    const u = Math.min(1, Math.max(0, (horizon - l.seed[1]) / top));
    lines.push({ pts: l.pts, pen: pickBand(pal.sky, u, rng), width: 0.95 + (1 - u) * 0.35, layer: "sky", order: u });
  }
  return lines;
}

export function starLines(ctx) {
  const { w, horizon, pal, rng, blocked, sun } = ctx;
  const lines = [];
  for (let i = 0; i < 160; i++) {
    const x = rng.range(10, w - 10);
    const y = rng.range(6, horizon - 20) ** 1 * (rng() < 0.6 ? rng.range(0.1, 0.7) : 1);
    if (blocked(x, y) || !ctx.isSky(x, y) || (sun && Math.hypot(x - sun[0], y - sun[1]) < sun[2] * 1.5)) continue;
    const s = rng.range(1.2, 3.4) * (rng() < 0.1 ? 1.8 : 1);
    const pen = rng() < 0.7 ? pal.sun[1] : pal.sun[0];
    lines.push({ pts: [x - s, y, x + s, y], pen, width: 0.9, layer: "stars", order: rng() });
    lines.push({ pts: [x, y - s, x, y + s], pen, width: 0.9, layer: "stars", order: rng() });
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
      for (let t = 0; t <= 1.0001; t += 0.125) pts.push(x + dir * s * t, y - Math.sin(t * Math.PI) * s * flap + t * s * 0.25);
      return pts;
    };
    lines.push({ pts: reversePts(wing(-1)), pen: pal.ink, width: 1.1, layer: "birds", order: i });
    lines.push({ pts: wing(1), pen: pal.ink, width: 1.1, layer: "birds", order: i + 0.5 });
  }
  return lines;
}

function reversePts(p) {
  const out = [];
  for (let i = p.length - 2; i >= 0; i -= 2) out.push(p[i], p[i + 1]);
  return out;
}

export function groundLines(ctx) {
  const { F, pal, rng, cam, wind, blocked } = ctx;
  const lines = [];
  const ground = (i) => F.code[i] === 8;
  const notFigure = (i) => F.code[i] < 16;
  const horizonRuns = isolines(F, (i) => (F.code[i] === 8 ? 1 : 0), notFigure, 0.5, { minLength: 8 });
  for (const l of horizonRuns) lines.push({ pts: l.pts, pen: pal.ground[0], width: 1.4, layer: "horizon", order: 0 });

  const near = cam.eye[1] * 0.9;
  const levels = [];
  for (let t = Math.max(0.6, near); t < 420; t *= ctx.furrow) levels.push(Math.log(t));
  const logDepth = (i) => Math.log(F.depth[i]);
  levels.forEach((lv, k) => {
    for (const l of isolines(F, logDepth, ground, lv, { minLength: 10, smooth: 2, eps: 0.3 })) {
      const u = k / Math.max(1, levels.length - 1);
      lines.push({ pts: l.pts, pen: pickBand(pal.ground, 1 - u, rng, 0.6), width: 1.0 + (1 - u) * 0.4, layer: "ground", order: u });
    }
  });

  const blades = ctx.grass;
  for (let i = 0; i < blades; i++) {
    const x = rng.range(0, ctx.w);
    const y = ctx.h - (1 - Math.sqrt(rng())) * (ctx.h - ctx.horizon) * 0.9;
    const idx = F.index(x, y);
    if (F.code[idx] !== 8) continue;
    const d = F.depth[idx];
    const P = add(cam.eye, mul(cam.ray(x, y), d));
    const height = rng.range(0.05, 0.22) * (rng() < 0.15 ? 1.8 : 1);
    const lean = add(mul(wind, rng.range(0.2, 0.9) * height), [rng.range(-0.04, 0.04) * height * 4, 0, rng.range(-0.04, 0.04) * height * 4]);
    const pts = [];
    let hidden = false;
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      const Q = add(P, add(mul([0, height, 0], t), mul(lean, t * t)));
      const [qx, qy, qz] = cam.project(Q);
      const j = F.index(qx, qy);
      if (F.code[j] >= 16 && F.depth[j] < qz) {
        hidden = true;
        break;
      }
      if (blocked(qx, qy) && F.code[j] < 16 && s > 0 && F.depth[j] < qz) {
        hidden = true;
        break;
      }
      pts.push(qx, qy);
    }
    if (hidden || pts.length < 6 || length(pts) < 2.5) continue;
    const u = Math.min(1, (y - ctx.horizon) / (ctx.h - ctx.horizon));
    lines.push({ pts, pen: pickBand(pal.ground, u * 0.85 + 0.1, rng, 0.9), width: 0.8 + u * 0.5, layer: "grass", order: x / ctx.w });
  }
  return lines;
}

export function constructionLines(ctx) {
  const { scene, cam, pal, horizon, w, sun } = ctx;
  const lines = [];
  const P = (p) => cam.project(p).slice(0, 2);
  const seg = (a, b, order) => {
    const [ax, ay] = P(a);
    const [bx, by] = P(b);
    lines.push({ pts: [ax, ay, bx, by], pen: pal.pencil, width: 0.7, layer: "construct", order });
  };
  lines.push({ pts: [0, horizon, w, horizon], pen: pal.pencil, width: 0.6, layer: "construct", order: 0 });
  if (sun) {
    const pts = [];
    for (let i = 0; i <= 64; i++) pts.push(sun[0] + Math.cos((i / 64) * Math.PI * 2) * sun[2] * 1.03, sun[1] + Math.sin((i / 64) * Math.PI * 2) * sun[2] * 1.03);
    lines.push({ pts, pen: pal.pencil, width: 0.6, layer: "construct", order: 0.1 });
  }
  scene.people.forEach((sk, i) => {
    const o = 0.2 + i * 0.4;
    const spine = [sk.P0, sk.P1, sk.P2, sk.P3, sk.neckTop, sk.head.o];
    spine.slice(1).forEach((p, j) => seg(spine[j], p, o + j * 0.01));
    for (const A of [sk.arms.L, sk.arms.R]) {
      seg(sk.P2, A.S, o + 0.1);
      seg(A.S, A.elbow, o + 0.12);
      seg(A.elbow, A.wrist, o + 0.14);
    }
    for (const L of [sk.legs.L, sk.legs.R]) {
      seg(sk.P0, L.H, o + 0.2);
      seg(L.H, L.knee, o + 0.22);
      seg(L.knee, L.ankle, o + 0.24);
    }
    const [hx, hy] = P(sk.head.o);
    const r = Math.abs(P(add(sk.head.o, mul(cam.up, 0.1 * sk.hk)))[1] - hy);
    const pts = [];
    for (let k = 0; k <= 40; k++) pts.push(hx + Math.cos((k / 40) * Math.PI * 2) * r * 0.86, hy + Math.sin((k / 40) * Math.PI * 2) * r);
    lines.push({ pts, pen: pal.pencil, width: 0.7, layer: "construct", order: o + 0.3 });
  });
  return lines;
}
