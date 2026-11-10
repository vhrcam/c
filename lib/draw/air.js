import { hash, random } from "../random.js";
import { fromLch, toLch } from "./color.js";
import { lerp } from "./noise.js";

const node = (G, x, y) => {
  const i = Math.round(x * G.RES);
  const j = Math.round(y * G.RES);
  return i < 0 || j < 0 || i >= G.nw || j >= G.nh ? -1 : j * G.nw + i;
};

// stars: points of light wherever the open backdrop shows, a few of them flaring
export function stars(G, well, scene, seed) {
  const night = scene.time === "night" || scene.backdrop === "space";
  if (!(scene.backdrop === "sky" || scene.backdrop === "space") || !(night || scene.time === "dusk")) return [];
  const rand = random(hash(`stars:${seed}`));
  const clear = scene.weather === "clear" || scene.weather === "wind" || scene.backdrop === "space";
  const count = Math.round(((night ? (clear ? 520 : 120) : 50) * G.W * G.H) / 15000);
  const hue = toLch(well.light)[2];
  const inks = [well.ink(fromLch(0.95, 0.02, hue)), well.ink(fromLch(0.88, 0.06, 80)), well.ink(fromLch(0.86, 0.06, 240))];
  const out = [];
  for (let c = 0; c < count; c++) {
    const x = rand() * G.W;
    const y = rand() * G.H;
    const k = node(G, x, y);
    if (k < 0 || G.rid[k]) continue;
    const big = rand() ** 3;
    const ink = inks[rand() < 0.7 ? 0 : rand() < 0.5 ? 1 : 2];
    const w = 0.07 + big * 0.36;
    out.push({ p: Float32Array.of(x, y), w, ink, r: 0, kind: "dot" });
    if (big > 0.55) {
      const l = w * lerp(1.6, 3.2, rand());
      out.push({ p: Float32Array.of(x - l, y, x + l, y), w: 0.045, ink, r: 0, kind: "air" }, { p: Float32Array.of(x, y - l, x, y + l), w: 0.045, ink, r: 0, kind: "air" });
    }
  }
  return out;
}

// rain: straight broken streaks across the whole sheet, thinner over what the picture is about
export function rain(G, well, scene, seed, style) {
  if (scene.weather !== "rain" && scene.weather !== "storm") return [];
  if (scene.backdrop === "room" || scene.backdrop === "deep" || scene.backdrop === "space") return [];
  const rand = random(hash(`rain:${seed}`));
  const heavy = scene.weather === "storm" ? 1.9 : 1;
  const count = Math.round((720 * heavy * G.W * G.H) / 15000);
  const angle = Math.PI / 2 + style.wind * 0.42 + (scene.weather === "storm" ? Math.sign(style.wind || 1) * 0.2 : 0);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const inks = well.dark ? [well.ink(fromLch(0.82, 0.03, 240)), well.ink(fromLch(0.68, 0.04, 250))] : [well.ink(fromLch(0.42, 0.04, 245)), well.ink(fromLch(0.58, 0.035, 240))];
  const focal = new Set(G.shapes.filter((s) => s.role === "focus" && s.type !== "band").map((s) => s.k));
  const out = [];
  for (let c = 0; c < count; c++) {
    const x = rand() * (G.W + 20) - 10;
    const y = rand() * (G.H + 10) - 8;
    const len = lerp(2.2, 8.5, rand() ** 1.5);
    const mx = x + dx * len * 0.5;
    const my = y + dy * len * 0.5;
    const k = node(G, mx, my);
    if (k < 0 || node(G, x, y) < 0 || node(G, x + dx * len, y + dy * len) < 0) continue;
    if (focal.has(G.rid[k]) && rand() < 0.8) continue;
    out.push({ p: Float32Array.of(x, y, x + dx * len, y + dy * len), w: lerp(0.045, 0.09, rand()), ink: inks[rand() < 0.65 ? 0 : 1], a: lerp(0.45, 0.85, rand()), r: 0, kind: "air" });
  }
  return out;
}

// snow: soft dots falling in front of everything, larger when nearer
export function snow(G, well, scene, seed) {
  if (scene.weather !== "snow") return [];
  if (scene.backdrop === "room" || scene.backdrop === "deep" || scene.backdrop === "space") return [];
  const rand = random(hash(`snow:${seed}`));
  const count = Math.round((1000 * G.W * G.H) / 15000);
  const flake = well.dark ? well.ink(fromLch(0.95, 0.012, 240)) : well.ink(well.paper);
  const rim = well.ink(well.dark ? fromLch(0.8, 0.03, 240) : fromLch(0.62, 0.035, 240));
  const focal = new Set(G.shapes.filter((s) => s.role === "focus" && s.type !== "band").map((s) => s.k));
  const out = [];
  for (let c = 0; c < count; c++) {
    const x = rand() * G.W;
    const y = rand() * G.H;
    const k = node(G, x, y);
    if (k < 0 || (focal.has(G.rid[k]) && rand() < 0.6)) continue;
    const w = 0.12 + rand() ** 2.2 * 0.62;
    out.push({ p: Float32Array.of(x, y), w, ink: flake, r: 0, kind: "dot" });
    if (!well.dark && rand() < 0.45) {
      const ring = new Float32Array(18);
      for (let q = 0; q < 9; q++) {
        ring[q * 2] = x + (Math.cos((q / 8) * 6.2832) * w) / 2;
        ring[q * 2 + 1] = y + (Math.sin((q / 8) * 6.2832) * w) / 2;
      }
      out.push({ p: ring, w: 0.04, ink: rim, r: 0, kind: "air" });
    }
  }
  return out;
}
