import { random } from "../random";
import { H, W } from "./world";

export const POSES = ["embrace", "sit", "stand", "walk", "run", "alone", "ride", "crouch", "lie"];
export const PLACES = ["sea", "lake", "river", "field", "mountains", "forest", "city", "desert", "snow", "road", "garden", "home"];
export const FEATURES = ["sun", "sunset", "moon", "stars", "trees", "mountains", "water", "buildings", "road", "birds", "dock", "pier", "house", "cabin", "flowers", "fireworks", "lamps", "waves", "footprints", "rainbow"];
export const TIMES = ["dawn", "day", "golden", "dusk", "night"];
export const WEATHER = ["clear", "cloud", "rain", "snow", "fog"];
export const MOODS = ["tender", "joyful", "nostalgic", "melancholy", "serene", "lonely", "electric", "epic"];
export const DIRECTIONS = ["expressive", "geometric", "organic", "lines", "mosaic", "contours", "stipple"];
export const FOCUS = ["people", "place", "moment"];
export const GENDERS = ["unspecified", "woman", "man"];
export const AGES = ["unspecified", "child", "adult", "elder"];
export const FAMILIES = ["quadruped", "bird"];
export const MOTIONS = ["stand", "sit", "lie", "walk", "run", "swim", "fly"];
export const ROLES = ["focal", "secondary", "context"];
export const EARS = ["pointed", "floppy", "round", "none"];
export const TAILS = ["long", "bushy", "short", "curled", "none"];
export const WHERE = ["ground", "floor", "wall", "water", "sky", "table", "hand"];
export const SPACES = ["outdoor", "interior", "abstract"];
export const SPATIAL = ["scene", "close", "interior", "emblem"];
export const FRAMINGS = ["close", "medium", "wide", "vast"];
export const SHAPES = ["rect", "ellipse", "circle", "ring", "tri", "poly", "line"];

const hexOk = (v) => (/^#[0-9a-f]{6}$/i.test(v || "") ? v.toLowerCase() : "");
const num = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : d);
const str = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);

const box = (type, x, y, w, h, color, extra = {}) => ({ type, x, y, w, h, color, ...extra });
const LIB = {
  car: { size: { w: 4.3, h: 1.45 }, shapes: [box("rect", 0.02, 0.42, 0.96, 0.38, "#b3402c"), box("poly", 0, 0, 0, 0, "#b3402c", { points: [[0.2, 0.43], [0.33, 0.08], [0.7, 0.08], [0.84, 0.43]] }), box("poly", 0, 0, 0, 0, "#9fbfd2", { points: [[0.27, 0.41], [0.36, 0.15], [0.5, 0.15], [0.5, 0.41]] }), box("poly", 0, 0, 0, 0, "#9fbfd2", { points: [[0.53, 0.41], [0.53, 0.15], [0.67, 0.15], [0.77, 0.41]] }), box("circle", 0.22, 0.8, 0.19, 0, "#1f1d22"), box("circle", 0.78, 0.8, 0.19, 0, "#1f1d22"), box("circle", 0.22, 0.8, 0.08, 0, "#9a9a9a"), box("circle", 0.78, 0.8, 0.08, 0, "#9a9a9a"), box("rect", 0.93, 0.5, 0.05, 0.07, "#ffd27a")] },
  train: { size: { w: 20, h: 3.8 }, shapes: [box("rect", 0, 0.06, 1, 0.8, "#2f4f6f"), box("rect", 0, 0.62, 1, 0.06, "#d9c9a3"), ...Array.from({ length: 8 }, (_, i) => box("rect", 0.04 + i * 0.12, 0.18, 0.08, 0.3, "#f2d38a")), box("rect", 0, 0.86, 1, 0.06, "#1f1d22"), ...Array.from({ length: 6 }, (_, i) => box("circle", 0.08 + i * 0.17, 0.94, 0.03, 0, "#2a2a2a"))] },
  bus: { size: { w: 11, h: 3.2 }, shapes: [box("rect", 0, 0.05, 1, 0.78, "#d9a03a"), ...Array.from({ length: 6 }, (_, i) => box("rect", 0.05 + i * 0.15, 0.15, 0.11, 0.28, "#9fbfd2")), box("circle", 0.18, 0.86, 0.11, 0, "#1f1d22"), box("circle", 0.8, 0.86, 0.11, 0, "#1f1d22")] },
  boat: { size: { w: 5, h: 2.2 }, shapes: [box("poly", 0, 0, 0, 0, "#efe9dc", { points: [[0, 0.5], [1, 0.5], [0.86, 0.95], [0.12, 0.95]] }), box("rect", 0.3, 0.2, 0.36, 0.3, "#2b3a67"), box("rect", 0.36, 0.26, 0.24, 0.1, "#9fbfd2")] },
  table: { size: { w: 1.4, h: 0.76 }, shapes: [box("rect", 0, 0, 1, 0.1, "#7a5232"), box("rect", 0.05, 0.1, 0.05, 0.9, "#5c3b24"), box("rect", 0.9, 0.1, 0.05, 0.9, "#5c3b24")] },
  chair: { size: { w: 0.5, h: 0.95 }, shapes: [box("rect", 0.78, 0, 0.12, 0.56, "#6b4a2f"), box("rect", 0.05, 0.5, 0.85, 0.09, "#6b4a2f"), box("rect", 0.08, 0.59, 0.07, 0.41, "#5c3b24"), box("rect", 0.8, 0.59, 0.07, 0.41, "#5c3b24")] },
  counter: { size: { w: 3.2, h: 0.92 }, shapes: [box("rect", 0, 0, 1, 0.09, "#d9d2c4"), box("rect", 0, 0.09, 1, 0.91, "#8a6a4a"), ...Array.from({ length: 4 }, (_, i) => box("rect", 0.03 + i * 0.245, 0.17, 0.21, 0.74, "#7a5c3e")), box("rect", 0.08, 0.13, 0.06, 0.02, "#2a2a2a")] },
  fridge: { size: { w: 0.8, h: 1.8 }, shapes: [box("rect", 0, 0, 1, 1, "#e8e6e0"), box("rect", 0, 0.35, 1, 0.012, "#b8b6b0"), box("rect", 0.82, 0.12, 0.05, 0.18, "#8a8a8a"), box("rect", 0.82, 0.45, 0.05, 0.25, "#8a8a8a")] },
  stove: { size: { w: 0.8, h: 0.92 }, shapes: [box("rect", 0, 0, 1, 1, "#d8d4cc"), box("rect", 0.1, 0.3, 0.8, 0.45, "#3a3a3a"), box("circle", 0.3, 0.06, 0.18, 0, "#2a2a2a"), box("circle", 0.7, 0.06, 0.18, 0, "#2a2a2a")] },
  bed: { size: { w: 2.1, h: 0.9 }, shapes: [box("rect", 0, 0, 0.06, 1, "#6b4a2f"), box("rect", 0.04, 0.45, 0.96, 0.4, "#7a5232"), box("rect", 0.06, 0.3, 0.92, 0.2, "#efe9dc"), box("ellipse", 0.16, 0.26, 0.2, 0.12, "#f6f1e6"), box("rect", 0.35, 0.28, 0.63, 0.22, "#5c7290")] },
  couch: { size: { w: 2.2, h: 0.85 }, shapes: [box("rect", 0, 0.1, 1, 0.45, "#5c7290"), box("rect", 0, 0.5, 1, 0.3, "#4a6080"), box("rect", 0, 0.25, 0.1, 0.55, "#4a6080"), box("rect", 0.9, 0.25, 0.1, 0.55, "#4a6080"), box("rect", 0.04, 0.8, 0.04, 0.2, "#2a2a2a"), box("rect", 0.92, 0.8, 0.04, 0.2, "#2a2a2a")] },
  bench: { size: { w: 1.8, h: 0.85 }, shapes: [box("rect", 0, 0, 1, 0.12, "#6b4a2f"), box("rect", 0, 0.18, 1, 0.12, "#6b4a2f"), box("rect", 0, 0.46, 1, 0.12, "#7a5232"), box("rect", 0.06, 0.58, 0.05, 0.42, "#2a2a2a"), box("rect", 0.89, 0.58, 0.05, 0.42, "#2a2a2a")] },
  seats: { size: { w: 2.4, h: 1.2 }, shapes: [box("rect", 0, 0, 0.08, 0.75, "#7a3a3a"), box("rect", 0, 0.5, 0.45, 0.22, "#8a4a48"), box("rect", 0.52, 0, 0.08, 0.75, "#7a3a3a"), box("rect", 0.52, 0.5, 0.45, 0.22, "#8a4a48"), box("rect", 0.06, 0.72, 0.04, 0.28, "#2a2a2a"), box("rect", 0.58, 0.72, 0.04, 0.28, "#2a2a2a")] },
  door: { size: { w: 0.95, h: 2.1 }, shapes: [box("rect", -0.08, -0.04, 1.16, 1.04, "#e9e2d4"), box("rect", 0, 0, 1, 1, "#6b4a2f"), box("rect", 0.12, 0.08, 0.76, 0.36, "#5c3b24"), box("rect", 0.12, 0.52, 0.76, 0.4, "#5c3b24"), box("circle", 0.84, 0.52, 0.06, 0, "#d9a73a")] },
  lamp: { size: { w: 0.45, h: 1.7 }, shapes: [box("tri", 0.1, 0, 0.8, 0.22, "#f2d38a"), box("rect", 0.47, 0.22, 0.06, 0.74, "#2a2a2a"), box("ellipse", 0.5, 0.97, 0.5, 0.05, "#2a2a2a")] },
  letter: { size: { w: 0.24, h: 0.17 }, shapes: [box("rect", 0, 0, 1, 1, "#f6f1e4"), box("poly", 0, 0, 0, 0, "#e4dac4", { points: [[0, 0], [0.5, 0.56], [1, 0]] }), box("rect", 0.08, 0.66, 0.5, 0.06, "#b8ad98"), box("rect", 0.08, 0.8, 0.34, 0.05, "#b8ad98")] },
  book: { size: { w: 0.24, h: 0.3 }, shapes: [box("rect", 0, 0, 1, 1, "#8a2f3a"), box("rect", 0.06, 0.04, 0.9, 0.92, "#f2ecdf"), box("rect", 0.5, 0.04, 0.02, 0.92, "#c9bfad")] },
  phone: { size: { w: 0.075, h: 0.155 }, shapes: [box("rect", 0, 0, 1, 1, "#1f1d22"), box("rect", 0.08, 0.06, 0.84, 0.86, "#9fc3e8")] },
  umbrella: { size: { w: 1.0, h: 0.95 }, shapes: [box("poly", 0, 0, 0, 0, "#2b3a67", { points: [[0, 0.42], [0.08, 0.2], [0.28, 0.05], [0.5, 0], [0.72, 0.05], [0.92, 0.2], [1, 0.42], [0.83, 0.36], [0.66, 0.42], [0.5, 0.36], [0.34, 0.42], [0.17, 0.36]] }), box("line", 0, 0, 0.02, 0, "#2a2a2a", { points: [[0.5, 0.02], [0.5, 0.92], [0.46, 1]] })] },
  cup: { size: { w: 0.09, h: 0.1 }, shapes: [box("rect", 0.05, 0, 0.75, 1, "#efe9dc"), box("ring", 0.86, 0.45, 0.3, 0, "#efe9dc")] },
  bouquet: { size: { w: 0.32, h: 0.45 }, shapes: [box("line", 0, 0, 0.03, 0, "#3f7a4a", { points: [[0.5, 1], [0.35, 0.35]] }), box("line", 0, 0, 0.03, 0, "#3f7a4a", { points: [[0.5, 1], [0.65, 0.35]] }), box("circle", 0.3, 0.3, 0.36, 0, "#e58fa8"), box("circle", 0.68, 0.28, 0.34, 0, "#f2c14e"), box("circle", 0.5, 0.14, 0.32, 0, "#c8553d")] },
  balloon: { size: { w: 0.3, h: 1.1 }, shapes: [box("ellipse", 0.5, 0.17, 1, 0.34, "#c8553d"), box("line", 0, 0, 0.01, 0, "#6a6a6a", { points: [[0.5, 0.34], [0.46, 0.6], [0.52, 1]] })] },
  rod: { size: { w: 1.9, h: 1.5 }, shapes: [box("line", 0, 0, 0.012, 0, "#5a4030", { points: [[0.02, 0.98], [0.55, 0.45], [1, 0.02]] }), box("line", 0, 0, 0.003, 0, "#d8d8d8", { points: [[1, 0.02], [1.02, 0.6], [1.03, 1.3]] }), box("circle", 0.1, 0.88, 0.07, 0, "#3a3a3a")] },
  icecream: { size: { w: 0.08, h: 0.17 }, shapes: [box("poly", 0, 0, 0, 0, "#d9a35a", { points: [[0.1, 0.42], [0.9, 0.42], [0.5, 1]] }), box("circle", 0.5, 0.3, 0.92, 0, "#f3c6d3"), box("circle", 0.42, 0.13, 0.6, 0, "#fbeee6")] },
  snowman: { size: { w: 0.8, h: 1.3 }, shapes: [box("circle", 0.5, 0.78, 0.86, 0, "#f6f8fb"), box("circle", 0.5, 0.42, 0.6, 0, "#f6f8fb"), box("circle", 0.5, 0.17, 0.42, 0, "#f6f8fb"), box("poly", 0, 0, 0, 0, "#e07a2e", { points: [[0.5, 0.15], [0.68, 0.17], [0.5, 0.19]] }), box("circle", 0.44, 0.13, 0.05, 0, "#1f1d22"), box("circle", 0.58, 0.13, 0.05, 0, "#1f1d22"), box("line", 0, 0, 0.02, 0, "#5a4030", { points: [[0.25, 0.42], [0.02, 0.28]] }), box("line", 0, 0, 0.02, 0, "#5a4030", { points: [[0.75, 0.42], [0.98, 0.3]] }), box("rect", 0.3, 0.27, 0.4, 0.05, "#c8553d")] },
  baby: { size: { w: 0.44, h: 0.2 }, shapes: [box("ellipse", 0.2, 0.42, 0.44, 0.92, "#d8eee2"), box("poly", 0, 0, 0, 0, "#d8eee2", { points: [[0.2, 0.12], [0.55, 0.04], [0.88, 0.16], [1, 0.5], [0.9, 0.84], [0.55, 0.96], [0.24, 0.88]] }), box("line", 0, 0, 0.012, 0, "#a9cdb9", { points: [[0.4, 0.2], [0.62, 0.55], [0.5, 0.9]] }), box("circle", 0.21, 0.44, 0.28, 0, "#f3d3bd"), box("line", 0, 0, 0.008, 0, "#4a3530", { points: [[0.14, 0.4], [0.165, 0.43], [0.19, 0.4]] }), box("line", 0, 0, 0.008, 0, "#4a3530", { points: [[0.24, 0.4], [0.265, 0.43], [0.29, 0.4]] }), box("line", 0, 0, 0.007, 0, "#b06a6a", { points: [[0.2, 0.53], [0.225, 0.545]] }), box("ellipse", 0.21, 0.24, 0.16, 0.12, "#6b4a35")] },
  windowsill: { size: { w: 1.2, h: 0.1 }, shapes: [box("rect", 0, 0, 1, 0.55, "#e9e2d4"), box("rect", 0.04, 0.55, 0.92, 0.45, "#cfc6b4")] },
  swing: { size: { w: 1.6, h: 2.0 }, shapes: [box("rect", 0, 0, 1, 0.05, "#6b4a2f"), box("line", 0, 0, 0.012, 0, "#3a3a3a", { points: [[0.12, 0.05], [0.12, 0.62]] }), box("line", 0, 0, 0.012, 0, "#3a3a3a", { points: [[0.88, 0.05], [0.88, 0.62]] }), box("rect", 0.05, 0.62, 0.9, 0.06, "#7a5232"), box("rect", 0.05, 0.42, 0.9, 0.05, "#7a5232")] },
  fence: { size: { w: 4, h: 1.2 }, shapes: [box("rect", 0, 0.25, 1, 0.07, "#8a6a4a"), box("rect", 0, 0.6, 1, 0.07, "#8a6a4a"), ...Array.from({ length: 6 }, (_, i) => box("rect", 0.02 + i * 0.19, 0.05, 0.035, 0.95, "#7a5c3e"))] },
  bicycle: { size: { w: 1.8, h: 1.05 }, shapes: [box("ring", 0.2, 0.7, 0.36, 0, "#1f1d22"), box("ring", 0.8, 0.7, 0.36, 0, "#1f1d22"), box("line", 0, 0, 0.03, 0, "#b3402c", { points: [[0.2, 0.7], [0.45, 0.35], [0.75, 0.35], [0.8, 0.7]] }), box("line", 0, 0, 0.03, 0, "#b3402c", { points: [[0.45, 0.35], [0.5, 0.7], [0.75, 0.35]] })] },
};

const BEASTS = [
  [/\b(dog|dogs|puppy|puppies|pup)\b/, { family: "quadruped", kind: "dog", size: 0.65, build: { legs: 0.5, body: 0.55, neck: 0.4, head: 0.55, snout: 0.55, ears: "floppy", tail: "long" }, colors: ["#b8864b", "#ead8b8"] }],
  [/\b(cat|cats|kitten|kittens)\b/, { family: "quadruped", kind: "cat", size: 0.45, build: { legs: 0.4, body: 0.45, neck: 0.25, head: 0.55, snout: 0.15, ears: "pointed", tail: "long" }, colors: ["#8a7a6a", "#ddd2c4"] }],
  [/\b(fox|foxes)\b/, { family: "quadruped", kind: "fox", size: 0.6, build: { legs: 0.45, body: 0.38, neck: 0.35, head: 0.5, snout: 0.75, ears: "pointed", tail: "bushy" }, colors: ["#c8642e", "#f2e6d8"] }],
  [/\b(wolf|wolves)\b/, { family: "quadruped", kind: "wolf", size: 1.0, build: { legs: 0.55, body: 0.5, neck: 0.4, head: 0.55, snout: 0.75, ears: "pointed", tail: "bushy" }, colors: ["#8a8a86", "#d8d6cf"] }],
  [/\b(horse|horses|pony|ponies)\b/, { family: "quadruped", kind: "horse", size: 1.5, build: { legs: 0.8, body: 0.55, neck: 0.85, head: 0.45, snout: 0.85, ears: "pointed", tail: "long" }, colors: ["#6b4a2f", "#4a3020"] }],
  [/\b(deer|fawn|doe|stag)\b/, { family: "quadruped", kind: "deer", size: 1.1, build: { legs: 0.85, body: 0.42, neck: 0.65, head: 0.45, snout: 0.6, ears: "pointed", tail: "short" }, colors: ["#a0703f", "#ead9c0"] }],
  [/\b(cow|cows|calf)\b/, { family: "quadruped", kind: "cow", size: 1.6, build: { legs: 0.42, body: 0.85, neck: 0.3, head: 0.55, snout: 0.5, ears: "round", tail: "long" }, colors: ["#efe9dc", "#2b2b30"] }],
  [/\b(rabbit|rabbits|bunny|bunnies|hare)\b/, { family: "quadruped", kind: "rabbit", size: 0.3, build: { legs: 0.3, body: 0.65, neck: 0.1, head: 0.6, snout: 0.2, ears: "pointed", tail: "short" }, colors: ["#b9a894", "#efe8dc"] }],
  [/\b(bear|bears)\b/, { family: "quadruped", kind: "bear", size: 1.5, build: { legs: 0.35, body: 0.9, neck: 0.25, head: 0.55, snout: 0.5, ears: "round", tail: "short" }, colors: ["#4a3326", "#6b4a35"] }],
  [/\b(sheep|lamb|lambs)\b/, { family: "quadruped", kind: "sheep", size: 1.0, build: { legs: 0.35, body: 0.85, neck: 0.25, head: 0.45, snout: 0.45, ears: "floppy", tail: "short" }, colors: ["#efeae0", "#2b2724"] }],
  [/\b(duck|ducks|duckling|ducklings|goose|geese|swan|swans)\b/, { family: "bird", kind: "duck", size: 0.45, colors: ["#8a6a4a", "#efe6d6", "#2f6f4a", "#e0a030"] }],
  [/\b(bird|birds|seagulls?|gulls?|pigeons?|crows?|robins?|sparrows?|owls?)\b/, { family: "bird", kind: "bird", size: 0.25, colors: ["#5a4a3a", "#d8cfc2", "#3a3530", "#d9a03a"] }],
];

const THINGS = [
  [/\b(drove|driving|drive|road trip|in the car|car ride)\b/, "car", { holds: true, role: "focal", where: "ground" }],
  [/\b(car|truck|jeep)\b/, "car", { where: "ground" }],
  [/\b(on|in) the (train|subway|metro|tram)\b/, "seats", { where: "floor", interior: "train" }],
  [/\b(train|subway)\b/, "train", { where: "ground" }],
  [/\b(bus)\b/, "bus", { where: "ground" }],
  [/\b(boat|canoe|kayak|sailboat)\b/, "boat", { where: "water" }],
  [/\b(bike|bicycle)\b/, "bicycle", { where: "ground" }],
  [/\bkitchen\b/, "counter", { where: "floor", interior: "kitchen", more: ["fridge", "stove"] }],
  [/\b(bedroom|in bed|bed)\b/, "bed", { where: "floor", interior: "bedroom", more: ["lamp"] }],
  [/\b(living room|couch|sofa)\b/, "couch", { where: "floor", interior: "living room", more: ["lamp"] }],
  [/\b(cafe|café|coffee shop|diner|restaurant)\b/, "table", { where: "floor", interior: "cafe", more: ["chair"] }],
  [/\b(table)\b/, "table", { where: "floor" }],
  [/\b(bench)\b/, "bench", { where: "ground" }],
  [/\b(windowsill|window sill|window seat|sill)\b/, "windowsill", { where: "wall" }],
  [/\b(letter|envelope|acceptance)\b/, "letter", { where: "hand" }],
  [/\b(book|reading|novel)\b/, "book", { where: "hand" }],
  [/\b(phone|texted|texting|call(ed)? (me|her|him))\b/, "phone", { where: "hand" }],
  [/\bumbrella\b/, "umbrella", { where: "hand" }],
  [/\b(coffee|tea|mug|cup of)\b/, "cup", { where: "hand" }],
  [/\b(bouquet|(gave|bought|brought|picked|holding|handed)( me| her| him)? (some |a )?(flowers|roses|tulips))\b/, "bouquet", { where: "hand" }],
  [/\bballoons?\b/, "balloon", { where: "hand" }],
  [/\b(fish(ing)?|fishing (rod|pole))\b/, "rod", { where: "hand" }],
  [/\b(ice[- ]cream|cone|popsicle|gelato)\b/, "icecream", { where: "hand" }],
  [/\bsnow ?m[ae]n\b/, "snowman", { where: "ground" }],
  [/\b(newborn|infant)\b|\bholding (my|our|a|the) (baby|newborn|daughter|son) for the first time\b|\b(our|my|the|a) baby\b(?! (sister|brother|cousin|girl|boy))/, "baby", { where: "hand" }],
  [/\b(porch swing|swing)\b/, "swing", { where: "ground" }],
  [/\b(fence|gate)\b/, "fence", { where: "ground" }],
  [/\b(door|doorway|front step|porch)\b/, "door", { where: "ground" }],
];

function grounded(shapes) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (x, y) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  for (const s of shapes) {
    if (s.type === "rect" || s.type === "tri") {
      take(s.x, s.y);
      take(s.x + s.w, s.y + s.h);
    } else if (s.type === "ellipse") {
      take(s.x - s.w / 2, s.y - s.h / 2);
      take(s.x + s.w / 2, s.y + s.h / 2);
    } else if (s.type === "circle" || s.type === "ring") {
      take(s.x - s.w / 2, s.y - s.w / 2);
      take(s.x + s.w / 2, s.y + s.w / 2);
    } else for (const [u, v] of s.points || []) take(u, v);
  }
  if (!Number.isFinite(x0) || x1 - x0 < 0.05 || y1 - y0 < 0.05) return shapes;
  const sx = 1 / (x1 - x0);
  const sy = 1 / (y1 - y0);
  const X = (u) => (u - x0) * sx;
  const Y = (v) => (v - y0) * sy;
  return shapes.map((s) => ({
    ...s,
    x: s.type === "ellipse" || s.type === "circle" || s.type === "ring" ? X(s.x) : X(s.x),
    y: Y(s.y),
    w: s.w * sx,
    h: s.type === "circle" || s.type === "ring" ? s.h : s.h * sy,
    points: (s.points || []).map(([u, v]) => [X(u), Y(v)]),
  }));
}

function thing(label, kind, extra = {}) {
  const lib = LIB[kind] || LIB.table;
  return { label, kind, role: extra.role || "secondary", where: extra.where || "ground", holds: Boolean(extra.holds), size: { ...lib.size }, shapes: lib.shapes.map((x) => ({ ...x })) };
}

const BY_MOOD = {
  tender: ["expressive", "stipple", "organic", "mosaic", "contours", "lines", "geometric"],
  joyful: ["geometric", "mosaic", "expressive", "stipple", "lines", "contours", "organic"],
  nostalgic: ["lines", "contours", "expressive", "mosaic", "organic", "stipple", "geometric"],
  melancholy: ["organic", "stipple", "lines", "contours", "expressive", "mosaic", "geometric"],
  serene: ["contours", "lines", "geometric", "mosaic", "expressive", "stipple", "organic"],
  lonely: ["stipple", "organic", "contours", "lines", "geometric", "mosaic", "expressive"],
  electric: ["geometric", "stipple", "mosaic", "organic", "expressive", "contours", "lines"],
  epic: ["expressive", "geometric", "mosaic", "organic", "contours", "lines", "stipple"],
};

const pick = (v, list, d) => (list.includes(v) ? v : d);

const COLORS = { red: "#a8402c", auburn: "#8a3b22", ginger: "#c0612c", orange: "#de7a2e", yellow: "#e6b72f", gold: "#d9a73a", blonde: "#e2c27c", green: "#3f7a4a", teal: "#2f7f7d", blue: "#3b5ba5", navy: "#26346b", purple: "#7a4f9a", pink: "#e58fa8", white: "#efebe4", silver: "#c2c5cc", gray: "#86888d", grey: "#86888d", black: "#1f1d22", brown: "#6b4a2f", tan: "#b8935e", denim: "#4a6a95" };

export function colorIn(text) {
  const m = String(text || "").toLowerCase().match(new RegExp(`\\b(${Object.keys(COLORS).join("|")})\\b`));
  return m ? COLORS[m[1]] : "";
}

const GENDERED = /\b(her|she|hers|him|he|his|girlfriend|boyfriend|wife|husband|mom|mother|dad|father|sister|brother|grandma|grandmother|grandpa|grandfather|daughter|son|aunt|uncle|woman|women|man|men|girl|girls|boy|boys|lady|guy)\b/;

const PERSON = /\b(i|me|my|we|us|our|he|she|him|her|they|them|mom|mother|dad|father|grandpa|grandma|grandfather|grandmother|brother|sister|friend|son|daughter|wife|husband|partner|girlfriend|boyfriend|kid|child|baby)\b/;
const RIDE = /\b(rid(e|es|ing)|rode)\b/;
const EMBRACE = /\b(kiss\w*|hug\w*|embrac\w*|slow danc\w*|cuddl\w*)\b/;
const LIE = /\b((lying|lay|laid|lie)( down)? (on|in) (the|a|our|my)|stargaz\w*|in bed together)\b/;
const SIT = /\b(sit|sat|sitting|seated)\b/;
const CROUCH = /\b(feed\w*|kneel\w*|crouch\w*|squat\w*|petting|planting|picking (up )?(shells|flowers|berries)|digging|build\w* (a )?(sand ?castle|snow ?man))\b/;
const RUN = /\b(rac(e|ed|ing)|run(ning)?|ran|sprint\w*|chas\w+)\b/;
const WALK = /\b(walk\w*|stroll\w*|hik(e|ed|ing))\b/;
const WATCH = /\b(watch\w*|look\w* (at|out|up)|gaz\w*|stargaz\w*|star(ed|ing) at|admir\w*)\b/;
const ON = /\b(on|in|onto|atop) (the|a|an|our|my|his|her|their)? ?(\w+ )?(bench|couch|sofa|bed|swing|porch swing|grass|sand|blanket|bike|bicycle|chair|floor|rug|windowsill|sill|window seat|seat|seats|lap)\b/;
const NEAR = /\b(at|by|near|beside|next to|in front of) (the|a|our|my) (\w+ )?(front door|door|gate|fence|window|table)\b/;
const SUPPORT = { bench: "bench", couch: "couch", sofa: "couch", bed: "bed", swing: "swing", "porch swing": "swing", grass: "ground", sand: "ground", blanket: "ground", floor: "ground", rug: "ground", bike: "bicycle", bicycle: "bicycle", chair: "chair", windowsill: "windowsill", sill: "windowsill", "window seat": "windowsill", seat: "seats", seats: "seats" };
const LIB_WHERE = { windowsill: "wall", bed: "floor", couch: "floor", chair: "floor", table: "floor", door: "wall" };
const ELDER = /\b(grand(pa|ma|father|mother|parents?|dad|mom)|nana|granny|gran|old (man|woman|lady)|elderly)\b/;

function honor(plan) {
  const t = ` ${plan.text.toLowerCase()} `;
  if (!t.trim()) return plan;
  const people = { ...plan.people, subjects: plan.people.subjects.map((x) => ({ ...x })) };
  const setting = { ...plan.setting, features: [...plan.setting.features] };
  const beast = BEASTS.map(([re]) => re.source.replace(/^\\b\(|\)\\b$/g, "")).join("|");
  // a verb or relation belongs to whoever was named closest before it: "my cat sleeping on the sill" is the cat's, "watching the horses run" is the horses'
  const whose = (index) => {
    const before = t.slice(Math.max(0, index - 48), index);
    let b = -1;
    let p = -1;
    for (const m of before.matchAll(new RegExp(`\\b(${beast})\\b`, "g"))) b = m.index;
    for (const m of before.matchAll(new RegExp(PERSON.source, "g"))) p = m.index;
    return b > p ? "being" : "people";
  };
  const hits = (re) => [...t.matchAll(new RegExp(re.source, "g"))].map((m) => ({ m, who: whose(m.index) }));
  const owned = (re) => hits(re).some((x) => x.who === "people");
  const animal = (re) => hits(re).length > 0 && hits(re).every((x) => x.who === "being");
  const verb = owned(RIDE) && /\b(bikes?|bicycles?|horses?|pon(y|ies)|scooters?)\b/.test(t) ? "ride" : owned(EMBRACE) ? "embrace" : owned(LIE) ? "lie" : owned(SIT) ? "sit" : owned(CROUCH) ? "crouch" : owned(RUN) ? "run" : owned(WALK) ? "walk" : "";
  const many = /\b(two|both|couple|we|us|together|me and|and i)\b/.test(t);
  if (verb && people.pose !== verb) {
    people.pose = verb;
    if (!people.count) people.count = verb === "embrace" ? 2 : 1;
    if (verb === "embrace") people.count = 2;
  }
  if (!verb && ["run", "walk", "ride", "crouch"].includes(people.pose) && (animal(RUN) || animal(WALK) || owned(WATCH))) people.pose = "stand";
  if (verb && plan.focus === "place") plan = { ...plan, focus: verb === "embrace" ? "people" : "moment" };
  if (many && people.count === 1 && verb !== "run") people.count = 2;
  while (people.subjects.length < people.count) people.subjects.push({ label: "someone", gender: "unspecified", age: "unspecified", hair: "", clothing: "", appearance: "" });
  people.subjects = people.subjects.slice(0, people.count);
  if (!GENDERED.test(t)) people.subjects.forEach((x) => (x.gender = "unspecified"));
  if (/\btwo (women|girls|ladies)\b/.test(t)) people.subjects.forEach((x) => (x.gender = "woman"));
  if (/\btwo (men|boys|guys)\b/.test(t)) people.subjects.forEach((x) => (x.gender = "man"));
  people.subjects.forEach((x) => {
    x.hairColor = colorIn(x.hair) || (/hair/.test(x.appearance) ? colorIn(x.appearance.split("hair")[0].split(/[,;]/).pop()) : "");
    x.clothColor = colorIn(x.clothing);
  });
  if (people.subjects.length && !people.subjects.some((x) => x.hair || x.clothing)) {
    const hair = t.match(/(\w+ )?(\w+) hair\b/);
    const wear = t.match(/\b(\w+ )?(\w+ )?(raincoat|coat|jacket|dress|sweater|hoodie|shirt|scarf|suit)\b/);
    const at = people.subjects.length > 1 && /\bone (with|in|wearing)\b/.test(t) ? people.subjects.length - 1 : 0;
    if (hair) Object.assign(people.subjects[at], { hair: hair[0], hairColor: colorIn(hair[0]) });
    if (wear) Object.assign(people.subjects[at], { clothing: wear[0], clothColor: colorIn(wear[0]) });
  }
  const tm = /\b(sunset|golden hour)\b/.test(t) ? "golden" : /\b(sunrise|dawn)\b/.test(t) ? "dawn" : /\b(night|midnight|new year'?s eve|fireworks|stars|starry)\b/.test(t) ? "night" : /\b(dusk|twilight)\b/.test(t) ? "dusk" : "";
  if (tm) setting.time = tm;
  // the quiet after a storm is the clearing, not the rain: broken cloud, light coming through, often a rainbow
  const after = /\bafter (the |a )?(storm|rain|thunderstorm)\b/.test(t);
  if (after && !setting.features.includes("rainbow")) setting.features.push("rainbow");
  const wx = after ? "clear" : /\b(storm\w*|thunder\w*|lightning)\b/.test(t) ? "rain" : /\brain(y|ing)?\b/.test(t) ? "rain" : /\bsnow(y|ing)?\b/.test(t) ? "snow" : /\b(fog|foggy|mist)\b/.test(t) ? "fog" : "";
  if (wx) setting.weather = wx;
  const add = (f, re) => re.test(t) && !setting.features.includes(f) && setting.features.push(f);
  add("fireworks", /\bfireworks?\b/);
  add("flowers", /\b(flowers?|bloom\w*|garden|roses|tulips)\b/);
  add("cabin", /\bcabin\b/);
  add("dock", /\b(dock|pier|jetty)\b/);
  add("sun", /\b(sunset|sunrise)\b/);
  add("moon", /\bmoon\w*\b/);
  add("stars", /\bstar(s|ry)\b/);
  if (/\b(beach|shore|coast|ocean|sea)\b/.test(t) && !["sea"].includes(setting.place)) setting.place = "sea";
  if (/\bgarden\b/.test(t)) setting.place = "garden";
  if (/\b(pond|lake)\b/.test(t) && !["lake", "river"].includes(setting.place)) setting.place = "lake";
  const beings = plan.beings.map((b) => ({ ...b }));
  for (const [re, base] of BEASTS) {
    const m = t.match(re);
    if (!m || beings.some((b) => re.test(` ${b.kind} ${b.label} `.toLowerCase()))) continue;
    const plural = /(s|geese)$/.test(m[1]) && !/(ss|us)$/.test(m[1]);
    const motion = base.family === "bird" ? (/\b(fly|flying|flew|soar\w*)\b/.test(t) ? "fly" : /\b(pond|lake|river|water|swim\w*|feeding)\b/.test(t) && base.kind === "duck" ? "swim" : "stand") : /\b(run\w*|chas\w*|ran)\b/.test(t) ? "run" : /\b(cross\w*|walk\w*)\b/.test(t) ? "walk" : /\b(wait\w*|sit\w*|sat)\b/.test(t) ? "sit" : /\b(sleep\w*|asleep|lying|curled)\b/.test(t) ? "lie" : "stand";
    beings.push({ label: m[1], ...base, build: { ...(base.build || {}) }, count: plural ? (base.family === "bird" ? 4 : 2) : 1, role: people.count ? "secondary" : "focal", motion });
  }
  const things = plan.things.map((x) => ({ ...x }));
  for (const [re, kind, extra] of THINGS) {
    if (!re.test(t) || things.some((x) => x.kind === kind || new RegExp(`\\b${kind}`).test(`${x.kind} ${x.label}`.toLowerCase()))) continue;
    if (extra.interior) {
      setting.space = "interior";
      setting.interior = { ...setting.interior, kind: setting.interior.kind || extra.interior };
    }
    things.push(thing(kind, kind, { ...extra, role: extra.role || (!people.count && !beings.length ? "focal" : "secondary") }));
    for (const k of extra.more || []) things.push(thing(k, k, { where: "floor" }));
    if (extra.holds) people.inside = kind;
  }
  if (/\b(kitchen|bedroom|living room|indoors|inside|apartment|classroom|office|hallway)\b/.test(t) || /\b(on|in) the (train|subway|metro|bus)\b/.test(t)) setting.space = "interior";
  if (setting.space === "interior" && /\b(on|in) the (train|subway|metro|bus)\b/.test(t)) setting.interior = { ...setting.interior, kind: setting.interior.kind || "train" };
  if (setting.space === "interior" && /train|subway|metro|tram|bus/.test(setting.interior.kind)) for (let i = things.length - 1; i >= 0; i--) if (/^(train|bus)$/.test(things[i].kind)) things.splice(i, 1);
  const vehicle = things.find((x) => /\b(car|truck|van|jeep|convertible|pickup|suv|taxi)\b/.test(`${x.kind} ${x.label}`.toLowerCase()));
  if (vehicle && /\b(drove|driving|drive|road trip|in the car|car ride)\b/.test(t) && people.count) {
    vehicle.holds = true;
    vehicle.role = "focal";
    people.inside = vehicle.kind;
  }
  if (people.inside && !things.some((x) => x.holds)) people.inside = "";
  const onSill = /sill|window seat/.test(`${people.on} ${plan.beings.map((b) => b.on).join(" ")} ${t}`);
  if (setting.space === "interior" && !onSill && things.filter((x) => x.where === "floor" || x.where === "ground").length < 1) {
    const kind = `${setting.interior.kind} ${t}`;
    // an empty room gets the furniture that names it; a doorway or hall stays bare so the door carries it
    const set = /entry|hall|foyer|door|airport|terminal|station|lobby|concourse|hospital/.test(kind) ? [] : /kitchen/.test(kind) ? ["counter", "table"] : /bed/.test(kind) ? ["bed", "lamp"] : /train|subway|bus/.test(kind) ? ["seats"] : /cafe|restaurant|diner/.test(kind) ? ["table", "chair"] : ["couch", "lamp", "table"];
    for (const k of set) things.push(thing(k, k, { where: "floor", role: "context" }));
  }
  if (setting.space !== "interior" && things.some((x) => /\b(house|home|cabin|cottage|barn|farmhouse)\b/.test(`${x.kind} ${x.label}`.toLowerCase()))) {
    const cabin = things.some((x) => /cabin|cottage/.test(`${x.kind} ${x.label}`.toLowerCase()));
    if (!setting.features.includes(cabin ? "cabin" : "house")) setting.features.push(cabin ? "cabin" : "house");
  }
  const need = (kind, extra = {}) => {
    let x = things.find((o) => o.kind === kind || new RegExp(`\\b${kind}`).test(`${o.kind} ${o.label}`.toLowerCase()));
    if (!x && LIB[kind]) things.push((x = thing(kind, kind, { where: LIB_WHERE[kind] || "ground", ...extra })));
    return x;
  };
  for (const { m, who } of hits(ON)) {
    const kind = SUPPORT[m[4]];
    if (!kind) continue;
    if (who === "being" && beings.length) {
      const b = beings.find((x) => new RegExp(`\\b(${beast})\\b`).test(` ${x.kind} ${x.label} `.toLowerCase())) || beings[0];
      if (!b.on) b.on = kind;
    } else if (people.count && !people.on && kind !== "seats") people.on = kind;
    if (kind !== "ground") need(kind);
  }
  for (const { m, who } of hits(NEAR)) {
    if (who !== "being" || !beings.length) continue;
    const kind = { "front door": "door", door: "door", gate: "fence", fence: "fence", window: "window", table: "table" }[m[4]] || "";
    if (!kind) continue;
    if (!beings[0].near) beings[0].near = kind;
    if (kind !== "window") need(kind);
  }
  beings.forEach((b) => {
    const name = new RegExp(`\\b(${b.label || b.kind}|${b.kind})\\b`.replace(/\s+/g, "\\s+"));
    const at = t.search(name);
    if (at >= 0 && /\b(sleep\w*|asleep|nap\w*|dozing|curled)\b/.test(t.slice(at, at + 40))) b.asleep = true;
    if (b.asleep) b.motion = "lie";
  });
  if (owned(WATCH) && people.count) {
    const seen = beings.find((b) => b.motion === "run" || b.motion === "walk" || b.motion === "fly") || beings[0];
    people.toward = seen ? seen.kind : /\b(sunset|sunrise|sun)\b/.test(t) ? "sun" : /\b(stars|fireworks|moon|sky|meteor\w*)\b/.test(t) ? "sky" : "view";
  }
  if (people.pose === "crouch" && beings.length && /\bfeed\w*\b/.test(t)) {
    people.toward = beings[0].kind;
    people.reach = true;
    beings[0].near = "people";
  }
  if (people.pose === "ride") {
    people.on = people.on || (/\b(horses?|pon(y|ies))\b/.test(t) ? "horse" : "bicycle");
    if (people.on === "bicycle") need("bicycle", { role: "secondary" });
    const taught = /\bteach\w* .{0,30}\bto ride\b|\blearn\w* to ride\b/.test(t);
    people.riders = people.count === 2 && taught ? [1] : people.count === 2 && !/\b(we|us|both|together|horses|bikes)\b/.test(t) ? [0] : people.count === 2 ? [0, 1] : [0];
    if (people.on === "horse") {
      const horse = beings.find((b) => /horse|pony/.test(`${b.kind} ${b.label}`.toLowerCase()));
      if (horse) {
        horse.role = "focal";
        horse.count = Math.max(horse.count || 1, people.riders.length);
        if (horse.motion === "run" || horse.motion === "stand" || horse.motion === "sit" || horse.motion === "lie") horse.motion = /\b(gallop\w*|rac\w*|ran|run\w*)\b/.test(t) ? "run" : "walk";
      }
    }
  }
  people.subjects.forEach((x, i) => {
    if (ELDER.test(` ${x.label} `.toLowerCase())) x.age = "elder";
    else if (i > 0 && ELDER.test(t) && !people.subjects.some((y) => y.age === "elder") && !/\b(me|i)\b/.test(x.label.toLowerCase())) x.age = "elder";
  });
  // the first time holding a baby: the child is a bundle in someone's arms, not a second standing person
  if (things.some((x) => x.kind === "baby")) {
    const parent = people.subjects.findIndex((x) => !/\b(baby|daughter|son|newborn|infant|child)\b/.test(`${x.label}`.toLowerCase()) && x.age !== "child");
    people.subjects = [people.subjects[Math.max(0, parent)] || { label: "me", gender: "unspecified", age: "unspecified", hair: "", clothing: "", appearance: "", hairColor: "", clothColor: "" }];
    people.count = 1;
    people.labels = [people.subjects[0].label || "me"];
    people.pose = "stand";
  }
  const HANDHELD = /\b(letter|envelope|book|phone|umbrella|cup|mug|coffee|bouquet|flowers|balloon|ticket|camera|photo|ring|gift|present|card|rod|icecream|baby)\b/;
  const small = things.find((x) => (x.where === "hand" || x.role === "focal") && HANDHELD.test(`${x.kind} ${x.label}`.toLowerCase()) && x.size.w < 1.2 && x.size.h < 1.3);
  if (small && !beings.length && !people.inside) {
    if (!people.count && /\b(i|me|my)\b/.test(t)) {
      people.count = 1;
      people.pose = "stand";
      people.subjects = [{ label: "me", gender: "unspecified", age: "unspecified", hair: "", clothing: "", appearance: "", hairColor: "", clothColor: "" }];
      people.labels = ["me"];
    }
    if (people.count) {
      small.where = "hand";
      if (small.role === "focal") small.role = "secondary";
    }
  }
  if (!people.count) for (const x of things) if (x.where === "hand") x.where = "table";
  const focus = plan.focus === "place" && (beings.some((b) => b.role === "focal") || things.some((x) => x.role === "focal")) ? "moment" : plan.focus === "place" && people.count ? "people" : plan.focus;
  return { ...plan, focus, people, setting, beings, things };
}

export function normalizePlan(p = {}) {
  return honor(baseline(p));
}

function baseline(p = {}) {
  const s = p.setting || {};
  const people = p.people || {};
  const count = Math.max(0, Math.min(2, Math.round(Number(people.count) || 0)));
  const mood = pick(p.mood, MOODS, "tender");
  const dirs = (Array.isArray(p.directions) ? p.directions : []).filter((d) => DIRECTIONS.includes(d));
  const labels = (Array.isArray(people.labels) ? people.labels : []).map((l) => String(l).slice(0, 24)).filter(Boolean);
  const subjects = (Array.isArray(people.subjects) ? people.subjects : []).slice(0, 2).map((x = {}) => ({
    label: String(x.label || "").slice(0, 24),
    gender: pick(x.gender, GENDERS, "unspecified"),
    age: pick(x.age, AGES, "unspecified"),
    hair: String(x.hair || "").slice(0, 40),
    clothing: String(x.clothing || "").slice(0, 60),
    appearance: String(x.appearance || "").slice(0, 80),
    hairColor: /^#[0-9a-f]{6}$/i.test(x.hairColor || "") ? x.hairColor : "",
    clothColor: /^#[0-9a-f]{6}$/i.test(x.clothColor || "") ? x.clothColor : "",
  }));
  const beings = (Array.isArray(p.beings) ? p.beings : []).slice(0, 4).map((b = {}) => {
    const B = b.build || {};
    return {
      label: str(b.label, 30),
      family: pick(b.family, FAMILIES, "quadruped"),
      kind: str(b.kind, 40),
      count: Math.round(num(b.count, 1, 8, 1)),
      role: pick(b.role, ROLES, "secondary"),
      motion: pick(b.motion, MOTIONS, "stand"),
      size: num(b.size, 0.08, 3, b.family === "bird" ? 0.35 : 0.6),
      colors: (Array.isArray(b.colors) ? b.colors : []).map(hexOk).filter(Boolean).slice(0, 4),
      build: { legs: num(B.legs, 0, 1, 0.5), body: num(B.body, 0, 1, 0.5), neck: num(B.neck, 0, 1, 0.4), head: num(B.head, 0, 1, 0.5), snout: num(B.snout, 0, 1, 0.5), ears: pick(B.ears, EARS, "pointed"), tail: pick(B.tail, TAILS, "long") },
      on: str(b.on, 30).toLowerCase(),
      near: str(b.near, 30).toLowerCase(),
      asleep: Boolean(b.asleep),
    };
  });
  const things = (Array.isArray(p.things) ? p.things : []).slice(0, 6).map((t = {}) => {
    const shapes = (Array.isArray(t.shapes) ? t.shapes : []).slice(0, 18).map((x = {}) => ({
      type: pick(x.type, SHAPES, "rect"),
      x: num(x.x, -0.2, 1.2, 0),
      y: num(x.y, -0.2, 1.2, 0),
      w: num(x.w, 0, 1.4, 0.2),
      h: num(x.h, 0, 1.4, 0.2),
      r: num(x.r, -180, 180, 0),
      points: (Array.isArray(x.points) ? x.points : []).slice(0, 10).map((q) => [num(q?.[0], -0.2, 1.2, 0), num(q?.[1], -0.2, 1.2, 0)]),
      color: hexOk(x.color) || "#8a7a6a",
    }));
    const lib = Object.keys(LIB).find((k) => new RegExp(`\\b${k}`).test(`${t.kind || ""} ${t.label || ""}`.toLowerCase()));
    // known objects keep believable proportions even when the director guesses odd sizes (a 0.4 m door)
    const canon = lib ? LIB[lib].size : null;
    const sane = (v, c) => (c && (v < c * 0.6 || v > c * 1.7) ? c : v);
    return {
      label: str(t.label, 30),
      kind: str(t.kind, 40),
      role: pick(t.role, ROLES, "secondary"),
      where: pick(t.where, WHERE, "ground"),
      holds: Boolean(t.holds),
      size: { w: sane(num(t.size?.w, 0.05, 40, canon ? canon.w : 1), canon?.w), h: sane(num(t.size?.h, 0.05, 40, canon ? canon.h : 1), canon?.h) },
      // c's own drawings of familiar objects beat a quick sketch from the director; unfamiliar ones use the sketch
      shapes: lib ? LIB[lib].shapes.map((x) => ({ ...x })) : shapes.length >= 2 ? grounded(shapes) : [{ type: "rect", x: 0, y: 0, w: 1, h: 1, r: 0, points: [], color: "#8a7a6a" }],
    };
  });
  const concepts = (Array.isArray(p.concepts) ? p.concepts : []).slice(0, 3).map((c = {}) => ({
    idea: str(c.idea, 160),
    spatial: pick(c.spatial, SPATIAL, "scene"),
    framing: pick(c.framing, FRAMINGS, "wide"),
    construction: pick(c.construction, DIRECTIONS, ""),
    abstraction: num(c.abstraction, 0, 1, 0.3),
  }));
  const interior = s.interior || {};
  return {
    art: 1,
    mode: "2d",
    beings,
    things,
    concepts,
    conceptIndex: Math.round(num(p.conceptIndex, 0, 99, 0)),
    seed: Number.isInteger(p.seed) ? p.seed >>> 0 : Math.floor(Math.random() * 2 ** 31),
    avoid: (Array.isArray(p.avoid) ? p.avoid : []).filter((d) => DIRECTIONS.includes(d)).slice(0, 3),
    text: String(p.text || "").slice(0, 600),
    title: String(p.title || "").slice(0, 60),
    read: String(p.read || "").slice(0, 160),
    people: { count, pose: count ? pick(people.pose, POSES, "stand") : "none", on: str(people.on, 30).toLowerCase(), toward: str(people.toward, 30).toLowerCase(), reach: Boolean(people.reach), riders: (Array.isArray(people.riders) ? people.riders : []).filter((i) => i === 0 || i === 1), relation: String(people.relation || "").slice(0, 30), labels: subjects.length ? subjects.map((x, i) => x.label || labels[i] || "someone").slice(0, count) : labels.length ? labels.slice(0, count) : Array.from({ length: count }, () => "someone"), subjects },
    focus: count ? pick(p.focus, FOCUS, "people") : beings.some((b) => b.role === "focal") || things.some((t) => t.role === "focal") ? "moment" : "place",
    setting: {
      place: pick(s.place, PLACES, "field"),
      features: (Array.isArray(s.features) ? s.features : []).filter((f) => FEATURES.includes(f)),
      time: pick(s.time, TIMES, "golden"),
      weather: pick(s.weather, WEATHER, "clear"),
      space: pick(s.space, SPACES, "outdoor"),
      interior: { kind: str(interior.kind, 30), wall: hexOk(interior.wall), floor: hexOk(interior.floor), window: interior.window !== false, light: pick(interior.light, ["lamp", "window", "dim", "bright"], "lamp") },
    },
    mood,
    energy: Math.min(1, Math.max(0, Number(p.energy) || 0.4)),
    directions: [...new Set([...dirs, ...BY_MOOD[mood]])],
  };
}

const has = (t, re) => re.test(t);

const WOMAN = /\b(her|she|girlfriend|wife|mom|mother|sister|grandma|grandmother|daughter|aunt|woman|girl)\b/;
const MAN = /\b(him|he|boyfriend|husband|dad|father|brother|grandpa|grandfather|son|uncle|man|boy)\b/;
const CHILD = /\b(son|daughter|kid|child|little (brother|sister)|baby)\b/;

function subjectsOf(t, count) {
  if (!count) return [];
  const both = /\btwo (women|girls)\b/.test(t) ? "woman" : /\btwo (men|boys)\b/.test(t) ? "man" : "";
  const other = both || (WOMAN.test(t) ? "woman" : MAN.test(t) ? "man" : "unspecified");
  const label = (t.match(/\b(my (best |little |big |older |younger |baby )?\w+|her|him)\b/) || [])[0] || "someone";
  if (count === 1) return [{ label: /\b(i|me|my)\b/.test(t) ? "me" : "someone", gender: both || "unspecified", age: "unspecified" }];
  const me = /\b(i|me|we|us)\b/.test(t);
  return [
    { label: me ? "me" : "someone", gender: both || "unspecified", age: "unspecified" },
    { label: both ? "someone" : label, gender: other, age: CHILD.test(t) ? "child" : "unspecified" },
  ];
}

export function readWords(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const two = has(t, /\b(we|us|our|together|two|couple|me and|and i|with (her|him|my)|girlfriend|boyfriend|wife|husband|partner|friend|brother|sister|mom|dad|grandma|grandpa)\b/);
  const one = has(t, /\b(i|me|my|myself)\b/) && !has(t, /\b(grandparents'|cabin|lake|house|home)\b.*\b(summer|every|always)\b/);
  const pose = has(t, /\b(run|ran|running|race|racing|sprint|chas)/) ? "run" : has(t, /\b(walk|walking|stroll)/) ? "walk" : has(t, /\b(kiss|hug|embrace|dance|danc|slow dance)/) ? "embrace" : has(t, /\b(sit|sat|sitting|watch|watching|looking)/) ? "sit" : "stand";
  const count = pose === "run" && !two ? 1 : two ? 2 : one && !has(t, /\b(place|lake|cabin|mountain|house)\b/) ? 1 : 0;
  const place = has(t, /\b(sea|ocean|beach|shore|coast)/) ? "sea" : has(t, /\blake\b/) ? "lake" : has(t, /\briver\b/) ? "river" : has(t, /\b(mountain|peak|alps|valley)/) ? "mountains" : has(t, /\b(forest|woods|trees)/) ? "forest" : has(t, /\b(city|street|downtown|rooftop|subway|skyline)/) ? "city" : has(t, /\bdesert\b/) ? "desert" : has(t, /\b(snow|winter)/) ? "snow" : has(t, /\b(road|drive|highway|trip)/) ? "road" : has(t, /\bgarden\b/) ? "garden" : has(t, /\b(home|house|backyard|porch)/) ? "home" : "field";
  const time = has(t, /\b(sunset|golden hour|evening sun)/) ? "golden" : has(t, /\b(dusk|twilight)/) ? "dusk" : has(t, /\b(sunrise|dawn|morning)/) ? "dawn" : has(t, /\b(night|stars|moon|midnight|late)/) ? "night" : "day";
  const weather = has(t, /\brain/) ? "rain" : has(t, /\bsnow/) ? "snow" : has(t, /\b(fog|mist)/) ? "fog" : "clear";
  const features = FEATURES.filter((f) => has(t, new RegExp(`\\b${f}`)));
  if (time === "golden" || time === "dawn") features.push("sun");
  if (has(t, /\bcabin\b/)) features.push("cabin", "trees");
  const mood = pose === "run" ? "joyful" : has(t, /\b(alone|lonely|last|goodbye|miss)/) ? "melancholy" : has(t, /\b(childhood|grandparents|summers|every summer|used to|grew up)/) ? "nostalgic" : two ? "tender" : "serene";
  const placeFirst = /^\s*(the|our|my)\s+(old\s+)?(lake|beach|cabin|house|home|mountain|field|garden|street|city|road|river|forest|backyard|porch)/.test(String(text).toLowerCase());
  const focus = count === 0 || placeFirst ? "place" : pose === "run" || pose === "walk" ? "moment" : "people";
  const n = placeFirst ? Math.min(count, 2) : count;
  return normalizePlan({ text, people: { count: n, pose: placeFirst ? "stand" : pose, subjects: subjectsOf(t, n) }, focus, setting: { place, features, time, weather }, mood, energy: pose === "run" ? 0.85 : 0.35 });
}

const weighted = (rand, list, weights) => {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
  return list[list.length - 1];
};

export function concepts(plan) {
  if (plan.concepts.length) return plan.concepts;
  const subject = (plan.people.count && !plan.people.inside) || plan.beings.length || plan.things.some((t) => t.role === "focal");
  const inside = plan.setting.space === "interior";
  const [a, b, c] = plan.directions;
  return [
    { idea: "", spatial: inside ? "interior" : "scene", framing: subject ? "wide" : "vast", construction: a, abstraction: 0.2 },
    { idea: "", spatial: subject ? "close" : "scene", framing: subject ? "medium" : "vast", construction: b, abstraction: 0.4 },
    { idea: "", spatial: subject ? "emblem" : inside ? "interior" : "scene", framing: subject ? "wide" : "vast", construction: c, abstraction: 0.7 },
  ];
}

export function variant(plan, k) {
  return normalizePlan({ ...plan, seed: (plan.seed + k * 7919) >>> 0, conceptIndex: (plan.conceptIndex || 0) + k, avoid: [] });
}

function heightOf(b) {
  if (b.family === "bird") return b.size * 0.9;
  const tall = b.motion === "lie" ? b.size * 0.45 : b.motion === "sit" ? b.size * (1.1 + b.build.legs * 0.5) : b.size * (0.95 + b.build.legs * 0.6);
  return Math.max(tall, b.size * 1.5 * 0.55);
}

export function composition(plan, seed) {
  const rand = random((Math.imul(seed, 2246822519) ^ 0x7f4a7c15) >>> 0);
  const list = concepts(plan);
  const C = list[(plan.conceptIndex || 0) % list.length];
  const open = plan.directions.filter((d) => !plan.avoid?.includes(d));
  const pool = open.length ? open : plan.directions;
  const direction = C.construction && !plan.avoid?.includes(C.construction) ? C.construction : weighted(rand, pool, pool.map((_, i) => 0.72 ** i));
  const people = plan.people.count && !plan.people.inside;
  const focalThing = plan.things.find((t) => t.role === "focal" || t.holds);
  const subject = people ? "people" : plan.beings.length ? "beings" : focalThing ? "thing" : "place";
  // an indoor memory stays indoors even in a close-up: the room is still behind the people
  let spatial = plan.setting.space === "interior" && (C.spatial === "scene" || C.spatial === "close") ? "interior" : plan.setting.space === "abstract" && C.spatial === "scene" ? "emblem" : C.spatial;
  if (subject === "place" && (spatial === "emblem" || spatial === "close")) spatial = plan.setting.space === "interior" ? "interior" : "scene";
  if (plan.people.inside && spatial === "interior") spatial = "scene";
  if (subject === "thing" && spatial === "close") spatial = "scene";
  if (subject === "beings" && spatial === "close") spatial = plan.setting.space === "interior" ? "interior" : "scene";
  const framing = subject === "place" ? (spatial === "interior" ? "wide" : "none") : spatial === "close" ? (C.framing === "wide" || C.framing === "vast" ? "medium" : C.framing) : C.framing;
  const pose = plan.people.pose;
  const { place, features } = plan.setting;
  const skyward = features.some((f) => ["fireworks", "stars", "moon", "sunset", "sun"].includes(f));
  const grounded = ["garden", "field", "sea", "lake", "river", "snow", "desert", "road"].includes(place);
  const placeLayouts = place === "garden" ? [["high", 0.6], ["landscape", 0.4]] : place === "city" ? (skyward ? [["low", 0.75], ["landscape", 0.25]] : [["landscape", 0.55], ["low", 0.45]]) : skyward && !grounded ? [["low", 0.6], ["landscape", 0.4]] : grounded ? [["high", 0.45], ["landscape", 0.4], ["low", 0.15]] : [["landscape", 0.5], ["low", 0.35], ["high", 0.15]];
  const layouts = plan.focus === "place" ? placeLayouts : pose === "embrace" ? [["intimate", 0.35], ["landscape", 0.25], ["low", 0.2], ["edge", 0.2]] : plan.focus === "moment" ? [["low", 0.3], ["high", 0.25], ["landscape", 0.3], ["edge", 0.15]] : [["landscape", 0.35], ["low", 0.25], ["high", 0.15], ["edge", 0.25]];
  let layout = spatial === "interior" ? "interior" : spatial === "emblem" ? "emblem" : spatial === "close" ? "intimate" : framing === "close" ? (rand.chance(0.6) ? "intimate" : "edge") : weighted(rand, layouts.map((l) => l[0]), layouts.map((l) => l[1]));
  if (layout === "high" && place === "city") layout = "landscape";
  if (subject === "place" && layout === "interior") layout = "interior";
  if (subject === "thing" && layout === "intimate") layout = "low";
  // riding, crouching to feed, lying down or sitting on a bench only reads when the whole body and what it rests on are in frame
  const action = people && (["ride", "crouch", "lie"].includes(pose) || (pose === "sit" && plan.people.on && plan.people.on !== "ground"));
  if (action && layout === "intimate") layout = "landscape";
  // looking up at the stars: keep the horizon low so the sky fills the picture
  if (people && plan.people.toward === "sky") layout = "low";
  const bigSky = rand.chance(0.5);
  const base = framing === "close" ? rand.range(0.5, 0.72) : framing === "medium" ? rand.range(0.42, 0.66) : framing === "none" || framing === "vast" ? (bigSky ? rand.range(0.64, 0.8) : rand.range(0.3, 0.44)) : rand.range(0.4, 0.68);
  const horizon = H * (layout === "interior" ? rand.range(0.5, 0.64) : layout === "emblem" ? 1.25 : layout === "intimate" ? 1.12 : layout === "low" ? rand.range(0.78, 0.88) : layout === "high" ? rand.range(0.14, 0.3) : base);
  const center = layout !== "edge" && rand.chance(framing === "close" ? 0.35 : 0.15);
  const focusX = W * (layout === "edge" ? rand.pick([0.17, 0.83]) : center ? rand.range(0.45, 0.55) : rand.pick([0.3, 0.36, 0.64, 0.7]) + rand.range(-0.04, 0.04));
  const fit = action && (framing === "close" || framing === "medium") ? "wide" : layout === "intimate" && (framing === "wide" || framing === "vast") ? "medium" : framing;
  const scaleBy = subject === "people" ? 1 : subject === "beings" ? 0.55 : 0.75;
  let body = H * { close: rand.range(2.1, 2.7), medium: rand.range(1.35, 1.7), wide: rand.range(0.55, 0.8), vast: rand.range(0.1, 0.2), none: 0 }[fit] * (fit === "close" || fit === "medium" ? scaleBy : 1);
  let feet = null;
  if (fit === "close" || fit === "medium") feet = H * (fit === "close" ? rand.range(0.03, 0.14) : rand.range(0.06, 0.22)) + body;
  else if (fit === "wide") {
    feet = H * rand.range(0.74, 0.96);
    if (layout !== "intimate") feet = Math.max(feet, horizon + H * 0.04);
    body = Math.min(body, feet - H * 0.05);
  } else if (fit === "vast") feet = place === "sea" || place === "lake" ? H * rand.range(0.82, 0.93) : horizon + rand.range(0.5, 0.9) * body;
  if (feet !== null && layout === "interior") feet = Math.max(feet, horizon + H * 0.08);
  if (feet !== null && layout === "emblem" && (fit === "wide" || fit === "vast")) feet = Math.min(feet, H * rand.range(0.8, 0.92));
  if (subject === "beings") {
    body = H * { close: rand.range(0.42, 0.55), medium: rand.range(0.34, 0.45), wide: rand.range(0.24, 0.34), vast: rand.range(0.1, 0.18), none: 0.3 }[fit];
    feet = layout === "emblem" ? H * rand.range(0.78, 0.9) : Math.max(horizon + H * 0.05, H * rand.range(0.8, 0.94));
  }
  if (subject === "thing") {
    body = H * { close: rand.range(0.75, 0.95), medium: rand.range(0.55, 0.72), wide: rand.range(0.38, 0.5), vast: rand.range(0.22, 0.32), none: 0.4 }[fit];
    feet = layout === "intimate" || layout === "emblem" ? H * rand.range(0.8, 0.92) : Math.max(horizon + H * 0.06, H * rand.range(0.82, 0.94));
  }
  const extent = subject === "people" ? 1.75 / (plan.people.pose === "sit" ? 0.6 : 1) : subject === "beings" ? Math.max(...plan.beings.map(heightOf)) : focalThing ? Math.max(focalThing.size.h, focalThing.size.w * 0.55) : 2;
  let ppm = body ? body / extent : (H * 0.5) / 6;
  const tall = Math.max(0, ...plan.things.filter((t) => !t.holds && t.role !== "context" && ["ground", "floor", "wall"].includes(t.where)).map((t) => t.size.h));
  if (fit !== "close" && tall && subject !== "thing" && tall * ppm > H * 0.85) {
    const k = (H * 0.85) / (tall * ppm);
    ppm *= k;
    if (feet !== null && fit !== "medium") body *= k;
  }
  const behind = plan.focus === "people" && (fit === "wide" || fit === "vast") && rand.chance(0.6);
  const lightX = behind ? focusX + (rand.chance(0.5) ? 1 : -1) * (body * 0.32 + H * 0.12) : W * (focusX < W / 2 ? rand.range(0.66, 0.85) : rand.range(0.15, 0.34));
  // most pieces combine two constructions: one builds the sky (or the walls indoors), the other the land and everything on it
  const PAIRS = { expressive: ["stipple", "contours", "lines", "mosaic"], geometric: ["expressive", "stipple", "contours"], organic: ["expressive", "contours", "stipple"], lines: ["expressive", "stipple", "contours"], mosaic: ["expressive", "stipple", "contours"], contours: ["expressive", "stipple", "lines"], stipple: ["expressive", "contours", "lines"] };
  // dots and engraved lines turn into static on a dark sky or a plain wall, so those take painterly or contour partners
  const dim = plan.setting.time === "night" || plan.setting.time === "dusk" || layout === "interior";
  const partners = (PAIRS[direction] || ["expressive"]).filter((d) => !dim || !["stipple", "lines"].includes(d));
  const sky = rand.chance(0.65) && partners.length ? rand.pick(partners) : direction;
  return {
    seed,
    direction,
    sky,
    framing: fit,
    layout,
    subject,
    ppm,
    idea: C.idea,
    abstraction: C.abstraction,
    horizon,
    focusX,
    body,
    feet,
    lightX: Math.min(W * 0.88, Math.max(W * 0.12, lightX)),
    shore: rand.range(0.18, 0.55),
    vanish: focusX + W * rand.range(-0.15, 0.15),
    roadSpread: rand.range(0.9, 1.8),
    density: rand.range(0.7, 1.15),
  };
}

const BUILDS = {
  expressive: ["thousands of brush strokes, each laid along the way light and fabric fall", "the sky is built from layered washes, the ground from strokes that follow its grain"],
  geometric: ["the figures are triangulated into flat planes lit by their own shading", "the world is cut into faceted terrain, banded light and solid blocks"],
  organic: ["the figures become textured silhouettes with light growing through them", "the land is built from mottled strata and contour lines, the trees from recursive branching"],
  lines: ["every value is an engraved line whose width carries the light", "the figures are hatched along the direction of each limb"],
  mosaic: ["the scene is cut into cells that shrink where the memory matters most", "every cell takes one color from the place beneath it"],
  contours: ["the light of the scene becomes a topographic map of contour lines", "every edge between things is drawn as a single line"],
  stipple: ["thousands of dots gather where the scene is darkest", "dots on the people link into a fine network"],
};

export function withView(plan, direction) {
  const labels = [...(plan.people.inside ? [] : plan.people.labels), ...plan.beings.map((b) => b.label || b.kind), ...plan.things.filter((t) => t.role !== "context").map((t) => t.label || t.kind)].slice(0, 5);
  const ids = labels.map((l, i) => `${String(l).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "s"}-${i}`);
  const subjects = labels.map((label, i) => ({ id: ids[i], label }));
  const { place, time, weather, features } = plan.setting;
  const builds = BUILDS[direction] || BUILDS.lines;
  return {
    ...plan,
    title: plan.title || plan.text.split(/\s+/).slice(0, 4).join(" ").toLowerCase(),
    read: plan.read || `${subjects.length ? subjects.map((s) => s.label).join(" and ") + ", " : ""}${place}, ${time}`,
    subjects,
    relations: ids.length > 1 ? [{ a: ids[0], rel: plan.people.pose === "sit" || plan.people.pose === "stand" ? "beside" : "with", b: ids[1] }] : [],
    world: { setting: place, time, season: "none", weather, energy: plan.energy },
    lights: features.includes("moon") || time === "night" ? [{ kind: "moon" }] : features.includes("sun") ? [{ kind: "sun" }] : [],
    particles: weather === "rain" || weather === "snow" ? [{ kind: weather, motion: "fall" }] : [],
    systems: [...subjects.slice(0, 1).map((s) => ({ subject: s.id, why: builds[0] })), { subject: "world", why: builds[1] }],
    missing: [],
  };
}
