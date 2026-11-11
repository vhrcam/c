import { axis, chaikin, distance, ellipse, fill, fillet, resample, spline, thickness } from "./geometry.js";
import { clamp } from "./noise.js";

const SOFT = new Set(["skin", "hair", "fur", "feather", "cloth", "knit", "leather", "rubber", "food", "water", "snow", "sand", "soil", "grass", "foliage", "petals", "fire", "smoke", "cloud", "light"]);
// substances that grow or pile up have no corners at all; made things keep theirs
const GROWN = new Set(["skin", "hair", "fur", "feather", "scales", "food", "water", "snow", "sand", "soil", "grass", "foliage", "petals", "fire", "smoke", "cloud"]);
const ROUGH = { stone: [0.03, 0.05, 0.008], foliage: [0.028, 0.11, 0.004], grass: [0.006, 0.2, 0.004], snow: [0.008, 0.04, 0], sand: [0.007, 0.03, 0], soil: [0.008, 0.07, 0.003], cloud: [0.02, 0.06, 0.004], smoke: [0.02, 0.06, 0.004] };

// the top edge of a band at every grid column, extended to both sides and roughened to suit what it is made of
function bandEdge(s, W, H, nw, RES, n) {
  let pts = s.pts.map((p) => [p[0], p[1]]);
  if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
  if (pts[pts.length - 1][0] < W) pts.push([W, pts[pts.length - 1][1]]);
  if (SOFT.has(s.material) && pts.length > 2) pts = spline(pts, false, 10);
  const edge = new Float32Array(nw);
  const rough = ROUGH[s.material];
  let at = 0;
  for (let i = 0; i < nw; i++) {
    const x = i / RES;
    while (at < pts.length - 2 && pts[at + 1][0] < x) at++;
    const a = pts[at];
    const b = pts[at + 1];
    const t = clamp((x - a[0]) / Math.max(1e-6, b[0] - a[0]));
    let y = a[1] + (b[1] - a[1]) * t;
    if (rough) {
      const [amp, freq, fine] = rough;
      if (s.material === "foliage") y -= amp * H * (n.domes(x * freq + s.k * 7.3, s.k * 3.1) + 0.5 * n.domes(x * freq * 2.3 + 9, s.k * 5.7) - 0.5);
      else if (s.material === "stone") y += amp * H * (0.5 - n.ridge(x * freq * 0.6 + s.k * 11.1, s.k * 2.7, 4));
      else y += amp * H * n.fbm(x * freq + s.k * 13.7, s.k * 1.9, 3);
      y += fine * H * n(x * 1.9 + s.k * 3.3, s.k * 8.1);
    }
    edge[i] = y;
  }
  return edge;
}

function frame(x0, y0, x1, y1, RES, nw, nh) {
  const i0 = clamp(Math.floor(x0 * RES) - 2, 0, nw - 1);
  const j0 = clamp(Math.floor(y0 * RES) - 2, 0, nh - 1);
  const i1 = clamp(Math.ceil(x1 * RES) + 2, 0, nw - 1);
  const j1 = clamp(Math.ceil(y1 * RES) + 2, 0, nh - 1);
  return { i0, j0, w: i1 - i0 + 1, h: j1 - j0 + 1 };
}

function tube(s, RES, nw, nh) {
  const line = resample(spline(s.pts, false, 10), 0.35);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let rmax = 0;
  for (const [x, y, r] of line) {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
    rmax = Math.max(rmax, r);
  }
  s.line = line;
  s.rmax = rmax;
  // where the tube bends: how far along it, how sharply and to which side
  s.bends = [];
  if (s.pts.length > 2) {
    const at = [0];
    for (let i = 1; i < s.pts.length; i++) at.push(at[i - 1] + Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]));
    const total = at[at.length - 1] || 1;
    for (let i = 1; i < s.pts.length - 1; i++) {
      const ax = s.pts[i][0] - s.pts[i - 1][0];
      const ay = s.pts[i][1] - s.pts[i - 1][1];
      const bx = s.pts[i + 1][0] - s.pts[i][0];
      const by = s.pts[i + 1][1] - s.pts[i][1];
      const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      if (Math.abs(turn) > 0.12) s.bends.push({ u: at[i] / total, turn, r: s.pts[i][2] });
    }
  }
  // anything under about a unit across is too small to cut into lines: it is inked solid as a mark instead
  s.thin = rmax < 0.42;
  if (s.thin) return;
  const box = frame(x0, y0, x1, y1, RES, nw, nh);
  const size = box.w * box.h;
  const d = new Float32Array(size).fill(-1e6);
  const R = new Float32Array(size);
  const u = new Float32Array(size);
  const side = new Float32Array(size);
  const segs = line.length - 1;
  for (let a = 0; a < segs; a++) {
    const [ax, ay, ar] = line[a];
    const [bx, by, br] = line[a + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const pad = Math.max(ar, br);
    const ia = Math.max(box.i0, Math.floor((Math.min(ax, bx) - pad) * RES));
    const ib = Math.min(box.i0 + box.w - 1, Math.ceil((Math.max(ax, bx) + pad) * RES));
    const ja = Math.max(box.j0, Math.floor((Math.min(ay, by) - pad) * RES));
    const jb = Math.min(box.j0 + box.h - 1, Math.ceil((Math.max(ay, by) + pad) * RES));
    for (let j = ja; j <= jb; j++) {
      const py = j / RES - ay;
      for (let i = ia; i <= ib; i++) {
        const px = i / RES - ax;
        const t = clamp((px * dx + py * dy) / len2);
        const qx = px - dx * t;
        const qy = py - dy * t;
        const r = ar + (br - ar) * t;
        const v = r - Math.hypot(qx, qy);
        const m = (j - box.j0) * box.w + (i - box.i0);
        if (v > d[m]) {
          d[m] = v;
          R[m] = r;
          u[m] = (a + t) / segs;
          side[m] = clamp((dx * qy - dy * qx) / (Math.sqrt(len2) * r), -1, 1);
        }
      }
    }
  }
  Object.assign(s, { box, d, R, u, side });
}

// "round" asks for soft corners and soft substances get theirs eased, but a box stays a box: an outline of a few
// points only has its corners turned, while a grown thing or a long outline is smoothed all the way round
function eased(s) {
  const n = s.pts.length;
  const soft = SOFT.has(s.material);
  if (n < 3 || s.wall || (!s.round && !soft)) return s.pts;
  const grown = GROWN.has(s.material);
  if (n > 6 || grown) return chaikin(s.pts, s.round ? (n > 9 ? 2 : 3) : grown && n < 7 ? 2 : 1);
  return fillet(s.pts, s.round ? 0.27 : 0.12);
}

// how far a substance's own growth pushes its outline about (as a share of the shape's size) and how many lumps it has
const RAGGED = { foliage: [0.2, 3.2], cloud: [0.16, 2.2], smoke: [0.18, 2.4], stone: [0.07, 2.6], snow: [0.04, 2], petals: [0.05, 4] };

// A crown of leaves, a cloud or a rock is never the smooth ball it was blocked as: its outline swells in lumps.
function ragged(s, outline, n) {
  const rough = RAGGED[s.material];
  if (!rough || s.wall || outline.length < 3) return outline;
  const [x0, y0, x1, y1] = [Math.min(...outline.map((p) => p[0])), Math.min(...outline.map((p) => p[1])), Math.max(...outline.map((p) => p[0])), Math.max(...outline.map((p) => p[1]))];
  const size = Math.sqrt(Math.max(0.01, (x1 - x0) * (y1 - y0))) / 2;
  if (size < 0.8) return outline;
  const amp = Math.min(3.2, rough[0] * size);
  const freq = rough[1] / (size + 1.5);
  const loop = resample([...outline, outline[0]], Math.max(0.2, size / 40));
  loop.pop();
  const m = loop.length;
  let area = 0;
  for (let i = 0; i < m; i++) area += loop[i][0] * loop[(i + 1) % m][1] - loop[(i + 1) % m][0] * loop[i][1];
  const sign = area > 0 ? 1 : -1;
  const k = s.k * 2.39;
  return loop.map((p, i) => {
    const a = loop[(i - 1 + m) % m];
    const b = loop[(i + 1) % m];
    let ox = (b[1] - a[1]) * sign;
    let oy = -(b[0] - a[0]) * sign;
    const len = Math.hypot(ox, oy) || 1;
    ox /= len;
    oy /= len;
    const lump = s.material === "stone" ? n.ridge(p[0] * freq + k, p[1] * freq - k, 3) * 1.6 - 0.8 : n.domes(p[0] * freq + k, p[1] * freq - k) * 1.3 + n.domes(p[0] * freq * 2.6 - k, p[1] * freq * 2.6 + k) * 0.45 - 0.55;
    return [p[0] + ox * amp * lump, p[1] + oy * amp * lump];
  });
}

function poly(s, RES, nw, nh, n) {
  const outline = ragged(s, s.type === "blob" ? ellipse(s.x, s.y, s.rx, s.ry, s.tilt, Math.max(24, Math.min(120, Math.round((s.rx + s.ry) * 3)))) : eased(s), n);
  s.outline = outline;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  s.thin = Math.min(x1 - x0, y1 - y0) < 1;
  if (s.thin) return;
  const box = frame(x0, y0, x1, y1, RES, nw, nh);
  const mask = new Uint8Array(box.w * box.h);
  const grid = outline.map(([x, y]) => [x * RES, y * RES]);
  fill(grid, box.i0 + 1, box.j0 + 1, box.i0 + box.w - 2, box.j0 + box.h - 2, (i, j) => (mask[(j - box.j0) * box.w + (i - box.i0)] = 1));
  const d = distance(mask, box.w, box.h);
  const R = thickness(d, box.w, box.h);
  for (let m = 0; m < d.length; m++) {
    d[m] = mask[m] ? d[m] / RES : -1e6;
    R[m] /= RES;
  }
  Object.assign(s, { box, d, R });
}

const reachTo = (x, y, a, b) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1e-9));
  return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t);
};

// A mass of hair is often blocked straight over the surface it grows from. Small marks placed on that surface
// (eyes, a mouth, brows) were placed to be seen, so the hair opens around them and they sit on top again.
function unveil(shapes, rid, nw, RES) {
  const marksOf = (s) => {
    if (s.type === "tube") return [s.line[0], s.line[s.line.length >> 1], s.line[s.line.length - 1]];
    let cx = 0;
    let cy = 0;
    for (const p of s.outline) {
      cx += p[0] / s.outline.length;
      cy += p[1] / s.outline.length;
    }
    return [[cx, cy]];
  };
  const holds = (s, p) => inner(s, Math.round(p[0] * RES), Math.round(p[1] * RES)) > 0;
  for (const s of shapes) {
    if (s.type === "band" || s.thin) continue;
    let area = 0;
    for (let m = 0; m < s.d.length; m++) if (s.d[m] > 0) area++;
    s.area = area;
  }
  for (const hair of shapes) {
    if (hair.material !== "hair" || hair.thin || hair.type === "band") continue;
    const body = shapes.filter((s) => s !== hair && s.type !== "band" && s.form === hair.form && s.inst === hair.inst);
    const under = body.filter((s) => !s.thin && s.material !== "hair" && s.k < hair.k);
    const found = new Map();
    for (const mark of body) {
      const pts = marksOf(mark);
      const mid = pts[pts.length >> 1];
      if (!holds(hair, mid)) continue;
      let surface = null;
      for (const t of under) if (t.k < mark.k && (mark.thin || mark.area <= t.area * 0.08) && holds(t, mid)) surface = t;
      if (!surface) continue;
      if (!found.has(surface)) found.set(surface, []);
      found.get(surface).push({ mark, pts });
    }
    // The other way round: hair listed before a bare surface it grows on has been buried by it. A head with no face
    // on it is seen from behind, so the hair lies over it.
    for (const surface of body) {
      if (surface.thin || surface.material === "hair" || surface.k < hair.k || !surface.area) continue;
      const marked = body.some((mark) => mark.k > surface.k && (mark.thin || mark.area <= surface.area * 0.08) && holds(surface, marksOf(mark)[marksOf(mark).length >> 1]));
      if (marked) continue;
      const b = surface.box;
      const under = [];
      for (let j = 0; j < b.h; j++)
        for (let i = 0; i < b.w; i++) {
          const k = (j + b.j0) * nw + i + b.i0;
          if (surface.d[j * b.w + i] > 0 && rid[k] === surface.k && inner(hair, i + b.i0, j + b.j0) > 0) under.push(k);
        }
      if (under.length < surface.area * 0.3) continue;
      for (const k of under) rid[k] = hair.k;
    }
    for (const [surface, list] of found) {
      if (list.length < 2) continue;
      const pts = list.flatMap((q) => q.pts);
      let across = 0;
      for (const a of pts) for (const b of pts) across = Math.max(across, Math.hypot(a[0] - b[0], a[1] - b[1]));
      let deep = 0;
      for (let m = 0; m < surface.d.length; m++) if (surface.d[m] > deep) deep = surface.d[m];
      const reach = Math.max(0.36 * across, 0.42 * deep);
      const b = surface.box;
      for (let j = 0; j < b.h; j++)
        for (let i = 0; i < b.w; i++) {
          const k = (j + b.j0) * nw + i + b.i0;
          if (surface.d[j * b.w + i] <= 0 || rid[k] !== hair.k) continue;
          const x = (i + b.i0) / RES;
          const y = (j + b.j0) / RES;
          let near = false;
          for (let p = 0; p < pts.length && !near; p++) for (let q = p; q < pts.length && !near; q++) near = reachTo(x, y, pts[p], pts[q]) <= reach;
          if (near) rid[k] = surface.k;
        }
      // marks the hair had buried go back on the surface, in the order they were given
      const shown = new Set([surface.k]);
      for (const { mark } of list.sort((p, q) => p.mark.k - q.mark.k)) {
        if (mark.thin || mark.k > hair.k) continue;
        const m = mark.box;
        for (let j = 0; j < m.h; j++)
          for (let i = 0; i < m.w; i++) {
            const k = (j + m.j0) * nw + i + m.i0;
            if (mark.d[j * m.w + i] > 0 && shown.has(rid[k])) rid[k] = mark.k;
          }
        shown.add(mark.k);
      }
    }
  }
}

// rasterize every shape onto one grid of nodes: who is in front where, plus each shape's inner distance and thickness
export function ground(scene, n, RES = 5) {
  const { W, H } = scene;
  const gw = Math.round(W * RES);
  const gh = Math.round(H * RES);
  const nw = gw + 1;
  const nh = gh + 1;
  const rid = new Uint16Array(nw * nh);
  const shapes = scene.shapes.map((s, k) => ({ ...s, k: k + 1 }));
  for (const s of shapes) {
    if (s.type === "band") {
      s.edge = bandEdge(s, W, H, nw, RES, n);
      for (let i = 0; i < nw; i++) for (let j = Math.max(0, Math.ceil(s.edge[i] * RES)); j < nh; j++) rid[j * nw + i] = s.k;
      continue;
    }
    if (s.type === "tube") tube(s, RES, nw, nh);
    else poly(s, RES, nw, nh, n);
    if (s.thin) continue;
    const { box, d } = s;
    for (let j = 0; j < box.h; j++) for (let i = 0; i < box.w; i++) if (d[j * box.w + i] > 0) rid[(j + box.j0) * nw + i + box.i0] = s.k;
  }

  unveil(shapes, rid, nw, RES);

  // what each shape still shows once everything is in place, and its long axis
  const sums = shapes.map(() => [0, 0, 0, 0, 0, 0]);
  for (let j = 0; j < nh; j++)
    for (let i = 0; i < nw; i++) {
      const k = rid[j * nw + i];
      if (!k) continue;
      const a = sums[k - 1];
      const x = i / RES;
      const y = j / RES;
      a[0] += x;
      a[1] += y;
      a[2] += x * x;
      a[3] += x * y;
      a[4] += y * y;
      a[5]++;
    }
  shapes.forEach((s, q) => {
    const a = sums[q];
    s.seen = a[5];
    s.axis = a[5] > 3 ? axis(a[0], a[1], a[2], a[3], a[4], a[5]) : { x: 1, y: 0, cx: 0, cy: 0, along: 1, across: 1 };
  });

  // each band shows from its own edge down to the next band's edge
  const bands = shapes.filter((s) => s.type === "band");
  bands.forEach((b, q) => {
    b.floor = new Float32Array(nw).fill(H);
    for (const later of bands.slice(q + 1)) for (let i = 0; i < nw; i++) if (later.edge[i] < b.floor[i]) b.floor[i] = Math.max(later.edge[i], b.edge[i] + 0.5);
    b.far = bands.length > 1 ? q / (bands.length - 1) : 1;
  });

  // every copy of a form is one body: its parts share a silhouette, and that union gets its own distance and thickness
  const groups = [];
  const byKey = new Map();
  const gid = new Uint16Array(shapes.length + 1);
  for (const s of shapes) {
    if (s.type === "band") {
      groups.push({ id: groups.length + 1, band: s, members: [s] });
      gid[s.k] = groups.length;
      continue;
    }
    const key = `${s.form}:${s.inst}`;
    let g = byKey.get(key);
    if (!g) {
      g = { id: groups.length + 1, members: [], form: s.form, role: s.role };
      groups.push(g);
      byKey.set(key, g);
    }
    g.members.push(s);
    s.g = g;
    s.order = g.members.length - 1;
    gid[s.k] = g.id;
  }
  for (const g of groups) {
    if (g.band) continue;
    const solid = g.members.filter((s) => !s.thin);
    if (!solid.length) continue;
    const i0 = Math.min(...solid.map((s) => s.box.i0));
    const j0 = Math.min(...solid.map((s) => s.box.j0));
    const i1 = Math.max(...solid.map((s) => s.box.i0 + s.box.w - 1));
    const j1 = Math.max(...solid.map((s) => s.box.j0 + s.box.h - 1));
    const box = { i0, j0, w: i1 - i0 + 1, h: j1 - j0 + 1 };
    const mask = new Uint8Array(box.w * box.h);
    for (const s of solid) {
      const b = s.box;
      for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) if (s.d[j * b.w + i] > 0) mask[(j + b.j0 - j0) * box.w + i + b.i0 - i0] = 1;
    }
    const d = distance(mask, box.w, box.h);
    const R = thickness(d, box.w, box.h);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let m = 0; m < d.length; m++) {
      d[m] /= RES;
      R[m] /= RES;
      if (!mask[m]) continue;
      const x = ((m % box.w) + i0) / RES;
      const y = (Math.floor(m / box.w) + j0) / RES;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    Object.assign(g, { box, d, R, mask, x0, y0, x1, y1, solid });
  }

  // a limb that starts inside an earlier part of its own body grows out of that part rather than lying on it
  for (const g of groups) {
    if (g.band || !g.solid) continue;
    for (const s of g.solid) {
      if (s.type !== "tube") continue;
      const last = s.line.length - 1;
      s.roots = [];
      for (const end of [0, last]) {
        const [x, y, r] = s.line[end];
        let parent = null;
        let best = 0.12;
        for (const p of g.solid) {
          if (p === s || p.k > s.k) continue;
          const v = inner(p, Math.round(x * RES), Math.round(y * RES));
          if (v > best) {
            best = v;
            parent = p;
          }
        }
        if (!parent) continue;
        const step = end ? -1 : 1;
        let i = end;
        while (i >= 0 && i <= last && inner(parent, Math.round(s.line[i][0] * RES), Math.round(s.line[i][1] * RES)) > 0) i += step;
        if (i < 0 || i > last) continue;
        s.roots.push({ parent, far: end > 0, exit: Math.abs(i - end) / last, span: (1.2 * r) / Math.max(0.35, last * 0.35), r });
      }
    }
  }

  return { W, H, RES, gw, gh, nw, nh, rid, gid, shapes, bands, groups };
}

// how much of a limb's surface belongs to the part it grows from, at a node: 1 deep inside that part near the joint
export function rooted(s, root, along, i, j) {
  const t = root.far ? 1 - along : along;
  if (t >= root.exit + root.span) return 0;
  const dp = inner(root.parent, i, j);
  if (dp <= 0) return 0;
  const near = 1 - clamp((t - root.exit) / root.span);
  return clamp(dp / (0.7 * root.r)) * near * near * (3 - 2 * near);
}

// a shape's own distance from its outline at a node, negative outside it
export function inner(s, i, j) {
  const b = s.box;
  const x = i - b.i0;
  const y = j - b.j0;
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return -1e6;
  return s.d[y * b.w + x];
}
