export const PLACES = ["meadow", "beach", "mountains", "forest", "lake", "city", "snow"];
export const TIMES = ["sunrise", "day", "golden", "sunset", "night"];
export const WEATHER = ["clear", "clouds", "rain", "snow", "fog"];
export const EXTRAS = ["flowers", "stars", "fireflies", "birds", "trees", "lanterns", "aurora", "shooting-star"];
export const MOODS = ["warm", "dreamy", "calm", "moody", "bright"];
export const POSES = ["stand", "hold", "kiss", "hug", "sit", "walk"];
export const STYLES = ["watercolor", "oil", "storybook", "ink", "pixel"];
export const HAIR = ["short", "long", "bun"];

export const LABELS = {
  place: { meadow: "meadow", beach: "beach", mountains: "mountains", forest: "forest", lake: "lake", city: "city", snow: "snowy hills" },
  time: { sunrise: "sunrise", day: "daytime", golden: "golden hour", sunset: "sunset", night: "night" },
  weather: { clear: "clear sky", clouds: "clouds", rain: "rain", snow: "snow", fog: "fog" },
  extras: { flowers: "flowers", stars: "stars", fireflies: "fireflies", birds: "birds", trees: "trees", lanterns: "lanterns", aurora: "northern lights", "shooting-star": "shooting star" },
  mood: { warm: "warm", dreamy: "dreamy", calm: "calm", moody: "moody", bright: "bright" },
  pose: { stand: "standing", hold: "holding hands", kiss: "kissing", hug: "hugging", sit: "sitting", walk: "walking" },
  style: { watercolor: "watercolor", oil: "oil", storybook: "storybook", ink: "ink", pixel: "pixel" },
};

export const PEOPLE = ["no one", "one person", "two people", "three people", "four people", "five people"];

export const COLORS = {
  red: "#b5352d",
  pink: "#e290ab",
  orange: "#df7a3a",
  yellow: "#e6c34a",
  green: "#4d8748",
  teal: "#2e8584",
  blue: "#4170ad",
  navy: "#25375c",
  purple: "#6c4b98",
  brown: "#6e4a2f",
  black: "#201e1c",
  white: "#f1eee6",
  gray: "#8a8780",
  cream: "#e8dbbd",
  gold: "#c8a13f",
};

export const TAG_GROUPS = [
  { key: "place", options: PLACES },
  { key: "time", options: TIMES },
  { key: "weather", options: WEATHER.slice(1) },
  { key: "extras", options: EXTRAS, multi: true, shown: 4 },
];

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (value, list, fallback) => (list.includes(value) ? value : fallback);
const hex = (value) => (HEX.test(value || "") ? value.toLowerCase() : "");
const PAIRS = ["hold", "kiss", "hug"];

function figure(f = {}) {
  return {
    hair: hex(f.hair),
    hairLength: pick(f.hairLength, HAIR, ""),
    skin: hex(f.skin),
    top: hex(f.top),
    bottom: hex(f.bottom),
    dress: Boolean(f.dress),
    height: Math.min(1.08, Math.max(0.55, Number(f.height) || 1)),
  };
}

export function normalize(input = {}) {
  const people = (Array.isArray(input.people) ? input.people : []).slice(0, 5).map(figure);
  let pose = pick(input.pose, POSES, people.length > 1 ? "hold" : "stand");
  if (people.length < 2 && PAIRS.includes(pose)) pose = "stand";
  if (people.length > 2 && ["kiss", "hug"].includes(pose)) pose = "hold";
  return {
    seed: Number.isInteger(input.seed) ? input.seed >>> 0 : 1,
    style: pick(input.style, STYLES, "watercolor"),
    place: pick(input.place, PLACES, "meadow"),
    time: pick(input.time, TIMES, "golden"),
    weather: pick(input.weather, WEATHER, "clear"),
    extras: [...new Set((Array.isArray(input.extras) ? input.extras : []).filter((x) => EXTRAS.includes(x)))],
    mood: pick(input.mood, MOODS, "warm"),
    pose,
    people,
    skyTint: hex(input.skyTint),
    caption: String(input.caption || "").slice(0, 240),
  };
}

export function newSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function colorName(value) {
  if (!value) return "";
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(value);
  let best = "";
  let distance = Infinity;
  for (const [name, h] of Object.entries(COLORS)) {
    const [r2, g2, b2] = rgb(h);
    const mean = (r + r2) / 2;
    const d = (2 + mean / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - mean) / 256) * (b - b2) ** 2;
    if (d < distance) [best, distance] = [name, d];
  }
  return best;
}

export function sceneTags(scene) {
  const tags = [
    { group: "time", value: scene.time, label: LABELS.time[scene.time] },
    { group: "place", value: scene.place, label: LABELS.place[scene.place] },
  ];
  if (scene.weather !== "clear") tags.push({ group: "weather", value: scene.weather, label: LABELS.weather[scene.weather] });
  if (scene.people.length) {
    tags.push({ group: "people", value: scene.people.length, label: PEOPLE[scene.people.length] });
    tags.push({ group: "pose", value: scene.pose, label: LABELS.pose[scene.pose] });
    scene.people.forEach((f, index) => {
      const color = f.dress ? f.top : f.top || f.bottom;
      const item = f.dress ? "dress" : f.top && f.top === f.bottom ? "suit" : f.top ? "top" : "pants";
      if (color) tags.push({ group: "outfit", value: index, label: `${colorName(color)} ${item}` });
    });
  }
  scene.extras.forEach((x) => tags.push({ group: "extras", value: x, label: LABELS.extras[x] }));
  tags.push({ group: "mood", value: scene.mood, label: LABELS.mood[scene.mood] });
  return tags;
}

export function swapOptions(tag, scene) {
  const list = (options, group) => options.map((value) => ({ value, label: LABELS[group][value] }));
  if (tag.group === "time") return list(TIMES, "time");
  if (tag.group === "place") return list(PLACES, "place");
  if (tag.group === "weather") return list(WEATHER, "weather");
  if (tag.group === "mood") return list(MOODS, "mood");
  if (tag.group === "pose") return list(POSES.filter((p) => scene.people.length > 1 || !PAIRS.includes(p)).filter((p) => scene.people.length < 3 || !["kiss", "hug"].includes(p)), "pose");
  if (tag.group === "people") return PEOPLE.map((label, value) => ({ value, label }));
  if (tag.group === "extras") return [{ value: null, label: "remove" }];
  if (tag.group === "outfit") return Object.entries(COLORS).map(([label, value]) => ({ value, label, swatch: value }));
  return [];
}

export function applySwap(scene, tag, value) {
  const next = structuredClone(scene);
  if (tag.group === "extras") next.extras = next.extras.filter((x) => x !== tag.value);
  else if (tag.group === "people") {
    while (next.people.length < value) next.people.push(figure({ height: next.people.length > 1 ? 0.7 : 1 }));
    next.people = next.people.slice(0, value);
  } else if (tag.group === "outfit") {
    const f = next.people[tag.value];
    const suit = !f.dress && f.top && f.top === f.bottom;
    if (f.dress || f.top) f.top = value;
    if (suit || (!f.dress && !f.top)) f.bottom = value;
  } else next[tag.group] = value;
  return normalize(next);
}
