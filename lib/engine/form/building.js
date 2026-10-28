import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rgb } from "../palette";

export const STYLES = ["mansion", "house", "cottage", "cabin", "farmhouse", "modern", "castle", "church", "cathedral", "skyscraper", "tower", "lighthouse", "barn", "temple", "pagoda", "bridge", "windmill"];
export const ROOFS = ["auto", "gable", "hip", "flat", "mansard", "dome", "spire", "gambrel"];

const DEFAULT = {
  mansion: { wall: "#e8dfcc", roof: "#4b4f58", trim: "#f4f1ea", floors: 3 },
  house: { wall: "#d9cbb3", roof: "#5a4a43", trim: "#f2eee6", floors: 2 },
  cottage: { wall: "#efe6d2", roof: "#7a4a35", trim: "#fbf7ee", floors: 1 },
  cabin: { wall: "#8a5f3d", roof: "#4a3b33", trim: "#d8c4a0", floors: 1 },
  farmhouse: { wall: "#f1ede4", roof: "#5d5f63", trim: "#ffffff", floors: 2 },
  modern: { wall: "#e9e8e4", roof: "#3a3c40", trim: "#2b2d31", floors: 2 },
  castle: { wall: "#a39d91", roof: "#4b4f63", trim: "#8f897e", floors: 4 },
  church: { wall: "#d8d0c0", roof: "#4f535c", trim: "#efe9dd", floors: 3 },
  cathedral: { wall: "#c9c0ae", roof: "#3f434b", trim: "#e2dacb", floors: 5 },
  skyscraper: { wall: "#9aa6b2", roof: "#5d6670", trim: "#c9d1d8", floors: 40 },
  tower: { wall: "#bfb6a6", roof: "#4b4f58", trim: "#e3ddd0", floors: 8 },
  lighthouse: { wall: "#f1ece2", roof: "#2b2b2e", trim: "#b23a2e", floors: 8 },
  barn: { wall: "#9b3a2c", roof: "#4c4f55", trim: "#f2eee6", floors: 2 },
  temple: { wall: "#e7e1d3", roof: "#cfc6b4", trim: "#f6f2ea", floors: 2 },
  pagoda: { wall: "#b5402f", roof: "#3a3d42", trim: "#e9dcc4", floors: 5 },
  bridge: { wall: "#9a958c", roof: "#6d6a64", trim: "#c9c3b8", floors: 1 },
  windmill: { wall: "#e9e3d6", roof: "#4b4f58", trim: "#7a5a3c", floors: 4 },
};

const GLASS = rgb("#2e3a4a");

export class Kit {
  constructor() {
    this.parts = [];
    this.delay = 0;
    this.facade = 0;
  }

  add(geometry, color, glow = 0) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    g.deleteAttribute("uv");
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set(color, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(c, 3));
    g.setAttribute("glow", new THREE.BufferAttribute(new Float32Array(n).fill(glow), 1));
    g.setAttribute("delay", new THREE.BufferAttribute(new Float32Array(n).fill(this.delay), 1));
    g.setAttribute("facade", new THREE.BufferAttribute(new Float32Array(n).fill(this.facade), 1));
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    this.parts.push(g);
    return g;
  }

  box(w, h, d, x, y, z, color, glow = 0, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    return this.add(g, color, glow);
  }

  cylinder(r0, r1, h, x, y, z, color, seg = 24) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1);
    g.translate(x, y + h / 2, z);
    return this.add(g, color);
  }

  cone(r, h, x, y, z, color, seg = 24, rot = 0) {
    const g = new THREE.ConeGeometry(r, h, seg, 1);
    if (rot) g.rotateY(rot);
    g.translate(x, y + h / 2, z);
    return this.add(g, color);
  }

  dome(r, x, y, z, color, squash = 1) {
    const g = new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    g.scale(1, squash, 1);
    g.translate(x, y, z);
    return this.add(g, color);
  }

  prism(points, depth, x, y, z, color, axis = "z") {
    const shape = new THREE.Shape(points.map(([a, b]) => new THREE.Vector2(a, b)));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    if (axis === "x") g.rotateY(Math.PI / 2);
    g.translate(x, y, z);
    return this.add(g, color);
  }

  gable(w, d, h, x, y, z, color, over = 0.5, along = "z") {
    const span = along === "z" ? w : d;
    const len = along === "z" ? d : w;
    return this.prism([[-span / 2 - over, 0], [span / 2 + over, 0], [0, h]], len + over * 2, x, y, z, color, along === "z" ? "z" : "x");
  }

  hip(w, d, h, x, y, z, color, over = 0.4) {
    const W = w / 2 + over;
    const D = d / 2 + over;
    const r = Math.max(0, W - D);
    const s = Math.max(0, D - W);
    const v = [
      [-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D],
      [-r, h, -s], [r, h, -s], [r, h, s], [-r, h, s],
    ].map(([a, b, c]) => [a + x, b + y, c + z]);
    const f = [[0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7], [4, 5, 6], [4, 6, 7]];
    const pos = [];
    for (const [a, b, c] of f) pos.push(...v[a], ...v[c], ...v[b]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.computeVertexNormals();
    return this.add(g, color);
  }

  windows(face, x0, y0, z0, w, h, floors, cols, opt) {
    const { fh = 3.2, ww = 1.1, wh = 1.6, trim, sill = 0.9, skip, arch = false } = opt;
    const step = w / cols;
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++) {
        if (skip && skip(f, c)) continue;
        const along = -w / 2 + step * (c + 0.5);
        const y = y0 + f * fh + sill;
        if (y + wh > y0 + h) continue;
        const hh = arch ? wh * 1.25 : wh;
        if (face === "x") {
          this.box(0.12, hh + 0.2, ww + 0.2, x0 + 0.04, y - 0.1, z0 + along, trim);
          this.box(0.16, hh, ww, x0 + 0.07, y, z0 + along, GLASS, 1);
        } else if (face === "-x") {
          this.box(0.12, hh + 0.2, ww + 0.2, x0 - 0.04, y - 0.1, z0 + along, trim);
          this.box(0.16, hh, ww, x0 - 0.07, y, z0 + along, GLASS, 1);
        } else {
          const s = face === "z" ? 1 : -1;
          this.box(ww + 0.2, hh + 0.2, 0.12, x0 + along, y - 0.1, z0 + s * 0.04, trim);
          this.box(ww, hh, 0.16, x0 + along, y, z0 + s * 0.07, GLASS, 1);
        }
      }
  }

  block(w, d, floors, x, z, col, opt = {}) {
    const fh = opt.fh ?? 3.2;
    const h = floors * fh;
    this.box(w, h, d, x, 0, z, col.wall);
    this.box(w + 0.3, 0.35, d + 0.3, x, 0, z, col.trim);
    this.box(w + 0.25, 0.3, d + 0.25, x, h - 0.3, z, col.trim);
    const cols = Math.max(1, Math.round(w / (opt.spacing ?? 3)));
    const side = Math.max(1, Math.round(d / (opt.spacing ?? 3)));
    const win = { fh, ww: opt.ww ?? 1.1, wh: opt.wh ?? 1.6, trim: col.trim, arch: opt.arch, skip: opt.skip };
    this.windows("x", x + w / 2, 0, z, w, h, floors, Math.max(1, Math.round(d / (opt.spacing ?? 3))), { ...win, skip: opt.door ? (f, c) => f === 0 && c === Math.floor(side / 2) : undefined });
    this.windows("z", x, 0, z + d / 2, w, h, floors, cols, win);
    this.windows("-z", x, 0, z - d / 2, w, h, floors, cols, win);
    this.windows("-x", x - w / 2, 0, z, w, h, floors, side, win);
    return h;
  }

  geometry() {
    const g = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    return g;
  }
}

function colorsFor(subject, style) {
  const d = DEFAULT[style] || DEFAULT.house;
  const [wall, roof, trim] = subject.colors;
  return { wall: rgb(wall || d.wall), roof: rgb(roof || d.roof), trim: rgb(trim || d.trim), dark: rgb("#2a2420"), stone: rgb("#8d877c") };
}

export function guessStyle(label) {
  const l = label.toLowerCase();
  const pairs = [
    [/mansion|manor|estate|palace|chateau/, "mansion"],
    [/castle|fortress|citadel|keep/, "castle"],
    [/cathedral|basilica/, "cathedral"],
    [/church|chapel|abbey|monastery/, "church"],
    [/skyscraper|tower block|high.?rise|office tower|empire state|building/, "skyscraper"],
    [/lighthouse/, "lighthouse"],
    [/pagoda|shrine/, "pagoda"],
    [/temple|parthenon|pantheon/, "temple"],
    [/barn/, "barn"],
    [/cabin|lodge|log/, "cabin"],
    [/cottage|hut/, "cottage"],
    [/farm/, "farmhouse"],
    [/modern|villa|glass house|minimal/, "modern"],
    [/tower|clock tower|spire/, "tower"],
    [/bridge/, "bridge"],
    [/windmill|wind mill/, "windmill"],
  ];
  for (const [re, s] of pairs) if (re.test(l)) return s;
  return "house";
}

export function building(subject, rand) {
  const b = subject.building || {};
  const style = STYLES.includes(b.style) ? b.style : guessStyle(subject.label);
  const col = colorsFor(subject, style);
  const k = new Kit();
  const r = (lo, hi) => lo + (hi - lo) * rand();
  const floors = Math.max(1, Math.round(b.floors || DEFAULT[style]?.floors || 2));
  const wide = b.width || 0;
  const roofKind = ROOFS.includes(b.roof) && b.roof !== "auto" ? b.roof : null;
  const roof = (w, d, h, x, z, kind, over) => {
    const kindOf = kind || roofKind || "gable";
    if (kindOf === "hip") return k.hip(w, d, Math.min(w, d) * 0.32, x, h, z, col.roof, over ?? 0.5);
    if (kindOf === "flat") {
      k.box(w + 0.2, 0.9, d + 0.2, x, h, z, col.trim);
      return k.box(w - 0.4, 0.2, d - 0.4, x, h + 0.5, z, col.roof);
    }
    if (kindOf === "mansard") {
      k.hip(w, d, 2.6, x, h, z, col.roof, 0.3);
      return null;
    }
    if (kindOf === "dome") return k.dome(Math.min(w, d) * 0.45, x, h, z, col.roof, 0.9);
    if (kindOf === "spire") return k.cone(Math.min(w, d) * 0.6, Math.min(w, d) * 2.2, x, h, z, col.roof, 4, Math.PI / 4);
    if (kindOf === "gambrel") {
      const s = w / 2 + 0.4;
      return k.prism([[-s, 0], [-s * 0.72, h * 0 + w * 0.32], [0, w * 0.48], [s * 0.72, w * 0.32], [s, 0]], d + 0.8, x, h, z, col.roof, "z");
    }
    return k.gable(w, d, Math.min(w, d) * 0.42, x, h, z, col.roof, over ?? 0.5, w >= d ? "x" : "z");
  };
  const chimney = (x, y, z) => {
    k.box(0.9, 2.6, 0.9, x, y, z, col.wall.map((v) => v * 0.8));
    k.box(1.1, 0.25, 1.1, x, y + 2.6, z, col.trim);
  };
  const door = (x, z, w = 1.6, h = 2.6) => {
    k.box(0.3, h + 0.35, w + 0.5, x + 0.05, 0, z, col.trim);
    k.box(0.36, h, w, x + 0.09, 0, z, col.dark);
  };
  const columns = (x, z, span, count, h, rad = 0.32) => {
    for (let i = 0; i < count; i++) {
      const cz = z - span / 2 + (span * i) / Math.max(1, count - 1);
      k.box(rad * 2.6, 0.35, rad * 2.6, x, 0, cz, col.trim);
      k.cylinder(rad, rad * 0.88, h - 0.7, x, 0.35, cz, col.trim, 16);
      k.box(rad * 2.8, 0.35, rad * 2.8, x, h - 0.35, cz, col.trim);
    }
  };
  const battlements = (w, d, h, x, z, size = 0.7) => {
    const ring = [];
    for (let t = -w / 2; t <= w / 2; t += size * 2) ring.push([x + t, z - d / 2], [x + t, z + d / 2]);
    for (let t = -d / 2; t <= d / 2; t += size * 2) ring.push([x - w / 2, z + t], [x + w / 2, z + t]);
    for (const [a, c] of ring) k.box(size, size * 1.1, size, a, h, c, col.wall);
  };
  const round = (rad, h, x, z, capKind) => {
    k.cylinder(rad, rad, h, x, 0, z, col.wall, 28);
    const n = 3 + Math.floor(h / 4);
    for (let f = 1; f < n; f++) {
      const a = rand() * Math.PI * 2;
      k.box(0.25, 1.4, 0.6, x + Math.cos(a) * rad, (h * f) / n, z + Math.sin(a) * rad, GLASS, 1, -a);
    }
    if (capKind === "cone") k.cone(rad * 1.25, rad * 2.4, x, h, z, col.roof, 28);
    else {
      k.cylinder(rad * 1.12, rad * 1.12, 0.6, x, h, z, col.wall, 28);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        k.box(0.55, 0.8, 0.55, x + Math.cos(a) * rad, h + 0.6, z + Math.sin(a) * rad, col.wall, 0, -a);
      }
    }
  };

  let heart = [0, 4, 0];
  let deck = null;
  if (style === "mansion") {
    const W = wide || r(16, 22);
    const D = r(11, 14);
    const H = k.block(D, W, floors, 0, 0, col, { fh: 3.4, door: true, spacing: 2.6 });
    roof(D, W, H, 0, 0, roofKind || "hip");
    const wings = b.wings ?? 2;
    for (const s of wings >= 2 ? [-1, 1] : wings === 1 ? [1] : []) {
      const ww = r(9, 12);
      const wh = k.block(D * 0.82, ww, Math.max(1, floors - 1), -D * 0.08, s * (W / 2 + ww / 2 - 0.2), col, { fh: 3.4, spacing: 2.6 });
      roof(D * 0.82, ww, wh, -D * 0.08, s * (W / 2 + ww / 2 - 0.2), roofKind || "hip");
      chimney(-D * 0.08, wh + 1.2, s * (W / 2 + ww * 0.8));
    }
    const ph = Math.min(H, 3.4 * 2);
    columns(D / 2 + 2.2, 0, W * 0.36, b.columns === false ? 0 : 6, ph);
    k.box(3.2, 0.5, W * 0.42, D / 2 + 1.7, ph, 0, col.trim);
    k.gable(3.2, W * 0.42, 2.2, D / 2 + 1.7, ph + 0.5, 0, col.trim, 0.2, "z");
    for (let s = 0; s < 4; s++) k.box(1.2, 0.18, W * 0.3 - s * 0.6, D / 2 + 4.6 - s * 1.1 + 0.5, s * 0.18, 0, col.stone);
    door(D / 2, 0, 1.8, 3);
    chimney(-D * 0.2, H + 2.5, W * 0.3);
    chimney(-D * 0.2, H + 2.5, -W * 0.3);
    heart = [0, H * 0.5, 0];
  } else if (style === "castle") {
    const W = wide || r(26, 34);
    const H = floors * 3.4;
    const wall = H * 0.62;
    k.box(W, wall, W, 0, 0, 0, col.wall);
    battlements(W, W, wall, 0, 0);
    const keep = W * 0.42;
    const kh = k.block(keep, keep, floors + 1, -W * 0.08, 0, col, { fh: 3.4, spacing: 3.4, arch: true, ww: 0.7, wh: 1.8 });
    battlements(keep, keep, kh, -W * 0.08, 0, 0.6);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) round(W * 0.09, wall + 6, (x * W) / 2, (z * W) / 2, rand() < 0.6 ? "cone" : "crenel");
    k.box(1.2, 5.2, 4.4, W / 2 + 0.2, 0, 0, col.dark);
    k.cylinder(2.2, 2.2, 0.6, W / 2 + 0.2, 5.0, 0, col.wall, 18);
    if (b.towers) round(keep * 0.22, kh + 7, -W * 0.08 + keep * 0.35, keep * 0.35, "cone");
    heart = [0, wall, 0];
  } else if (style === "church" || style === "cathedral") {
    const big = style === "cathedral";
    const L = wide || (big ? r(48, 64) : r(20, 28));
    const N = big ? r(16, 20) : r(9, 11);
    const H = big ? r(18, 24) : r(8, 10);
    k.box(L, H, N, -L / 2, 0, 0, col.wall);
    k.gable(L, N, N * (big ? 0.75 : 0.6), -L / 2, H, 0, col.roof, 0.6, "x");
    const bays = Math.round(L / (big ? 5 : 4));
    for (let i = 0; i < bays; i++) for (const s of [-1, 1]) {
      const x = -L + (L * (i + 0.5)) / bays;
      k.box(1.3, H * 0.62, 0.16, x, H * 0.18, s * (N / 2 + 0.07), GLASS, 1);
      k.box(1.7, H * 0.66, 0.12, x, H * 0.16, s * (N / 2 + 0.04), col.trim);
      if (big) k.box(1.4, H * 0.9, 1.6, x + L / bays / 2, 0, s * (N / 2 + 0.8), col.wall.map((v) => v * 0.92));
    }
    const tw = big ? N * 0.42 : N * 0.55;
    for (const s of big ? [-1, 1] : [0]) {
      const tz = s * (N / 2 - tw / 2);
      const th = H * (big ? 2.1 : 1.9);
      k.box(tw, th, tw, tw / 2, 0, tz, col.wall);
      k.box(0.16, th * 0.2, tw * 0.4, tw + 0.07, th * 0.62, tz, GLASS, 1);
      k.cone(tw * 0.62, tw * (big ? 3.2 : 3.4), tw / 2, th, tz, col.roof, 4, Math.PI / 4);
    }
    k.cylinder(N * 0.16, N * 0.16, 0.3, 0.1, H * 0.72, 0, GLASS, 32).rotateZ(0);
    door(tw, 0, 2.4, 4.2);
    heart = [-L * 0.3, H * 0.6, 0];
  } else if (style === "skyscraper") {
    const W = wide || r(24, 36);
    let y = 0;
    let w = W;
    const tiers = 2 + Math.floor(rand() * 2);
    const fl = Math.max(12, floors);
    for (let t = 0; t < tiers; t++) {
      const f = Math.round((fl * (t === 0 ? 0.55 : 0.45 / (tiers - 1))) || 6);
      const h = f * 3.6;
      k.box(w, h, w, 0, y, 0, col.wall);
      const n = Math.max(4, Math.round(w / 2.2));
      for (let i = 0; i < n; i++)
        for (const [face, s] of [["x", 1], ["z", 1], ["-x", -1], ["-z", -1]]) {
          const t2 = -w / 2 + (w * (i + 0.5)) / n;
          if (face === "x" || face === "-x") k.box(0.16, h - 1, w / n - 0.5, (s * w) / 2 + s * 0.06, y + 0.5, t2, GLASS, rand() < 0.75 ? 1 : 0.2);
          else k.box(w / n - 0.5, h - 1, 0.16, t2, y + 0.5, (s * w) / 2 + s * 0.06, GLASS, rand() < 0.75 ? 1 : 0.2);
        }
      for (let f2 = 1; f2 < f; f2 += 1) k.box(w + 0.25, 0.25, w + 0.25, 0, y + f2 * 3.6, 0, col.trim);
      y += h;
      w *= 0.72;
    }
    k.cylinder(0.4, 0.15, fl * 0.5, 0, y, 0, col.trim, 8);
    heart = [0, y * 0.4, 0];
  } else if (style === "lighthouse" || style === "tower") {
    const H = (floors || 8) * 3.6;
    const R0 = H * 0.13;
    const prof = [new THREE.Vector2(R0 * 1.25, 0), new THREE.Vector2(R0, 0.6), new THREE.Vector2(R0 * 0.72, H)];
    k.add(new THREE.LatheGeometry(prof, 40), col.wall);
    if (style === "lighthouse") for (const t of [0.3, 0.62]) k.cylinder(R0 * (1 - t * 0.29) + 0.05, R0 * (1 - (t + 0.12) * 0.29) + 0.05, H * 0.12, 0, H * t, 0, col.trim, 40);
    k.cylinder(R0 * 0.95, R0 * 0.95, 0.5, 0, H, 0, col.dark, 40);
    const ring = new THREE.TorusGeometry(R0 * 0.92, 0.05, 6, 48);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, H + 1.4, 0);
    k.add(ring, col.dark);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      k.box(0.07, 0.9, 0.07, Math.cos(a) * R0 * 0.92, H + 0.5, Math.sin(a) * R0 * 0.92, col.dark);
    }
    k.cylinder(R0 * 0.6, R0 * 0.6, 3, 0, H + 0.5, 0, style === "lighthouse" ? rgb("#f6e3a8") : GLASS, 24).getAttribute("glow").array.fill(1);
    k.cone(R0 * 0.75, R0 * 0.9, 0, H + 3.5, 0, col.dark, 24);
    for (let f = 1; f < floors; f++) {
      const a = rand() * Math.PI * 2;
      const rr = R0 * (1 - (f / floors) * 0.28);
      k.box(0.2, 1.2, 0.6, Math.cos(a) * rr, (H * f) / floors, Math.sin(a) * rr, GLASS, 1, -a);
    }
    door(R0 * 1.02, 0, 1.2, 2.2);
    heart = [0, H * 0.5, 0];
  } else if (style === "modern") {
    const W = wide || r(14, 20);
    const D = r(9, 12);
    k.box(W, 3.4, D, 0, 0, 0, col.wall);
    k.box(W * 0.7, 3.2, D * 1.05, W * 0.18, 3.4, -D * 0.2, col.wall.map((v) => v * 0.94));
    k.box(W + 0.4, 0.3, D + 0.4, 0, 3.4, 0, col.trim);
    k.box(W * 0.7 + 0.4, 0.3, D * 1.05 + 0.4, W * 0.18, 6.6, -D * 0.2, col.trim);
    k.box(0.16, 2.6, W * 0.7, D / 2 + 0.08, 0.4, 0, GLASS, 1, Math.PI / 2);
    k.box(W * 0.62, 2.4, 0.16, W * 0.18, 3.8, -D * 0.2 + D * 0.525 + 0.08, GLASS, 1);
    k.box(W * 0.84, 2.6, 0.16, -W * 0.05, 0.4, D / 2 + 0.08, GLASS, 1);
    k.box(W * 0.3, 0.08, D * 0.5, -W * 0.45, 0, D * 0.75, rgb("#6f9fb0"));
    heart = [0, 3.4, 0];
  } else if (style === "windmill") {
    const H = 14;
    k.add(new THREE.CylinderGeometry(2.4, 3.6, H, 8, 1).translate(0, H / 2, 0), col.wall);
    k.dome(2.7, 0, H, 0, col.roof, 1.1);
    const hub = new THREE.Vector3(3.2, H + 0.6, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const arm = new THREE.BoxGeometry(0.22, 9.5, 0.22);
      arm.translate(0, 4.75, 0);
      arm.rotateX(a);
      arm.translate(hub.x, hub.y, hub.z);
      k.add(arm, col.trim);
      const sail = new THREE.BoxGeometry(0.06, 7, 1.7);
      sail.translate(0, 5.2, 0.95);
      sail.rotateX(a);
      sail.translate(hub.x + 0.05, hub.y, hub.z);
      k.add(sail, col.wall.map((v) => v * 0.95));
    }
    door(3.25, 0, 1.2, 2.2);
    for (let f = 1; f < 4; f++) k.box(0.2, 1.1, 0.7, 3.1 - f * 0.28, f * 3.2, 0, GLASS, 1);
    heart = [0, H * 0.6, 0];
  } else if (style === "barn") {
    const W = wide || r(12, 16);
    const D = r(18, 24);
    k.box(W, 5, D, 0, 0, 0, col.wall);
    const s = W / 2 + 0.4;
    k.prism([[-s, 0], [-s * 0.78, 3.2], [0, 5.6], [s * 0.78, 3.2], [s, 0]], D + 0.8, 0, 5, 0, col.roof, "z");
    k.box(0.25, 4, 4.2, W / 2 + 0.1, 0, 0, col.trim);
    k.box(0.3, 3.6, 3.8, W / 2 + 0.14, 0.2, 0, col.wall.map((v) => v * 0.8));
    k.box(0.32, 0.25, 5.2, W / 2 + 0.16, 1.9, 0, col.trim, 0, 0);
    heart = [0, 4, 0];
  } else if (style === "temple") {
    const W = wide || r(18, 24);
    const D = W * 1.8;
    for (let s = 0; s < 3; s++) k.box(W + 4 - s * 1.2, 0.5, D + 4 - s * 1.2, 0, s * 0.5, 0, col.trim);
    const H = 9;
    const n = 6;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        const x = sx * (W / 2);
        const z = -D / 2 + (D * i) / (n - 1);
        k.cylinder(0.62, 0.52, H, x, 1.5, z, col.wall, 20);
      }
    }
    for (const sz of [-1, 1]) for (let i = 1; i < 5; i++) k.cylinder(0.62, 0.52, H, -W / 2 + (W * i) / 5, 1.5, (sz * D) / 2, col.wall, 20);
    k.box(W + 1.6, 1.2, D + 1.6, 0, H + 1.5, 0, col.trim);
    k.gable(W + 1.6, D + 1.6, 3, 0, H + 2.7, 0, col.roof, 0.3, "z");
    k.box(W * 0.6, H - 1, D * 0.7, 0, 1.5, 0, col.wall.map((v) => v * 0.85));
    heart = [0, H * 0.6, 0];
  } else if (style === "pagoda") {
    let y = 0;
    let w = wide || r(10, 13);
    const tiers = Math.max(3, Math.min(9, floors));
    for (let t = 0; t < tiers; t++) {
      const h = t ? 2.6 : 3.4;
      k.box(w, h, w, 0, y, 0, col.wall);
      k.box(w * 0.5, h * 0.55, 0.14, 0, y + h * 0.2, w / 2 + 0.07, GLASS, 1);
      const g = new THREE.CylinderGeometry(w * 0.32, w * 0.92, 1.4, 4, 1, true);
      g.rotateY(Math.PI / 4);
      g.translate(0, y + h + 0.7, 0);
      k.add(g, col.roof);
      y += h + 1.4;
      w *= 0.84;
    }
    k.cylinder(0.25, 0.08, 5, 0, y, 0, col.trim, 8);
    heart = [0, y * 0.4, 0];
  } else if (style === "bridge") {
    const H = 12;
    const modern = /suspension|cable|golden gate|modern|steel/i.test(subject.label + " " + (b.note || ""));
    if (modern) {
      const L = wide || r(60, 90);
      k.box(6, 1, L, 0, H, 0, col.wall);
      for (const s2 of [-1, 1]) for (let i = 0; i < 3; i++) k.box(2.6, H, 3, 0, 0, s2 * L * (0.15 + i * 0.15), col.stone);
      for (const s2 of [-1, 1]) {
        const tz = s2 * L * 0.22;
        k.box(1.8, 24, 1.8, -2.2, H, tz, col.trim);
        k.box(1.8, 24, 1.8, 2.2, H, tz, col.trim);
        k.box(6, 1.2, 1.8, 0, H + 21, tz, col.trim);
        for (let c = 1; c <= 8; c++) {
          const g = new THREE.CylinderGeometry(0.06, 0.06, 1, 4);
          const a = new THREE.Vector3(2.2, H + 22, tz);
          const bpt = new THREE.Vector3(2.2, H + 1, tz + s2 * (c * 3.2));
          const mid = a.clone().add(bpt).multiplyScalar(0.5);
          g.scale(1, a.distanceTo(bpt), 1);
          g.lookAt(bpt.clone().sub(a));
          g.rotateX(Math.PI / 2);
          g.translate(mid.x, mid.y, mid.z);
          k.add(g, col.trim);
        }
      }
      heart = [0, H, 0];
      deck = H + 1;
    } else {
      const spans = 5 + Math.floor(rand() * 3);
      const span = r(9, 12);
      const L = spans * span;
      const Wd = 6.5;
      const stone = rgb(subject.colors[0] || "#a59d8e");
      for (let i = 0; i < spans; i++) {
        const z = -L / 2 + span * (i + 0.5);
        const shapeA = new THREE.Shape();
        shapeA.moveTo(-span / 2, 0);
        shapeA.lineTo(-span / 2, H);
        shapeA.lineTo(span / 2, H);
        shapeA.lineTo(span / 2, 0);
        shapeA.lineTo(span * 0.36, 0);
        shapeA.lineTo(span * 0.36, H * 0.42);
        shapeA.absarc(0, H * 0.42, span * 0.36, 0, Math.PI, false);
        shapeA.lineTo(-span * 0.36, 0);
        shapeA.lineTo(-span / 2, 0);
        const g = new THREE.ExtrudeGeometry(shapeA, { depth: Wd, bevelEnabled: false, curveSegments: 18 });
        g.translate(0, 0, -Wd / 2);
        g.rotateY(Math.PI / 2);
        g.translate(0, 0, z);
        k.add(g, stone.map((v) => v * (0.92 + rand() * 0.12)));
      }
      k.box(Wd + 0.6, 0.5, L + 0.6, 0, H, 0, col.trim);
      for (const s2 of [-1, 1]) k.box(0.5, 1.1, L, s2 * (Wd / 2), H + 0.5, 0, stone);
      for (let i = 0; i <= spans; i++) for (const s2 of [-1, 1]) k.box(1.4, H, 1.6, s2 * (Wd / 2 + 0.2), 0, -L / 2 + i * span, stone.map((v) => v * 0.9));
      if (/train|rail/i.test(subject.label + " " + (b.note || "") + " " + (b.rails ? "rail" : ""))) for (const s2 of [-1, 1]) k.box(0.1, 0.15, L, s2 * 0.75, H + 0.5, 0, rgb("#3a3836"));
      heart = [0, H * 0.6, 0];
      deck = H + 0.5;
    }
  } else {
    const cabin = style === "cabin";
    const W = wide || (style === "cottage" || cabin ? r(8, 10) : r(10, 14));
    const D = style === "farmhouse" ? r(12, 15) : r(8, 11);
    const fl = Math.min(floors, style === "cottage" || cabin ? 1 : 3);
    const H = k.block(D, W, fl, 0, 0, col, { fh: 3, door: true, spacing: 3 });
    if (cabin) for (let y = 0.3; y < H; y += 0.42) k.box(D + 0.1, 0.06, W + 0.1, 0, y, 0, col.wall.map((v) => v * 0.7));
    roof(D, W, H, 0, 0, roofKind || "gable", 0.6);
    door(D / 2, 0, 1.3, 2.4);
    chimney(-D * 0.15, H + 0.8, W * 0.32);
    if (style !== "cottage") {
      k.box(2.6, 0.25, W * 0.7, D / 2 + 1.3, 0, 0, col.stone);
      columns(D / 2 + 2.3, 0, W * 0.62, 4, 2.9, 0.14);
      k.box(2.9, 0.2, W * 0.72, D / 2 + 1.35, 2.9, 0, col.roof);
    }
    if (style === "farmhouse") k.block(D * 0.6, W * 0.6, 1, -D * 0.1, W * 0.75, col, { fh: 3 });
    heart = [0, H * 0.5, 0];
  }
  const geometry = k.geometry();
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const shift = new THREE.Vector3(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geometry.translate(shift.x, shift.y, shift.z);
  geometry.computeBoundingBox();
  return { geometry, heart: [heart[0] + shift.x, heart[1] + shift.y, heart[2] + shift.z], style, deck: deck === null ? null : deck + shift.y };
}
