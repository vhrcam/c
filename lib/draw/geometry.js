const INF = 1e20;

// Catmull-Rom through points of any width (x, y, radius...), open or closed
export function spline(points, closed = false, per = 8) {
  const n = points.length;
  if (n < 3) return points.map((p) => [...p]);
  const at = (i) => (closed ? points[((i % n) + n) % n] : points[Math.min(n - 1, Math.max(0, i))]);
  const out = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(p1.map((_, k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  if (!closed) out.push([...points[n - 1]]);
  return out;
}

// corner cutting: a closed polygon rounds off while staying inside its own outline
export function chaikin(points, rounds = 3) {
  let pts = points;
  for (let r = 0; r < rounds; r++) {
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = next;
  }
  return pts;
}

// round each corner of a closed polygon over a share of its shorter side, so the straight runs between corners stay
export function fillet(points, share, per = 5) {
  const n = points.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = points[(i - 1 + n) % n];
    const v = points[i];
    const q = points[(i + 1) % n];
    const a = Math.hypot(p[0] - v[0], p[1] - v[1]);
    const b = Math.hypot(q[0] - v[0], q[1] - v[1]);
    const r = Math.min(a, b) * share;
    if (r < 0.02) {
      out.push([v[0], v[1]]);
      continue;
    }
    const sx = v[0] + ((p[0] - v[0]) / a) * r;
    const sy = v[1] + ((p[1] - v[1]) / a) * r;
    const ex = v[0] + ((q[0] - v[0]) / b) * r;
    const ey = v[1] + ((q[1] - v[1]) / b) * r;
    for (let k = 0; k <= per; k++) {
      const t = k / per;
      const u = 1 - t;
      out.push([u * u * sx + 2 * u * t * v[0] + t * t * ex, u * u * sy + 2 * u * t * v[1] + t * t * ey]);
    }
  }
  return out;
}

export function ellipse(x, y, rx, ry, tilt = 0, n = 72) {
  const c = Math.cos((tilt * Math.PI) / 180);
  const s = Math.sin((tilt * Math.PI) / 180);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    return [x + px * c - py * s, y + px * s + py * c];
  });
}

// evenly spaced points along a polyline, every component interpolated
export function resample(points, step) {
  if (points.length < 2) return points.map((p) => [...p]);
  const out = [[...points[0]]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) continue;
    let at = step - carry;
    while (at <= len) {
      const t = at / len;
      out.push(a.map((v, k) => v + (b[k] - v) * t));
      at += step;
    }
    carry = len - (at - step);
  }
  const end = points[points.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(end[0] - tail[0], end[1] - tail[1]) > step * 0.25) out.push([...end]);
  return out;
}

export function bounds(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    const r = p.length > 2 ? p[2] : 0;
    if (p[0] - r < x0) x0 = p[0] - r;
    if (p[1] - r < y0) y0 = p[1] - r;
    if (p[0] + r > x1) x1 = p[0] + r;
    if (p[1] + r > y1) y1 = p[1] + r;
  }
  return [x0, y0, x1, y1];
}

export function length(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return sum;
}

// nonzero-winding scanline fill of a polygon given in grid coordinates; hit(i, j) for every node inside
export function fill(poly, x0, y0, x1, y1, hit) {
  const n = poly.length;
  const cross = [];
  for (let j = Math.max(y0, 0); j <= y1; j++) {
    cross.length = 0;
    for (let a = 0; a < n; a++) {
      const p = poly[a];
      const q = poly[(a + 1) % n];
      if (p[1] <= j === q[1] <= j) continue;
      cross.push([p[0] + ((j - p[1]) / (q[1] - p[1])) * (q[0] - p[0]), q[1] > p[1] ? 1 : -1]);
    }
    if (cross.length < 2) continue;
    cross.sort((u, v) => u[0] - v[0]);
    let wind = 0;
    for (let c = 0; c < cross.length - 1; c++) {
      wind += cross[c][1];
      if (!wind) continue;
      const from = Math.max(x0, Math.ceil(cross[c][0]));
      const to = Math.min(x1, Math.floor(cross[c + 1][0]));
      for (let i = from; i <= to; i++) hit(i, j);
    }
  }
}

function edt1d(grid, offset, stride, n, f, v, z) {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset];
  for (let q = 1, k = 0, s = 0; q < n; q++) {
    f[q] = grid[offset + q * stride];
    const q2 = q * q;
    do {
      const r = v[k];
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k] && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const r = v[k];
    grid[offset + q * stride] = f[r] + (q - r) * (q - r);
  }
}

// distance, in cells, from every inside cell of a mask to the nearest outside cell
export function distance(mask, w, h) {
  const grid = new Float64Array(w * h);
  for (let i = 0; i < grid.length; i++) grid[i] = mask[i] ? INF : 0;
  const size = Math.max(w, h);
  const f = new Float64Array(size);
  const v = new Uint32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < w; x++) edt1d(grid, x, w, h, f, v, z);
  for (let y = 0; y < h; y++) edt1d(grid, y * w, 1, w, f, v, z);
  const out = new Float32Array(w * h);
  for (let i = 0; i < grid.length; i++) out[i] = Math.sqrt(grid[i]);
  return out;
}

// local thickness: the radius of the largest disc that fits inside the shape and covers each cell
export function thickness(d, w, h) {
  const R = Float32Array.from(d);
  const ridge = [];
  for (let j = 1; j < h - 1; j++)
    for (let i = 1; i < w - 1; i++) {
      const k = j * w + i;
      const v = d[k];
      if (v < 1.5) continue;
      if ((v >= d[k - 1] && v >= d[k + 1]) || (v >= d[k - w] && v >= d[k + w]) || (v >= d[k - w - 1] && v >= d[k + w + 1]) || (v >= d[k - w + 1] && v >= d[k + w - 1])) ridge.push(k);
    }
  ridge.sort((a, b) => d[b] - d[a]);
  const taken = new Uint8Array(w * h);
  for (const k of ridge) {
    if (taken[k]) continue;
    const v = d[k];
    const ci = k % w;
    const cj = (k - ci) / w;
    const r = Math.ceil(v);
    const near = Math.max(1, v / 4);
    const near2 = near * near;
    const v2 = v * v;
    for (let j = Math.max(0, cj - r); j <= Math.min(h - 1, cj + r); j++) {
      const dy = j - cj;
      for (let i = Math.max(0, ci - r); i <= Math.min(w - 1, ci + r); i++) {
        const dx = i - ci;
        const q = dx * dx + dy * dy;
        if (q > v2) continue;
        const m = j * w + i;
        if (R[m] < v && d[m] > 0) R[m] = v;
        if (q <= near2) taken[m] = 1;
      }
    }
  }
  return R;
}

// principal axis of a set of weighted cells as a unit vector plus the spread along and across it
export function axis(sumX, sumY, sumXX, sumXY, sumYY, count) {
  const mx = sumX / count;
  const my = sumY / count;
  const xx = sumXX / count - mx * mx;
  const xy = sumXY / count - mx * my;
  const yy = sumYY / count - my * my;
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: c, y: s, cx: mx, cy: my, along: Math.sqrt(Math.max(0, xx * c * c + 2 * xy * c * s + yy * s * s)), across: Math.sqrt(Math.max(0, xx * s * s - 2 * xy * c * s + yy * c * c)) };
}
