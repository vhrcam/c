import { random } from "../random.js";
import { FORMATS } from "./director.js";

const PALETTES = {
  dawn: ["#f2b79a", "#c9a5c2", "#7f8fc0", "#f7d9a8"],
  day: ["#5f95cc", "#7aa35a", "#e9dfc8", "#3d5a80"],
  golden: ["#f2a65a", "#d9b092", "#6f8fb5", "#7a5a3a"],
  dusk: ["#d4574e", "#7a3d73", "#2d2a5a", "#f29a4a"],
  night: ["#182048", "#2a3160", "#e9d9a8", "#0c1030"],
};

// When the director can't be reached, c can still read the place, the hour and the weather out of the words.
// It can't know what a dog or a kitchen table looks like on its own, so this draws only the setting.
export function wordsScore(words, seed) {
  const t = ` ${String(words || "").toLowerCase()} `;
  const has = (...list) => list.some((w) => t.includes(w));
  const rand = random((seed ^ 0x77a1) >>> 0);
  const [W, H] = FORMATS.wide;
  const time = has("night", "midnight", " stars", "moon", "firework") ? "night" : has("sunset", "dusk", "evening", "twilight") ? "dusk" : has("sunrise", "dawn", "first light") ? "dawn" : has("golden", "late afternoon") ? "golden" : "day";
  const weather = has("storm", "thunder", "lightning") ? "storm" : has("rain", "drizzle", "pouring") ? "rain" : has("snow", "blizzard") ? "snow" : has("fog", "mist", "haze") ? "fog" : has("wind", "breeze", "gust") ? "wind" : has("cloud", "overcast", "grey sky", "gray sky") ? "cloud" : "clear";
  const backdrop = has("underwater", "reef", "diving", "ocean floor") ? "deep" : has("outer space", "galaxy", "planet", "astronaut", "orbit") ? "space" : has("kitchen", "bedroom", "living room", " room", "inside", "couch", "hallway", "classroom", "office", "diner", "cafe") ? "room" : "sky";
  const y = (v) => Math.round(H * (v + (rand() - 0.5) * 0.06) * 10) / 10;
  const edge = (at, wobble) => Array.from({ length: 6 }, (_, i) => `${Math.round((W * i) / 5)},${y(at + (rand() - 0.5) * wobble)}`).join(" ");
  const forms = [];
  const add = (name, line) => forms.push({ name, role: "setting", shapes: [line] });
  if (backdrop === "room") {
    add("floor", `band | wood | #7a5a3e | floor | 0,${y(0.72)} ${W},${y(0.72)}`);
  } else if (backdrop === "sky") {
    const low = time === "dawn" || time === "dusk" || time === "golden";
    if (low || time === "night") {
      const x = Math.round(W * (0.25 + rand() * 0.5));
      const r = time === "night" ? 5 : 8;
      add(time === "night" ? "moon" : "sun", `blob | light | ${time === "night" ? "#e9e2c8" : "#f7b35a"} | disc | ${x},${time === "night" ? y(0.22) : y(0.5)},${r},${r},0`);
    }
    if (has("mountain", "peak", "alps", "canyon", "cliff")) add("mountains", `band | stone | #5c5a6e | range | ${Array.from({ length: 8 }, (_, i) => `${Math.round((W * i) / 7)},${y(i % 2 ? 0.3 : 0.48)}`).join(" ")}`);
    if (has("forest", "woods", "trees", "pines", "jungle")) add("treeline", `band | foliage | #3f5d3a | trees | ${edge(0.46, 0.08)}`);
    if (has("city", "skyline", "street", "downtown", "tokyo", "new york")) add("city", `band | concrete | #4a4f5e | blocks | ${Array.from({ length: 12 }, (_, i) => `${Math.round((W * i) / 11)},${y(0.3 + rand() * 0.22)}`).join(" ")}`);
    if (has("sea", "ocean", "lake", "river", "pond", "beach", "shore", "dock", "boat", "waves", "harbor", "coast")) add("water", `band | water | ${time === "night" ? "#1c2c4a" : time === "day" ? "#3f7fa6" : "#5a5078"} | water | 0,${y(0.56)} ${W},${y(0.56)}`);
    if (has("beach", "sand", "desert", "dune", "shore")) add("sand", `band | sand | #d8c29a | sand | ${edge(0.76, 0.05)}`);
    else if (has("snow", "winter", "frozen", "ice")) add("snow", `band | snow | #e8edf2 | snowfield | ${edge(0.7, 0.06)}`);
    else if (has("street", "road", "city", "sidewalk", "highway")) add("road", `band | concrete | #5a5a60 | road | 0,${y(0.74)} ${W},${y(0.74)}`);
    else add("ground", `band | grass | ${time === "night" ? "#1f2e22" : "#6f9a4e"} | field | ${edge(0.72, 0.07)}`);
  }
  return {
    v: 2,
    text: String(words || "").slice(0, 600),
    seed: seed >>> 0,
    title: String(words || "untitled").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").trim().split(/\s+/).slice(0, 4).join(" ") || "untitled",
    reading: "The place, the hour and the weather, read straight from the words.",
    format: "wide",
    time,
    weather,
    backdrop,
    mood: "",
    energy: weather === "storm" ? 0.8 : 0.35,
    palette: PALETTES[time],
    light: { x: W * (0.2 + rand() * 0.6), y: time === "night" ? H * 0.15 : -H * 0.2, color: time === "night" ? "#cfd8ff" : time === "day" ? "#fff6e0" : "#ffb86b" },
    layout: "",
    forms,
  };
}
