import { random } from "../random.js";

const SKY = 0;
const CLOUD = 1;
const CITY = 2;

const PALETTE = {
  sky: ["#1c2457", "#2b3c8f", "#4a63b8", "#7a6cc0", "#b066a8", "#e0708a", "#f48d6b", "#f9b25e", "#fcd889", "#fff1cf"],
  cloud: ["#2b3c8f", "#4a63b8", "#7a6cc0", "#9a8fb8", "#cfb8c8", "#e0708a", "#f48d6b", "#f9b25e", "#fcd889", "#fff1cf"],
  city: ["#141832", "#1f2448", "#2e2e5c", "#463f73"],
  skin: ["#fde6d6", "#f8c6b0", "#ee9e8c", "#d97a73"],
  hairA: ["#fde08a", "#f6c25a", "#e39a3c", "#b86a2c"],
  hairB: ["#9a5a3c", "#6e3a26", "#4a2418", "#2c140d"],
  shirt: ["#5a6fae", "#3a4c86", "#2a3866", "#1b2447"],
  pants: ["#3a3c58", "#2b2d44", "#1b1c2e"],
  dress: ["#fdf7ec", "#e7e1f0", "#c4c6e6", "#a3a9d8"],
};

const GROUP = { 1: "skin", 2: "hairA", 3: "hairB", 4: "shirt", 5: "pants", 6: "dress" };

const PARAMS = {
  sky: { gap: 1.8, width: [3, 9], max: 900, min: 26, speed: 720 },
  cloud: { gap: 1.4, width: [2.4, 5.5], max: 420, min: 16, speed: 560 },
  city: { gap: 1.2, width: [1.4, 2.8], max: 160, min: 8, speed: 380 },
  hair: { gap: 0.9, width: [1.3, 2.6], max: 260, min: 10, speed: 320 },
  skin: { gap: 1.0, width: [1.4, 2.4], max: 180, min: 6, speed: 260 },
  cloth: { gap: 1.0, width: [1.8, 3.4], max: 260, min: 8, speed: 320 },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function snap(rgb, palette, r) {
  const scored = palette.map((h) => {
    const [a, b, c] = hex(h);
    return [h, (a - rgb[0]) ** 2 * 0.3 + (b - rgb[1]) ** 2 * 0.59 + (c - rgb[2]) ** 2 * 0.11];
  });
  scored.sort((x, y) => x[1] - y[1]);
  return r() < 0.22 && scored[1] ? scored[1][0] : scored[0][0];
}

function valueNoise(seed) {
  const r = random(seed);
  const table = Float32Array.from({ length: 4096 }, () => r());
  const at = (x, y) => table[(((x & 63) * 64) + (y & 63)) & 4095];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v;
  };
}

function boxBlur(src, w, h, radius) {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 1 / (radius * 2 + 1);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -radius; x <= radius; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc * k;
      acc += src[y * w + Math.min(w - 1, x + radius + 1)] - src[y * w + Math.max(0, x - radius)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * k;
      acc += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
    }
  }
  return out;
}

function field(lum, region, w, h, sun, seed) {
  const n = w * h;
  const jxx = new Float32Array(n);
  const jxy = new Float32Array(n);
  const jyy = new Float32Array(n);
  const L = (x, y) => lum[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  const S = (x, y, q) => (region[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))] === q ? 1 : 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const q = region[i];
      const gx = L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1);
      const gy = L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1);
      const bx = (S(x + 1, y - 1, q) + 2 * S(x + 1, y, q) + S(x + 1, y + 1, q) - S(x - 1, y - 1, q) - 2 * S(x - 1, y, q) - S(x - 1, y + 1, q)) * 1.5;
      const by = (S(x - 1, y + 1, q) + 2 * S(x, y + 1, q) + S(x + 1, y + 1, q) - S(x - 1, y - 1, q) - 2 * S(x, y - 1, q) - S(x + 1, y - 1, q)) * 1.5;
      jxx[i] = gx * gx + bx * bx;
      jxy[i] = gx * gy + bx * by;
      jyy[i] = gy * gy + by * by;
    }
  }
  let a = jxx;
  let b = jxy;
  let c = jyy;
  for (let k = 0; k < 3; k++) {
    a = boxBlur(a, w, h, 3);
    b = boxBlur(b, w, h, 3);
    c = boxBlur(c, w, h, 3);
  }
  const noise = valueNoise(seed);
  const out = new Float32Array(n * 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const reg = region[i];
      const theta = 0.5 * Math.atan2(2 * b[i], a[i] - c[i]) + Math.PI / 2;
      const coh = Math.sqrt((a[i] - c[i]) ** 2 + 4 * b[i] * b[i]) / (a[i] + c[i] + 1e-6);
      const strength = Math.min(1, (a[i] + c[i]) * 40);
      let tx = Math.cos(theta);
      let ty = Math.sin(theta);
      let dx;
      let dy;
      const wobble = (noise(x * 0.025, y * 0.025) - 0.5) * 1.4;
      if (reg === SKY || reg === CLOUD) {
        const vx = x - sun[0];
        const vy = y - sun[1];
        const d = Math.hypot(vx, vy) || 1;
        const spin = 0.18 + wobble * 0.3;
        dx = (-vy / d) * Math.cos(spin) + (vx / d) * Math.sin(spin);
        dy = (vx / d) * Math.cos(spin) + (vy / d) * Math.sin(spin);
      } else if (reg === CITY) {
        dx = 0;
        dy = 1;
      } else {
        const sway = reg === 12 || reg === 13 ? 0.6 : 0.35;
        dx = Math.sin(wobble * sway);
        dy = Math.cos(wobble * sway);
      }
      if (tx * dx + ty * dy < 0) {
        tx = -tx;
        ty = -ty;
      }
      const weight = reg === SKY ? 0.45 : reg === CITY ? 0.25 : 1;
      const k = Math.min(1, coh * strength * 1.4) * weight;
      const fx = tx * k + dx * (1 - k);
      const fy = ty * k + dy * (1 - k);
      const len = Math.hypot(fx, fy) || 1;
      out[i * 2] = fx / len;
      out[i * 2 + 1] = fy / len;
    }
  }
  return out;
}

function groupOf(reg) {
  if (reg === SKY) return "sky";
  if (reg === CLOUD) return "cloud";
  if (reg === CITY) return "city";
  return GROUP[reg - 10] || "pants";
}

function paramsOf(group) {
  if (group === "hairA" || group === "hairB") return PARAMS.hair;
  if (group === "skin") return PARAMS.skin;
  if (group === "shirt" || group === "pants" || group === "dress") return PARAMS.cloth;
  return PARAMS[group];
}

export function flowArt(ref, { width = 1500, height = 1000, seed = 7 } = {}) {
  const { w, h } = ref;
  const n = w * h;
  const s = width / w;
  const region = new Uint8Array(n);
  const lum = new Float32Array(n);
  const rgb = new Uint8Array(n * 3);
  for (let row = 0; row < h; row++) {
    for (let x = 0; x < w; x++) {
      const src = (row * w + x) * 4;
      const y = h - 1 - row;
      const i = y * w + x;
      const m = Math.round((ref.regions[src] / 255) * 32);
      const cloud = ref.regions[src + 1] / 255;
      const cover = ref.regions[src + 2] / 255;
      region[i] = cover > 0.5 ? 10 + m : y / h > 0.7 && cloud > 0.5 ? CITY : cloud > 0.85 ? CLOUD : SKY;
      rgb[i * 3] = ref.color[src];
      rgb[i * 3 + 1] = ref.color[src + 1];
      rgb[i * 3 + 2] = ref.color[src + 2];
      lum[i] = (0.2126 * ref.color[src] + 0.7152 * ref.color[src + 1] + 0.0722 * ref.color[src + 2]) / 255;
    }
  }
  const sun = [ref.sunUv[0] * w, (1 - ref.sunUv[1]) * h];
  const dirs = field(lum, region, w, h, sun, seed);

  const sample = (x, y) => {
    const fx = Math.min(w - 1.001, Math.max(0, x / s - 0.5));
    const fy = Math.min(h - 1.001, Math.max(0, y / s - 0.5));
    return [fx, fy];
  };
  const regionAt = (x, y) => {
    const [fx, fy] = sample(x, y);
    return region[Math.round(fy) * w + Math.round(fx)];
  };
  const colorAt = (x, y) => {
    const [fx, fy] = sample(x, y);
    const i = Math.round(fy) * w + Math.round(fx);
    return [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]];
  };
  const dirAt = (x, y, px, py) => {
    const [fx, fy] = sample(x, y);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const u = fx - x0;
    const v = fy - y0;
    let ax = 0;
    let ay = 0;
    for (const [cx, cy, wt] of [[x0, y0, (1 - u) * (1 - v)], [x0 + 1, y0, u * (1 - v)], [x0, y0 + 1, (1 - u) * v], [x0 + 1, y0 + 1, u * v]]) {
      const i = (Math.min(h - 1, cy) * w + Math.min(w - 1, cx)) * 2;
      let dx = dirs[i];
      let dy = dirs[i + 1];
      if (dx * px + dy * py < 0) {
        dx = -dx;
        dy = -dy;
      }
      ax += dx * wt;
      ay += dy * wt;
    }
    const len = Math.hypot(ax, ay) || 1;
    return [ax / len, ay / len];
  };

  const cell = 16;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid = Array.from({ length: cols * rows }, () => []);
  const free = (x, y, r, gap) => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    for (let j = cy - 1; j <= cy + 1; j++) {
      if (j < 0 || j >= rows) continue;
      for (let i = cx - 1; i <= cx + 1; i++) {
        if (i < 0 || i >= cols) continue;
        for (const [px, py, pr] of grid[j * cols + i]) {
          const lim = r + pr + gap;
          if ((px - x) ** 2 + (py - y) ** 2 < lim * lim) return false;
        }
      }
    }
    return true;
  };

  const r = random(seed);
  const step = 2;
  const walk = (x, y, dx, dy, reg, rad, p, limit) => {
    const out = [];
    let px = dx;
    let py = dy;
    for (let k = 0; k < limit; k++) {
      const [ax, ay] = dirAt(x, y, px, py);
      const [bx, by] = dirAt(x + ax * step * 0.5, y + ay * step * 0.5, ax, ay);
      const nx = x + bx * step;
      const ny = y + by * step;
      if (nx < 1 || ny < 1 || nx > width - 1 || ny > height - 1) break;
      if (regionAt(nx, ny) !== reg || !free(nx, ny, rad, p.gap)) break;
      out.push(nx, ny);
      x = nx;
      y = ny;
      px = bx;
      py = by;
    }
    return out;
  };

  const lines = [];
  const seeds = [];
  for (let y = 4; y < height; y += 9) for (let x = 4; x < width; x += 9) seeds.push([x + r() * 8, y + r() * 8]);
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  const local = [];
  const tryLine = (x0, y0) => {
    const reg = regionAt(x0, y0);
    const group = groupOf(reg);
    const p = paramsOf(group);
    const width0 = p.width[0] + r() * (p.width[1] - p.width[0]);
    const rad = width0 / 2;
    if (!free(x0, y0, rad, p.gap)) return;
    const [dx, dy] = dirAt(x0, y0, 1, 0);
    const limit = Math.round(p.max / step / 2);
    const fwd = walk(x0, y0, dx, dy, reg, rad, p, limit);
    const back = walk(x0, y0, -dx, -dy, reg, rad, p, limit);
    const pts = [];
    for (let i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
    pts.push(x0, y0, ...fwd);
    const count = pts.length / 2;
    if (count * step < p.min) return;
    const mid = Math.floor(count / 2) * 2;
    const color = snap(colorAt(pts[mid], pts[mid + 1]), PALETTE[group], r);
    for (let i = 0; i < pts.length; i += 2) grid[Math.floor(pts[i + 1] / cell) * cols + Math.floor(pts[i] / cell)].push([pts[i], pts[i + 1], rad]);
    lines.push({ pts: Float32Array.from(pts), color, width: width0, group, length: count * step, speed: p.speed });
    for (let i = 0; i < pts.length - 2; i += 10) {
      const tx = pts[i + 2] - pts[i];
      const ty = pts[i + 3] - pts[i + 1];
      const tl = Math.hypot(tx, ty) || 1;
      const off = width0 + p.gap + p.width[0] * 0.5 + 0.5;
      local.push([pts[i] - (ty / tl) * off, pts[i + 1] + (tx / tl) * off], [pts[i] + (ty / tl) * off, pts[i + 1] - (tx / tl) * off]);
    }
  };
  while (seeds.length || local.length) {
    const [x, y] = local.length ? local.pop() : seeds.pop();
    if (x > 1 && y > 1 && x < width - 1 && y < height - 1) tryLine(x, y);
  }

  const sx = sun[0] * s;
  const sy = sun[1] * s;
  const far = Math.hypot(Math.max(sx, width - sx), Math.max(sy, height - sy));
  let end = 0;
  for (const line of lines) {
    const m = Math.floor(line.pts.length / 4) * 2;
    const cx = line.pts[m];
    const cy = line.pts[m + 1];
    if (line.group === "sky" || line.group === "cloud") line.start = 0.2 + (Math.hypot(cx - sx, cy - sy) / far) ** 0.75 * 7.6 + r() * 1.2;
    else if (line.group === "city") line.start = 8.2 + r() * 3.2;
    else line.start = 10.8 + (cy / height) * 5.2 + r() * 1.6;
    line.dur = Math.min(2.2, Math.max(0.25, line.length / line.speed));
    end = Math.max(end, line.start + line.dur);
  }
  lines.sort((a, b) => a.start - b.start);
  return { lines, width, height, end: end + 0.5 };
}
