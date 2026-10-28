export const W = 1500;
export const H = 1000;

export const SKIES = {
  dawn: ["#fbe6d2", "#f4bfa6", "#d6a9c0", "#9eaed3", "#6f86b8"],
  day: ["#f3f6f2", "#d7e7ee", "#acd0e4", "#7fb0d6", "#5b8fc2"],
  golden: ["#fff3cf", "#f7c45c", "#ef8f3a", "#c9522c", "#7a2d26"],
  dusk: ["#fbd3a6", "#f0a3a8", "#b07fb6", "#5d5c9c", "#2a3163"],
  night: ["#3a4670", "#26305a", "#192042", "#10152d", "#090c1b"],
};

const MATERIAL = {
  grass: { day: "#7f9a52", golden: "#9a7a2e", dusk: "#4b4a3e", night: "#1c2a26", dawn: "#7f8c5e" },
  field: { day: "#c9b36a", golden: "#d18d38", dusk: "#7e5a48", night: "#2a2a2e", dawn: "#c4a07a" },
  sand: { day: "#e3cf9f", golden: "#e2b277", dusk: "#b48a7c", night: "#3a3b45", dawn: "#e6c3a6" },
  snow: { day: "#eef2f6", golden: "#f6e1c8", dusk: "#c9c2d6", night: "#5d6c8c", dawn: "#efdcd8" },
  desert: { day: "#d9a86c", golden: "#e08a4a", dusk: "#9a6060", night: "#3b3040", dawn: "#dca487" },
  water: { day: "#4f86ad", golden: "#c96c3c", dusk: "#6d5d92", night: "#16203d", dawn: "#9a9cc4" },
  mountain: { day: "#7d8ea8", golden: "#9a5f5a", dusk: "#5b5486", night: "#1b2240", dawn: "#a49ab8" },
  forest: { day: "#3f5f3c", golden: "#5a4426", dusk: "#2f3340", night: "#0f1a1c", dawn: "#56664e" },
  city: { day: "#7f8794", golden: "#6a4a48", dusk: "#3a3858", night: "#121628", dawn: "#8a8098" },
  road: { day: "#6a6a6a", golden: "#5a4038", dusk: "#3e3a48", night: "#1a1c24", dawn: "#7c7480" },
  wood: { day: "#7a5a3c", golden: "#5e3a24", dusk: "#3e2c2c", night: "#16120f", dawn: "#6e5444" },
};

export const tone = (material, time) => (MATERIAL[material] || MATERIAL.grass)[time] || MATERIAL[material]?.day || "#777777";

const ridge = (n, base, amp, scale, z, sharp = 0) => (x) => {
  let v = n(x / scale, z, 3) * 0.6 + n(x / (scale * 0.37), z + 4, 5) * 0.3;
  if (sharp) v = v * (1 - sharp) + (1 - Math.abs(n(x / scale, z + 9, 3))) * sharp;
  return base - (v * 0.5 + 0.5) * amp;
};

export function world(plan, comp, rand, n) {
  const { place, features, time, weather } = plan.setting;
  const has = (f) => features.includes(f);
  const hz = comp.horizon;
  const layers = [];
  const objects = [];
  const lights = [];
  const sunny = has("sun") || (has("sunset") && time !== "night");
  if (time === "night") {
    if (has("moon") || rand.chance(0.6)) lights.push({ kind: "moon", x: comp.lightX, y: Math.max(H * 0.12, hz - H * rand.range(0.2, 0.45)), r: H * rand.range(0.035, 0.06) });
  } else if (sunny || (["golden", "dusk", "dawn"].includes(time) && rand.chance(0.75))) {
    const low = time === "day" ? rand.range(0.25, 0.5) : rand.range(-0.02, 0.18);
    const r = H * (comp.framing === "close" ? rand.range(0.14, 0.22) : rand.range(0.07, 0.13));
    lights.push({ kind: "sun", x: comp.lightX, y: hz - low * H - r * (time === "day" ? 0 : 0.3), r });
  }
  const water = ["sea", "lake", "river"].includes(place) || has("water");
  const mountains = place === "mountains" || has("mountains") || (place === "lake" && rand.chance(0.5));
  if (mountains) {
    const peaks = rand.int(1, 3);
    for (let i = 0; i < peaks; i++) {
      const amp = H * rand.range(0.12, 0.3) * (1 - i * 0.25);
      layers.push({ kind: "mountain", material: "mountain", depth: 0.05 + i * 0.12, top: ridge(n, hz + 2, amp, rand.range(160, 320), 10 + i * 7, place === "mountains" ? 0.6 : 0.3), bottom: () => hz + 2 });
    }
  }
  if (place === "city" || has("buildings")) {
    const blocks = [];
    for (let x = -20; x < W + 20; ) {
      const w = rand.range(40, 130);
      blocks.push({ x, w, h: H * rand.range(0.05, 0.34) * (0.6 + 0.4 * Math.sin((x / W) * Math.PI)) });
      x += w + rand.range(-8, 6);
    }
    const top = (x) => {
      const b = blocks.find((k) => x >= k.x && x < k.x + k.w);
      return hz - (b ? b.h : 0);
    };
    layers.push({ kind: "city", material: "city", depth: 0.25, top, bottom: () => hz + 2, blocks });
  }
  const treeline = place === "forest" || place === "lake" || has("trees") || (place === "field" && rand.chance(0.5));
  if (treeline && place !== "city") layers.push({ kind: "treeline", material: "forest", depth: 0.3, top: ridge(n, hz + 1, H * rand.range(0.03, 0.07), 70, 30), bottom: () => hz + 4 });
  if (!mountains && !treeline && place !== "city" && !water && rand.chance(0.6)) layers.push({ kind: "hills", material: place === "snow" ? "snow" : place === "desert" ? "desert" : "grass", depth: 0.35, top: ridge(n, hz + 1, H * rand.range(0.02, 0.06), 260, 40), bottom: () => hz + 3 });

  const groundMat = { sea: "sand", lake: "grass", river: "grass", field: "field", mountains: "grass", forest: "grass", city: "road", desert: "desert", snow: "snow", garden: "grass", road: "field", room: "wood" }[place] || "grass";
  const docked = water && (has("dock") || has("pier"));
  const shore = water ? (docked && comp.feet ? Math.max(hz + (H - hz) * comp.shore, Math.min(H + 20, comp.feet + 70)) : hz + (H - hz) * comp.shore) : hz;
  if (water) layers.push({ kind: "water", material: "water", depth: 0.5, top: () => hz, bottom: ridge(n, shore, H * 0.03, 300, 50) });
  const groundTop = water ? ridge(n, shore, H * 0.03, 300, 50) : ridge(n, hz + 2, H * 0.012, 400, 60);
  layers.push({ kind: "ground", material: plan.setting.weather === "snow" ? "snow" : groundMat, depth: 0.8, top: groundTop, bottom: () => H + 10 });

  if (place === "road" || has("road")) {
    const vx = comp.vanish;
    layers.push({ kind: "road", material: "road", depth: 0.85, vx, top: () => hz + 1, bottom: () => H + 10, inside: (x, y) => y > hz && Math.abs(x - vx) < (y - hz) * comp.roadSpread + 2 });
  }
  if (docked && comp.feet && comp.feet < H - 10) {
    const side = comp.focusX < W / 2 ? -1 : 1;
    const reach = comp.body * 0.5;
    objects.push({ kind: "dock", base: comp.feet, x0: side < 0 ? -10 : comp.focusX - reach, x1: side < 0 ? comp.focusX + reach : W + 10, y: comp.feet - 4, h: Math.max(10, comp.body * 0.06) });
  }
  if (has("house") || has("cabin") || place === "home") {
    const x = rand.chance(0.5) ? W * rand.range(0.1, 0.3) : W * rand.range(0.7, 0.9);
    const near = !water && rand.chance(0.5);
    const y = water ? hz + 3 : near ? hz + (H - hz) * rand.range(0.15, 0.35) : hz + 3;
    objects.push({ kind: "house", x, y, base: y, w: H * (water || !near ? rand.range(0.05, 0.09) : rand.range(0.12, 0.2)), lit: time === "night" || time === "dusk" });
  }
  if (treeline || has("trees") || place === "forest" || place === "garden") {
    const count = place === "forest" ? rand.int(5, 9) : rand.int(1, 3);
    for (let i = 0; i < count; i++) {
      let x = rand() * W;
      if (Math.abs(x - comp.focusX) < W * 0.12) x += W * 0.25 * (x < comp.focusX ? -1 : 1);
      const near = rand();
      const floor = water ? shore + 8 : hz + 4;
      const base = floor + (H - floor) * (0.03 + near * 0.55);
      objects.push({ kind: "tree", conifer: place === "forest" || place === "mountains" || place === "snow" ? rand.chance(0.7) : rand.chance(0.2), x, base, h: Math.min(H * 0.42, (base - hz) * rand.range(0.9, 1.6) + H * 0.05) });
    }
    objects.sort((a, b) => (a.base ?? 0) - (b.base ?? 0));
  }
  const clouds = [];
  if (time !== "night" && weather !== "fog") {
    const count = weather === "rain" || weather === "cloud" ? rand.int(5, 9) : rand.int(2, 6);
    for (let i = 0; i < count; i++) {
      const y = hz * rand.range(0.12, 0.85);
      clouds.push({ x: rand() * W, y, w: W * rand.range(0.1, 0.32) * (0.6 + (y / hz) * 0.5), h: H * rand.range(0.025, 0.07), puffs: rand.int(4, 9) });
    }
  }
  const particles = [];
  if (weather === "rain") particles.push({ kind: "rain", count: 900 });
  if (weather === "snow" || place === "snow") particles.push({ kind: "snow", count: 700 });
  if (time === "night" && weather !== "rain") particles.push({ kind: "stars", count: 260 });
  if (has("birds")) particles.push({ kind: "birds", count: rand.int(3, 9) });
  if (weather === "fog") particles.push({ kind: "fog" });
  return { sky: SKIES[time] || SKIES.golden, lights, clouds, layers: layers.sort((a, b) => a.depth - b.depth), objects, particles, horizon: hz, shore, time };
}
