import { add, lerp, mul } from "../math";

const SKIN = ["#e9c4a6", "#d9a988", "#c48d68", "#a56f4c", "#7d5137", "#5a3a28"];
const FEM = /\b(girlfriend|wife|mom|mother|woman|girl|she|her|sister|daughter|grandma|grandmother|lady|bride|aunt)\b/;
const MASC = /\b(boyfriend|husband|dad|father|man|boy|he|him|brother|son|grandpa|grandfather|guy|groom|uncle)\b/;

export function human(subject, rand) {
  const label = subject.label.toLowerCase();
  const fem = subject.traits.feminine ?? (FEM.test(label) ? 0.88 : MASC.test(label) ? 0.12 : 0.35);
  const f = (a, b) => a + (b - a) * fem;
  const top = subject.colors[0] || "#6f7480";
  const bottom = subject.colors[1] || "#2c2e34";
  const skin = SKIN[Math.floor(rand() * 3) + (rand() < 0.3 ? 2 : 0)];
  const hairColor = subject.hair.color || (rand() < 0.6 ? "#2a1f1a" : "#5b3b25");
  const hairLen = subject.hair.length || (fem > 0.6 ? "long" : "short");
  const pose = subject.pose;
  const close = pose === "kiss" || pose === "embrace";
  const parts = [];
  const P = (part) => parts.push({ r: [0, 0], rot: [0, 0, 0], path: [], radii: [], profile: [], blend: 0.03, cut: false, fur: 0, flow: [0, -1, 0], ...part });

  const lean = close ? 0.07 : 0;
  const L = (y) => lean * Math.max(0, (y - 0.9) / 0.6);
  const sh = f(0.205, 0.172);
  const hip = f(0.158, 0.182);
  const waist = f(0.128, 0.104);

  P({ name: "pelvis", shape: "ellipsoid", a: [0, 0.93, 0], b: [0.108, 0.12, hip], color: bottom, blend: 0.04 });
  P({ name: "waist", shape: "ellipsoid", a: [L(1.07), 1.07, 0], b: [0.098, 0.12, waist], color: top, blend: 0.07 });
  P({ name: "chest", shape: "ellipsoid", a: [L(1.27) + f(0, 0.01), 1.27, 0], b: [f(0.118, 0.112), 0.16, f(0.168, 0.15)], color: top, blend: 0.07 });
  if (fem > 0.6) for (const s of [-1, 1]) P({ name: "chest", shape: "ellipsoid", a: [L(1.24) + 0.07, 1.235, s * 0.058], b: [0.06, 0.06, 0.06], color: top, blend: 0.05 });
  P({ name: "neck", shape: "capsule", a: [L(1.38), 1.38, 0], b: [L(1.5) + lean * 0.4, 1.5, 0], r: [f(0.058, 0.048), f(0.05, 0.042)], color: skin, blend: 0.025 });
  const head = [L(1.6) + lean * 0.9, 1.6, 0];
  const tilt = close ? -14 : 0;
  P({ name: "head", shape: "ellipsoid", a: head, b: [0.098, 0.118, f(0.083, 0.078)], rot: [tilt * 0.6, 0, -6], color: skin, blend: 0.03 });
  P({ name: "jaw", shape: "ellipsoid", a: add(head, [0.03, -0.055, 0]), b: [0.07, 0.06, f(0.062, 0.056)], color: skin, blend: 0.04 });
  P({ name: "nose", shape: "capsule", a: add(head, [0.085, 0.0, 0]), b: add(head, [0.106, -0.028, 0]), r: [0.012, 0.014], color: skin, blend: 0.012 });
  for (const s of [-1, 1]) P({ name: "ear", shape: "ellipsoid", a: add(head, [-0.005, -0.005, s * 0.078]), b: [0.02, 0.03, 0.012], color: skin, blend: 0.01 });

  const crown = add(head, [-0.012, 0.03, 0]);
  P({ name: "hair", shape: "ellipsoid", a: crown, b: [0.106, 0.108, f(0.092, 0.09)], color: hairColor, blend: 0.02, fur: 0.6, flow: [-0.6, -1, 0] });
  if (hairLen === "long" || hairLen === "medium") {
    const drop = hairLen === "long" ? 0.38 : 0.2;
    P({ name: "hair", shape: "sweep", path: [add(crown, [-0.05, 0.02, 0]), add(crown, [-0.1, -0.12, 0]), add(crown, [-0.1, -0.12 - drop * 0.6, 0]), add(crown, [-0.085, -0.1 - drop, 0])], radii: [0.09, 0.095, 0.085, 0.05], color: hairColor, blend: 0.04, fur: 1.4, flow: "axis" });
    for (const s of [-1, 1]) P({ name: "hair", shape: "sweep", path: [add(crown, [0.0, 0.0, s * 0.08]), add(crown, [-0.02, -0.12, s * 0.09]), add(crown, [-0.035, -0.08 - drop * 0.8, s * 0.075])], radii: [0.035, 0.03, 0.018], color: hairColor, blend: 0.03, fur: 1.1, flow: "axis" });
  } else if (hairLen === "bun") P({ name: "hair", shape: "ellipsoid", a: add(crown, [-0.1, 0.06, 0]), b: [0.055, 0.055, 0.055], color: hairColor, blend: 0.03, fur: 0.5 });
  else if (hairLen !== "none") P({ name: "hair", shape: "ellipsoid", a: add(crown, [-0.04, -0.02, 0]), b: [0.1, 0.09, 0.09], color: hairColor, blend: 0.03, fur: 0.5, flow: [-0.5, -1, 0] });
  if (fem < 0.6 && rand() < 0.4) P({ name: "hood", shape: "ellipsoid", a: [L(1.42) - 0.11, 1.42, 0], b: [0.07, 0.07, 0.13], color: top, blend: 0.05 });

  const shoulder = (s) => [L(1.4) - 0.01, 1.4, s * sh];
  const arms = {
    stand: (s) => [shoulder(s), [L(1.13) - 0.02, 1.13, s * (sh + 0.035)], [0.02, 0.86, s * (sh + 0.03)], [0.025, 0.78, s * (sh + 0.02)]],
    walk: (s) => [shoulder(s), [s * 0.06, 1.13, s * (sh + 0.03)], [s * 0.13, 0.88, s * (sh + 0.02)], [s * 0.15, 0.8, s * (sh + 0.01)]],
    hold: (s) => (s > 0 ? [shoulder(s), [0.06, 1.13, s * (sh + 0.04)], [0.14, 0.9, s * (sh + 0.02)], [0.17, 0.84, s * 0.12]] : arms.stand(s)),
    embrace: (s) => [shoulder(s), [0.17, s > 0 ? 1.22 : 1.14, s * (sh + 0.07)], [0.33, s > 0 ? 1.3 : 1.12, s * 0.15], [0.38, s > 0 ? 1.32 : 1.12, s * 0.07]],
  };
  const armPose = arms[close ? "embrace" : pose === "walk" ? "walk" : pose === "hold" ? "hold" : "stand"];
  for (const s of [-1, 1]) {
    const [a, e, w, h] = armPose(s);
    P({ name: "arm", shape: "sweep", path: [a, e, w], radii: [f(0.05, 0.043), f(0.042, 0.036), f(0.036, 0.03)], color: top, blend: 0.035 });
    P({ name: "hand", shape: "capsule", a: w, b: h, r: [f(0.03, 0.026), f(0.024, 0.02)], color: skin, blend: 0.02 });
  }

  const step = pose === "walk" ? 0.16 : close ? 0.05 : 0;
  for (const s of [-1, 1]) {
    const fwd = s > 0 ? step : -step;
    const z = s * f(0.085, 0.08);
    const hipJ = [0, 0.88, z];
    const knee = [fwd * 0.6 + (close && s > 0 ? 0.03 : 0), 0.48, z * 0.9];
    const ankle = [fwd, 0.085, z * 0.85];
    P({ name: "leg", shape: "sweep", path: [hipJ, lerp(hipJ, knee, 0.5), knee, ankle], radii: [f(0.085, 0.088), f(0.066, 0.07), f(0.052, 0.05), f(0.04, 0.036)], color: bottom, blend: 0.04 });
    P({ name: "shoe", shape: "capsule", a: add(ankle, [-0.03, -0.035, 0]), b: add(ankle, [0.15, -0.055, 0]), r: [0.045, 0.04], color: "#1f1e1d", blend: 0.025 });
  }
  const heart = add(mul([0, 1.2, 0], 1), [0, 0, 0]);
  return { parts, heart, fur: 0.07 };
}
