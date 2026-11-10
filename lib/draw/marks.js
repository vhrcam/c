import { hash, random } from "../random.js";
import { mix } from "./color.js";
import { resample } from "./geometry.js";
import { clamp, lerp } from "./noise.js";
import { rooted } from "./ground.js";
import { see } from "./strands.js";

// the outline of a shape as a closed loop of [x, y, isCap, how far along a tube]
function outline(s) {
  if (s.type !== "tube") return resample([...s.outline, s.outline[0]], 0.3).map((p) => [p[0], p[1], 0, 0]);
  const L = s.line;
  const n = L.length;
  const left = [];
  const right = [];
  let end = [0, 0];
  let begin = [0, 0];
  for (let i = 0; i < n; i++) {
    const a = L[Math.max(0, i - 1)];
    const b = L[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const r = L[i][2];
    left.push([L[i][0] - ty * r, L[i][1] + tx * r, 0, i / (n - 1)]);
    right.push([L[i][0] + ty * r, L[i][1] - tx * r, 0, i / (n - 1)]);
    if (i === n - 1) end = [tx, ty];
    if (i === 0) begin = [tx, ty];
  }
  const cap = (c, t, r, sign) => {
    const base = Math.atan2(t[0] * sign, -t[1] * sign);
    const steps = Math.max(4, Math.round(r * 5));
    return Array.from({ length: steps - 1 }, (_, q) => {
      const a = base - ((q + 1) / steps) * Math.PI;
      return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, 1, sign > 0 ? 1 : 0];
    });
  };
  return [...left, ...cap(L[n - 1], end, L[n - 1][2], 1), ...right.reverse(), ...cap(L[0], begin, L[0][2], -1)];
}

// contour lines where a body meets what is behind it, heavier on the side away from the light
export function edges(G, well, scene, seed) {
  const out = [];
  const off = 0.75 / G.RES;
  for (const s of G.shapes) {
    if (s.type === "band" || s.thin || !s.seen || s.mat.sys === "glow") continue;
    const rand = random(hash(`edge:${seed}:${s.k}`));
    const loop = outline(s);
    const n = loop.length;
    if (n < 4) continue;
    let area = 0;
    for (let i = 0; i < n; i++) area += loop[i][0] * loop[(i + 1) % n][1] - loop[(i + 1) % n][0] * loop[i][1];
    const sign = area > 0 ? 1 : -1;
    const kind = new Uint8Array(n);
    const wide = new Float32Array(n);
    const focus = s.role === "focus" ? 1 : 0.8;
    for (let i = 0; i < n; i++) {
      const a = loop[(i - 1 + n) % n];
      const b = loop[(i + 1) % n];
      let ox = (b[1] - a[1]) * sign;
      let oy = -(b[0] - a[0]) * sign;
      const len = Math.hypot(ox, oy) || 1;
      ox /= len;
      oy /= len;
      const [x, y, capped] = loop[i];
      if (see(G, s.k, x - ox * off, y - oy * off) !== 1) continue;
      const i2 = Math.round((x + ox * off * 1.4) * G.RES);
      const j2 = Math.round((y + oy * off * 1.4) * G.RES);
      const ro = i2 < 0 || j2 < 0 || i2 >= G.nw || j2 >= G.nh ? 0 : G.rid[j2 * G.nw + i2];
      if (ro === s.k) continue;
      const same = G.gid[ro] === G.gid[s.k];
      if (same && capped) continue;
      if (same && s.roots && s.roots.some((root) => rooted(s, root, loop[i][3], i2, j2) > 0.35)) continue;
      const lx = scene.light.x - x;
      const ly = scene.light.y - y;
      const ll = Math.hypot(lx, ly) || 1;
      const facing = (ox * lx + oy * ly) / ll;
      const shadow = clamp(0.5 - facing * 0.6);
      if (same) {
        // where one part of a body crosses another the line is lighter than the silhouette, but it is always there
        kind[i] = 2;
        wide[i] = lerp(0.05, 0.13, shadow) * focus;
      } else if (well.dark) {
        // on a dark sheet the edge that shows is the one catching the light
        kind[i] = 1;
        wide[i] = lerp(0.0, 0.17, clamp((1 - shadow) * 1.25 - 0.2)) * focus;
      } else {
        kind[i] = 1;
        wide[i] = lerp(0.04, 0.21, shadow ** 1.3) * focus;
      }
      if (wide[i] < 0.035) kind[i] = 0;
    }
    // runs of the same kind become strokes; start the scan at a gap so a run is never split at the seam
    let startAt = 0;
    while (startAt < n && kind[startAt]) startAt++;
    if (startAt === n) startAt = 0;
    let run = [];
    const flush = (k) => {
      if (run.length >= 3) {
        const p = new Float32Array(run.length * 2);
        const w = new Float32Array(run.length);
        run.forEach((q, c) => {
          p[c * 2] = loop[q][0];
          p[c * 2 + 1] = loop[q][1];
          const taper = Math.min(1, (c + 1) / 4, (run.length - c) / 4);
          w[c] = (wide[(q - 1 + n) % n] + wide[q] * 2 + wide[(q + 1) % n]) * 0.25 * (0.55 + 0.45 * taper);
        });
        out.push({ p, w, ink: s.cut.edge, r: s.k, kind: "edge" });
      }
      run = [];
    };
    let last = 0;
    for (let c = 0; c <= n; c++) {
      const q = (startAt + c) % n;
      const k = c === n ? 0 : kind[q];
      if (k !== last) {
        flush(last);
        last = k;
      }
      if (k) run.push(q);
    }
  }
  return out;
}

// shapes too slender for the grid: rods, strings, wires, whiskers, spokes, and tiny dots like eyes
export function slender(G, well, seed) {
  const out = [];
  for (const s of G.shapes) {
    if (!s.thin || s.type === "band") continue;
    const ink = s.cut.polar > 0 ? s.cut.body : s.cut.deep;
    if (s.type !== "tube") {
      const o = s.outline;
      let cx = 0;
      let cy = 0;
      for (const p of o) {
        cx += p[0] / o.length;
        cy += p[1] / o.length;
      }
      let far = o[0];
      for (const p of o) if (Math.hypot(p[0] - cx, p[1] - cy) > Math.hypot(far[0] - cx, far[1] - cy)) far = p;
      const reach = Math.hypot(far[0] - cx, far[1] - cy);
      let small = Infinity;
      for (const p of o) small = Math.min(small, Math.hypot(p[0] - cx, p[1] - cy));
      const w = Math.max(0.1, small * 2);
      if (see(G, s.k, cx, cy) !== 2) continue;
      if (reach < w) out.push({ p: Float32Array.of(cx, cy), w: Math.max(w, 0.14), ink, r: s.k, kind: "dot" });
      else out.push({ p: Float32Array.of(2 * cx - far[0], 2 * cy - far[1], cx, cy, far[0], far[1]), w, ink, r: s.k, kind: "thin" });
      continue;
    }
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        const p = new Float32Array(run.length * 2);
        const w = new Float32Array(run.length);
        let even = true;
        run.forEach((q, c) => {
          p[c * 2] = q[0];
          p[c * 2 + 1] = q[1];
          w[c] = Math.max(0.07, q[2] * 2);
          if (Math.abs(w[c] - w[0]) > 0.02) even = false;
        });
        out.push({ p, w: even ? w[0] : w, ink, r: s.k, kind: "thin" });
      }
      run = [];
    };
    for (const q of s.line) {
      if (see(G, s.k, q[0], q[1]) === 2) run.push(q);
      else flush();
    }
    flush();
  }
  return out;
}

// the director's blocking drawn as a faint construction sketch: what c was told, before it builds anything
export function blocking(G, well, ink) {
  const out = [];
  const count = G.shapes.length || 1;
  const line = (pts, u, w = 0.05) => {
    if (pts.length < 2) return;
    const p = new Float32Array(pts.length * 2);
    pts.forEach((q, c) => {
      p[c * 2] = q[0];
      p[c * 2 + 1] = q[1];
    });
    out.push({ p, w, ink, r: 0, kind: "block", u });
  };
  G.shapes.forEach((s, q) => {
    const u = (q / count) * 0.8;
    if (s.type === "band") {
      const pts = [];
      for (let i = 0; i < G.nw; i += 4) pts.push([i / G.RES, s.edge[i]]);
      return line(pts, u);
    }
    const loop = outline(s);
    line([...loop, loop[0]], u);
    if (s.type === "tube") {
      line(s.line, u + 0.02, 0.035);
      for (const [x, y] of s.pts) {
        line([[x - 0.45, y], [x + 0.45, y]], u + 0.04, 0.045);
        line([[x, y - 0.45], [x, y + 0.45]], u + 0.04, 0.045);
      }
    } else if (s.type === "blob") {
      const c = Math.cos((s.tilt * Math.PI) / 180);
      const n = Math.sin((s.tilt * Math.PI) / 180);
      line([[s.x - c * s.rx, s.y - n * s.rx], [s.x + c * s.rx, s.y + n * s.rx]], u + 0.02, 0.035);
      line([[s.x + n * s.ry, s.y - c * s.ry], [s.x - n * s.ry, s.y + c * s.ry]], u + 0.02, 0.035);
    }
  });
  return out;
}

const world = (G, x, y) => {
  const i = Math.round(x * G.RES);
  const j = Math.round(y * G.RES);
  if (i < 0 || j < 0 || i >= G.nw || j >= G.nh) return -1;
  const r = G.rid[j * G.nw + i];
  return !r || G.shapes[r - 1].type === "band" ? 1 : 0;
};

// threads: a few of the subject's own lines run on past its edge, downwind, as if it were still being drawn out
export function threads(G, strokes, wind, seed) {
  const rand = random(hash(`threads:${seed}`));
  const focal = new Set(G.shapes.filter((s) => s.role === "focus" && s.type !== "band" && !s.thin).map((s) => s.k));
  const dir = wind >= 0 ? 1 : -1;
  const share = lerp(0.04, 0.12, rand());
  const out = [];
  for (const s of strokes) {
    if (s.kind !== "slice" || !focal.has(s.r) || rand() > share) continue;
    const p = s.p;
    const n = p.length / 2;
    const end = dir > 0 ? n - 1 : 0;
    const prev = dir > 0 ? n - 2 : 1;
    const x = p[end * 2];
    const y = p[end * 2 + 1];
    let dx = x - p[prev * 2];
    let dy = y - p[prev * 2 + 1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    if (dx * dir < 0.3) continue;
    const reach = lerp(2, 12, rand() ** 2);
    const pts = [x, y];
    for (let t = 0.4; t < reach; t += 0.4) {
      const qx = x + dx * t;
      const qy = y + dy * t * 0.3 + Math.sin(t * 0.8 + s.r) * 0.06;
      const w = world(G, qx, qy);
      if (w < 0) break;
      if (!w) {
        if (t < 1.4) continue;
        break;
      }
      pts.push(qx, qy);
    }
    if (pts.length < 8) continue;
    const m = pts.length / 2;
    const w = new Float32Array(m);
    const base = typeof s.w === "number" ? s.w : s.w[end];
    for (let q = 0; q < m; q++) w[q] = Math.max(0.025, base * (1 - q / m));
    out.push({ p: Float32Array.from(pts), w, ink: s.ink, r: s.r, kind: "strand" });
  }
  return out;
}

// echoes: the subject's contour repeated downwind, fainter each time, wherever it lands on open ground or sky
export function echoes(G, strokes, well, wind, seed) {
  const rand = random(hash(`echo:${seed}`));
  const focal = new Set(G.shapes.filter((s) => s.role === "focus" && s.type !== "band").map((s) => s.k));
  const dx = (wind >= 0 ? 1 : -1) * lerp(1.1, 2.1, rand());
  const dy = -lerp(0.15, 0.7, rand());
  const faded = new Map();
  const out = [];
  for (const s of strokes) {
    if (s.kind !== "edge" || !focal.has(s.r)) continue;
    for (let k = 1; k <= 3; k++) {
      const key = `${s.ink}:${k}`;
      let ink = faded.get(key);
      if (ink === undefined) faded.set(key, (ink = well.ink(mix(well.inks[s.ink], well.paper, 0.3 + k * 0.17))));
      let run = [];
      const flush = () => {
        if (run.length >= 6) out.push({ p: Float32Array.from(run), w: 0.05, ink, r: s.r, kind: "strand" });
        run = [];
      };
      for (let i = 0; i < s.p.length; i += 2) {
        const x = s.p[i] + dx * k;
        const y = s.p[i + 1] + dy * k;
        if (world(G, x, y) === 1) run.push(x, y);
        else flush();
      }
      flush();
    }
  }
  return out;
}
