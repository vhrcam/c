import { adjust, luma, mix } from "../color.js";

const SKIES = {
  sunrise: { sky: ["#6a7db6", "#a9a6c8", "#eeb7a7", "#fbdcb2", "#fde9c8"], sun: "#fff3dc", glow: "#ffcf9c", light: "#ffd8ad", shade: "#3f3a63", haze: "#c9aac0" },
  day: { sky: ["#4d84cb", "#74a9dd", "#a9d0ec", "#d6e8f0", "#eef3ea"], sun: "#fffbea", glow: "#fff1c8", light: "#fff3d6", shade: "#3d4b5f", haze: "#d9e6ec" },
  golden: { sky: ["#6a8dc4", "#a9b6cf", "#e7c79d", "#f8d79a", "#fbe6b4"], sun: "#fff0c4", glow: "#ffc066", light: "#ffcf84", shade: "#57412f", haze: "#f2d7a8" },
  sunset: { sky: ["#2b2c60", "#6e4588", "#cf5f88", "#f0925f", "#fbcb84"], sun: "#ffe8b4", glow: "#ff9a58", light: "#ffae68", shade: "#2c1f45", haze: "#c48aa0" },
  night: { sky: ["#080c28", "#111a42", "#202c5e", "#35427a", "#4a5487"], sun: "#f4f1e3", glow: "#b9c8ff", light: "#a7b7ec", shade: "#0b0f25", haze: "#333e6a" },
};

const LIGHT = {
  sunrise: { light: 0.1, shade: 0.3, haze: 0.72, back: 0.42, rim: 0.85, lift: 0.08 },
  day: { light: 0.03, shade: 0.04, haze: 0.42, back: 0.05, rim: 0.2 },
  golden: { light: 0.18, shade: 0.16, haze: 0.5, back: 0.3, rim: 0.75, lift: 0.04 },
  sunset: { light: 0.1, shade: 0.48, haze: 0.78, back: 0.55, rim: 0.95, lift: 0.1 },
  night: { light: 0.04, shade: 0.66, haze: 0.4, back: 0.6, rim: 0.5 },
};

const MOODS = {
  warm: { tint: "#ffb27a", k: 0.07, s: 0.04, l: 0 },
  dreamy: { tint: "#f6e2ee", k: 0.13, s: -0.04, l: 0.03 },
  calm: { tint: "#c8d5e2", k: 0.05, s: -0.12, l: 0 },
  moody: { tint: "#5c6987", k: 0.12, s: -0.2, l: -0.06 },
  bright: { tint: "#fff5da", k: 0.04, s: 0.12, l: 0.03 },
};

const WEATHER = {
  clear: null,
  clouds: { tint: "#b8bfcb", k: 0.08, s: -0.08, l: 0 },
  rain: { tint: "#7c8697", k: 0.2, s: -0.18, l: -0.04 },
  snow: { tint: "#e3e8f1", k: 0.14, s: -0.12, l: 0.03 },
  fog: { tint: "#dde1e4", k: 0.2, s: -0.15, l: 0.04 },
};

export const LANDS = {
  meadow: { far: "#7f9c6d", mid: "#5f8b4d", near: "#447039", deep: "#2b4c28", grass: ["#355f2e", "#4f8139", "#6d9c48", "#97b75a"], bloom: ["#f2b3c4", "#f4efe4", "#f2cc5f", "#b89bd8", "#e8705a"] },
  beach: { far: "#6f8e80", mid: "#5a7d6e", sea: ["#4b8db0", "#2b5e7f"], sand: ["#ead2a6", "#d8b684"], foam: "#f6f3ea", near: "#c9a777", deep: "#b08e62" },
  mountains: { far: "#8b8ca8", mid: "#6b7191", rock: "#5d6178", snow: "#f3f3f6", near: "#4e7442", deep: "#30502c", grass: ["#36592f", "#4f7a3d", "#6b9248", "#8fae58"] },
  forest: { far: "#6e8b74", mid: "#45684d", near: "#38613a", deep: "#213f25", trunk: "#4a3426", grass: ["#2f5a2c", "#467a37", "#5f9143", "#86ad55"] },
  lake: { far: "#728f7c", mid: "#54775a", water: ["#6593b2", "#3b6684"], near: "#477b3f", deep: "#2c5029", reed: "#5c6f3a", grass: ["#34602e", "#4c7f39", "#6a9a46", "#93b459"] },
  city: { far: "#8e94ae", mid: "#5f6684", near: "#3c4159", roof: "#3b3b46", window: "#ffd27a", deep: "#2a2a33" },
  snow: { far: "#c8d1e4", mid: "#dbe2ef", near: "#ecf0f7", deep: "#c9d3e5", pine: "#2f4a45", grass: ["#dfe6f1", "#cdd7e8", "#f4f6fb", "#b9c6dc"] },
};

const INK = "#24211e";
const PAPER = "#ebe6dc";

export function palette(scene) {
  const base = SKIES[scene.time];
  const light = LIGHT[scene.time];
  const mood = MOODS[scene.mood];
  const weather = WEATHER[scene.weather];
  const mono = scene.style === "ink";

  const finish = (c, w = 1) => {
    let x = mix(c, mood.tint, mood.k);
    x = adjust(x, { s: mood.s, l: mood.l });
    if (weather) x = adjust(mix(x, weather.tint, weather.k * w), { s: weather.s * w, l: weather.l * w });
    if (mono) x = mix(PAPER, INK, Math.pow(1 - luma(x), 1.15) * 0.96);
    return x;
  };
  const grade = (c, depth = 1) => {
    let x = mix(c, base.haze, (1 - depth) * light.haze);
    x = mix(x, base.light, light.light * (1 - depth * 0.4));
    x = mix(x, base.shade, light.shade * (0.3 + depth * 0.7));
    if (light.lift) x = adjust(x, { s: light.lift });
    return finish(x);
  };

  let sky = base.sky.map((c) => (scene.skyTint ? mix(c, scene.skyTint, 0.34) : c));
  if (scene.weather === "rain" || scene.weather === "clouds") sky = sky.map((c, i) => mix(c, "#9aa2b0", scene.weather === "rain" ? 0.42 : 0.16 + i * 0.02));

  const accent = mono ? "#b5402f" : null;
  const sunColor = mono && scene.time !== "night" ? accent : finish(base.sun);
  const figureShade = mix(base.shade, "#000000", 0.2);

  return {
    time: scene.time,
    night: scene.time === "night",
    low: scene.time === "sunset" || scene.time === "sunrise",
    mono,
    accent,
    sky: sky.map(finish),
    sun: sunColor,
    glow: mono ? mix(PAPER, accent, 0.35) : finish(base.glow),
    light: mono ? PAPER : finish(base.light),
    shade: finish(base.shade),
    haze: finish(base.haze),
    rim: light.rim,
    land: LANDS[scene.place],
    grade,
    finish,
    figure: (c, k = 1, w = 1) => finish(mix(c, figureShade, light.back * k), w),
    paper: PAPER,
  };
}
