import { classify, length, outlines } from "./contours.js";
import { streamlines } from "./hatch.js";
import { add, dist, mul, toWorld } from "./math.js";

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
  1: { field: "ring", form: [0.46, 8.5, 3.2], shadow: [0.78, 7, 4], width: 0.85 },
  2: { field: "along", oriented: true, form: [-1, 4.4, 2.1], shadow: [0.5, 6.5, 3.2], width: 0.8, test: 0.72, turn: 0.82, max: 420 },
  3: { field: "along", oriented: true, form: [-1, 4.2, 2.0], shadow: [0.48, 6, 3], width: 0.8, test: 0.72, turn: 0.82, max: 520 },
  4: { field: "ring", form: [0.16, 10, 2.8], shadow: [0.62, 7, 3.4], width: 0.9 },
  5: { field: "along", form: [0.08, 7, 2.4], shadow: [0.6, 6, 3], width: 0.9 },
  6: { field: "along", form: [0.14, 11, 2.8], shadow: [0.64, 7.5, 3.6], width: 0.85, max: 700 },
  7: { field: "along", form: [-1, 3.2, 2], shadow: [2, 1, 1], width: 0.9 },
};

export function figureLines(F, { pens, rng, tone }) {
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
    const inside = (x, y) => F.codeAt(x, y) === code && F.ndv(x, y) > 0.24;
    const [main, dark] = pens.fill(code & 15, code >> 4);
    const hair = H.field === "along" && H.oriented;
    const layer = hair ? "hair" : "hatch";
    const pass = (field, [t0, s0, s1], pen, width, extra = {}) => {
      const spacing = (x, y) => {
        const t = tone(x, y);
        return t > t0 ? lerp(s0, s1, (t - Math.max(0, t0)) / (1 - Math.max(0, t0))) : 0;
      };
      for (const l of streamlines(F, { rng, inside, dir: F[field], spacing, oriented: H.oriented, test: H.test ?? 0.62, turn: H.turn ?? 0.72, maxLength: H.max ?? 380, minLength: hair ? 7 : 5, cell: 2, ...extra })) {
        lines.push({ pts: l.pts, pen, width, layer, code });
      }
    };
    pass(H.field, H.form, main, H.width);
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
    const faceC = f ? [0.01, -0.022, 0] : [0.01, -0.026, 0];
    const faceR = f ? 0.074 : 0.077;
    const surface = (y, z) => {
      const dy = y - faceC[1];
      const x = faceC[0] + Math.sqrt(Math.max(0, faceR * faceR - dy * dy - z * z));
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
        if (run.length >= 4 && length(run) > 1.5) lines.push({ pts: run, pen, width, layer: "face", kind, code: skin });
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
    for (const side of [-1, 1]) {
      curve((t) => {
        const z = side * (e.z0 + (e.z1 - e.z0) * t);
        return surface(e.y - Math.sin(Math.PI * t) * e.sag + t * t * 0.004, z);
      }, 24, pens.ink, 1.5, "eye");
      for (let j = 0; j < 3; j++) {
        const t0 = 0.72 + j * 0.12;
        curve((t) => {
          const z = side * (e.z0 + (e.z1 - e.z0) * t0 + t * 0.007);
          return surface(e.y - Math.sin(Math.PI * t0) * e.sag + t0 * t0 * 0.004 - t * (0.006 + j * 0.001), z);
        }, 6, pens.ink, 1.1, "lash");
      }
      curve((t) => {
        const z = side * (0.014 + 0.04 * t);
        return surface(0.006 + Math.sin(Math.PI * t) * 0.004 - t * 0.003, z);
      }, 18, pens.hairDark(person), 1.05, "brow");
      for (let j = 0; j < 4; j++) {
        const z0 = 0.03 + j * 0.0065;
        curve((t) => surface(-0.046 + t * 0.011, side * (z0 + t * 0.004)), 5, pens.accent, 1.15, "blush");
      }
    }
    curve((t) => surface(-0.066 + Math.sin(Math.PI * t) * 0.0015, (t - 0.5) * 0.016), 8, pens.mouth, 1.0, "mouth");
  });
  return lines;
}

