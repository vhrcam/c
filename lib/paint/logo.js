import { random } from "../random.js";

const POINTS = [[505, 34], [442, 18], [355, 16], [263, 32], [171, 74], [92, 145], [45, 231], [26, 316], [39, 400], [87, 473], [171, 531], [289, 560], [434, 555], [592, 526], [776, 492], [987, 452]];
const WIDTHS = [5, 15, 28, 42, 58, 76, 92, 98, 92, 78, 58, 42, 30, 20, 11, 3.5];

export const LOGO_BOX = { x: -30, y: -40, w: 1060, h: 660 };

const smooth = (t) => t * t * (3 - 2 * t);
const ramp = (a, b, x) => smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

let path;

function spline() {
  if (path) return path;
  const pts = [];
  for (let i = 0; i < POINTS.length - 1; i++) {
    const p0 = POINTS[Math.max(0, i - 1)];
    const p1 = POINTS[i];
    const p2 = POINTS[i + 1];
    const p3 = POINTS[Math.min(POINTS.length - 1, i + 2)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24;
      const at = (j) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t * t * t);
      pts.push({ x: at(0), y: at(1), w: WIDTHS[i] + (WIDTHS[i + 1] - WIDTHS[i]) * smooth(t) });
    }
  }
  const [lx, ly] = POINTS[POINTS.length - 1];
  pts.push({ x: lx, y: ly, w: WIDTHS[WIDTHS.length - 1] });
  let total = 0;
  pts.forEach((p, i) => {
    if (i) total += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    p.len = total;
  });
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    p.nx = -(b.y - a.y) / d;
    p.ny = (b.x - a.x) / d;
    p.s = p.len / total;
  });
  path = pts;
  return pts;
}

function dry(s, dryness, phase) {
  if (dryness < 0.68) return false;
  const zone = ramp(0.18, 0.4, s) * (1 - ramp(0.6, 0.78, s)) + ramp(0.72, 1, s) * 0.45;
  const n = Math.sin(s * 23 + phase) * 0.6 + Math.sin(s * 61 + phase * 1.7) * 0.4;
  return n > 1 - zone * 0.95;
}

function ribbon(ctx, run, offset, thick, count) {
  if (run.length < 2) return;
  const edge = (q, side) => {
    const fan = 1 + 1.4 * (1 - ramp(0, 0.06, q.s));
    const c = offset * q.w * 0.5 * fan + side * (q.w / count) * thick * 0.5;
    return [q.x + q.nx * c, q.y + q.ny * c];
  };
  ctx.beginPath();
  run.forEach((q, i) => {
    const [x, y] = edge(q, 1);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  for (let i = run.length - 1; i >= 0; i--) ctx.lineTo(...edge(run[i], -1));
  ctx.closePath();
  ctx.fill();
}

export function drawC(ctx, progress = 1, { seed = 7, bristles = 26, rgb = "26,25,22", alpha = 1 } = {}) {
  const pts = spline();
  const r = random(seed);
  for (let j = 0; j < bristles; j++) {
    const offset = -1 + (2 * (j + 0.5)) / bristles + (r() - 0.5) * (0.7 / bristles);
    const start = r() * 0.03;
    const end = 1 - r() * r() * 0.05;
    const thick = 1.55 + r() * 0.7;
    const ink = (0.8 + r() * 0.2) * alpha;
    const dryness = r();
    const phase = r() * 100;
    const stop = Math.min(end, progress + (r() - 0.5) * 0.014);
    if (stop <= start) continue;
    ctx.fillStyle = `rgba(${rgb},${ink})`;
    let run = [];
    for (const q of pts) {
      if (q.s < start) continue;
      if (q.s > stop) break;
      if (dry(q.s, dryness, phase)) {
        ribbon(ctx, run, offset, thick, bristles);
        run = [];
      } else run.push(q);
    }
    ribbon(ctx, run, offset, thick, bristles);
  }
}

export function outline(weight = 1) {
  const pts = spline();
  const side = (k) => pts.map((q) => [q.x + (k * q.nx * q.w * weight) / 2, q.y + (k * q.ny * q.w * weight) / 2]);
  return [...side(1), ...side(-1).reverse()];
}

export function outlinePath(ring, scale = 1, dx = 0, dy = 0) {
  return "M" + ring.map(([x, y]) => `${(x * scale + dx).toFixed(1)} ${(y * scale + dy).toFixed(1)}`).join("L") + "Z";
}

export function fitPath(weight, size, inner, lift = 0) {
  const ring = outline(weight).filter((_, i, all) => i % 3 === 0 || i === all.length - 1);
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = inner / (x1 - x0);
  return outlinePath(ring, scale, (size - (x1 - x0) * scale) / 2 - x0 * scale, (size - (y1 - y0) * scale) / 2 - y0 * scale + lift);
}

export function svgPaths(progress = 1, options) {
  const paths = [];
  const pt = (x, y) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  let d = "";
  let fill = "";
  const recorder = {
    set fillStyle(value) {
      fill = value;
    },
    beginPath() {
      d = "";
    },
    moveTo(x, y) {
      d += "M" + pt(x, y);
    },
    lineTo(x, y) {
      d += "L" + pt(x, y);
    },
    closePath() {
      d += "Z";
    },
    fill() {
      paths.push({ d, opacity: Number(fill.slice(fill.lastIndexOf(",") + 1, -1)) });
    },
  };
  drawC(recorder, progress, options);
  return paths;
}
