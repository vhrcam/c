import { random } from "../../random";
import { luma, mixColor, rgb } from "../palette";

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const COOL = rgb("#2a2c5c");
const WARM = rgb("#fff0c2");

function ramp(c) {
  const shadow = mixColor(c.map((v) => v * 0.55), COOL, 0.28);
  return [mixColor(c.map((v) => v * 0.28), COOL, 0.45), shadow, mixColor(shadow, c, 0.55), c, mixColor(c.map((v) => Math.min(1, v * 1.12)), WARM, 0.22), mixColor(c, [1, 1, 1], 0.6)];
}

const quant = (c) => c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 15) / 15);
const key = (c) => c.map((v) => Math.round(v * 15).toString(16)).join("");

export function pixelArt(g, ctx, arranged) {
  const { plan, pal, W } = ctx;
  const { w, h } = g;
  const rand = random((plan.seed ^ 0x9e3779b9) >>> 0);
  const ramps = new Map();
  const rampOf = (c) => {
    const q = quant(c);
    const k = key(q);
    if (!ramps.has(k)) ramps.set(k, ramp(q));
    return ramps.get(k);
  };
  const n = w * h;
  const final = new Float32Array(n * 3);
  const flat = new Float32Array(n * 3);
  const birth = new Float32Array(n).fill(0);
  const shadeAt = new Float32Array(n).fill(0);
  const kind = new Uint8Array(n);
  const idx = (x, y) => y * w + x;
  const sidAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : g.sid[idx(x, y)]);
  const keyDir = g.key;
  const ambient = pal.night ? 0.22 : 0.35;

  let horizon = h;
  for (let y = 0; y < h && horizon === h; y++) for (let x = 0; x < w; x++) if (g.sid[idx(x, y)] === 90) { horizon = y; break; }
  const skyTop = pal.bg;
  const skyLow = pal.night ? mixColor(pal.bg, [pal.bg[0] * 2.4 + 0.05, pal.bg[1] * 2.4 + 0.06, pal.bg[2] * 2.4 + 0.1], 0.9) : plan.world.time === "dusk" || plan.world.time === "golden" ? mixColor(pal.bg, rgb("#e09a5c"), 0.45) : mixColor(pal.bg, [1, 1, 1], 0.35);
  const bands = 5;

  let cx = 0;
  let cy = 0;
  let count = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      const s = g.sid[i];
      if (s < 0) {
        const t = Math.min(1, y / Math.max(1, Math.min(horizon, h) - 1));
        const band = Math.min(bands - 1, Math.floor(t * bands + (bayer(x, y) - 0.5) * 0.9));
        const c = mixColor(skyTop, skyLow, band / (bands - 1));
        final.set(c, i * 3);
        flat.set(c, i * 3);
        kind[i] = 0;
        birth[i] = W.light[0] + (y / h) * 2.5 + rand() * 0.6;
        shadeAt[i] = birth[i];
        continue;
      }
      const albedo = [g.albedo[i * 3], g.albedo[i * 3 + 1], g.albedo[i * 3 + 2]];
      const nn = [g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]];
      const lam = Math.max(0, nn[0] * keyDir[0] + nn[1] * keyDir[1] + nn[2] * keyDir[2]);
      const L = s === 90 ? lam * (1 - ambient) + ambient : 0.42 + lam * 0.5;
      const r = rampOf(s === 90 ? mixColor(albedo, pal.bg, pal.night ? 0.45 : 0.15) : albedo);
      const vd = g.view.fwd;
      const refl = nn[1] * 0 + Math.max(0, 2 * lam * (nn[0] * -vd[0] + nn[1] * -vd[1] + nn[2] * -vd[2]) - (keyDir[0] * -vd[0] + keyDir[1] * -vd[1] + keyDir[2] * -vd[2]));
      let level = Math.max(1, Math.min(4, Math.floor(L * 4.2 + (bayer(x, y) - 0.5) * 0.5) + 1));
      if (s !== 90 && refl > 0.9) level = 5;
      if (s === 90) {
        const row = (y - horizon) / Math.max(1, h - horizon);
        const band = row * 3 + (bayer(x, y) - 0.5) * 0.35 + (rand() - 0.5) * 0.25;
        level = Math.max(1, Math.min(4, 2 + Math.floor(band)));
      }
      final.set(r[level], i * 3);
      flat.set(r[3], i * 3);
      if (s === 90) {
        kind[i] = 1;
        const depthRow = (y - horizon) / Math.max(1, h - horizon);
        birth[i] = W.structure[0] + 0.3 + (1 - depthRow) * 2.4 + rand() * 0.3;
        shadeAt[i] = birth[i] + 0.4;
        if (rand() < 0.06) final.set(r[Math.max(1, level - 1)], i * 3);
      } else {
        kind[i] = 2;
        cx += x;
        cy += y;
        count++;
      }
    }
  if (count) {
    cx /= count;
    cy /= count;
  }
  const fx = Math.round(Math.min(w - 1, Math.max(0, g.focus[0])));
  const fy = Math.round(Math.min(h - 1, Math.max(0, g.focus[1])));

  const dist = new Float32Array(n).fill(-1);
  const queue = [];
  let start = idx(fx, fy);
  if (kind[start] !== 2) {
    let best = Infinity;
    for (let i = 0; i < n; i++)
      if (kind[i] === 2) {
        const d = (i % w - fx) ** 2 + (Math.floor(i / w) - fy) ** 2;
        if (d < best) [best, start] = [d, i];
      }
  }
  if (kind[start] === 2) {
    dist[start] = 0;
    queue.push(start);
  }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = idx(nx, ny);
      if (kind[j] !== 2 || dist[j] >= 0) continue;
      dist[j] = dist[i] + 1 + (rand() < 0.3 ? 1 : 0);
      queue.push(j);
    }
  }
  let maxD = 1;
  for (let i = 0; i < n; i++) if (dist[i] > maxD) maxD = dist[i];

  const outline = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (kind[i] !== 2) continue;
      const s = g.sid[i];
      const edge = [sidAt(x + 1, y), sidAt(x - 1, y), sidAt(x, y + 1), sidAt(x, y - 1)].some((t) => t !== s && (t < 0 || t === 90 || t !== s));
      const order = dist[i] < 0 ? 1 : dist[i] / maxD;
      birth[i] = W.form[0] + order * (W.form[1] - W.form[0] - 1.5) + rand() * 0.25;
      const albedo = [g.albedo[i * 3], g.albedo[i * 3 + 1], g.albedo[i * 3 + 2]];
      const nn = [g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]];
      const L = Math.max(0, nn[0] * keyDir[0] + nn[1] * keyDir[1] + nn[2] * keyDir[2]);
      shadeAt[i] = W.detail[0] + (1 - L) * (W.detail[1] - W.detail[0] - 2) + rand() * 0.4;
      if (edge) {
        final.set(rampOf(albedo)[0], i * 3);
        flat.set(rampOf(albedo)[0], i * 3);
        kind[i] = 3;
        outline.push(i);
      }
    }
  outline.forEach((i) => {
    const x = i % w;
    const y = (i - x) / w;
    const a = (Math.atan2(y - cy, x - cx) / (Math.PI * 2) + 0.5 + 0.25) % 1;
    birth[i] = W.structure[0] + 0.8 + a * (W.structure[1] - W.structure[0] - 1.6);
    shadeAt[i] = birth[i];
  });

  const stars = [];
  if (pal.night && plan.world.weather !== "storm" && plan.world.setting !== "void") {
    for (let k = 0; k < (w * Math.min(horizon, h)) / 70; k++) {
      const x = Math.floor(rand() * w);
      const y = Math.floor(rand() * Math.min(horizon, h) * 0.85);
      if (g.sid[idx(x, y)] < 0) stars.push({ i: idx(x, y), b: W.world[0] + rand() * 4, p: rand() * 6, big: rand() < 0.12 });
    }
  }

  const drops = [];
  const kinds = plan.particles.map((p) => p.kind);
  if (plan.world.weather === "snow" && !kinds.includes("snow")) kinds.push("snow");
  if ((plan.world.weather === "rain" || plan.world.weather === "storm") && !kinds.includes("rain")) kinds.push("rain");
  kinds.slice(0, 2).forEach((k) => {
    const spec = plan.particles.find((p) => p.kind === k);
    const base = rgb(spec?.color || (k === "snow" ? "#f2f1ee" : k === "rain" ? "#9fb0c2" : k === "leaves" ? "#d4692c" : "#e8e0c8"));
    const amount = k === "snow" ? 0.012 : k === "rain" ? 0.01 : 0.004;
    for (let j = 0; j < w * h * amount; j++) {
      const shade = k === "leaves" ? mixColor(base, rand() < 0.5 ? rgb("#8c2f1c") : rgb("#e3a83b"), rand() * 0.6) : base;
      drops.push({ x: rand() * w, y: rand() * h, v: k === "rain" ? 40 + rand() * 20 : k === "snow" ? 3 + rand() * 4 : 4 + rand() * 4, drift: rand() * 6.28, c: shade, k, b: W.world[0] + rand() * 3 });
    }
  });

  const image = new Uint8ClampedArray(n * 4);
  const bg = pal.bg;
  const put = (i, c, a = 1) => {
    image[i * 4] = (bg[0] + (c[0] - bg[0]) * a) * 255;
    image[i * 4 + 1] = (bg[1] + (c[1] - bg[1]) * a) * 255;
    image[i * 4 + 2] = (bg[2] + (c[2] - bg[2]) * a) * 255;
    image[i * 4 + 3] = 255;
  };
  const seedPixel = idx(fx, fy);
  return {
    w,
    h,
    draw(T) {
      for (let i = 0; i < n; i++) {
        if (T < birth[i]) put(i, bg);
        else if (T < shadeAt[i]) put(i, flat.subarray(i * 3, i * 3 + 3));
        else put(i, final.subarray(i * 3, i * 3 + 3));
      }
      if (T < W.seed[1] + 0.4 && Math.floor(T * 1.9) % 2 === 0) put(seedPixel, pal.ink);
      for (const s of stars) {
        if (T < s.b) continue;
        const tw = 0.55 + 0.45 * Math.sin(T * 1.7 + s.p * 9);
        put(s.i, pal.ink, tw);
        if (s.big && tw > 0.8) for (const d of [1, -1, w, -w]) if (s.i + d >= 0 && s.i + d < n && g.sid[s.i + d] < 0) put(s.i + d, pal.ink, 0.35);
      }
      for (const d of drops) {
        if (T < d.b) continue;
        const t = T - d.b;
        const x = Math.floor((((d.x + Math.sin(t * 0.8 + d.drift) * (d.k === "rain" ? 0 : 3) + t * (d.k === "rain" ? 6 : 1.5)) % w) + w) % w);
        const y = Math.floor((d.y + t * d.v) % h);
        const i = idx(x, y);
        put(i, d.c);
        if (d.k === "rain") for (const k of [1, 2]) if (y - k >= 0) put(idx(x, y - k), d.c, 0.5 / k);
        if (d.k === "leaves" && x + 1 < w) put(i + 1, d.c.map((v) => v * 0.8));
      }
      return image;
    },
    luma: luma(pal.bg),
  };
}
