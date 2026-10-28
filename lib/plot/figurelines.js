import { classify, length, outlines } from "./contours.js";
import { streamlines } from "./hatch.js";
import { faceShape } from "./figure.js";
import { add, dist, mul, toWorld } from "./math.js";
import { hash, random } from "../random.js";

const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));

export function toneField(F, rimWeight = 0.85) {
  return (x, y) => {
    const l = F.light(x, y);
    const a = F.ao(x, y);
    const r = F.rim(x, y);
    return Math.min(1, Math.max(0, 1 - (0.22 + 0.78 * l) * (0.35 + 0.65 * a) - r * rimWeight));
  };
}

const HATCH = {
  1: { field: "along", form: [0.6, 6.5, 3.4], shadow: [0.86, 5, 3], width: 0.75 },
  2: { field: "along", oriented: true, form: [-1, 4.4, 2.1], shadow: [0.5, 6.5, 3.2], width: 0.8, test: 0.72, turn: 0.82, max: 420 },
  3: { field: "along", oriented: true, form: [-1, 4.2, 2.0], shadow: [0.48, 6, 3], width: 0.8, test: 0.72, turn: 0.82, max: 520 },
  4: { field: "ring", form: [0.16, 10, 2.8], shadow: [0.62, 7, 3.4], width: 0.9 },
  5: { field: "along", form: [0.08, 7, 2.4], shadow: [0.6, 6, 3], width: 0.9 },
  6: { field: "along", form: [0.14, 11, 2.8], shadow: [0.64, 7.5, 3.6], width: 0.85, max: 700 },
  7: { field: "along", form: [-1, 3.2, 2], shadow: [2, 1, 1], width: 0.9 },
  9: { field: "along", form: [0.1, 9, 2.6], shadow: [0.6, 7, 3.4], width: 0.9, max: 700 },
  10: { field: "along", form: [-1, 5.5, 2.6], shadow: [0.55, 5, 2.4], width: 0.85 },
};

export function figureLines(F, { pens, rng, tone, patterns = new Map(), avoid = () => false }) {
  const lines = [];
  for (const o of outlines(F, { iso: 0.2 })) {
    const { kind, code } = classify(F, o);
    lines.push({ pts: o.pts, pen: pens.outline(code & 15), width: kind === "outer" ? 1.85 : kind === "overlap" ? 1.4 : 0.95, layer: "outline", code, kind });
  }

  const codes = new Map();
  for (let i = 0; i < F.code.length; i += 5) if (F.code[i] >= 16) codes.set(F.code[i], (codes.get(F.code[i]) || 0) + 1);
  for (const code of codes.keys()) {
    const H = HATCH[code & 15];
    if (!H) continue;
    const inside = (x, y) => F.codeAt(x, y) === code && F.ndv(x, y) > 0.24 && !avoid(x, y);
    const [main, dark] = pens.fill(code & 15, code >> 4);
    const hair = H.field === "along" && H.oriented;
    const layer = hair ? "hair" : "hatch";
    const pass = (field, [t0, s0, s1], pen, width, extra = {}) => {
      const spacing = (x, y) => {
        const t = tone(x, y);
        if (t <= t0) return 0;
        const u = (t - Math.max(0, t0)) / (1 - Math.max(0, t0));
        return u < 0.42 ? s0 : u < 0.78 ? lerp(s0, s1, 0.55) : s1;
      };
      for (const l of streamlines(F, { rng, inside, dir: F[field], spacing, oriented: H.oriented, test: H.test ?? 0.62, turn: H.turn ?? 0.72, maxLength: H.max ?? 380, minLength: hair ? 7 : 5, cell: 2, ...extra })) {
        lines.push({ pts: l.pts, pen, width, layer, code });
      }
    };
    const pattern = patterns.get(code);
    if (pattern === "stripes") pass("ring", [-1, 7, 7], dark, 1.3);
    else if (pattern === "pinstripe") pass("along", [-1, 9, 9], dark, 0.75);
    else if (pattern === "rib") pass("along", [-1, 4.2, 4.2], dark, 0.7);
    else if (pattern === "plaid") {
      pass("along", [-1, 11, 11], dark, 1.05);
      pass("ring", [-1, 11, 11], pens.accent, 0.8, { seedStep: 9 });
    } else pass(H.field, H.form, main, H.width);
    if (H.shadow[0] < 1.5) pass(hair ? "along" : H.field === "ring" ? "along" : "ring", H.shadow, dark, H.width * 0.95, { seedStep: 9 });
  }
  return lines;
}

const EYE = (f) => ({ y: f ? -0.026 : -0.03, z0: f ? 0.016 : 0.018, z1: f ? 0.05 : 0.052, sag: f ? 0.0075 : 0.006 });

export function faceLines(scene, cam, F, pens) {
  const lines = [];
  scene.people.forEach((sk, idx) => {
    const f = sk.spec.sex === "f";
    const person = idx + 1;
    const skin = person * 16 + 1;
    const H = sk.head;
    const k = sk.hk;
    const shape = faceShape(sk.spec);
    const rng = random((hash(JSON.stringify(sk.spec)) ^ 0x3b9ac9b) >>> 0);
    const look = {
      size: rng.range(f ? 0.95 : 0.85, f ? 1.25 : 1.1),
      sag: rng.range(0.55, 1.35),
      tilt: rng.range(-0.004, 0.005),
      flick: rng.range(0.6, 1.2) * (f ? 1 : 0.6),
      flickUp: rng.range(-0.3, f ? 0.9 : 0.3),
      lashes: f ? rng.int(2, 4) : rng.int(0, 2),
      lash: rng.range(0.8, 1.3),
      brow: rng.range(-0.004, 0.006),
      arch: rng.range(0.001, 0.005),
      browLen: rng.range(0.85, 1.1),
      crease: rng.chance(f ? 0.55 : 0.3),
      trough: rng.chance(0.35),
      blush: rng.chance(f ? 0.85 : 0.5) ? rng.int(3, 6) : 0,
      blushTilt: rng.range(-0.5, 0.9),
      nose: rng.pick(["tick", "hook", "dot"]),
      lip: rng.range(0.8, 1.2),
    };
    const [ox, oy] = cam.project(toWorld(H, [0, 0, 0]));
    const [tx, ty] = cam.project(toWorld(H, [0, 0.1 * k, 0]));
    const wf = Math.min(1.15, Math.max(0.7, 0.6 + Math.hypot(tx - ox, ty - oy) / 180));
    const surface = (y, z) => {
      const [cx, cy, cz] = shape.c;
      const [rx, ry, rz] = shape.r;
      const x = cx + rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2 - ((z - cz) / rz) ** 2));
      return [x + 0.002, y, z];
    };
    const visible = (local) => {
      const P = toWorld(H, local.map((v) => v * k));
      const [sx, sy, depth] = cam.project(P);
      if (sx < 0 || sy < 0 || sx >= cam.width || sy >= cam.height) return null;
      const i = F.index(sx, sy);
      if (F.code[i] !== skin) return null;
      const S = add(cam.eye, mul(cam.ray(sx, sy), F.depth[i]));
      return dist(S, P) < 0.018 * k ? [sx, sy, depth] : null;
    };
    const curve = (fn, n, pen, width, kind) => {
      let run = [];
      const flush = () => {
        if (run.length >= 4 && length(run) > 1.5) lines.push({ pts: run, pen, width: width * wf, layer: "face", kind, code: skin });
        run = [];
      };
      for (let i = 0; i <= n; i++) {
        const p = visible(fn(i / n));
        if (p) run.push(p[0], p[1]);
        else flush();
      }
      flush();
    };
    const e = EYE(f);
    const half = ((e.z1 - e.z0) / 2) * look.size;
    const mid = (e.z0 + e.z1) / 2;
    const sag = e.sag * look.sag;
    const lid = (t) => e.y - Math.sin(Math.PI * t) * sag + t * t * look.tilt;
    const slope = (Math.PI * sag + 2 * look.tilt) / (2 * half);
    const fl = 0.009 * look.flick;
    const nose = f ? [0.092, -0.045] : [0.095, -0.049];
    for (const side of [-1, 1]) {
      const z = (t) => side * (mid - half + 2 * half * t);
      curve((t) => surface(lid(t), z(t)), 24, pens.ink, f ? 2.5 : 2.2, "eye");
      curve((t) => {
        const q = 0.72 + t * 0.56;
        if (q <= 1) return surface(lid(q), z(q));
        const s = (q - 1) / 0.28;
        return surface(lid(1) + s * fl * (slope * 0.6 + look.flickUp), z(1) + side * s * fl);
      }, 10, pens.ink, f ? 2.1 : 1.8, "flick");
      for (let j = 0; j < look.lashes; j++) {
        const t0 = look.lashes === 1 ? 0.85 : 0.55 + (0.4 * j) / (look.lashes - 1) + rng.range(-0.04, 0.04);
        const l = (0.004 + 0.003 * t0) * look.lash * (f ? 1 : 0.7) * rng.range(0.8, 1.2);
        const out = rng.range(0.2, 0.7) * (0.5 + t0);
        curve((t) => surface(lid(t0) - t * l + t * t * l * 0.25, z(t0) + side * t * l * out), 6, pens.ink, f ? 1.4 : 1.2, "lash");
      }
      if (look.crease) curve((t) => surface(lid(0.2 + t * 0.7) + 0.006 + Math.sin(Math.PI * t) * 0.0012, z(0.2 + t * 0.7)), 14, pens.ink, 0.8, "crease");
      if (look.trough) curve((t) => surface(e.y - sag - 0.007 - Math.sin(Math.PI * t) * 0.001, z(0.3 + t * 0.4)), 8, pens.mouth, 0.75, "trough");
      curve((t) => {
        const zz = side * (0.012 + 0.042 * look.browLen * t);
        return surface((f ? 0.007 : 0.004) + Math.sin(Math.PI * t) * look.arch - t * look.brow, zz);
      }, 18, pens.hairDark(person), f ? 1.6 : 2, "brow");
      for (let j = 0; j < look.blush; j++) {
        const y0 = -0.044 - (j % 2) * 0.004 + rng.range(-0.002, 0.002);
        const z0 = 0.027 + j * (0.022 / look.blush);
        curve((t) => surface(y0 + (t - 0.5) * 0.01, side * (z0 + (t - 0.5) * 0.008 * look.blushTilt)), 5, pens.accent, 1.1, "blush");
      }
      const nz = side * 0.006;
      if (look.nose === "tick") curve((t) => [nose[0] - 0.003 - t * 0.007, nose[1] - 0.002 - t * 0.0015, nz + side * t * 0.003], 6, pens.ink, 1.2, "nose");
      else if (look.nose === "hook") curve((t) => [nose[0] - 0.002 - t * 0.01, nose[1] - 0.003 + Math.sin(Math.PI * t) * 0.003, nz * (1 + t)], 8, pens.ink, 1.2, "nose");
      else curve((t) => [nose[0] - 0.004 - t * 0.004, nose[1] - 0.003, nz], 4, pens.ink, 1.4, "nose");
    }
    const w = 0.008 * look.lip;
    curve((t) => surface(-0.066 + Math.sin(Math.PI * t) * 0.0012 - Math.sin(2 * Math.PI * t) ** 2 * 0.0008, (t - 0.5) * 2 * w), 10, pens.mouth, 1.3, "mouth");
    curve((t) => surface(-0.073 - Math.sin(Math.PI * t) * 0.0006, (t - 0.5) * w), 6, pens.mouth, 0.9, "lip");
  });
  return lines;
}


function perp(a) {
  const h = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = [a[1] * h[2] - a[2] * h[1], a[2] * h[0] - a[0] * h[2], a[0] * h[1] - a[1] * h[0]];
  const ul = Math.hypot(...u) || 1;
  const uu = u.map((x) => x / ul);
  return [uu, [a[1] * uu[2] - a[2] * uu[1], a[2] * uu[0] - a[0] * uu[2], a[0] * uu[1] - a[1] * uu[0]]];
}

export function foldLines(scene, cam, F, pens, rng) {
  const lines = [];
  const arc = (c, axis, r, code, count, spread) => {
    const [u, v] = perp(axis);
    for (let i = 0; i < count; i++) {
      const shift = rng.range(-spread, spread);
      const c0 = add(c, mul(axis, shift));
      const start = rng.range(0, Math.PI * 2);
      const span = rng.range(1.1, 2.6);
      const tilt = rng.range(-0.35, 0.35);
      const wob = rng.range(0.002, 0.006);
      let run = [];
      const flush = () => {
        if (run.length >= 6 && length(run) > 4) lines.push({ pts: run, pen: pens.ink, width: 0.85, layer: "folds", code: Array.isArray(code) ? code[0] : code });
        run = [];
      };
      for (let k = 0; k <= 18; k++) {
        const th = start + (k / 18) * span;
        const rr = r * (1.02 + Math.sin(k * 1.7) * wob * 3);
        const P = add(add(c0, add(mul(u, Math.cos(th) * rr), mul(v, Math.sin(th) * rr))), mul(axis, Math.sin(th) * tilt * r + Math.sin(k * 0.9) * wob));
        const [sx, sy, depth] = cam.project(P);
        const j = F.index(sx, sy);
        const S = add(cam.eye, mul(cam.ray(sx, sy), F.depth[j]));
        if ((Array.isArray(code) ? code.includes(F.code[j]) : F.code[j] === code) && dist(S, P) < 0.03 && depth > 0) run.push(sx, sy);
        else flush();
      }
      flush();
    }
  };
  const norm3 = (a, b) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const l = Math.hypot(...d) || 1;
    return d.map((x) => x / l);
  };
  scene.people.forEach((sk, idx) => {
    const person = idx + 1;
    const s = sk.s;
    if (sk.spec.sex === "m") {
      const top = [person * 16 + 4, person * 16 + 9];
      const bottom = person * 16 + 5;
      for (const A of [sk.arms.L, sk.arms.R]) {
        arc(A.elbow, norm3(A.S, A.elbow), 0.053 * s, top, rng.int(2, 4), 0.05 * s);
        arc(A.elbow, norm3(A.elbow, A.wrist), 0.05 * s, top, rng.int(1, 3), 0.04 * s);
      }
      arc(add(sk.P0, mul(sk.F0.y, 0.09 * s)), sk.F0.y, 0.13 * s, top, rng.int(2, 4), 0.03 * s);
      for (const L of [sk.legs.L, sk.legs.R]) {
        arc(L.knee, norm3(L.H, L.knee), 0.07 * s, bottom, rng.int(2, 4), 0.05 * s);
        arc(lerp3(L.knee, L.ankle, 0.85), norm3(L.knee, L.ankle), 0.06 * s, bottom, rng.int(1, 3), 0.04 * s);
      }
    } else {
      const dress = [person * 16 + 6, person * 16 + 4, person * 16 + 5];
      arc(add(sk.P1, mul(sk.F1.y, -0.02 * s)), sk.F1.y, 0.1 * s, dress, rng.int(1, 3), 0.02 * s);
    }
  });
  return lines;
}

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
