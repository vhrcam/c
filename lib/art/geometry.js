export function poisson(rand, { w, h, radius, tries = 30000, inside = () => true }) {
  const pts = [];
  const cell = 6;
  const gw = Math.ceil(w / cell);
  const grid = new Map();
  for (let t = 0; t < tries; t++) {
    const x = rand() * w;
    const y = rand() * h;
    if (!inside(x, y)) continue;
    const r = radius(x, y);
    const span = Math.ceil(r / cell);
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    let ok = true;
    for (let j = -span; j <= span && ok; j++)
      for (let i = -span; i <= span && ok; i++) {
        const b = grid.get((cy + j) * gw + cx + i);
        if (b) for (const p of b) if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < r * r) ok = false;
      }
    if (!ok) continue;
    const p = [x, y];
    pts.push(p);
    const key = cy * gw + cx;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }
  return pts;
}

export function nearest(pts, k) {
  return pts.map((p, i) =>
    pts
      .map((q, j) => [j, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, k)
      .map(([j]) => j)
  );
}

export function clip(poly, nx, ny, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = a[0] * nx + a[1] * ny - d;
    const db = b[0] * nx + b[1] * ny - d;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

export function voronoi(pts, rect, k = 14) {
  const near = nearest(pts, k);
  return pts.map((p, i) => {
    let poly = [[rect[0], rect[1]], [rect[2], rect[1]], [rect[2], rect[3]], [rect[0], rect[3]]];
    for (const j of near[i]) {
      const q = pts[j];
      const nx = q[0] - p[0];
      const ny = q[1] - p[1];
      poly = clip(poly, nx, ny, (nx * (p[0] + q[0])) / 2 + (ny * (p[1] + q[1])) / 2);
      if (poly.length < 3) break;
    }
    return poly;
  });
}

export function centroid(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}

export function inset(poly, g) {
  const c = centroid(poly);
  return poly.map((p) => {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.max(0, d - g) / d;
    return [c[0] + dx * k, c[1] + dy * k];
  });
}

export function hatch(poly, angle, spacing) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const proj = poly.map((p) => p[0] * nx + p[1] * ny);
  const lo = Math.min(...proj);
  const hi = Math.max(...proj);
  const segs = [];
  for (let o = lo + spacing / 2; o < hi; o += spacing) {
    const hits = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * ny - o;
      const db = b[0] * nx + b[1] * ny - o;
      if (da * db < 0) {
        const t = da / (da - db);
        hits.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (hits.length >= 2) segs.push([hits[0][0], hits[0][1], hits[1][0], hits[1][1]]);
  }
  return segs;
}

export const ring = (poly) => [...poly.flat(), poly[0][0], poly[0][1]];
