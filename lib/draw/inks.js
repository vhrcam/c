import { fromLch, hueDistance, hueToward, mix, ramp, toLch } from "./color.js";
import { clamp, lerp } from "./noise.js";

const SKY = {
  dawn: ["#7f8fc0", "#c9a5c2", "#f2b79a", "#f7d9a8"],
  day: ["#5f95cc", "#93bde0", "#c9deea"],
  golden: ["#6f8fb5", "#d9b092", "#f2a65a", "#f7c873"],
  dusk: ["#2d2a5a", "#7a3d73", "#d4574e", "#f29a4a"],
  night: ["#0c1030", "#182048", "#2a3160"],
};
const DEEP = ["#2f7f95", "#1d5a78", "#12324f"];
const GREY = { clear: 0, wind: 0.08, cloud: 0.35, snow: 0.5, fog: 0.6, rain: 0.6, storm: 0.78 };

// Paper and inks for one piece. Every color the director named keeps its hue but is re-cut against the paper:
// colors darker than the sheet become dark inks whose lines stand for shade, colors lighter than it become pale inks
// whose lines stand for light, and coverage carries how strong the color is.
export function inkwell(scene, G, rand) {
  const palette = scene.palette.map(toLch);
  const lightLch = toLch(scene.light.color);
  const grey = GREY[scene.weather] ?? 0;
  const night = scene.time === "night" || scene.backdrop === "space";

  let stops = scene.backdrop === "deep" ? DEEP : scene.backdrop === "space" ? ["#07070d", "#0d0b1a", "#141024"] : SKY[scene.time] || SKY.day;
  // lean the sky toward the colors the director felt, then let the weather grey it
  stops = stops.map((hexColor) => {
    const [L, C, h] = toLch(hexColor);
    let near = null;
    for (const p of palette) if (p[1] > 0.04 && hueDistance(p[2], h) < 55 && (!near || hueDistance(p[2], h) < hueDistance(near[2], h))) near = p;
    const hue = near ? hueToward(h, near[2], 0.5) : h;
    const chroma = near ? lerp(C, Math.max(C, near[1]), 0.4) : C;
    return fromLch(lerp(L, night ? 0.3 : 0.72, grey * 0.55), chroma * (1 - grey * 0.8), hue);
  });
  const wall = palette.length ? fromLch(...[...palette].sort((a, b) => (night ? a[0] - b[0] : b[0] - a[0]))[0]) : "#d8d2c6";
  const behind = (v) => (scene.backdrop === "room" ? wall : scene.backdrop === "void" ? null : ramp(stops, v));

  // how bright is the whole picture, and how bright is what it is about
  let sumL = 0;
  let sumA = 0;
  let back = G.nw * G.nh;
  for (const s of G.shapes) {
    if (!s.seen) continue;
    const L = toLch(s.color)[0];
    sumL += L * s.seen;
    sumA += s.seen;
    back -= s.seen;
  }
  const mid = behind(0.6);
  if (mid && back > 0) {
    sumL += toLch(mid)[0] * back;
    sumA += back;
  }
  const mean = sumA ? sumL / sumA : 0.7;

  // the sheet: near black when the memory is dark, otherwise a warm white leaning toward the memory's own color
  const tone = palette.length ? palette.reduce((a, p) => (p[1] > a[1] ? p : a), palette[0]) : [0.5, 0.05, 80];
  const kind = night || mean < 0.36 + (rand() - 0.5) * 0.1 ? "dark" : "light";
  const paper = kind === "dark" ? fromLch(lerp(0.15, 0.19, rand()), 0.018, tone[1] > 0.03 ? hueToward(tone[2], 275, 0.5) : 275) : fromLch(lerp(0.935, 0.955, rand()), lerp(0.012, 0.022, rand()), hueToward(85, tone[2], hueDistance(tone[2], 85) < 90 ? 0.4 : 0.1));
  const paperL = toLch(paper)[0];
  const dark = paperL < 0.4;

  const inks = [];
  const index = new Map();
  const ink = (hexColor) => {
    let at = index.get(hexColor);
    if (at === undefined) {
      at = inks.length;
      inks.push(hexColor);
      index.set(hexColor, at);
    }
    return at;
  };

  // a named color becomes a body ink, a stronger ink of the same kind, an edge ink, and how densely to lay it
  const cut = (hexColor, fade = 0) => {
    let [L, C, h] = toLch(hexColor);
    let near = null;
    for (const p of palette) if (p[1] > 0.04 && C > 0.03 && hueDistance(p[2], h) < 50 && (!near || hueDistance(p[2], h) < hueDistance(near[2], h))) near = p;
    if (near) h = hueToward(h, near[2], 0.3);
    if (lightLch[1] > 0.03) h = hueToward(h, lightLch[2], C < 0.04 ? 0.5 : 0.08);
    C = Math.max(C, lightLch[1] > 0.03 ? 0.012 : 0);
    const polar = paperL < 0.8 && (L > paperL + 0.03 || (dark && L > paperL - 0.02)) ? 1 : -1;
    let body;
    let deep;
    let edge;
    let cover;
    if (polar > 0) {
      const bl = clamp(L + (dark ? 0.2 : 0.1), paperL + (dark ? 0.29 : 0.2), 0.96);
      body = fromLch(bl, Math.min(C * 1.25 + 0.012, 0.21), h);
      deep = fromLch(clamp(bl + 0.14, 0.6, 0.98), Math.min(C * 0.9 + 0.02, 0.16), hueToward(h, lightLch[2], 0.35));
      edge = dark ? deep : fromLch(Math.max(0.12, paperL - 0.34), Math.min(C * 0.6 + 0.02, 0.1), hueToward(h, 280, 0.25));
      cover = clamp(0.05 + 1.05 * Math.max((L - paperL) / (0.95 - paperL), (0.55 * C) / 0.15), 0.05, 0.95);
    } else {
      const bl = clamp(L, Math.min(0.2, paperL - 0.3), Math.min(0.7, paperL - 0.2));
      body = fromLch(bl, Math.min(C * 1.18 + 0.01, 0.22), h);
      deep = fromLch(Math.max(0.1, bl - 0.24), Math.min(C * 0.85 + 0.015, 0.14), hueToward(h, 280, 0.22));
      edge = deep;
      cover = clamp(0.08 + 0.98 * Math.max((paperL - L) / (paperL - 0.15), (0.6 * C) / 0.15), 0.07, 0.96);
    }
    if (fade) {
      body = mix(body, paper, fade);
      deep = mix(deep, paper, fade * 0.8);
      edge = mix(edge, paper, fade * 0.6);
      cover *= 1 - fade * 0.45;
    }
    return { body: ink(body), deep: ink(deep), edge: ink(edge), cover, polar, L, C, h };
  };

  const key = dark ? fromLch(0.9, 0.03, lightLch[2]) : fromLch(Math.min(0.2, paperL - 0.35), 0.03, hueToward(tone[2], 280, 0.6));

  return { paper, paperL, dark, kind, inks, ink, cut, behind, stops, key: ink(key), light: scene.light.color };
}
