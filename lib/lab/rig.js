import { random } from "../random.js";
import { add, mix, norm, rotX, rotY, rotZ, scale, sub } from "./vec.js";

export const MAT = { skin: 1, hairA: 2, hairB: 3, shirt: 4, pants: 5, dress: 6, shoe: 7 };

const sph = (c, r, m, k) => ({ kind: "sph", c, r, m, k });
const ell = (c, r, axes, m, k) => ({ kind: "ell", c, r, axes, m, k });
const cone = (a, b, r1, r2, m, k) => ({ kind: "cone", a, b, r1, r2, m, k });
const skirt = (a, b, r1, r2, m, k, folds, depth) => ({ kind: "fold", a, b, r1, r2, m, k, folds, depth });

function bezier(p0, p1, p2, t) {
  return add(add(scale(p0, (1 - t) * (1 - t)), scale(p1, 2 * (1 - t) * t)), scale(p2, t * t));
}

function clump(p0, p1, p2, r0, m, r1 = 0.0015) {
  const ts = [0, 0.3, 0.62, 1];
  const pts = ts.map((t) => bezier(p0, p1, p2, t));
  const rs = ts.map((t) => r1 + (r0 - r1) * (1 - t) ** 0.85 * (1 + Math.sin(t * Math.PI) * 0.15));
  return [0, 1, 2].map((i) => cone(pts[i], pts[i + 1], rs[i], rs[i + 1], m));
}

function body(o) {
  const s = o.height / 1.8;
  const F = [o.facing, 0, 0];
  const U = [0, 1, 0];
  const L = [0, 0, -o.facing];
  const dir = (l) => add(add(scale(F, l[0]), scale(U, l[1])), scale(L, l[2]));
  const at = (l) => add(o.base, dir(l));
  const hip = 0.98 * s;
  const bend = (l) => {
    const r = rotZ([l[0], l[1] - hip, l[2]], -o.lean);
    return [r[0], r[1] + hip, r[2]];
  };
  const up = (l) => at(bend(l));
  const lean = (v) => dir(rotZ(v, -o.lean));
  const axes = [lean([1, 0, 0]), lean([0, 1, 0]), lean([0, 0, 1])];
  const turn = (v) => dir(rotZ(rotY(rotX(v, o.roll), o.yaw), o.pitch - o.lean));
  const headAxes = [turn([1, 0, 0]), turn([0, 1, 0]), turn([0, 0, 1])];
  const k = o.headSize;
  const head = up([0.012 * s + o.reach, 1.615 * s, 0]);
  const H = (l) => add(head, turn(scale(l, k)));
  return { s, at, up, dir, axes, headAxes, head, H, k, F, L };
}

function headParts(b, m) {
  const k = b.k;
  return [
    sph(b.H([-0.012, 0.014, 0]), 0.095 * k, MAT.skin),
    ell(b.H([0.03, -0.03, 0]), [0.06 * k, 0.07 * k, 0.066 * k], b.headAxes, MAT.skin),
    cone(b.H([0.0, -0.045, 0.044]), b.H([0.054, -0.094, 0.01]), 0.022 * k, 0.012 * k, MAT.skin, 0.03),
    cone(b.H([0.0, -0.045, -0.044]), b.H([0.054, -0.094, -0.01]), 0.022 * k, 0.012 * k, MAT.skin, 0.03),
    sph(b.H([0.056, -0.096, 0]), 0.013 * k, MAT.skin),
    cone(b.H([0.079, -0.012, 0]), b.H([0.096, -0.036, 0]), 0.0062 * k, 0.0028 * k, MAT.skin, 0.008),
    ell(b.H([-0.012, -0.018, 0.088]), [0.016 * b.k, 0.026 * b.k, 0.008 * b.k], b.headAxes, MAT.skin, 0.008),
    ell(b.H([-0.012, -0.018, -0.088]), [0.016 * b.k, 0.026 * b.k, 0.008 * b.k], b.headAxes, MAT.skin, 0.008),
    cone(b.H([-0.012, -0.07, 0]), b.up([-0.01, 1.47 * b.s, 0]), 0.036 * b.s, 0.042 * b.s, m || MAT.skin, 0.02),
  ];
}

function messyHair(b, seed) {
  const r = random(seed);
  const m = MAT.hairA;
  const k = b.k;
  const out = [sph(b.H([-0.016, 0.016, 0]), 0.101 * k, m)];
  for (let i = 0; i < 46; i++) {
    const az = r.range(0, Math.PI * 2);
    const el = r.range(-0.15, 1.45);
    if (Math.cos(az) > 0.3 && el < 1.05) continue;
    const d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const root = add([-0.012, 0.014, 0], scale(d, 0.088));
    const out2 = norm([d[0] * 0.9 - 0.15, d[1] * 0.35 - 0.55 + r.range(-0.25, 0.3), d[2] * 1.1]);
    const flick = norm(add(out2, [r.range(-0.3, 0.3), r.range(-0.15, 0.2), r.range(-0.3, 0.3)]));
    const length = r.range(0.085, 0.15) * (el > 1.1 ? 0.75 : 1);
    const tip = add(add(root, scale(flick, length)), [r.range(-0.01, 0.01), r.range(-0.01, 0.02), 0]);
    const mid = add(add(root, scale(flick, length * 0.45)), scale(d, 0.02));
    out.push(...clump(b.H(root), b.H(mid), b.H(tip), r.range(0.022, 0.03) * k, m));
  }
  for (let i = 0; i < 9; i++) {
    const z = (i / 8 - 0.5) * 0.13;
    const sweep = r.range(-0.03, 0.03) + z * 0.5;
    const root = [0.04, 0.09, z * 0.8];
    const mid = [0.1, 0.048 + r.range(-0.01, 0.01), z * 1.05 + sweep * 0.5];
    const tip = [0.105, -0.012 + r.range(-0.02, 0.012), z * 1.15 + sweep];
    out.push(...clump(b.H(root), b.H(mid), b.H(tip), r.range(0.02, 0.026) * k, m));
  }
  for (const side of [-1, 1]) {
    out.push(...clump(b.H([0.0, 0.03, side * 0.088]), b.H([0.025, -0.03, side * 0.094]), b.H([0.03, -0.075, side * 0.088]), 0.02 * k, m));
    out.push(...clump(b.H([-0.06, -0.02, side * 0.07]), b.H([-0.08, -0.07, side * 0.075]), b.H([-0.07, -0.115, side * 0.06]), 0.022 * k, m));
  }
  return out;
}

function longHair(b, seed, tuck = 0) {
  const r = random(seed);
  const m = MAT.hairB;
  const k = b.k;
  const out = [sph(b.H([-0.016, 0.017, 0]), 0.1 * k, m)];
  for (let i = 0; i < 9; i++) {
    const z = (i / 8 - 0.5) * 0.13;
    const sweep = z * 0.35 + r.range(-0.012, 0.012);
    out.push(...clump(b.H([0.045, 0.09, z * 0.75]), b.H([0.096, 0.052, z + sweep * 0.5]), b.H([0.1, -0.006 + r.range(-0.012, 0.006), z * 1.12 + sweep]), r.range(0.018, 0.023) * k, m));
  }
  for (let i = 0; i < 10; i++) {
    const az = r.range(0.6, 2.6) * (r.chance(0.5) ? 1 : -1);
    const el = r.range(0.7, 1.35);
    const d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const root = add([-0.014, 0.016, 0], scale(d, 0.092));
    const tip = add(root, [-0.06, -0.05, d[2] * 0.06]);
    out.push(...clump(b.H(root), b.H(add(root, add(scale(d, 0.03), [-0.02, 0, 0]))), b.H(tip), 0.03 * k, m));
  }
  const fall = (root, drop, sway, back, wave) => {
    const w0 = b.H(root);
    const p1 = add(w0, add(scale(b.F, back * 0.6), [0, -drop * 0.45, sway * 0.5]));
    const p2 = add(w0, add(scale(b.F, back), [0, -drop, sway]));
    return [w0, add(p1, [0, 0, wave]), p2];
  };
  for (const side of [-1, 1]) {
    const back = side === tuck ? -0.07 : 0;
    for (let j = 0; j < 2; j++) {
      const [p0, p1, p2] = fall([0.03 - j * 0.035 + back, 0.035, side * (0.082 + j * 0.006)], 0.36 + j * 0.06, side * 0.025 * (j + 1), 0.035 - j * 0.03 + back * 1.2, side * 0.01);
      out.push(...clump(p0, p1, p2, (0.026 - j * 0.002) * k, m, 0.002));
    }
  }
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const az = Math.PI * (0.62 + t * 0.76) + r.range(-0.05, 0.05);
    const el = r.range(-0.15, 0.85);
    const d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    const root = add([-0.014, 0.016, 0], scale(d, 0.094));
    const [p0, p1, p2] = fall(root, r.range(0.46, 0.62), d[2] * 0.08 + r.range(-0.02, 0.02), -0.11 - Math.abs(d[2]) * 0.02, r.range(-0.015, 0.015));
    out.push(...clump(p0, add(p1, scale(b.F, -0.04)), p2, r.range(0.03, 0.038) * k, m, 0.003));
  }
  return out;
}

function arm(points, r, m, hand) {
  const [shoulder, elbow, wrist, tip] = points;
  return [cone(shoulder, elbow, r * 1.15, r, m), cone(elbow, wrist, r * 0.95, r * 0.75, hand ?? m), cone(wrist, tip, r * 0.72, r * 0.55, MAT.skin, 0.012)];
}

const lips = (b) => b.H([0.083, -0.062, 0]);
const marks = (b) => [[0.088, 0.032, 0], [0.09, 0.0, 0], [0.099, -0.036, 0], [0.083, -0.062, 0], [0.069, -0.096, 0]].map((l) => b.H(l));

function solve(o) {
  const g0 = body({ base: [0, o.tiptoe, 0], facing: 1, height: o.girl, lean: 0.05, pitch: 0.5, roll: -0.1, yaw: 0.05, headSize: 0.95, reach: 0.03 });
  const gl = lips(g0);
  let best = null;
  for (let lean = 0.08; lean <= 0.2001; lean += 0.01) {
    for (let total = -0.5; total <= -0.2199; total += 0.02) {
      const pitch = total + lean;
      const m0 = body({ base: [0, 0, 0], facing: -1, height: o.man, lean, pitch, roll: 0.12, yaw: 0, headSize: 1, reach: 0.05 });
      const ml = lips(m0);
      const err = Math.abs(ml[1] - (gl[1] + o.lift)) + Math.abs(total + 0.34) * 0.05 + Math.abs(lean - 0.14) * 0.05;
      if (!best || err < best.err) best = { err, lean, pitch, m0 };
    }
  }
  const herFront = Math.max(...marks(g0).map((q) => q[0]));
  const hisFront = Math.min(...marks(best.m0).map((q) => q[0]));
  const manX = herFront + o.gap - hisFront;
  const shift = -(herFront + o.gap / 2);
  return { girlX: shift, manX: manX + shift, lean: best.lean, pitch: best.pitch };
}

export function couple() {
  const tiptoe = 0.05;
  const p = solve({ man: 1.8, girl: 1.64, gap: 0.012, lift: 0.03, tiptoe });
  const man = body({ base: [p.manX, 0, 0], facing: -1, height: 1.8, lean: p.lean, pitch: p.pitch, roll: 0.12, yaw: 0, headSize: 1, reach: 0.05 });
  const girl = body({ base: [p.girlX, tiptoe, 0], facing: 1, height: 1.64, lean: 0.05, pitch: 0.5, roll: -0.1, yaw: 0.05, headSize: 0.95, reach: 0.03 });
  const hold = [(p.manX + p.girlX) / 2, 0.97, 0.215];

  const manShoulder = (z) => man.up([-0.005, 1.415 * man.s, z * man.s]);
  const girlShoulder = (z) => girl.up([-0.005, 1.33 * girl.s, z * girl.s]);
  const ml = manShoulder(0.175);
  const mr = manShoulder(-0.175);
  const gr = girlShoulder(-0.155);
  const gl = girlShoulder(0.155);
  const manChest = man.up([0, 1.3 * man.s, 0]);
  const girlWaist = girl.up([0, 1.08 * girl.s, 0]);

  const manElbow = add(mix(ml, hold, 0.5), [0.035, 0.025, 0.06]);
  const girlElbow = add(mix(gr, hold, 0.5), [-0.03, 0.03, 0.06]);
  const manWrist = mix(manElbow, hold, 0.82);
  const girlWrist = mix(girlElbow, hold, 0.82);

  const groups = [
    {
      name: "man body",
      k: 0.035,
      prims: [
        ell(man.up([0, 1.31 * man.s, 0]), [0.105, 0.165, 0.19], man.axes, MAT.shirt),
        ell(man.up([0, 1.12 * man.s, 0]), [0.088, 0.13, 0.135], man.axes, MAT.shirt),
        ell(man.at([0, 0.97, 0]), [0.1, 0.1, 0.155], man.axes, MAT.pants),
        sph(ml, 0.058, MAT.shirt),
        sph(mr, 0.058, MAT.shirt),
        cone(man.at([0, 0.94, 0.085]), man.at([0.02, 0.5, 0.09]), 0.075, 0.055, MAT.pants),
        cone(man.at([0, 0.94, -0.085]), man.at([0.02, 0.5, -0.09]), 0.075, 0.055, MAT.pants),
      ],
    },
    {
      name: "man arms",
      k: 0.03,
      prims: [
        ...arm([ml, manElbow, manWrist, add(hold, [-0.012, -0.01, 0.01])], 0.046, MAT.shirt),
        ...arm([mr, add(mix(mr, girlWaist, 0.5), [0.02, -0.02, -0.08]), add(girlWaist, [-0.04, 0, -0.16]), add(girlWaist, [-0.1, 0.01, -0.12])], 0.046, MAT.shirt),
      ],
    },
    { name: "man head", k: 0.03, prims: headParts(man) },
    { name: "man hair", k: 0.012, prims: messyHair(man, 11) },
    {
      name: "girl body",
      k: 0.03,
      prims: [
        ell(girl.up([0, 1.29 * girl.s, 0]), [0.088, 0.14, 0.142], girl.axes, MAT.dress),
        ell(girl.up([0, 1.1 * girl.s, 0]), [0.075, 0.1, 0.11], girl.axes, MAT.dress),
        skirt(girl.up([0.005, 1.04 * girl.s, 0]), girl.at([0.035, 0.56, 0]), 0.115, 0.27, MAT.dress, 0.04, 13, 0.012),
        ell(add(gr, [0, -0.02, 0]), [0.06, 0.05, 0.058], girl.axes, MAT.dress, 0.02),
        ell(add(gl, [0, -0.02, 0]), [0.06, 0.05, 0.058], girl.axes, MAT.dress, 0.02),
        cone(girl.up([0.06, 1.0 * girl.s, -0.03]), girl.up([0.075, 0.92 * girl.s, -0.06]), 0.012, 0.008, MAT.shirt, 0.008),
        cone(girl.at([0.03, 0.56, 0.07]), girl.at([0.03, 0.2, 0.07]), 0.05, 0.035, MAT.skin),
        cone(girl.at([0.03, 0.56, -0.07]), girl.at([0.03, 0.2, -0.07]), 0.05, 0.035, MAT.skin),
      ],
    },
    {
      name: "girl arms",
      k: 0.025,
      prims: [
        ...arm([gr, girlElbow, girlWrist, add(hold, [0.012, 0.012, 0.012])], 0.036, MAT.skin),
        ...arm([gl, add(mix(gl, manChest, 0.45), [0.02, -0.08, -0.06]), add(manChest, [-0.14, -0.03, -0.07]), add(manChest, [-0.1, 0.0, -0.05])], 0.036, MAT.skin),
      ],
    },
    { name: "girl head", k: 0.03, prims: headParts(girl) },
    { name: "girl hair", k: 0.012, prims: longHair(girl, 23, -1) },
  ];

  return {
    groups,
    heads: [
      { center: man.head, axes: man.headAxes, size: man.k },
      { center: girl.head, axes: girl.headAxes, size: girl.k },
    ],
  };
}

export function bounds(prims) {
  const pts = prims.flatMap((p) => (p.kind === "cone" || p.kind === "fold" ? [[p.a, Math.max(p.r1, p.r2)], [p.b, Math.max(p.r1, p.r2)]] : [[p.c, p.kind === "ell" ? Math.max(...p.r) : p.r]]));
  const c = scale(pts.reduce((s, [q]) => add(s, q), [0, 0, 0]), 1 / pts.length);
  const r = Math.max(...pts.map(([q, rr]) => Math.hypot(...sub(q, c)) + rr));
  return { c, r: r + 0.01 };
}
