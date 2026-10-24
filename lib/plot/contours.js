const CASES = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  null,
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[0, 2]],
  null,
  [[1, 2]],
  [[1, 3]],
  [[0, 1]],
  [[3, 0]],
  [],
];

export function chaikin(pts, closed, rounds = 2) {
  let p = pts;
  for (let r = 0; r < rounds; r++) {
    const n = p.length / 2;
    if (n < 3) return p;
    const out = [];
    if (!closed) out.push(p[0], p[1]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 2];
      const ay = p[i * 2 + 1];
      const bx = p[j * 2];
      const by = p[j * 2 + 1];
      out.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75);
    }
    if (!closed) out.push(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
    p = out;
  }
  return p;
}

function corners(p, closed, k = 4, limit = 0.8) {
  const n = p.length / 2;
  const found = [];
  if (n < 2 * k + 2) return found;
  const ang = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = i - k;
    let b = i + k;
    if (closed) {
      a = (a + n) % n;
      b %= n;
    } else if (a < 0 || b >= n) continue;
    const ax = p[i * 2] - p[a * 2];
    const ay = p[i * 2 + 1] - p[a * 2 + 1];
    const bx = p[b * 2] - p[i * 2];
    const by = p[b * 2 + 1] - p[i * 2 + 1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la > 1e-6 && lb > 1e-6) ang[i] = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
  }
  for (let i = 0; i < n; i++) {
    if (ang[i] < limit) continue;
    let peak = true;
    for (let j = 1; j <= k && peak; j++) {
      const l = closed ? (i - j + n) % n : i - j;
      const r = closed ? (i + j) % n : i + j;
      if ((l >= 0 && ang[l] > ang[i]) || (r < n && ang[r] >= ang[i])) peak = false;
    }
    if (peak) found.push(i);
  }
  return found;
}

export function sharpen(pts, closed, rounds = 2) {
  const n = pts.length / 2;
  const cs = corners(pts, closed);
  if (!cs.length) return chaikin(pts, closed, rounds);
  const piece = (a, b) => {
    const out = [pts[a * 2], pts[a * 2 + 1]];
    for (let i = (a + 1) % n; ; i = (i + 1) % n) {
      out.push(pts[i * 2], pts[i * 2 + 1]);
      if (i === b) break;
    }
    return out;
  };
  const stops = closed ? [...cs, cs[0]] : [0, ...cs.filter((i) => i > 0 && i < n - 1), n - 1];
  const out = [];
  for (let j = 0; j < stops.length - 1; j++) {
    const sm = chaikin(piece(stops[j], stops[j + 1]), false, rounds);
    out.push(...(j === 0 ? sm : sm.slice(2)));
  }
  if (closed) out.length -= 2;
  return out;
}

export function simplify(pts, eps) {
  const n = pts.length / 2;
  if (n < 3) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a * 2];
    const ay = pts[a * 2 + 1];
    const dx = pts[b * 2] - ax;
    const dy = pts[b * 2 + 1] - ay;
    const L = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i * 2] - ax) * dy - (pts[i * 2 + 1] - ay) * dx) / L;
      if (d > best) [best, at] = [d, i];
    }
    if (best > eps) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

export function length(pts) {
  let s = 0;
  for (let i = 2; i < pts.length; i += 2) s += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return s;
}

export function outlines(F, { iso = 0.2, figure = (c) => c >= 16, minLength = 4 } = {}) {
  const { W, H, ss, code, depth } = F;
  const nd = F.raw.a;
  const points = new Map();
  const segA = [];
  const segB = [];
  const v = [0, 0, 0, 0];
  const id = [0, 0, 0, 0];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const c0 = y * W + x;
      const cs = [c0, c0 + 1, c0 + W + 1, c0 + W];
      let zmin = Infinity;
      for (const i of cs) if (figure(code[i]) && depth[i] < zmin) zmin = depth[i];
      if (zmin === Infinity) continue;
      const limit = zmin + Math.max(0.012, zmin * 0.012);
      let mask = 0;
      for (let k = 0; k < 4; k++) {
        const i = cs[k];
        v[k] = figure(code[i]) && depth[i] <= limit ? nd[i * 4] / 255 : 0;
        if (v[k] > iso) mask |= 1 << k;
      }
      if (mask === 0 || mask === 15) continue;
      id[0] = (y * W + x) * 2;
      id[1] = (y * W + x + 1) * 2 + 1;
      id[2] = ((y + 1) * W + x) * 2;
      id[3] = (y * W + x) * 2 + 1;
      const cross = (e) => {
        if (points.has(id[e])) return;
        const [p, q, px, py, qx, qy] = e === 0 ? [0, 1, x, y, x + 1, y] : e === 1 ? [1, 2, x + 1, y, x + 1, y + 1] : e === 2 ? [3, 2, x, y + 1, x + 1, y + 1] : [0, 3, x, y, x, y + 1];
        const t = Math.min(1, Math.max(0, (iso - v[p]) / (v[q] - v[p] || 1e-9)));
        points.set(id[e], [(px + (qx - px) * t + 0.5) / ss, (py + (qy - py) * t + 0.5) / ss]);
      };
      let pairs = CASES[mask];
      if (!pairs) {
        const center = (v[0] + v[1] + v[2] + v[3]) / 4 > iso;
        pairs = mask === 5 ? (center ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]) : center ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
      }
      for (const [e1, e2] of pairs) {
        cross(e1);
        cross(e2);
        segA.push(id[e1]);
        segB.push(id[e2]);
      }
    }
  }

  return chain(points, segA, segB, { minLength, smooth: 2, eps: 0.15, keep: true });
}

export function classify(F, line, figure = (c) => c >= 16) {
  const p = line.pts;
  const n = p.length / 2;
  let outer = 0;
  let overlap = 0;
  let total = 0;
  const codes = new Map();
  for (let i = 1; i < n; i += Math.max(1, Math.floor(n / 12))) {
    const dx = p[i * 2] - p[i * 2 - 2];
    const dy = p[i * 2 + 1] - p[i * 2 - 1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    const x = p[i * 2];
    const y = p[i * 2 + 1];
    const a = F.index(x + nx * 2, y + ny * 2);
    const b = F.index(x - nx * 2, y - ny * 2);
    const ca = F.code[a];
    const cb = F.code[b];
    total++;
    if (!figure(ca) || !figure(cb)) outer++;
    else if (Math.abs(F.depth[a] - F.depth[b]) > 0.03) overlap++;
    const front = !figure(cb) || (figure(ca) && F.depth[a] < F.depth[b]) ? ca : cb;
    codes.set(front, (codes.get(front) || 0) + 1);
  }
  const code = [...codes.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0;
  const kind = outer / total > 0.4 ? "outer" : overlap / total > 0.4 ? "overlap" : "inner";
  return { kind, code };
}

export function isolines(F, value, valid, levels, { minLength = 4, smooth = 2, eps = 0.2 } = {}) {
  const { W, H, ss } = F;
  const list = Array.isArray(levels) ? levels : [levels];
  const vals = new Float32Array(W * H);
  const ok = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    ok[i] = valid(i) ? 1 : 0;
    if (ok[i]) vals[i] = value(i);
  }
  const per = list.map(() => ({ points: new Map(), segA: [], segB: [] }));
  const v = [0, 0, 0, 0];
  const id = [0, 0, 0, 0];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const c0 = y * W + x;
      if (!ok[c0] || !ok[c0 + 1] || !ok[c0 + W] || !ok[c0 + W + 1]) continue;
      v[0] = vals[c0];
      v[1] = vals[c0 + 1];
      v[2] = vals[c0 + W + 1];
      v[3] = vals[c0 + W];
      const lo = Math.min(v[0], v[1], v[2], v[3]);
      const hi = Math.max(v[0], v[1], v[2], v[3]);
      for (let L = 0; L < list.length; L++) {
        const iso = list[L];
        if (iso <= lo || iso > hi) continue;
        let mask = 0;
        for (let k = 0; k < 4; k++) if (v[k] > iso) mask |= 1 << k;
        if (mask === 0 || mask === 15) continue;
        const { points, segA, segB } = per[L];
        id[0] = (y * W + x) * 2;
        id[1] = (y * W + x + 1) * 2 + 1;
        id[2] = ((y + 1) * W + x) * 2;
        id[3] = (y * W + x) * 2 + 1;
        const cross = (e) => {
          if (points.has(id[e])) return;
          const [p, q, px, py, qx, qy] = e === 0 ? [0, 1, x, y, x + 1, y] : e === 1 ? [1, 2, x + 1, y, x + 1, y + 1] : e === 2 ? [3, 2, x, y + 1, x + 1, y + 1] : [0, 3, x, y, x, y + 1];
          const t = Math.min(1, Math.max(0, (iso - v[p]) / (v[q] - v[p] || 1e-9)));
          points.set(id[e], [(px + (qx - px) * t + 0.5) / ss, (py + (qy - py) * t + 0.5) / ss]);
        };
        let pairs = CASES[mask];
        if (!pairs) {
          const center = (v[0] + v[1] + v[2] + v[3]) / 4 > iso;
          pairs = mask === 5 ? (center ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]]) : center ? [[3, 0], [1, 2]] : [[0, 1], [2, 3]];
        }
        for (const [e1, e2] of pairs) {
          cross(e1);
          cross(e2);
          segA.push(id[e1]);
          segB.push(id[e2]);
        }
      }
    }
  }
  const out = per.map(({ points, segA, segB }) => chain(points, segA, segB, { minLength, smooth, eps }));
  return Array.isArray(levels) ? out : out[0];
}

function chain(points, segA, segB, { minLength, smooth, eps, keep = false }) {
  const adj = new Map();
  const link = (e, s) => {
    const list = adj.get(e);
    if (list) list.push(s);
    else adj.set(e, [s]);
  };
  for (let s = 0; s < segA.length; s++) {
    link(segA[s], s);
    link(segB[s], s);
  }
  const used = new Uint8Array(segA.length);
  const next = (e) => {
    for (const s of adj.get(e) || []) if (!used[s]) return s;
    return -1;
  };
  const lines = [];
  for (let s0 = 0; s0 < segA.length; s0++) {
    if (used[s0]) continue;
    used[s0] = 1;
    const ids = [segA[s0], segB[s0]];
    for (let e = segB[s0], s = next(e); s >= 0; s = next(e)) {
      used[s] = 1;
      e = segA[s] === e ? segB[s] : segA[s];
      ids.push(e);
    }
    for (let e = segA[s0], s = next(e); s >= 0; s = next(e)) {
      used[s] = 1;
      e = segA[s] === e ? segB[s] : segA[s];
      ids.unshift(e);
    }
    const closed = ids.length > 3 && ids[0] === ids[ids.length - 1];
    const raw = [];
    for (let i = 0; i < ids.length - (closed ? 1 : 0); i++) raw.push(...points.get(ids[i]));
    const pts = simplify(keep ? sharpen(raw, closed, smooth) : chaikin(raw, closed, smooth), eps);
    if (closed) pts.push(pts[0], pts[1]);
    if (length(pts) >= minLength) lines.push({ pts, closed });
  }
  return lines;
}
