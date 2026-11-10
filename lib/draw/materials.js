// What c knows about the world is on this page: how each substance takes a line.
// sys: slice = cut the form's relief into level lines; strand = grow hairs along a flow; glow = a light source.
// step coarsens the cuts, cover scales the ink, lift is how far the part stands off the body, gloss leaves a highlight bare.
// flat marks what comes in boards, walls, panes and sheets: an outline of it is a plate with crisp edges, not a cushion.
export const MATERIAL = {
  skin: { sys: "slice", step: 1, cover: 0.62, lift: 0.5, micro: "none" },
  hair: { sys: "strand", kind: "hair", lift: 0.9 },
  fur: { sys: "slice", step: 1, cover: 0.55, lift: 0.6, micro: "soft", coat: "fur" },
  feather: { sys: "slice", step: 1, cover: 0.5, lift: 0.6, micro: "soft", coat: "feather" },
  scales: { sys: "slice", cover: 0.9, lift: 0.5, micro: "scales" },
  cloth: { sys: "slice", cover: 1, lift: 0.7, micro: "fold" },
  knit: { sys: "slice", cover: 1, lift: 0.8, micro: "knit" },
  leather: { sys: "slice", cover: 1.1, lift: 0.6, micro: "none", gloss: 0.35 },
  wood: { sys: "slice", cover: 0.95, lift: 0.6, micro: "grain", flat: true },
  bark: { sys: "slice", cover: 1.1, lift: 0.7, micro: "bark" },
  stone: { sys: "slice", cover: 0.95, lift: 0.8, micro: "rock" },
  brick: { sys: "slice", cover: 1, lift: 0.5, micro: "course", flat: true },
  concrete: { sys: "slice", step: 1, cover: 0.85, lift: 0.4, micro: "speck", flat: true },
  metal: { sys: "slice", cover: 1, lift: 0.5, micro: "none", gloss: 0.8 },
  glass: { sys: "slice", step: 1, cover: 0.55, lift: 0.3, micro: "none", gloss: 1, flat: true },
  plastic: { sys: "slice", cover: 1, lift: 0.5, micro: "none", gloss: 0.55 },
  rubber: { sys: "slice", cover: 1.05, lift: 0.5, micro: "none" },
  paper: { sys: "slice", step: 1, cover: 0.7, lift: 0.3, micro: "none", flat: true },
  ceramic: { sys: "slice", cover: 0.9, lift: 0.5, micro: "none", gloss: 0.7 },
  food: { sys: "slice", cover: 0.95, lift: 0.5, micro: "speck" },
  bone: { sys: "slice", step: 1, cover: 0.7, lift: 0.5, micro: "none" },
  rope: { sys: "slice", cover: 1, lift: 0.5, micro: "knit" },
  water: { sys: "slice", cover: 0.9, lift: 0.2, micro: "wave", run: 5, rest: 1 },
  ice: { sys: "slice", step: 1, cover: 0.6, lift: 0.4, micro: "none", gloss: 1 },
  snow: { sys: "slice", step: 1, cover: 0.6, lift: 0.7, micro: "soft" },
  sand: { sys: "slice", step: 1, cover: 0.8, lift: 0.5, micro: "soft", grain: 1 },
  soil: { sys: "slice", cover: 0.9, lift: 0.5, micro: "rock", grain: 0.6 },
  grass: { sys: "slice", step: 1, cover: 0.8, lift: 0.5, micro: "soft", coat: "grass" },
  foliage: { sys: "slice", cover: 1, lift: 1, micro: "domes" },
  petals: { sys: "slice", cover: 1.05, lift: 0.7, micro: "petal" },
  fire: { sys: "strand", kind: "flame", lift: 0.5 },
  smoke: { sys: "slice", step: 1, cover: 0.55, lift: 0.8, micro: "billow" },
  cloud: { sys: "slice", step: 1, cover: 0.5, lift: 1, micro: "billow" },
  light: { sys: "glow", cover: 1, lift: 0.4, micro: "none" },
};

// fine relief on top of a form, in units: s is the shape, (x, y) the point, (u, v) along and across its long axis
export function micro(kind, n, s, x, y, u, v) {
  const k = s.k * 1.618;
  switch (kind) {
    case "fold":
      return n.fbm(u * 0.11 + k, v * 0.42 - k, 3) * 0.75;
    case "knit":
      return Math.sin(v * 7.5 + Math.sin(u * 3.1) * 0.8) * 0.085 + n(u * 0.2 + k, v * 0.2) * 0.3;
    case "grain":
      return n.fbm(u * 0.16 + k, v * 1.3 + k, 3) * 0.7;
    case "bark":
      return (n.ridge(u * 0.14 + k, v * 1.5 - k, 3) - 0.5) * 1.5;
    case "rock":
      return (n.ridge(x * 0.13 + k, y * 0.13 - k, 4) - 0.5) * 1.9;
    case "course":
      return Math.abs(((y * 0.9) % 1) - 0.5) < 0.08 ? -0.25 : n(x * 0.5, y * 0.5 + k) * 0.08;
    case "speck":
      return n(x * 1.1 + k, y * 1.1) * 0.13;
    case "wave":
      return n.fbm(x * 0.3 + k, y * 1.5, 3) * 0.7;
    case "soft":
      return n.fbm(x * 0.07 + k, y * 0.07 - k, 3) * 0.7;
    case "scales":
      return n.domes(x * 1.1 + k, y * 1.1) * 0.3;
    case "domes": {
      const f = 1.9 / Math.max(2.5, Math.min(14, s.g?.x1 - s.g?.x0 || 8));
      return n.domes(x * f * 2 + k, y * f * 2.3 - k) * 1.5 + n.domes(x * f * 5 - k, y * f * 5) * 0.5;
    }
    case "billow": {
      const f = 1.6 / Math.max(3, Math.min(20, s.g?.x1 - s.g?.x0 || 10));
      return n.domes(x * f * 2 + k, y * f * 3 - k) * 1.3 + n.fbm(x * 0.2, y * 0.3 + k, 2) * 0.3;
    }
    case "petal":
      return n.fbm(u * 0.5 + k, v * 0.5, 2) * 0.35;
    default:
      return 0;
  }
}
