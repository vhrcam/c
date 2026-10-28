import { colonize, isolines } from "./fields";
import { hatch, inset, poisson, ring, voronoi } from "./geometry";

export function clipLine(pts, mask, step = 2) {
  const out = [];
  let cur = [];
  const flush = () => {
    if (cur.length >= 4) out.push(cur);
    cur = [];
  };
  for (let k = 0; k < pts.length - 2; k += 2) {
    const ax = pts[k];
    const ay = pts[k + 1];
    const bx = pts[k + 2];
    const by = pts[k + 3];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let i = k ? 1 : 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n;
      const y = ay + ((by - ay) * i) / n;
      if (mask(x, y)) cur.push(x, y);
      else flush();
    }
  }
  flush();
  return out;
}

const draw = (c, pts, style) => {
  for (const p of clipLine(pts, c.mask)) c.add(p, typeof style === "function" ? style(p[0], p[1]) : style);
};

const time = (c, x, y) => c.t[0] + (c.t[1] - c.t[0]) * Math.min(1, Math.max(0, c.order ? c.order(x, y) : (x - c.box[0]) / (c.box[2] - c.box[0] || 1)));

export function cells(c, { size = 26, spacing = [2.2, 5.5], empty = 0.25, outline = 0.5 } = {}) {
  const [x0, y0, x1, y1] = c.box;
  const pts = poisson(c.rand, { w: x1 - x0, h: y1 - y0, radius: (x, y) => size * (0.5 + 0.9 * (1 - c.warm(x + x0, y + y0))), tries: 9000 }).map(([x, y]) => [x + x0, y + y0]);
  if (pts.length < 3) return;
  const polys = voronoi(pts, [x0, y0, x1, y1]);
  polys.forEach((poly, i) => {
    if (poly.length < 3) return;
    const [cx, cy] = pts[i];
    const w = c.warm(cx, cy);
    const pen = c.pen(cx, cy);
    const t0 = time(c, cx, cy);
    const shape = inset(poly, 1.6);
    if (c.rand() < outline) draw(c, ring(shape), { pen, width: 0.8, alpha: 0.7, t0, dur: 0.6 });
    if (c.rand() < empty * (1 - w)) return;
    const angle = (Math.floor((c.n(cx / 140, cy / 140, 3) + 1) * 2.5) * Math.PI) / 4;
    const gap = spacing[1] - (spacing[1] - spacing[0]) * w;
    for (const s of hatch(shape, angle, gap)) draw(c, s, { pen, width: 0.9, alpha: 0.85, t0: t0 + 0.3, dur: 0.4 });
  });
}

export function strata(c, { gap = 6, grow = 0, keep = 0.55, wobble = 1.2, scale = 90 } = {}) {
  const [x0, y0, x1, y1] = c.box;
  let k = 0;
  for (let y = y0 + gap / 2; y < y1; y += gap + grow * k++) {
    let run = [];
    const flush = () => {
      if (run.length >= 4) draw(c, run, (x, yy) => ({ pen: c.pen(x, yy), width: 1, alpha: 0.85, t0: time(c, x, yy), dur: 0.5 }));
      run = [];
    };
    for (let x = x0; x <= x1; x += 3) {
      const on = (c.n(x / scale, y / 9, 7) + 1) / 2 < keep + c.warm(x, y) * 0.35;
      if (on) run.push(x, y + c.n(x / 160, y / 40, 4) * wobble);
      else flush();
    }
    flush();
  }
}

export function constellation(c, { size = [10, 34], links = 2, reach = 60 } = {}) {
  const [x0, y0, x1, y1] = c.box;
  const pts = poisson(c.rand, { w: x1 - x0, h: y1 - y0, radius: (x, y) => size[0] + (size[1] - size[0]) * (1 - c.warm(x + x0, y + y0)), inside: (x, y) => c.mask(x + x0, y + y0), tries: 12000 }).map(([x, y]) => [x + x0, y + y0]);
  const seen = new Set();
  pts.forEach((p, i) => {
    const t0 = time(c, p[0], p[1]);
    const r = 1.2 + c.warm(p[0], p[1]) * 1.8;
    c.add([p[0] - r, p[1], p[0] + r, p[1]], { pen: c.pen(p[0], p[1]), width: 1, alpha: 0.9, t0, dur: 0.2 });
    c.add([p[0], p[1] - r, p[0], p[1] + r], { pen: c.pen(p[0], p[1]), width: 1, alpha: 0.9, t0, dur: 0.2 });
    const near = pts
      .map((q, j) => [j, Math.hypot(q[0] - p[0], q[1] - p[1])])
      .filter(([j, d]) => j !== i && d < reach)
      .sort((a, b) => a[1] - b[1])
      .slice(0, links);
    for (const [j] of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      draw(c, [p[0], p[1], pts[j][0], pts[j][1]], { pen: c.pen(p[0], p[1]), width: 0.6, alpha: 0.55, t0: t0 + 0.2, dur: 0.5 });
    }
  });
}

export function cracks(c, { count = 260, turn = 0, angle = 0 } = {}) {
  const [x0, y0, x1, y1] = c.box;
  const w = Math.ceil(x1 - x0) + 2;
  const h = Math.ceil(y1 - y0) + 2;
  const hit = new Uint8Array(w * h);
  const mark = (x, y) => {
    const i = Math.round(y - y0) * w + Math.round(x - x0);
    if (i >= 0 && i < hit.length) hit[i] = 1;
  };
  const taken = (x, y) => hit[Math.round(y - y0) * w + Math.round(x - x0)] === 1;
  const trail = [];
  const seeds = [];
  for (let i = 0; i < 3; i++) seeds.push([x0 + c.rand() * (x1 - x0), y0 + c.rand() * (y1 - y0), angle + (c.rand() < 0.5 ? 0 : Math.PI / 2)]);
  for (let made = 0; made < count; made++) {
    let sx;
    let sy;
    let a;
    if (seeds.length) [sx, sy, a] = seeds.pop();
    else {
      if (!trail.length) break;
      const p = trail[Math.floor(c.rand() * trail.length)];
      sx = p[0];
      sy = p[1];
      a = p[2] + (c.rand() < 0.5 ? 1 : -1) * (Math.PI / 2 + (c.rand() - 0.5) * turn);
    }
    if (!c.mask(sx, sy)) continue;
    const pts = [sx, sy];
    let x = sx;
    let y = sy;
    for (let s = 0; s < 900; s++) {
      x += Math.cos(a);
      y += Math.sin(a);
      if (x < x0 || y < y0 || x > x1 || y > y1 || !c.mask(x, y) || (s > 2 && taken(x, y))) break;
      if (s % 4 === 0) pts.push(x, y);
      mark(x, y);
      if (s % 6 === 0) trail.push([x, y, a]);
    }
    pts.push(x, y);
    if (pts.length > 4) c.add(pts, { pen: c.pen(sx, sy), width: 0.9, alpha: 0.85, t0: time(c, sx, sy), dur: Math.min(1.6, pts.length / 60) });
  }
}

export function blocks(c, { depth = 7, gutter = 3 } = {}) {
  const leaf = (r) => {
    const [x0, y0, x1, y1] = r;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const w = c.warm(cx, cy);
    const pen = c.pen(cx, cy);
    const t0 = time(c, cx, cy);
    const poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    const kind = c.rand();
    if (kind < 0.3 - w * 0.2) draw(c, ring(poly), { pen, width: 0.7, alpha: 0.6, t0, dur: 0.5 });
    else if (kind < 0.75) for (const s of hatch(poly, c.rand() < 0.5 ? 0 : Math.PI / 2, 5 - w * 2.8)) draw(c, s, { pen, width: 0.9, alpha: 0.85, t0, dur: 0.35 });
    else {
      for (const s of hatch(poly, 0, 6)) draw(c, s, { pen, width: 0.6, alpha: 0.6, t0, dur: 0.3 });
      for (const s of hatch(poly, Math.PI / 2, 6)) draw(c, s, { pen, width: 0.6, alpha: 0.6, t0: t0 + 0.2, dur: 0.3 });
    }
  };
  const split = (r, d) => {
    const [x0, y0, x1, y1] = r;
    const w = x1 - x0;
    const h = y1 - y0;
    const busy = c.warm((x0 + x1) / 2, (y0 + y1) / 2);
    if (d >= depth || w * h < 900 || (d > 2 && c.rand() > 0.55 + busy * 0.4)) return leaf([x0 + gutter / 2, y0 + gutter / 2, x1 - gutter / 2, y1 - gutter / 2]);
    const t = c.rand.pick([0.33, 0.5, 0.618, 0.67, 0.38]);
    if (w > h * (0.6 + c.rand() * 0.8)) {
      split([x0, y0, x0 + w * t, y1], d + 1);
      split([x0 + w * t, y0, x1, y1], d + 1);
    } else {
      split([x0, y0, x1, y0 + h * t], d + 1);
      split([x0, y0 + h * t, x1, y1], d + 1);
    }
  };
  split(c.box, 0);
}

export function branches(c, { roots = 6, from = "bottom", reach = 120, step = 5 } = {}) {
  const [x0, y0, x1, y1] = c.box;
  const attractors = [];
  for (let t = 0; t < 4000 && attractors.length < 700; t++) {
    const x = x0 + c.rand() * (x1 - x0);
    const y = y0 + c.rand() * (y1 - y0);
    if (c.mask(x, y) && c.rand() < 0.35 + c.warm(x, y) * 0.65) attractors.push([x, y]);
  }
  const base = Array.from({ length: roots }, (_, i) => {
    const u = (i + 0.5 + (c.rand() - 0.5) * 0.6) / roots;
    if (from === "top") return { x: x0 + u * (x1 - x0), y: y0 + 2, dx: 0, dy: 1 };
    if (from === "left") return { x: x0 + 2, y: y0 + u * (y1 - y0), dx: 1, dy: 0 };
    return { x: x0 + u * (x1 - x0), y: y1 - 2, dx: 0, dy: -1 };
  });
  const paths = colonize({ roots: base, attractors, influence: reach, kill: step * 2.2, step, iterations: 260 });
  const top = Math.max(1, ...paths.map((p) => p.weight));
  for (const p of paths) {
    const w = 0.6 + 4.5 * Math.sqrt(p.weight / top);
    const x = p.pts[p.pts.length - 2];
    const y = p.pts[p.pts.length - 1];
    draw(c, p.pts, { pen: c.pen(x, y), width: w, taper: w > 2, alpha: 0.9, t0: c.t[0] + Math.min(1, p.depth / 120) * (c.t[1] - c.t[0]), dur: 0.5 });
  }
}

export function contours(c, { levels = 26, stretch = 3.2, ridge = 0.6 } = {}) {
  const [x0, y0, x1, y1] = c.box;
  const F = (x, y) => {
    const ax = x + x0;
    const ay = y + y0;
    const r = 1 - Math.abs(c.n(ax / (260 * stretch), ay / 260, 11));
    return (ay - y0) / (y1 - y0 || 1) + (c.n(ax / (300 * stretch), ay / 160, 12) * 0.5 + r * ridge) * 0.35;
  };
  const lv = Array.from({ length: levels }, (_, i) => -0.2 + (i / levels) * 1.6);
  for (const l of isolines(F, { w: x1 - x0, h: y1 - y0, cell: 5, levels: lv })) {
    const pts = l.pts.map((v, i) => v + (i % 2 ? y0 : x0));
    draw(c, pts, (x, y) => ({ pen: c.pen(x, y), width: 1, alpha: 0.85, t0: time(c, x, y), dur: 1.2 }));
  }
}

export function stipple(c, { size = [2.6, 7] } = {}) {
  const [x0, y0, x1, y1] = c.box;
  const pts = poisson(c.rand, { w: x1 - x0, h: y1 - y0, radius: (x, y) => size[0] + (size[1] - size[0]) * (1 - c.warm(x + x0, y + y0)), inside: (x, y) => c.mask(x + x0, y + y0), tries: 40000 });
  for (const [x, y] of pts) {
    const ax = x + x0;
    const ay = y + y0;
    c.add([ax, ay, ax + 0.6, ay + 0.6], { pen: c.pen(ax, ay), width: 1.6, alpha: 0.9, t0: time(c, ax, ay), dur: 0.1 });
  }
}

export function fill(c, { angle = Math.PI / 2.2, gap = 1.5, pen } = {}) {
  const [x0, y0, x1, y1] = c.box;
  for (const s of hatch([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], angle, gap)) draw(c, s, (x, y) => ({ pen: pen || c.pen(x, y), width: 1.1, alpha: 0.95, t0: time(c, x, y), dur: 0.25 }));
}

export const SYSTEMS = { cells, strata, constellation, cracks, blocks, branches, contours, stipple, fill };
