import { lerpStops, rgba } from "../color.js";
import { noise } from "../random.js";

export const W = 1500;
export const H = 1000;

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function trace(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

export function curve(ctx, pts, close = true) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  ctx.beginPath();
  const start = close ? mid(pts[n - 1], pts[0]) : pts[0];
  ctx.moveTo(start[0], start[1]);
  for (let i = close ? 0 : 1; i < (close ? n : n - 1); i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  if (close) ctx.closePath();
  else ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
}

export function bounds(pts) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

export function box(pts, pad = 30) {
  const [x0, y0, x1, y1] = bounds(pts);
  return [x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2];
}

export function resample(pts, step = 40) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
}

export function deform(pts, depth, spread, r) {
  let shape = pts.map(([x, y]) => [x, y, r.range(0.4, 1.3)]);
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i];
      const b = shape[(i + 1) % shape.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const v = (a[2] + b[2]) / 2;
      const off = r.gauss() * spread * v * Math.min(1, len / (spread * 3));
      next.push(a, [(a[0] + b[0]) / 2 - (dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off, v * r.range(0.8, 1.15)]);
    }
    shape = next;
    spread *= 0.55;
  }
  return shape;
}

export function blob(x, y, rx, ry, r, wobble = 0.18, n = 16) {
  const phase = r() * 6.28;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + Math.sin(a * 3 + phase) * wobble * 0.5 + r.range(-wobble, wobble) * 0.5;
    return [x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k];
  });
}

export function lengths(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}

export function ribbon(ctx, pts, width, p = 1, taper = [0.12, 0.35], lens = lengths(pts)) {
  const total = lens[lens.length - 1] || 1;
  const stop = total * clamp(p);
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    let [x, y] = pts[i];
    let s = lens[i];
    const last = s >= stop;
    if (last && i > 0) {
      const t = (stop - lens[i - 1]) / (s - lens[i - 1] || 1);
      x = pts[i - 1][0] + (x - pts[i - 1][0]) * t;
      y = pts[i - 1][1] + (y - pts[i - 1][1]) * t;
      s = stop;
    }
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const u = s / total;
    const w = (width / 2) * Math.max(0.08, Math.min(1, u / taper[0], (1 - u) / taper[1]));
    left.push([x - ((b[1] - a[1]) / d) * w, y + ((b[0] - a[0]) / d) * w]);
    right.push([x + ((b[1] - a[1]) / d) * w, y - ((b[0] - a[0]) / d) * w]);
    if (last) break;
  }
  if (left.length < 2) return;
  trace(ctx, [...left, ...right.reverse()]);
  ctx.fill();
}

export function fillStyle(ctx, fill, a = 1) {
  if (typeof fill === "string") return rgba(fill, a);
  const g = fill.r ? ctx.createRadialGradient(fill.x, fill.y, 0, fill.x, fill.y, fill.r) : ctx.createLinearGradient(fill.x0 ?? 0, fill.y0, fill.x1 ?? 0, fill.y1);
  fill.stops.forEach((c, i) => g.addColorStop(fill.at ? fill.at[i] : i / (fill.stops.length - 1), rgba(c, a * (fill.alpha ? fill.alpha[i] : 1))));
  return g;
}

export function sample(fill, x, y) {
  if (typeof fill === "string") return fill;
  let t;
  if (fill.r) t = Math.hypot(x - fill.x, y - fill.y) / fill.r;
  else {
    const dx = (fill.x1 ?? 0) - (fill.x0 ?? 0);
    const dy = fill.y1 - fill.y0;
    t = ((x - (fill.x0 ?? 0)) * dx + (y - fill.y0) * dy) / (dx * dx + dy * dy || 1);
  }
  t = clamp(t);
  if (!fill.at) return lerpStops(fill.stops, t);
  let i = 0;
  while (i < fill.at.length - 2 && t > fill.at[i + 1]) i++;
  const span = fill.at[i + 1] - fill.at[i] || 1;
  return lerpStops([fill.stops[i], fill.stops[i + 1]], (t - fill.at[i]) / span);
}

export const mask = {
  fade: () => (m, p, [x, y, w, h]) => {
    m.globalAlpha = ease(p);
    m.fillRect(x - 5, y - 5, w + 10, h + 10);
    m.globalAlpha = 1;
  },
  sweep: (dir = "right", wave = 40, seed = 1) => {
    const n = noise(seed);
    return (m, p, [x, y, w, h]) => {
      const along = dir === "right" || dir === "left" ? w : h;
      const across = dir === "right" || dir === "left" ? h : w;
      const front = -wave * 2.5 + (along + wave * 5) * ease(p);
      const at = (u, v) => {
        if (dir === "right") return [x + u, y + v];
        if (dir === "left") return [x + w - u, y + v];
        if (dir === "down") return [x + v, y + u];
        return [x + v, y + h - u];
      };
      m.beginPath();
      m.moveTo(...at(-40, -40));
      for (let k = 0; k <= 30; k++) {
        const v = -40 + ((across + 80) * k) / 30;
        m.lineTo(...at(front + (n(k * 0.33 + p * 2, 2) - 0.5) * 2 * wave, v));
      }
      m.lineTo(...at(-40, across + 40));
      m.closePath();
      m.fill();
    };
  },
  bands: (rows = 6, tilt = 0.02, seed = 1) => {
    const n = noise(seed);
    return (m, p, [x, y, w, h]) => {
      const bh = h / rows;
      m.lineCap = "round";
      m.lineJoin = "round";
      m.strokeStyle = "#fff";
      for (let i = 0; i < rows; i++) {
        const q = ease(clamp((p * (rows + 1.4) - i) / 1.4));
        if (!q) continue;
        const yy = y + (i + 0.5) * bh;
        const [x0, x1] = i % 2 ? [x + w + bh, x - bh] : [x - bh, x + w + bh];
        m.lineWidth = bh * (1.7 + (n(i * 3.1) - 0.5) * 0.4);
        m.beginPath();
        for (let k = 0; k <= 24; k++) {
          const u = Math.min(q, k / 24);
          m.lineTo(x0 + (x1 - x0) * u, yy + (n(i * 5 + u * 5, 2) - 0.5) * bh * 0.7 + (u - 0.5) * (x1 - x0) * tilt);
          if (u >= q) break;
        }
        m.stroke();
      }
    };
  },
  radial: (cx, cy, reach, seed = 1) => {
    const n = noise(seed);
    return (m, p) => {
      const rad = reach * ease(p);
      m.beginPath();
      for (let k = 0; k <= 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        const rr = rad * (0.88 + n(k * 0.4, 2) * 0.24);
        m.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      m.fill();
    };
  },
  path: (lines, width) => {
    const all = lines.map((pts) => ({ pts, lens: lengths(pts) }));
    const total = all.reduce((s, l) => s + l.lens[l.lens.length - 1], 0);
    return (m, p) => {
      m.lineWidth = width;
      m.lineCap = "round";
      m.lineJoin = "round";
      m.strokeStyle = "#fff";
      let budget = ease(p) * total;
      for (const { pts, lens } of all) {
        if (budget <= 0) break;
        m.beginPath();
        m.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          if (lens[i] <= budget) m.lineTo(pts[i][0], pts[i][1]);
          else {
            const t = (budget - lens[i - 1]) / (lens[i] - lens[i - 1]);
            m.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t);
            break;
          }
        }
        m.stroke();
        budget -= lens[lens.length - 1];
      }
    };
  },
  dabs: (list, grow = 0.1) => (m, p) => {
    for (const [x, y, rad, t] of list) {
      const q = (p - t * (1 - grow)) / grow;
      if (q <= 0) continue;
      m.beginPath();
      m.arc(x, y, rad * Math.min(1, q), 0, Math.PI * 2);
      m.fill();
    }
  },
};

export const sprite = (area, paint, reveal, extra = {}) => ({ type: "sprite", area, paint, reveal, feather: 7, a: 0, d: 1, ...extra });
export const vector = (draw, a = 0, d = 1, extra = {}) => ({ type: "vector", draw, a, d, ...extra });
