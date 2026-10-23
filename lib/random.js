export function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function random(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * next());
  next.pick = (list) => list[Math.floor(next() * list.length)];
  next.chance = (p) => next() < p;
  next.gauss = () => {
    let u = 0;
    while (!u) u = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return next;
}

export function noise(seed) {
  const r = random(seed);
  const table = Array.from({ length: 256 }, () => r());
  const at = (i) => table[i & 255];
  const smooth = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    return at(i) + (at(i + 1) - at(i)) * f * f * (3 - 2 * f);
  };
  return (x, octaves = 1) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += smooth(x * 2 ** o + o * 31.7) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}
