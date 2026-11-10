import { random } from "../random.js";

// seeded 2D gradient noise in about -1..1, with fractal, ridged and cellular variants
export function noise2(seed) {
  const r = random(seed);
  const perm = new Uint8Array(512);
  const order = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = order[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  const jx = new Float32Array(256);
  const jy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
    jx[i] = r();
    jy[i] = r();
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  const n = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    const u = fade(xf);
    const v = fade(yf);
    const top = gx[aa] * xf + gy[aa] * yf + (gx[ba] * (xf - 1) + gy[ba] * yf - (gx[aa] * xf + gy[aa] * yf)) * u;
    const bottom = gx[ab] * xf + gy[ab] * (yf - 1) + (gx[bb] * (xf - 1) + gy[bb] * (yf - 1) - (gx[ab] * xf + gy[ab] * (yf - 1))) * u;
    return (top + (bottom - top) * v) * 1.41;
  };

  n.fbm = (x, y, octaves = 4, gain = 0.5, lacunarity = 2) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += n(x + o * 17.3, y - o * 9.1) * amp;
      norm += amp;
      amp *= gain;
      x *= lacunarity;
      y *= lacunarity;
    }
    return sum / norm;
  };

  // sharp crests, 0..1
  n.ridge = (x, y, octaves = 4, gain = 0.5) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const v = 1 - Math.abs(n(x + o * 31.7, y + o * 13.9));
      sum += v * v * amp;
      norm += amp;
      amp *= gain;
      x *= 2;
      y *= 2;
    }
    return sum / norm;
  };

  // distance to the nearest scattered point, 0 at a point and about 1 between them
  n.cell = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let best = 9;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const h = perm[perm[(xi + dx) & 255] + ((yi + dy) & 255)];
        const px = xi + dx + jx[h] - x;
        const py = yi + dy + jy[h] - y;
        const d = px * px + py * py;
        if (d < best) best = d;
      }
    return Math.sqrt(best);
  };

  // rounded domes packed side by side, 0..1
  n.domes = (x, y) => {
    const d = n.cell(x, y);
    return Math.max(0, 1 - d * d * 1.6);
  };

  return n;
}

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
