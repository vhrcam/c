export function streamlines(F, opts) {
  const { inside, dir, spacing, rng, step = 1, minLength = 6, maxLength = 600, test = 0.6, turn = 0.7, seedGap = 1, oriented = false, jump = 0.025 } = opts;
  const w = F.w;
  const h = F.h;
  const cell = Math.max(1, opts.cell || 2);
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid = new Array(gw * gh);
  const d = [0, 0];
  const m = [0, 0];

  const near = (x, y, r, self) => {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor((x - r) / cell));
    const x1 = Math.min(gw - 1, Math.floor((x + r) / cell));
    const y0 = Math.max(0, Math.floor((y - r) / cell));
    const y1 = Math.min(gh - 1, Math.floor((y + r) / cell));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const list = grid[gy * gw + gx];
        if (!list) continue;
        for (let i = 0; i < list.length; i += 3) {
          if (list[i + 2] === self) continue;
          const dx = list[i] - x;
          const dy = list[i + 1] - y;
          if (dx * dx + dy * dy < r2) return true;
        }
      }
    }
    return false;
  };

  const add = (x, y, id) => {
    const k = Math.min(gh - 1, Math.floor(y / cell)) * gw + Math.min(gw - 1, Math.floor(x / cell));
    (grid[k] ||= []).push(x, y, id);
  };

  const trace = (x0, y0, sign, id) => {
    const out = [];
    let x = x0;
    let y = y0;
    let px = 0;
    let py = 0;
    let z = F.depthAt(x, y);
    for (let k = 0; k < maxLength / step; k++) {
      dir(x, y, d);
      if (k === 0) {
        d[0] *= sign;
        d[1] *= sign;
      } else if (d[0] * px + d[1] * py < 0) {
        d[0] = -d[0];
        d[1] = -d[1];
      }
      dir(x + d[0] * step * 0.5, y + d[1] * step * 0.5, m);
      if (m[0] * d[0] + m[1] * d[1] < 0) {
        m[0] = -m[0];
        m[1] = -m[1];
      }
      if (k > 0 && m[0] * px + m[1] * py < turn) break;
      const nx = x + m[0] * step;
      const ny = y + m[1] * step;
      if (nx < 1 || ny < 1 || nx > w - 1 || ny > h - 1 || !inside(nx, ny)) break;
      const sep = spacing(nx, ny);
      if (!(sep > 0)) break;
      if (near(nx, ny, sep * test, id)) break;
      const nz = F.depthAt(nx, ny);
      if (Math.abs(nz - z) > jump + z * 0.01) break;
      out.push(nx, ny);
      x = nx;
      y = ny;
      z = nz;
      px = m[0];
      py = m[1];
    }
    return out;
  };

  const lines = [];
  const queue = [];
  const candidates = opts.seeds ? [...opts.seeds] : [];
  if (!opts.seeds) {
    const g = opts.seedStep || 6;
    for (let y = g / 2; y < h; y += g) for (let x = g / 2; x < w; x += g) candidates.push([x + rng.range(-g / 2, g / 2), y + rng.range(-g / 2, g / 2)]);
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
  }

  const tryLine = (sx, sy) => {
    if (sx < 1 || sy < 1 || sx > w - 1 || sy > h - 1 || !inside(sx, sy)) return;
    const sep = spacing(sx, sy);
    if (!(sep > 0) || near(sx, sy, sep * 0.95, -1)) return;
    const id = lines.length;
    const fwd = trace(sx, sy, 1, id);
    const back = trace(sx, sy, -1, id);
    const pts = [];
    for (let i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
    pts.push(sx, sy, ...fwd);
    let L = 0;
    for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (L < minLength) return;
    if (oriented) {
      dir(sx, sy, d);
      const n = pts.length / 2;
      const tx = pts[(n - 1) * 2] - pts[0];
      const ty = pts[(n - 1) * 2 + 1] - pts[1];
      if (tx * d[0] + ty * d[1] < 0) {
        const r = [];
        for (let i = n - 1; i >= 0; i--) r.push(pts[i * 2], pts[i * 2 + 1]);
        pts.length = 0;
        pts.push(...r);
      }
    }
    for (let i = 0; i < pts.length; i += 2) add(pts[i], pts[i + 1], id);
    lines.push({ pts, seed: [sx, sy], sep });
    const n = pts.length / 2;
    for (let i = 0; i < n; i += Math.max(1, Math.round(seedGap * 4))) {
      const x = pts[i * 2];
      const y = pts[i * 2 + 1];
      const j = Math.min(n - 1, i + 1);
      const k = Math.max(0, i - 1);
      const tx = pts[j * 2] - pts[k * 2];
      const ty = pts[j * 2 + 1] - pts[k * 2 + 1];
      const tl = Math.hypot(tx, ty) || 1;
      const s = spacing(x, y);
      if (!(s > 0)) continue;
      queue.push([x - (ty / tl) * s, y + (tx / tl) * s], [x + (ty / tl) * s, y - (tx / tl) * s]);
    }
  };

  let c = 0;
  while (queue.length || c < candidates.length) {
    if (queue.length) {
      const [x, y] = queue.pop();
      tryLine(x, y);
    } else {
      const [x, y] = candidates[c++];
      tryLine(x, y);
    }
  }
  return lines;
}
