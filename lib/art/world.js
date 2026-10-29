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

const OVERCAST = {
  day: ["#dfe2e1", "#c6cbce", "#a8afb6", "#8a929c", "#6c7480"],
  warm: ["#d8c3b6", "#b9a8a6", "#948b95", "#6d6a7c", "#4a4a5e"],
  night: ["#3e4456", "#2e3446", "#212636", "#171b28", "#0d1018"],
};

export const tone = (material, time) => (MATERIAL[material] || MATERIAL.grass)[time] || MATERIAL[material]?.day || "#777777";

const ridge = (n, base, amp, scale, z, sharp = 0) => (x) => {
  let v = n(x / scale, z, 3) * 0.6 + n(x / (scale * 0.37), z + 4, 5) * 0.3;
  if (sharp) v = v * (1 - sharp) + (1 - Math.abs(n(x / scale, z + 9, 3))) * sharp;
  return base - (v * 0.5 + 0.5) * amp;
};

// seat height in meters for things people or animals rest on
const SEATS = { bench: 0.45, couch: 0.42, sofa: 0.42, bed: 0.55, swing: 0.62, chair: 0.46, seats: 0.45 };

const kindOf = (t) => `${t.kind} ${t.label}`.toLowerCase();

// which subject rests on this thing: "people", a being index, or null
function perchOf(plan, t) {
  const k = kindOf(t);
  if (plan.people.count && plan.people.on && plan.people.pose !== "ride" && k.includes(plan.people.on)) return "people";
  const i = plan.beings.findIndex((b) => b.on && k.includes(b.on));
  return i >= 0 ? i : null;
}

function placeThings(plan, comp, wd, rand) {
  const out = [];
  const hz = Math.min(wd.horizon, H);
  const ppm = comp.ppm || (H * 0.5) / 6;
  let side = rand.chance(0.5) ? 1 : -1;
  let behind = false;
  for (const t of plan.things) {
    let w = t.size.w * ppm;
    let h = t.size.h * ppm;
    const focal = comp.subject === "thing" && (t.role === "focal" || t.holds);
    const feet = comp.feet ?? (wd.emblem ? H * 0.86 : hz + (H - hz) * 0.62);
    const k = kindOf(t);
    const perch = perchOf(plan, t);
    if (plan.people.pose === "ride" && /\b(bicycle|bike)\b/.test(k)) continue;
    if (t.where === "hand" && plan.people.count) continue;
    // tables at a shared meal, the boat people sit in and the bed they lie in are drawn with the people
    if (plan.people.across && /\b(table|booth|chair|desk)\b/.test(k)) continue;
    if (plan.people.on === "boat" && /\b(kayak|canoe|boat|row ?boat)\b/.test(k)) continue;
    if (plan.people.pose === "lie" && plan.people.on === "bed" && /\bbed\b/.test(k)) continue;
    if (/sill/.test(k) && wd.sill) continue;
    if (wd.sill && t.role === "context") continue;
    // buildings and terrain belong to the landscape layers, never shrunk into a prop at someone's feet
    if (!wd.interior && /\b(house|home|cabin|cottage|barn|farmhouse|building)\b/.test(k)) continue;
    if (plan.setting.features.includes("stage") && /\b(stage|speakers?|crowd|band)\b/.test(k)) continue;
    if (/\b(shore\w*|water ?edge|waterline|ground|grass|lawn|sand|beach|field|path|sky|horizon|lake|pond|sea|ocean|river|water)\b/.test(k) && !/\b(boat|dock|pier|bench|blanket|towel)\b/.test(k)) continue;
    const nearBy = plan.beings.findIndex((b) => b.near && b.near !== "people" && k.includes(b.near));
    let base;
    let x;
    if (perch !== null && comp.feet != null) {
      // the thing sits exactly where its subject is, at the subject's depth
      base = feet;
      x = comp.focusX - w / 2;
      const seat = SEATS[Object.keys(SEATS).find((s) => k.includes(s))] ?? t.size.h;
      wd.support = { x: comp.focusX, ground: perch === "people" ? feet : feet - seat * ppm, seat: seat / 1.75, kind: t.kind, forPeople: perch === "people", forBeing: perch === "people" ? null : perch };
      out.push({ kind: "thing", label: t.kind || t.label, x, y: base - h, w, h, base, shapes: t.shapes, imp: 0.8, front: perch === "people" && !/\b(bed|chair)\b/.test(k), cel: true });
      continue;
    }
    if (nearBy >= 0 && comp.feet != null) {
      // an animal waiting at a door: the door stands right beside it on the wall it waits at
      const toward = comp.focusX < W / 2 ? 1 : -1;
      const reach = ((plan.beings[nearBy].size || 0.6) * 0.62 + 0.15) * ppm + w * 0.5;
      base = wd.interior ? Math.min(feet, hz + H * 0.02) : feet;
      x = comp.focusX + toward * reach - w / 2;
      wd.attract = { forBeing: nearBy, x: x + w / 2, ground: base };
      out.push({ kind: "thing", label: t.kind || t.label, x, y: base - h, w, h, base, shapes: t.shapes, imp: 0.85, front: false });
      continue;
    }
    if (/busstop|bus stop|shelter/.test(k) && comp.feet != null) {
      // a shelter people wait at stands right behind them, full size
      base = feet - 2;
      x = comp.focusX - w * 0.35;
      out.push({ kind: "thing", label: t.kind || t.label, x, y: base - h, w, h, base, shapes: t.shapes, imp: 0.7, front: false, cel: true });
      continue;
    }
    if (focal) {
      base = feet;
      x = comp.focusX - w / 2;
    } else if (comp.subject === "people" && t.role === "focal" && (t.where === "ground" || t.where === "floor") && comp.feet != null) {
      // what the people are busy with stands beside them at their depth: the snowman they build, the bench they sit by
      const toward = comp.focusX < W / 2 ? 1 : -1;
      const fire = /fire/.test(k);
      // people sit facing a fire, so it burns a little beyond them where it lights their faces
      base = fire ? feet - (feet - hz) * 0.12 : feet;
      x = fire ? comp.focusX + toward * comp.body * 0.42 - w / 2 : comp.focusX + toward * (comp.body * 0.3 + w * 0.5) - w / 2;
      out.push({ kind: "thing", label: t.kind || t.label, x, y: base - h, w, h, base, shapes: t.shapes, imp: 0.9, front: false, cel: true, fire });
      if (fire) wd.fire = { x: x + w / 2, y: base - h * 0.6, r: Math.max(h, w * 0.5) };
      continue;
    } else if (t.where === "wall" && wd.interior && t.size.h < 1.4) {
      const depth = (H * 0.35) / Math.max(H * 0.35, feet - hz + H * 0.35);
      w *= depth;
      h *= depth;
      base = hz - H * rand.range(0.14, 0.3);
      x = comp.focusX + side * W * rand.range(0.18, 0.32) - w / 2;
      side = -side;
    } else if (t.where === "wall" && wd.interior) {
      const depth = (H * 0.35) / Math.max(H * 0.35, feet - hz + H * 0.35);
      w *= depth;
      h *= depth;
      base = hz + 2;
      x = comp.focusX - w / 2 + (behind ? side * W * 0.25 : 0);
      if (behind) side = -side;
      behind = true;
    } else if (t.where === "water" && wd.water) {
      base = hz + (wd.shore - hz) * rand.range(0.3, 0.85);
      const depth = Math.max(0.15, (base - hz) / Math.max(1, feet - hz));
      w *= depth;
      h *= depth;
      x = W * rand.range(0.15, 0.85) - w / 2;
    } else if (t.where === "sky") {
      base = hz * rand.range(0.25, 0.55);
      x = W * rand.range(0.15, 0.85) - w / 2;
    } else if (t.where === "table" && out.some((o) => /table|counter|desk/.test(o.label))) {
      const tb = out.find((o) => /table|counter|desk/.test(o.label));
      base = tb.y + 2;
      x = tb.x + tb.w * rand.range(0.15, 0.6);
    } else {
      // indoors furniture stands between the people and the back wall, so it shows behind them instead of under the frame
      base = wd.interior ? feet - (feet - hz) * (behind ? rand.range(0.35, 0.5) : rand.range(0.22, 0.32)) : Math.max(hz + 4, feet - H * (behind ? rand.range(0.02, 0.07) : 0.03));
      const eye = wd.interior ? hz - H * 0.35 : hz;
      const depth = Math.max(t.role === "context" ? 0.2 : 0.45, Math.min(1, (base - eye) / Math.max(1, feet - eye)));
      w *= depth;
      h *= depth;
      if (!behind && comp.subject !== "place") {
        x = comp.focusX - w / 2 + (rand() - 0.5) * w * 0.3;
        behind = true;
      } else {
        const gap = (comp.subject === "people" ? comp.body * 0.3 : comp.body * 0.55) + W * 0.04;
        x = comp.subject === "place" && !behind ? comp.focusX - w / 2 : comp.focusX + side * gap - (side < 0 ? w : 0);
        side = -side;
        behind = true;
      }
    }
    if (t.role === "context" && !focal && (w > W * 0.55 || h > H * 0.6)) continue;
    if (wd.interior && !focal) x = Math.min(W - w * 0.4, Math.max(-w * 0.6, x));
    // indoors big furniture runs off the frame like it would through a lens; outdoors it is fitted
    const fit = wd.interior && !focal ? 1 : Math.min(1, (W * 1.3) / Math.max(1, w), (H * 0.95) / Math.max(1, h));
    w *= fit;
    h *= fit;
    const fire = /\b(camp ?fire|fire|bonfire|fireplace)\b/.test(k);
    out.push({ kind: "thing", label: t.kind || t.label, x, y: base - h, w, h, base, shapes: t.shapes, imp: focal ? 1 : t.role === "secondary" ? 0.6 : 0.35, front: false, fire });
    if (fire && !wd.fire) wd.fire = { x: x + w / 2, y: base - h * 0.6, r: Math.max(h, w * 0.5) };
  }
  return out;
}

function room(plan, comp, rand) {
  const { time, interior, weather } = plan.setting;
  let hz = comp.horizon;
  // something resting on a windowsill: the window fills the view around it and the floor drops out of frame
  const sill = comp.feet != null && plan.things.some((t) => /sill/.test(kindOf(t))) && (plan.beings.some((b) => /sill/.test(b.on)) || /sill/.test(plan.people.on));
  if (sill) hz = Math.max(hz, comp.feet + 0.9 * comp.ppm);
  const kind = interior.kind || "";
  const moving = /train|subway|metro|bus|tram/.test(kind);
  const night = time === "night" || time === "dusk";
  const wall = interior.wall || (moving ? "#c9c2b0" : night ? "#5b4b55" : time === "golden" ? "#e2c9a4" : "#e6dccb");
  const floor = interior.floor || (moving ? "#4a4a52" : night ? "#5a3f2e" : "#8a6040");
  const layers = [
    { kind: "wall", material: "wall", hex: wall, depth: 0.95, top: () => -10, bottom: () => hz },
    { kind: "floor", material: "floor", hex: floor, depth: 0.95, top: () => hz, bottom: () => H + 10, vx: comp.vanish },
  ];
  const objects = [];
  const away = comp.focusX < W / 2 ? 1 : -1;
  let support = null;
  if (moving) {
    const top = hz - H * rand.range(0.44, 0.38);
    const bottom = hz - H * rand.range(0.2, 0.16);
    for (let x = W * 0.04; x < W * 0.96; x += W * 0.24) objects.push({ kind: "window", x, y: top, w: W * 0.2, h: bottom - top, outside: night ? "night" : time, weather, moving: true, base: hz - 1 });
  } else if (sill) {
    const ppm = comp.ppm;
    const w = Math.max(W * 0.5, 1.2 * ppm);
    const h = 1.3 * ppm;
    const x = comp.focusX - w / 2;
    objects.push({ kind: "window", x, y: comp.feet - h, w, h, outside: night ? "night" : time, weather, moving: false, base: comp.feet - 2 });
    const lip = Math.max(8, 0.06 * ppm);
    objects.push({ kind: "thing", label: "windowsill", x: x - 0.1 * ppm, y: comp.feet, w: w + 0.2 * ppm, h: lip * 1.6, base: comp.feet - 1, shapes: [{ type: "rect", x: 0, y: 0, w: 1, h: 0.62, color: "#ece5d6", points: [] }, { type: "rect", x: 0.03, y: 0.62, w: 0.94, h: 0.38, color: "#c9bfad", points: [] }], imp: 0.6, front: false });
    const b = plan.beings.findIndex((x) => /sill/.test(x.on));
    support = { x: comp.focusX, ground: comp.feet, seat: 0, kind: "windowsill", forPeople: b < 0, forBeing: b < 0 ? null : b };
  } else if (/airport|terminal|station|lobby|concourse/.test(kind)) {
    const top = Math.max(H * 0.04, hz - H * rand.range(0.62, 0.52));
    objects.push({ kind: "window", x: W * 0.05, y: top, w: W * 0.9, h: hz - top - H * 0.04, outside: night ? "night" : time, weather, moving: false, plane: /airport|terminal|concourse/.test(kind), base: hz - 1 });
  } else if (interior.window !== false) {
    const w = H * rand.range(0.28, 0.4);
    const h = H * rand.range(0.26, 0.34);
    objects.push({ kind: "window", x: W / 2 + away * W * rand.range(0.18, 0.3) - w / 2, y: hz - H * rand.range(0.5, 0.42) - h * 0.3, w, h, outside: night ? "night" : time, weather, moving: false, base: hz - 1 });
  }
  const win = objects[0];
  const lights = interior.light === "window" && win ? [{ kind: "window", x: win.x + win.w / 2, y: win.y + win.h / 2, r: win.w * 0.4 }] : [{ kind: "lamp", x: W / 2 - away * W * rand.range(0.1, 0.3), y: hz - H * rand.range(0.38, 0.5), r: H * 0.03 }];
  const wd = { interior: true, horizon: hz, shore: hz, water: false, emblem: false, sill };
  objects.push(...placeThings(plan, comp, wd, rand));
  objects.sort((a, b) => (a.base ?? 0) - (b.base ?? 0));
  const grey = weather === "rain" || weather === "fog" || weather === "cloud" || weather === "snow";
  const sky = grey ? OVERCAST[night ? "night" : ["golden", "dusk", "dawn"].includes(time) ? "warm" : "day"] : SKIES[night ? "night" : time] || SKIES.day;
  return { sky, lights, clouds: [], layers, objects, particles: [], horizon: hz, shore: hz, time, interior: true, support: support || wd.support || null, attract: wd.attract || null, fire: wd.fire || null, season: plan.setting.season };
}

function field(plan, comp, rand) {
  const { time, weather } = plan.setting;
  const hz = comp.horizon;
  const objects = [];
  const tones = (SKIES[time] || SKIES.golden).slice();
  for (let i = 0; i < rand.int(3, 6); i++) objects.push({ kind: "aura", x: W * rand.range(0.05, 0.95), y: H * rand.range(0.05, 0.95), r: H * rand.range(0.25, 0.6), color: tones[rand.int(0, tones.length - 1)], base: -2 });
  if (comp.feet) objects.push({ kind: "shadow", x: comp.focusX, y: comp.feet, w: comp.body * 0.9, base: -1 });
  const wd = { interior: false, emblem: true, horizon: hz, shore: hz, water: false };
  objects.push(...placeThings(plan, comp, wd, rand));
  objects.sort((a, b) => (a.base ?? 0) - (b.base ?? 0));
  const particles = [];
  if (weather === "rain") particles.push({ kind: "rain", count: 1200 });
  if (weather === "snow") particles.push({ kind: "snow", count: 600 });
  if (time === "night") particles.push({ kind: "stars", count: 220 });
  return { sky: SKIES[time] || SKIES.golden, lights: [], clouds: [], layers: [], objects, particles, horizon: hz, shore: hz, time, emblem: true, support: wd.support || null, attract: wd.attract || null, fire: wd.fire || null, season: plan.setting.season };
}

export function world(plan, comp, rand, n) {
  if (comp.layout === "interior") return room(plan, comp, rand, n);
  if (comp.layout === "emblem") return field(plan, comp, rand, n);
  const { place, features, time, weather } = plan.setting;
  const has = (f) => features.includes(f);
  const hz = comp.horizon;
  const layers = [];
  const objects = [];
  const lights = [];
  const grey = weather === "rain" || weather === "fog" || weather === "cloud";
  const sunny = !grey && (has("sun") || (has("sunset") && time !== "night"));
  if (time === "night") {
    if (has("moon") || rand.chance(0.6)) lights.push({ kind: "moon", x: comp.lightX, y: Math.max(H * 0.12, hz - H * rand.range(0.2, 0.45)), r: H * rand.range(0.035, 0.06) });
  } else if (sunny || (!grey && ["golden", "dusk", "dawn"].includes(time) && rand.chance(0.75))) {
    const low = time === "day" ? rand.range(0.25, 0.5) : rand.range(-0.02, 0.18);
    const r = H * (comp.framing === "close" ? rand.range(0.14, 0.22) : rand.range(0.07, 0.13));
    const y = comp.layout === "intimate" ? H * rand.range(0.25, 0.6) : comp.layout === "high" ? Math.max(r * 0.6, hz - r * rand.range(0.2, 0.7)) : hz - low * H - r * (time === "day" ? 0 : 0.3);
    lights.push({ kind: "sun", x: comp.lightX, y, r });
  }
  if (comp.layout === "intimate" && lights[0]?.kind === "moon") lights[0].y = H * rand.range(0.15, 0.4);
  // fireworks over a city are usually seen across a river or harbour that doubles the light
  const water = ["sea", "lake", "river"].includes(place) || has("water") || (place === "city" && has("fireworks") && rand.chance(0.5));
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
  const docked = water && (has("dock") || has("pier") || plan.people.on === "boat");
  const free = hz + (H - hz) * (place === "sea" ? Math.max(comp.shore, 0.55) : comp.shore);
  // feeding ducks or watching swimmers puts the people right at the water's edge
  const atEdge = plan.beings.some((b) => b.motion === "swim" && (b.near === "people" || plan.people.toward === b.kind));
  const shore = !water ? hz : docked && comp.feet ? Math.max(free, Math.min(H + 20, comp.feet + 70)) : comp.feet && atEdge ? Math.max(hz + 8, comp.feet - Math.max(16, (comp.feet - hz) * 0.1)) : comp.feet ? Math.max(hz + 8, Math.min(free, comp.feet - Math.max(14, (comp.feet - hz) * 0.25))) : free;
  if (water) layers.push({ kind: "water", material: "water", depth: 0.5, top: () => hz, bottom: ridge(n, shore, H * 0.03, 300, 50) });
  const groundTop = water ? ridge(n, shore, H * 0.03, 300, 50) : ridge(n, hz + 2, H * 0.012, 400, 60);
  layers.push({ kind: "ground", material: plan.setting.weather === "snow" ? "snow" : groundMat, depth: 0.8, top: groundTop, bottom: () => H + 10 });

  if (place === "road" || has("road")) {
    const vx = comp.vanish;
    layers.push({ kind: "road", material: "road", depth: 0.85, vx, top: () => hz + 1, bottom: () => H + 10, inside: (x, y) => y > hz && Math.abs(x - vx) < (y - hz) * comp.roadSpread + 2 });
  }
  if (docked && plan.people.on !== "boat" && comp.feet && comp.feet < H - 10) {
    const side = comp.focusX < W / 2 ? -1 : 1;
    const reach = comp.body * 0.5;
    objects.push({ kind: "dock", base: comp.feet, x0: side < 0 ? -10 : comp.focusX - reach, x1: side < 0 ? comp.focusX + reach : W + 10, y: comp.feet - 4, h: Math.max(10, comp.body * 0.06) });
  }
  if (has("house") || has("cabin") || place === "home") {
    const x = rand.chance(0.5) ? W * rand.range(0.12, 0.3) : W * rand.range(0.7, 0.88);
    const near = plan.focus === "place" ? rand.chance(0.7) : !water && rand.chance(0.5);
    const floor = water ? shore + (H - shore) * rand.range(0.1, 0.3) : hz + (H - hz) * rand.range(0.15, 0.35);
    const y = near ? floor : hz + 3;
    objects.push({ kind: "house", x, y, base: y, w: H * (near ? rand.range(0.13, 0.22) : rand.range(0.05, 0.09)), lit: time === "night" || time === "dusk" });
  }
  if ((treeline || has("trees") || place === "forest" || place === "garden") && hz < H * 0.92) {
    const count = place === "forest" ? rand.int(5, 9) : rand.int(1, 3);
    for (let i = 0; i < count; i++) {
      let x = rand() * W;
      if (Math.abs(x - comp.focusX) < W * 0.12) x += W * 0.25 * (x < comp.focusX ? -1 : 1);
      const near = rand();
      const floor = water ? shore + 8 : hz + 4;
      const base = floor + (H - floor) * (0.03 + near * 0.55);
      objects.push({ kind: "tree", conifer: place === "forest" || place === "mountains" || place === "snow" ? rand.chance(0.7) : rand.chance(0.2), x, base, h: Math.max(H * 0.04, Math.min(H * 0.42, (base - hz) * rand.range(0.9, 1.6) + H * 0.05)) });
    }
    objects.sort((a, b) => (a.base ?? 0) - (b.base ?? 0));
  }
  const rainbow = has("rainbow") && time !== "night" ? { x: comp.lightX < W / 2 ? W * rand.range(0.62, 0.8) : W * rand.range(0.2, 0.38), y: hz, r: Math.min(W * 0.42, hz * rand.range(0.75, 0.95)) } : null;
  const clouds = [];
  if (time !== "night" && weather !== "fog") {
    const count = grey || has("rainbow") ? rand.int(9, 15) : rand.int(2, 6);
    const ceiling = Math.min(hz, H) * (grey ? 0.75 : 0.85);
    for (let i = 0; i < count; i++) {
      const y = ceiling * rand.range(0.06, 1);
      clouds.push({ x: rand() * W, y, w: W * rand.range(0.1, 0.32) * (0.6 + (y / ceiling) * 0.5) * (grey ? 1.5 : 1), h: H * rand.range(0.025, 0.07) * (grey ? 1.4 : 1), puffs: rand.int(4, 9) });
    }
  }
  const feet = comp.feet ?? H;
  const front = (y) => y > feet - 6;
  const groundY = (x) => groundTop(x);
  if (place === "sea" || has("waves")) {
    for (let i = 0; i < rand.int(3, 6); i++) {
      const y = shore - 4 - i * (shore - hz) * rand.range(0.06, 0.12);
      if (y > hz + 4) objects.push({ kind: "foam", base: y, y, amp: 1 + (y - hz) / H * 8, phase: rand() * 6, x0: rand() * W * 0.3, x1: W - rand() * W * 0.3 });
    }
  }
  if ((place === "sea" || place === "desert" || place === "snow" || has("footprints")) && comp.feet && plan.people.pose === "run") {
    const dir = comp.focusX < W / 2 ? -1 : 1;
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const y = feet + (H - feet) * t * 0.6 - t * 10;
      objects.push({ kind: "print", base: y, x: comp.focusX + dir * (40 + i * comp.body * 0.12) * (1 + t), y, s: comp.body * 0.012 * (1 + t * 2), front: front(y) });
    }
  }
  if (["field", "garden", "lake", "river", "mountains", "forest", "home"].includes(place) && groundMat !== "road" && hz < H * 0.95) {
    const n = Math.round(rand.range(26, 60));
    for (let i = 0; i < n; i++) {
      const x = rand() * W;
      const y = Math.max(groundY(x) + 6, H * rand.range(0.62, 1.02));
      if (y < hz) continue;
      objects.push({ kind: "tuft", x, base: y, h: (y - hz) * rand.range(0.08, 0.2) + 6, front: front(y) && rand.chance(0.7) });
    }
  }
  if ((place === "garden" || has("flowers")) && weather !== "snow" && place !== "snow") {
    const bloom = place === "garden" ? rand.int(7, 12) : rand.int(2, 5);
    const big = place === "garden" ? 72 : 34;
    const hues = rand.pick([["#e58fa8", "#f6f1e6", "#c8553d"], ["#f2c14e", "#f39a4a", "#c8553d"], ["#9a7fd1", "#e58fa8", "#f6f1e6"], ["#f6f1e6", "#f2c14e", "#e58fa8", "#9a7fd1", "#c8553d"]]);
    for (let b = 0; b < bloom; b++) {
      const near = b === 0 && place === "garden" ? 1 : rand() ** 0.6;
      const cx = b === 0 ? comp.focusX : rand() * W;
      const cy = Math.max(groundY(cx) + 6, hz + 6 + (H - hz) * near);
      const spread = 40 + near * W * 0.18;
      const hue = rand.pick(hues);
      for (let i = 0; i < 18 + near * 50; i++) {
        const x = cx + rand.gauss() * spread;
        const y = Math.max(groundY(x) + 3, cy + rand.gauss() * spread * 0.18 * (0.3 + near));
        const d = Math.max(0, (y - hz) / (H - hz));
        objects.push({ kind: "flower", x, base: y, s: 3 + d ** 1.6 * big * rand.range(0.7, 1.2), hue: rand() < 0.8 ? hue : rand.pick(hues), front: front(y) && rand.chance(0.6) });
      }
    }
  }
  if (["lake", "river"].includes(place))
    for (let i = 0; i < rand.int(4, 9); i++) {
      const x = rand() * W;
      objects.push({ kind: "reed", x, base: shore + rand() * 14, h: H * rand.range(0.05, 0.12), front: false });
    }
  if ((place === "city" || has("lamps")) && hz < H * 0.92) {
    const side = comp.focusX < W / 2 ? 1 : -1;
    for (let i = 0; i < rand.int(3, 6); i++) {
      const t = (i + 1) / 6;
      const y = Math.max(water ? shore + 6 + t * 30 : 0, hz + (H - hz) * t * t * 0.9 + 8);
      if (y > H + 20) continue;
      objects.push({ kind: "lamp", x: comp.focusX + side * (W * 0.12 + t * W * 0.35), base: y, h: Math.min(H * 0.5, (y - hz) * 1.6 + 20), lit: time === "night" || time === "dusk" || weather === "rain", front: front(y) });
    }
  }
  if (has("stage")) {
    // the stage sits on the horizon, the crowd fills the ground between it and the people
    const sw = W * rand.range(0.45, 0.6);
    const sx = (comp.focusX < W / 2 ? W * 0.58 : W * 0.42) - sw / 2;
    objects.push({ kind: "stage", x: sx, y: hz - H * 0.17, w: sw, h: H * 0.17, base: hz + 1, beams: rand.int(5, 8), hues: rand.pick([["#9a7fd1", "#e58fa8", "#8fb8de"], ["#f2c14e", "#f39a4a", "#e58fa8"], ["#8fb8de", "#6fd1c4", "#f6f1e6"]]) });
    // rows shrink toward the stage; the nearest stand just behind the people at nearly their size
    const feet = comp.feet ?? H * 0.9;
    const body = comp.body || H * 0.5;
    for (let row = 0; row < 8; row++) {
      const t = (row / 7) ** 1.5;
      const y = hz + 4 + (feet - (feet - hz) * 0.12 - hz - 4) * t;
      objects.push({ kind: "crowd", y, base: y, s: Math.max(H * 0.008, body * (0.03 + t * 0.15)), seed: rand() * 1000, front: false });
    }
  }
  if (has("fireworks"))
    for (let i = 0; i < rand.int(3, 6); i++) objects.push({ kind: "firework", x: W * rand.range(0.12, 0.88), y: hz * rand.range(0.15, 0.6), base: -1, r: H * rand.range(0.06, 0.14), hue: rand.pick(["#f2c14e", "#e58fa8", "#8fb8de", "#f6f1e6", "#f39a4a"]) });
  const wd = { interior: false, emblem: false, horizon: hz, shore, water };
  objects.push(...placeThings(plan, comp, wd, rand));
  objects.sort((a, b) => (a.base ?? 0) - (b.base ?? 0));
  const particles = [];
  if (comp.layout === "intimate" && (time === "night" || time === "dusk")) particles.push({ kind: "bokeh", count: rand.int(30, 70) });
  if (weather === "rain") particles.push({ kind: "rain", count: 1700 });
  if (weather === "snow" || place === "snow") particles.push({ kind: "snow", count: 700 });
  if (time === "night" && weather !== "rain") particles.push({ kind: "stars", count: plan.people.toward === "sky" ? 1100 : 260, band: plan.people.toward === "sky" });
  if (has("birds")) particles.push({ kind: "birds", count: rand.int(3, 9) });
  if (weather === "fog") particles.push({ kind: "fog" });
  const sky = grey ? OVERCAST[time === "night" ? "night" : ["golden", "dusk", "dawn"].includes(time) ? "warm" : "day"] : SKIES[time] || SKIES.golden;
  if (plan.setting.season === "autumn") particles.push({ kind: "leaves", count: rand.int(90, 170) });
  return { sky, lights, clouds, rainbow, layers: layers.sort((a, b) => a.depth - b.depth), objects, particles, horizon: hz, shore, time, support: wd.support || null, attract: wd.attract || null, fire: wd.fire || null, season: plan.setting.season };
}
