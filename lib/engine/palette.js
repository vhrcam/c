const MOODS = {
  calm: ["#9fb4c7", "#d8d2c4", "#6f8fa6", "#e8c9a0"],
  tender: ["#e7a98f", "#f0d6c0", "#b9727a", "#f4c98a"],
  nostalgic: ["#d98b4a", "#e9c58f", "#8c5b3e", "#c8a46a"],
  joyful: ["#f2b33d", "#ef7a55", "#5fb3a4", "#f6e3b4"],
  melancholy: ["#7d8aa0", "#b7b9c2", "#4f5a6e", "#c9b8a6"],
  tense: ["#c8553d", "#e0b07a", "#5c4f63", "#d9d2c5"],
  epic: ["#e3a857", "#f3e2bf", "#7a8fb0", "#c4553e"],
  mysterious: ["#6e7fb8", "#b6a6d6", "#3f4d74", "#e1c78f"],
  serene: ["#8fc0b7", "#e3e6d8", "#5f8f9c", "#e8cf9f"],
  playful: ["#f07f6c", "#f5c44e", "#6cb2d1", "#a88be0"],
};

const DARK = { dawn: false, day: false, golden: false, dusk: true, night: true };
const BG = {
  void: "#11100e",
  night: "#0b0b0e",
  dusk: "#121016",
  space: "#060709",
  dawn: "#e9e4dc",
  day: "#ebe8e1",
  golden: "#ece4d6",
};

export const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export const toHex = (c) => `#${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("")}`;
export const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const mixColor = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function palette(plan) {
  const { time, setting } = plan.world;
  const given = plan.palette.background;
  const stormy = plan.world.weather === "storm" || plan.world.weather === "fog";
  const misty = plan.world.weather === "fog" && !DARK[time];
  const bgHex = setting === "void" ? BG.void : misty ? given || "#d9dcdc" : given || (setting === "space" ? BG.space : stormy && !DARK[time] ? "#1b1e23" : BG[time]);
  const bg = rgb(bgHex);
  const dark = luma(bg) < 0.42;
  const subjectColors = plan.subjects.flatMap((s) => s.colors);
  const colors = [...new Set([...plan.palette.colors, ...subjectColors])];
  const mood = MOODS[plan.mood] || MOODS.calm;
  while (colors.length < 4) colors.push(mood[colors.length]);
  const givenInk = plan.palette.ink ? rgb(plan.palette.ink) : null;
  const ink = givenInk && Math.abs(luma(givenInk) - luma(bg)) > 0.45 ? givenInk : rgb(dark ? "#ebe6dc" : "#1d1c1a");
  return {
    bg,
    bgHex,
    dark,
    ink,
    colors: colors.map(rgb),
    accent: rgb(plan.palette.accent || colors[colors.length > 4 ? 4 : 3]),
    mood: mood.map(rgb),
    night: DARK[time] || setting === "space",
  };
}
