const ARCHETYPES = {
  m: {
    lean: { tone: 0.5, height: 1.8, head: 0.97, neck: [1.06, 0.9], shoulder: 0.98, slope: 0, chest: [0.93, 0.92], bust: 1, waist: [0.87, 0.88], hips: [0.93, 0.92], torso: 1, arm: [1.02, 0.86], leg: [1.07, 0.86], foot: 1, skull: [1, 1, 0.98], jaw: 0.96, chin: 0.004, nose: [1, 0.95], ear: 1 },
    athletic: { tone: 0.9, height: 1.83, head: 0.96, neck: [1, 1], shoulder: 1.06, slope: -0.3, chest: [1.04, 1.02], bust: 1, waist: [0.9, 0.92], hips: [0.96, 0.97], torso: 1, arm: [1, 0.96], leg: [1.04, 0.98], foot: 1.03, skull: [1, 0.98, 1.02], jaw: 1.05, chin: 0, nose: [1.02, 1.05], ear: 1 },
    lanky: { tone: 0.3, height: 1.9, head: 0.93, neck: [1.18, 0.86], shoulder: 1, slope: 0.4, chest: [0.9, 0.88], bust: 1, waist: [0.86, 0.88], hips: [0.92, 0.9], torso: 1.05, arm: [1.07, 0.82], leg: [1.11, 0.84], foot: 1.06, skull: [1.03, 1.04, 0.96], jaw: 0.94, chin: 0.008, nose: [1.1, 0.95], ear: 1.05 },
    broad: { tone: 0.8, height: 1.84, head: 1, neck: [0.94, 1.06], shoulder: 1.1, slope: -0.5, chest: [1.07, 1.06], bust: 1, waist: [0.96, 0.97], hips: [0.98, 0.99], torso: 0.98, arm: [0.99, 1], leg: [1.02, 1.02], foot: 1.08, skull: [1.02, 0.97, 1.06], jaw: 1.1, chin: -0.003, nose: [1, 1.12], ear: 1.04 },
    bishonen: { tone: 0.3, height: 1.78, head: 0.95, neck: [1.12, 0.86], shoulder: 1.02, slope: 0.2, chest: [0.93, 0.92], bust: 1, waist: [0.85, 0.87], hips: [0.94, 0.94], torso: 1, arm: [1.03, 0.85], leg: [1.12, 0.86], foot: 0.97, skull: [0.98, 1.02, 0.96], jaw: 0.88, chin: 0.011, nose: [0.92, 0.85], ear: 0.95 },
  },
  f: {
    petite: { tone: 0.2, height: 1.55, head: 1.05, neck: [0.98, 0.95], shoulder: 0.94, slope: 0.2, chest: [0.94, 0.95], bust: 0.9, waist: [0.92, 0.94], hips: [0.95, 0.96], torso: 0.97, arm: [0.97, 0.9], leg: [0.98, 0.92], foot: 0.94, skull: [0.98, 1.02, 1.02], jaw: 0.9, chin: 0.002, nose: [0.9, 0.85], ear: 0.95 },
    slender: { tone: 0.3, height: 1.65, head: 0.97, neck: [1.15, 0.9], shoulder: 0.98, slope: 0.3, chest: [0.94, 0.92], bust: 0.9, waist: [0.87, 0.89], hips: [0.96, 0.95], torso: 1, arm: [1.03, 0.85], leg: [1.1, 0.86], foot: 0.98, skull: [1, 1.03, 0.97], jaw: 0.92, chin: 0.008, nose: [1, 0.9], ear: 1 },
    curvy: { tone: 0.4, height: 1.62, head: 1, neck: [1, 1], shoulder: 1, slope: 0.1, chest: [1.02, 1.04], bust: 1.25, waist: [0.9, 0.94], hips: [1.13, 1.1], torso: 1, arm: [1, 1.03], leg: [1.02, 1.1], foot: 1, skull: [1, 1, 1.02], jaw: 0.98, chin: 0.002, nose: [0.96, 0.95], ear: 1 },
    athletic: { tone: 0.8, height: 1.67, head: 0.98, neck: [1.02, 1.04], shoulder: 1.07, slope: -0.1, chest: [1.03, 1], bust: 1, waist: [0.95, 0.95], hips: [1, 1], torso: 1, arm: [1, 1.04], leg: [1.06, 1.03], foot: 1.03, skull: [1, 0.98, 1.02], jaw: 1, chin: 0, nose: [1, 1], ear: 1 },
    elegant: { tone: 0.3, height: 1.7, head: 0.95, neck: [1.22, 0.88], shoulder: 0.98, slope: 0.35, chest: [0.96, 0.94], bust: 1.05, waist: [0.87, 0.9], hips: [1.02, 1], torso: 1.03, arm: [1.05, 0.87], leg: [1.12, 0.9], foot: 1, skull: [1.02, 1.03, 0.97], jaw: 0.9, chin: 0.01, nose: [1.05, 0.9], ear: 0.98 },
  },
};

const blend = (a, b, t, wobble) => {
  if (Array.isArray(a)) return a.map((v, i) => blend(v, b[i], t, wobble));
  return (a + (b - a) * t) * (1 + wobble());
};

export function genome(sex, rng) {
  const types = ARCHETYPES[sex];
  const names = Object.keys(types);
  const main = rng.pick(names);
  const other = rng.pick(names.filter((n) => n !== main));
  const mix = rng.range(0, 0.55);
  const wobble = () => rng.gauss() * 0.035;
  const g = {};
  for (const key of Object.keys(types[main])) g[key] = blend(types[main][key], types[other][key], mix, key === "chin" || key === "slope" ? () => 0 : wobble);
  g.tone = Math.min(1, Math.max(0, g.tone + rng.gauss() * 0.12));
  g.height = types[main].height + (types[other].height - types[main].height) * mix + rng.gauss() * 0.03;
  g.slope += rng.gauss() * 0.25;
  g.chin += rng.gauss() * 0.003;
  g.fwd = rng.range(-0.004, 0.006);
  g.cheek = rng.range(-0.6, 0.6);
  g.posture = { sway: rng.range(-1, 1), slouch: rng.range(-0.5, 1), tilt: rng.range(-1, 1) };
  g.type = mix > 0.3 ? `${main}-${other}` : main;
  return g;
}
