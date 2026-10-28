import { add, dir2, mul, norm } from "../math";

export const SPECIES = {
  wolf: { len: 0.78, leg: 0.62, girth: 0.19, neck: 0.34, neckUp: 32, headTilt: -12, head: 0.12, muzzle: 1.35, ears: 0.11, ear: "point", tail: 0.62, tailR: 0.05, fur: 0.075, ruff: 1.6, back: "#8f8b85", under: "#ddd6cb", accent: "#2f2b28" },
  dog: { len: 0.72, leg: 0.58, girth: 0.2, neck: 0.3, neckUp: 40, headTilt: -8, head: 0.125, muzzle: 1.0, ears: 0.1, ear: "fold", tail: 0.5, tailR: 0.04, fur: 0.04, ruff: 1, back: "#b47c45", under: "#ead9bc", accent: "#2a201b" },
  fox: { len: 0.72, leg: 0.5, girth: 0.16, neck: 0.3, neckUp: 35, headTilt: -10, head: 0.11, muzzle: 1.45, ears: 0.15, ear: "point", tail: 0.8, tailR: 0.075, fur: 0.06, ruff: 1.3, back: "#c9652b", under: "#f2e8da", accent: "#241b18", socks: true, tip: true },
  cat: { len: 0.66, leg: 0.52, girth: 0.17, neck: 0.2, neckUp: 50, headTilt: 0, head: 0.115, muzzle: 0.4, ears: 0.09, ear: "point", tail: 0.85, tailR: 0.028, fur: 0.03, ruff: 1, back: "#7b776f", under: "#d4cdc0", accent: "#1f1d1b", curl: true },
  lion: { len: 0.86, leg: 0.55, girth: 0.25, neck: 0.3, neckUp: 28, headTilt: -6, head: 0.17, muzzle: 0.8, ears: 0.05, ear: "round", tail: 0.8, tailR: 0.025, fur: 0.022, mane: 1, back: "#c99b57", under: "#e9d5aa", accent: "#3a2a1c", maneColor: "#7c4a24" },
  tiger: { len: 0.95, leg: 0.5, girth: 0.25, neck: 0.28, neckUp: 25, headTilt: -6, head: 0.16, muzzle: 0.75, ears: 0.055, ear: "round", tail: 0.85, tailR: 0.035, fur: 0.02, back: "#d9822b", under: "#f4ebde", accent: "#1d1a17", stripes: true },
  horse: { len: 0.8, leg: 0.64, girth: 0.24, neck: 0.62, neckUp: 55, headTilt: -58, head: 0.12, muzzle: 2.3, ears: 0.1, ear: "point", tail: 0.65, tailR: 0.05, fur: 0.012, mane: 0.6, back: "#6e4a31", under: "#7a5539", accent: "#1f1712", maneColor: "#2a1d16" },
  deer: { len: 0.68, leg: 0.68, girth: 0.17, neck: 0.55, neckUp: 62, headTilt: -35, head: 0.1, muzzle: 1.6, ears: 0.13, ear: "point", tail: 0.14, tailR: 0.04, fur: 0.012, antlers: true, back: "#a8774c", under: "#efe3d0", accent: "#2a2019" },
  bear: { len: 0.76, leg: 0.42, girth: 0.33, neck: 0.26, neckUp: 12, headTilt: -10, head: 0.17, muzzle: 0.9, ears: 0.05, ear: "round", tail: 0.08, tailR: 0.05, fur: 0.065, ruff: 1.2, back: "#4c3627", under: "#5a4130", accent: "#18110d" },
  cow: { len: 0.95, leg: 0.5, girth: 0.32, neck: 0.32, neckUp: 18, headTilt: -25, head: 0.15, muzzle: 1.4, ears: 0.08, ear: "side", tail: 0.7, tailR: 0.018, fur: 0.01, horns: true, back: "#f0ece4", under: "#f0ece4", accent: "#2a2624", patches: true },
  rabbit: { len: 0.5, leg: 0.32, girth: 0.25, neck: 0.12, neckUp: 50, headTilt: -5, head: 0.13, muzzle: 0.55, ears: 0.38, ear: "long", tail: 0.1, tailR: 0.08, fur: 0.045, back: "#c3b29d", under: "#efe7dc", accent: "#2a231d" },
};

const UP = [0, 1, 0];
const deg = (d) => (d * Math.PI) / 180;
const down = (deg2) => [Math.sin(deg(deg2)), -Math.cos(deg(deg2)), 0];

function chain(start, angles, lengths, z) {
  const pts = [start];
  let p = start;
  angles.forEach((a, i) => {
    p = add(p, mul(down(a), lengths[i]));
    pts.push([p[0], p[1], z]);
  });
  return pts;
}

function grounded(start, angles, weights, z) {
  const drop = weights.reduce((s, w, i) => s + w * Math.cos(deg(angles[i])), 0);
  const k = start[1] / Math.max(0.2, drop);
  return chain(start, angles, weights.map((w) => w * k), z);
}

const POSES = {
  stand: { front: [[-8, 2, 14], [-8, 2, 14]], hind: [[24, -38, 6], [24, -38, 6]], pitch: 0, lift: 0, neck: 0, tail: "hang" },
  walk: { front: [[14, 6, 22], [-20, -4, 10]], hind: [[6, -30, 0], [36, -44, 14]], pitch: 0, lift: 0, neck: -6, tail: "hang" },
  run: { front: [[58, 76, 88], [30, 48, 70]], hind: [[-38, -70, -84], [-20, -56, -72]], pitch: -3, lift: 0.08, neck: -20, tail: "stream" },
  sit: { front: [[-4, 0, 10], [-4, 0, 10]], hind: [[78, -84, 86], [78, -84, 86]], pitch: 32, lift: 0, neck: 14, tail: "ground" },
  lie: { front: [[80, 88, 90], [74, 86, 90]], hind: [[84, -88, 88], [84, -88, 88]], pitch: 0, lift: -0.42, neck: 6, tail: "ground" },
};

export function quadruped(subject, rand) {
  const base = SPECIES[subject.species] || SPECIES.dog;
  const t = subject.traits;
  const k = (key, value, spread = 0.5) => value * (1 + ((t[key] ?? 0.5) - 0.5) * spread * 2);
  const sp = {
    ...base,
    len: k("length", base.len),
    leg: k("legs", base.leg, 0.4),
    girth: k("bulk", base.girth, 0.5),
    neck: k("neck", base.neck, 0.6),
    head: k("head", base.head, 0.4),
    ears: k("ears", base.ears, 0.6),
    tail: k("tail", base.tail, 0.6),
    fur: k("fur", base.fur, 0.8),
  };
  const [c0, c1, c2] = subject.colors;
  const back = c0 || base.back;
  const under = c1 || base.under;
  const accent = c2 || base.accent;
  const pose = POSES[subject.pose] || POSES.stand;
  const g = sp.girth;
  const parts = [];
  const add3 = (part) => parts.push({ r: [0, 0], rot: [0, 0, 0], path: [], radii: [], profile: [], blend: g * 0.25, cut: false, color: back, under, fur: 1, flow: [-1, -0.45, 0], ...part });

  const sitting = subject.pose === "sit";
  const yb = subject.pose === "lie" ? g * 1.02 : sp.leg + g + pose.lift;
  const H = sitting ? [-sp.len / 2, g * 1.15, 0] : [-sp.len / 2, yb + g * 0.06, 0];
  const lean = sitting ? (Math.asin(Math.min(0.95, Math.max(-0.95, (sp.leg + g - H[1]) / sp.len))) * 180) / Math.PI : pose.pitch;
  const pitch = deg(lean);
  const tilt = (p) => {
    const d = [p[0] - H[0], p[1] - H[1]];
    return [H[0] + d[0] * Math.cos(pitch) - d[1] * Math.sin(pitch), H[1] + d[0] * Math.sin(pitch) + d[1] * Math.cos(pitch), p[2]];
  };
  const S = tilt([H[0] + sp.len, H[1] - g * 0.06, 0]);
  const W = tilt([H[0] + sp.len / 2, H[1] + g * 0.1, 0]);
  const fwd = norm([S[0] - H[0], S[1] - H[1], 0]);

  add3({ name: "chest", shape: "ellipsoid", a: add(S, mul(fwd, -0.02)), b: [g * 1.35, g * 1.22, g * 0.98], rot: [0, 0, lean], fur: 1.25 * (sp.ruff || 1) });
  add3({ name: "body", shape: "sweep", path: [add(S, mul(fwd, -g * 0.2)), W, add(H, [g * 0.2, 0, 0])], radii: [g * 1.12, g * 0.82, g * 0.95], blend: g * 0.5 });
  add3({ name: "rump", shape: "ellipsoid", a: H, b: [g * 1.08, g * 1.0, g * 0.92], fur: 1 });

  const neckDir = dir2(sp.neckUp + lean * 0.5 + pose.neck);
  const N0 = add(S, add(mul(fwd, g * 0.55), mul(UP, g * 0.5)));
  const N1 = add(N0, mul(neckDir, sp.neck));
  add3({ name: "neck", shape: "sweep", path: [N0, add(add(N0, mul(neckDir, sp.neck * 0.5)), mul(UP, g * 0.05)), N1], radii: [g * 0.92, g * 0.72, sp.head * 0.8], fur: 1.5 * (sp.ruff || 1), flow: [-0.3, -1, 0], color: sp.mane ? base.maneColor || back : back });

  const hd = dir2(sp.headTilt + pose.neck * 0.6);
  const hside = [0, 0, 1];
  const skull = add(N1, mul(hd, sp.head * 0.45));
  add3({ name: "head", shape: "ellipsoid", a: skull, b: [sp.head * 1.15, sp.head * 0.95, sp.head * 0.86], rot: [0, 0, sp.headTilt + pose.neck * 0.6], fur: 0.32, flow: mul(hd, -1), blend: sp.head * 0.3 });
  const hdown = norm([hd[1], -hd[0], 0]);
  const m0 = add(add(skull, mul(hd, sp.head * 0.55)), mul(hdown, sp.head * 0.18));
  const m1 = add(add(skull, mul(hd, sp.head * (0.6 + sp.muzzle))), mul(hdown, sp.head * 0.3));
  add3({ name: "muzzle", shape: "capsule", a: m0, b: m1, r: [sp.head * 0.6, sp.head * 0.3], fur: 0.15, flow: mul(hd, -1), color: under, blend: sp.head * 0.25 });
  add3({ name: "nose", shape: "ellipsoid", a: add(m1, mul(hd, sp.head * 0.18)), b: [sp.head * 0.17, sp.head * 0.14, sp.head * 0.17], fur: 0, color: accent, under: accent, blend: sp.head * 0.06 });
  for (const s of [-1, 1]) {
    const eye = add(add(add(skull, mul(hd, sp.head * 0.62)), mul(UP, sp.head * 0.28)), mul(hside, s * sp.head * 0.5));
    add3({ name: "eye", shape: "ellipsoid", a: eye, b: [sp.head * 0.13, sp.head * 0.1, sp.head * 0.13], fur: 0, color: accent, under: accent, blend: sp.head * 0.04 });
    const earBase = add(add(add(skull, mul(UP, sp.head * 0.72)), mul(hd, -sp.head * 0.25)), mul(hside, s * sp.head * 0.48));
    let earTip;
    let r = [sp.ears * 0.42, sp.ears * 0.05];
    if (sp.ear === "fold") earTip = add(earBase, mul(norm([0.25, -0.9, s * 0.5]), sp.ears * 1.1));
    else if (sp.ear === "side") earTip = add(earBase, mul(norm([-0.1, -0.1, s]), sp.ears * 1.2));
    else if (sp.ear === "round") {
      earTip = add(earBase, mul(norm([-0.1, 1, s * 0.3]), sp.ears * 0.5));
      r = [sp.ears * 0.6, sp.ears * 0.45];
    } else if (sp.ear === "long") {
      earTip = add(earBase, mul(norm([-0.35, 1, s * 0.12]), sp.ears));
      r = [sp.ears * 0.16, sp.ears * 0.11];
    } else earTip = add(earBase, mul(norm([-0.3, 1, s * 0.2]), sp.ears));
    add3({ name: "ear", shape: "capsule", a: earBase, b: earTip, r, fur: 0.25, flow: "axis", blend: sp.head * 0.15, color: back });
    if (sp.antlers) {
      const a0 = add(earBase, mul(hd, sp.head * 0.25));
      const a1 = add(a0, [-0.05, 0.28, s * 0.12]);
      const a2 = add(a1, [-0.06, 0.2, s * 0.08]);
      add3({ name: "antler", shape: "sweep", path: [a0, a1, a2], radii: [0.022, 0.016, 0.008], fur: 0, color: "#d8cbb2", under: "#d8cbb2", blend: 0.01 });
      add3({ name: "antler", shape: "capsule", a: a1, b: add(a1, [0.12, 0.12, s * 0.02]), r: [0.014, 0.006], fur: 0, color: "#d8cbb2", under: "#d8cbb2", blend: 0.008 });
      add3({ name: "antler", shape: "capsule", a: lerp3(a1, a2, 0.6), b: add(lerp3(a1, a2, 0.6), [0.1, 0.12, s * 0.03]), r: [0.012, 0.005], fur: 0, color: "#d8cbb2", under: "#d8cbb2", blend: 0.008 });
    }
    if (sp.horns) add3({ name: "horn", shape: "sweep", path: [earBase, add(earBase, [0.02, 0.06, s * 0.12]), add(earBase, [0.08, 0.14, s * 0.14])], radii: [0.03, 0.02, 0.006], fur: 0, color: "#e8e0cf", under: "#e8e0cf", blend: 0.01 });
  }
  if (sp.mane) {
    add3({ name: "mane", shape: "ellipsoid", a: add(skull, mul(hd, -sp.head * 0.55)), b: [sp.head * 1.3 * sp.mane, sp.head * 1.55 * sp.mane, sp.head * 1.45 * sp.mane], rot: [0, 0, sp.neckUp * 0.5], fur: 4 * sp.mane, flow: [-0.6, -0.8, 0], color: base.maneColor || back, under: base.maneColor || under, blend: sp.head * 0.5 });
  }

  const legs = [
    { root: add(S, [0.03, -g * 0.3, g * 0.58]), angles: pose.front[0], radii: [g * 0.48, g * 0.27, g * 0.17, g * 0.15], w: [0.4, 0.44, 0.16], front: true },
    { root: add(S, [0.03, -g * 0.3, -g * 0.58]), angles: pose.front[1], radii: [g * 0.48, g * 0.27, g * 0.17, g * 0.15], w: [0.4, 0.44, 0.16], front: true },
    { root: add(H, [-g * 0.08, -g * 0.22, g * 0.55]), angles: sitting ? [62, -102, 92] : pose.hind[0], radii: [g * 0.66, g * 0.34, g * 0.17, g * 0.15], w: [0.38, 0.38, 0.3], front: false },
    { root: add(H, [-g * 0.08, -g * 0.22, -g * 0.55]), angles: sitting ? [62, -102, 92] : pose.hind[1], radii: [g * 0.66, g * 0.34, g * 0.17, g * 0.15], w: [0.38, 0.38, 0.3], front: false },
  ];
  for (const leg of legs) {
    const free = subject.pose === "run" || subject.pose === "lie" || (sitting && !leg.front);
    const pts = free ? chain(leg.root, leg.angles, leg.w.map((w) => w * (sp.leg + g * 0.7)), leg.root[2]) : grounded(leg.root, leg.angles, leg.w, leg.root[2]);
    add3({ name: leg.front ? "foreleg" : "hindleg", shape: "sweep", path: pts, radii: leg.radii, fur: 0.55, flow: [0, -1, 0], blend: g * 0.3, low: true });
    const paw = pts[pts.length - 1];
    const toe = subject.pose === "run" ? add(paw, mul(down(leg.angles[2] + 90), g * 0.25)) : add(paw, [g * 0.32, 0, 0]);
    add3({ name: "paw", shape: "capsule", a: add(paw, [0, g * 0.06, 0]), b: add(toe, [0, g * 0.04, 0]), r: [g * 0.17, g * 0.13], fur: 0.2, flow: [1, 0, 0], blend: g * 0.12, low: true });
  }

  const tb = add(H, [-g * 0.85, g * 0.4, 0]);
  const L = sp.tail;
  const tails = {
    hang: [tb, add(tb, [-L * 0.25, -L * 0.15, 0]), add(tb, [-L * 0.42, -L * 0.55, 0]), add(tb, [-L * 0.4, -L * 0.92, 0])],
    stream: [tb, add(tb, [-L * 0.35, -L * 0.02, 0]), add(tb, [-L * 0.7, L * 0.02, 0]), add(tb, [-L, L * 0.05, 0])],
    ground: [tb, add(tb, [-L * 0.25, -L * 0.3, 0]), add(tb, [-L * 0.3, -tb[1] + g * 0.2, L * 0.3]), add(tb, [-L * 0.05, -tb[1] + g * 0.18, L * 0.75])],
  };
  let path = tails[pose.tail];
  if (sp.curl && pose.tail === "hang") path = [tb, add(tb, [-L * 0.3, -L * 0.3, 0]), add(tb, [-L * 0.5, -L * 0.1, 0]), add(tb, [-L * 0.45, L * 0.35, 0])];
  add3({ name: "tail", shape: "sweep", path, radii: [sp.tailR * 0.9, sp.tailR * 1.15, sp.tailR, sp.tailR * 0.45], fur: 2.3, flow: "axis", blend: g * 0.2, tip: true });

  const heart = add(lerp3(S, H, 0.35), [0, g * 0.1, 0]);
  return { parts, heart, sp, fur: sp.fur, rand };
}

function lerp3(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
