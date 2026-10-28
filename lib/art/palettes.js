export const PALETTES = {
  editorial: { paper: "#f3ecdf", ink: "#1f2a44", pencil: "#9eabc4", warm: ["#e0a458", "#e2725b", "#b3502e"], cool: ["#2b3a67", "#1f2a44", "#5c7290"], accent: "#e2725b" },
  ember: { paper: "#f4ede2", ink: "#2a1d26", pencil: "#8ea0bf", warm: ["#f7b84e", "#f38d52", "#e5636c"], cool: ["#b0528b", "#5b4592", "#2c2f6b"], accent: "#ec4a2c" },
  riso: { paper: "#f6f1e6", ink: "#1f2a5e", pencil: "#9fb2d6", warm: ["#ffd23f", "#ffa94d", "#ff7aa8"], cool: ["#2f4ea8", "#16855a", "#1f2a5e"], accent: "#ff4d7d" },
  dusk: { paper: "#f2ede4", ink: "#1d2236", pencil: "#a3aec8", warm: ["#f8c79e", "#eea3b2", "#f27d6b"], cool: ["#8b8fcf", "#4f62ad", "#25305f"], accent: "#ef6f8d" },
  night: { paper: "#f1ece2", ink: "#141a33", pencil: "#9aa6c4", warm: ["#f2cf7a", "#f2a0b5", "#e9b84e"], cool: ["#4f62a8", "#26346b", "#121a3d"], accent: "#f2a0b5" },
};

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export function ramp(colors, t) {
  const k = Math.min(colors.length - 1.0001, Math.max(0, t * (colors.length - 1)));
  const i = Math.floor(k);
  const a = rgb(colors[i]);
  const b = rgb(colors[i + 1]);
  const c = a.map((v, j) => Math.round(v + (b[j] - v) * (k - i)));
  return `rgb(${c.join(",")})`;
}
