import { random } from "../random.js";
import { MAT } from "./figure.js";
import { length } from "./contours.js";
import { onto, seen } from "./probe.js";
import { add, cross, dot, len, lerp, madd, mul, norm, sub, toDir, toWorld } from "./math.js";

const ring = (c, a, b, r, n = 14) => Array.from({ length: n + 1 }, (_, i) => add(c, add(mul(a, Math.cos((i / n) * Math.PI * 2) * r), mul(b, Math.sin((i / n) * Math.PI * 2) * r))));

export function halo(lines, w, h, r = 2.2) {
  const W = Math.ceil(w);
  const H = Math.ceil(h);
  const grid = new Uint8Array(W * H);
  const R = Math.ceil(r);
  for (const l of lines) {
    const p = l.pts;
    for (let i = 0; i < p.length - 2; i += 2) {
      const steps = Math.max(1, Math.ceil(Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1])));
      for (let k = 0; k <= steps; k++) {
        const x = p[i] + ((p[i + 2] - p[i]) * k) / steps;
        const y = p[i + 1] + ((p[i + 3] - p[i + 1]) * k) / steps;
        for (let dy = -R; dy <= R; dy++) {
          for (let dx = -R; dx <= R; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const gx = Math.round(x + dx);
            const gy = Math.round(y + dy);
            if (gx >= 0 && gy >= 0 && gx < W && gy < H) grid[gy * W + gx] = 1;
          }
        }
      }
    }
  }
  return (x, y) => {
    const gx = Math.round(x);
    const gy = Math.round(y);
    return gx >= 0 && gy >= 0 && gx < W && gy < H && grid[gy * W + gx] === 1;
  };
}

export function detailLines(scene, cam, F, pens, seed) {
  const rng = random((seed ^ 0x6c8e9cf5) >>> 0);
  const lines = [];
  scene.people.forEach((sk, idx) => {
    const person = idx + 1;
    const o = sk.outfit || {};
    const g = sk.gear || {};
    const { s, F0, F1, F2, legs, root } = sk;
    const code = (m) => person * 16 + m;
    const tol = 0.012 * s;

    const draw = (pts3, codes, pen, width, layer = "details") => {
      let run = [];
      const flush = () => {
        if (run.length >= 4 && length(run) > 2) lines.push({ pts: run, pen, width, layer, code: codes[0] });
        run = [];
      };
      for (const P of pts3) {
        const q = P && seen(cam, F, P, codes, tol);
        if (q) run.push(q[0], q[1]);
        else flush();
      }
      flush();
    };
    const snap = (node, targets, dir) => targets.map((t) => onto(node, t, typeof dir === "function" ? dir(t) : dir));
    const along = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
    const front = (node, Fr, ys, z, dir = mul(Fr.x, 1)) => snap(node, ys.map((y) => toWorld(Fr, [0, y * s, z * s])), mul(dir, -1));
    const button = (node, Fr, y, z, r, codes, pen) => {
      const c = onto(node, toWorld(Fr, [0, y * s, z * s]), mul(Fr.x, -1));
      if (!c) return;
      const pts = snap(node, ring(madd(c, Fr.x, 0.02 * s), Fr.y, Fr.z, r * s, 10), mul(Fr.x, -1));
      draw(pts, codes, pen, 0.9);
    };

    const sleeveRings = (node, codes, ends) => {
      for (const A of [sk.arms.L, sk.arms.R]) {
        for (const [a, b, t] of ends(A)) {
          const axis = norm(sub(b, a));
          const c = lerp(a, b, t);
          const u = norm(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
          const v = cross(axis, u);
          const away = norm(sub(A.S, F2.o));
          const pts = snap(node, ring(c, u, v, 0.16, 36), (t) => norm(sub(c, t))).map((p) => (p && dot(sub(p, c), away) > -0.4 * len(sub(p, c)) ? p : null));
          draw(pts, codes, pens.ink, 1.0);
        }
      }
    };
    const sideSeams = (node, codes, y0, y1) => {
      for (const z of [-1, 1]) draw(snap(node, along(24, (t) => toWorld(F2, [-0.005 * s, (y0 + (y1 - y0) * t) * s, 0])), mul(F2.z, -z)), codes, pens.ink, 0.95);
    };

    if (sk.spec.sex === "m") {
      const topCodes = [code(o.kind === "jacket" ? MAT.coat : MAT.top)];
      const sleeveNode = o.kind === "jacket" ? g.coat : g.top;
      if (sleeveNode) {
        const end = o.kind === "shirt" ? o.sleeve : 0.92;
        sleeveRings(sleeveNode, topCodes, (A) => [[A.S, A.elbow, 0.12], ...(end > 0.9 ? [[A.elbow, A.wrist, end - 0.08], [A.elbow, A.wrist, end - 0.03]] : [])]);
      }
      if (g.torso) sideSeams(g.torso, topCodes, 0.02, -0.3);
      if (o.kind === "shirt" && g.top) {
        const codes = [code(MAT.top)];
        const ys = along(30, (t) => 0.12 - t * 0.42);
        for (const z of [-0.011, 0.011]) draw(front(g.top, F2, ys, z), codes, pens.ink, 1.05);
        for (let y = 0.09; y > -0.3; y -= 0.075) button(g.top, F2, y, 0, 0.0055, codes, pens.ink);
        const side = rng.chance(0.5) ? 1 : -1;
        const z0 = side * 0.035;
        const z1 = side * 0.088;
        const box = [...along(6, (t) => [0.075, z0 + (z1 - z0) * t]), ...along(8, (t) => [0.075 - t * 0.075, z1]), ...along(6, (t) => [0, z1 + (z0 - z1) * t]), ...along(8, (t) => [t * 0.075, z0])];
        draw(snap(g.top, box.map(([y, z]) => toWorld(F2, [0, y * s, z * s])), mul(F2.x, -1)), codes, pens.ink, 1.05);
        draw(snap(g.top, along(6, (t) => toWorld(F2, [0, 0.066 * s, (z0 + (z1 - z0) * t) * s])), mul(F2.x, -1)), codes, pens.ink, 0.95);
      }
      if (o.kind === "sweater" && g.top) {
        const codes = [code(MAT.top)];
        const ys = along(60, (t) => 0.1 - t * 0.38);
        for (const ph of [0, Math.PI]) draw(snap(g.top, ys.map((y) => toWorld(F2, [0, y * s, Math.sin((y / 0.05) * Math.PI + ph) * 0.016 * s])), mul(F2.x, -1)), codes, pens.ink, 1.0);
        for (const z of [-0.03, 0.03, -0.074, 0.074]) draw(front(g.top, F2, ys, z), codes, pens.ink, 0.85);
        for (let a = -1.4; a <= 1.4; a += 0.07) {
          const dir = add(mul(F0.x, Math.cos(a)), mul(F0.z, Math.sin(a)));
          const ticks = along(3, (t) => onto(g.top, toWorld(F0, [0, (0.0 + t * 0.04) * s, 0]), mul(dir, -1)));
          draw(ticks, codes, pens.ink, 0.85);
        }
      }
      if (o.kind === "jacket" && g.coat) {
        const codes = [code(MAT.coat)];
        const side = o.open * s + 0.014 * s;
        for (const y of [-0.04, -0.12]) {
          const c = onto(g.coat, toWorld(F1, [0, y * s, side]), mul(F1.x, -1));
          if (c) draw(snap(g.coat, ring(madd(c, F1.x, 0.02 * s), F1.y, F1.z, 0.007 * s, 10), mul(F1.x, -1)), codes, pens.ink, 1.0);
        }
        if (g.hem) {
          for (const z of [-1, 1]) {
            const flap = [...along(6, (t) => [0.02, z * (0.05 + t * 0.065)]), ...along(3, (t) => [0.02 - t * 0.03, z * 0.115]), ...along(6, (t) => [-0.01, z * (0.115 - t * 0.065)])];
            draw(snap(g.hem, flap.map(([y, zz]) => toWorld(F0, [0, y * s, zz * s])), mul(F0.x, -1)), codes, pens.ink, 1.05);
          }
        }
      }
      if (g.pants) {
        const codes = [code(MAT.bottom)];
        for (const L of [legs.L, legs.R]) {
          const seg = (a, b, t0, t1) => {
            const axis = norm(sub(b, a));
            const fwd = norm(sub(root.x, mul(axis, dot(root.x, axis))));
            const out = norm(sub(mul(root.z, L.side), mul(axis, dot(mul(root.z, L.side), axis))));
            return [fwd, out].map((d) => snap(g.pants, along(14, (t) => lerp(a, b, t0 + (t1 - t0) * t)), mul(d, -1)).map((p) => p));
          };
          const [crease1, seam1] = seg(L.H, L.knee, 0.2, 1);
          const [crease2, seam2] = seg(L.knee, L.ankle, 0, 0.88);
          draw([...crease1, ...crease2], codes, pens.ink, 0.9);
          draw([...seam1, ...seam2], codes, pens.ink, 0.85);
        }
      }
      return;
    }

    if (o.kind === "sundress" && g.dress) {
      const codes = [code(MAT.dress)];
      const c = madd(F1.o, F1.y, -0.03 * s);
      draw(snap(g.dress, ring(c, F1.x, F1.z, 0.25, 48), (t) => norm(sub(c, t))), codes, pens.ink, 0.85);
      for (const y of [0.0, -0.04, -0.08]) button(g.dress, F2, y, 0, 0.0045, codes, pens.ink);
    }
    if (o.kind === "sailor" && g.collar) {
      const codes = [code(MAT.bottom)];
      for (const z of [-1, 1]) {
        for (const off of [0.01, 0.017]) {
          const pts = along(20, (t) => {
            const a = t < 0.5 ? [-0.02, 0.165, 0.1] : [0.07, 0.11, 0.07];
            const b = t < 0.5 ? [0.07, 0.11, 0.07] : [0.115, 0.02, 0.008];
            const u = t < 0.5 ? t * 2 : t * 2 - 1;
            const p = a.map((v, i) => v + (b[i] - v) * u);
            return toWorld(F2, [p[0] * s, p[1] * s, z * (p[2] + off * (1 - t * 0.7)) * s]);
          });
          draw(snap(g.collar, pts, mul(toDir(F2, [1, 0.6, 0]), -1)), codes, pens.accent, 1.0);
        }
      }
      if (g.top) sleeveRings(g.top, [code(MAT.top)], (A) => [[A.S, A.elbow, 0.44], [A.S, A.elbow, 0.49]]);
      for (const off of [0.012, 0.02]) {
        const pts = along(40, (t) => {
          const a = -Math.PI / 2 + t * Math.PI;
          const dir = add(mul(F2.x, -Math.cos(a)), mul(F2.z, Math.sin(a)));
          return onto(g.collar, add(toWorld(F2, [0, (0.03 + off) * s, 0]), mul(dir, 0.0)), mul(dir, -1), 0.25);
        });
        draw(pts, codes, pens.accent, 1.0);
      }
    }
    if (o.kind === "yukata" && g.obi) {
      const codes = [code(MAT.trim)];
      const c = madd(F1.o, F1.y, -0.01 * s);
      draw(snap(g.obi, ring(c, F1.x, F1.z, 0.3, 48), (t) => norm(sub(c, t))), codes, pens.accent, 1.6);
      for (const dy of [0.045, -0.045]) {
        const cc = madd(c, F1.y, dy * s);
        draw(snap(g.obi, ring(cc, F1.x, F1.z, 0.3, 48), (t) => norm(sub(cc, t))), codes, pens.ink, 0.95);
      }
      lines.push(...motifs(F, cam, sk, code(MAT.dress), pens.accent, rng));
    }
  });
  return lines;
}

function motifs(F, cam, sk, code, pen, rng) {
  const out = [];
  const [x0, y0] = cam.project(sk.P0);
  const [, y1] = cam.project(madd(sk.P0, [0, 1, 0], 0.1));
  const unit = Math.abs(y1 - y0) / 0.1;
  const R = 0.011 * unit;
  if (R < 2.2) return out;
  const gap = 0.07 * unit;
  const a = [0, 0];
  const b = [0, 0];
  for (let y = 0; y < F.h; y += gap) {
    for (let x = (Math.floor(y / gap) % 2) * gap * 0.5; x < F.w; x += gap) {
      const cx = x + rng.range(-0.3, 0.3) * gap;
      const cy = y + rng.range(-0.3, 0.3) * gap;
      if (F.codeAt(cx, cy) !== code || F.ndv(cx, cy) < 0.3) continue;
      F.along(cx, cy, a);
      F.ring(cx, cy, b);
      const squash = Math.max(0.35, F.ndv(cx, cy));
      const spin = rng.range(0, Math.PI * 2);
      const pts = [];
      let ok = true;
      for (let i = 0; i <= 40; i++) {
        const th = (i / 40) * Math.PI * 2;
        const r = R * (0.45 + 0.55 * Math.abs(Math.sin(2.5 * (th + spin)))) ** 0.7 * (Math.abs(Math.sin(2.5 * (th + spin))) > 0.97 ? 0.82 : 1);
        const u = Math.cos(th) * r;
        const v = Math.sin(th) * r * squash;
        const px = cx + a[0] * u + b[0] * v;
        const py = cy + a[1] * u + b[1] * v;
        if (F.codeAt(px, py) !== code) ok = false;
        pts.push(px, py);
      }
      if (ok) out.push({ pts, pen, width: 0.8, layer: "details", code });
    }
  }
  return out;
}
