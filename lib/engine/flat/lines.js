import { random } from "../../random";
import { noise3 } from "../noise";
import { mixColor, rgb } from "../palette";

export function flowLines(g, ctx, arranged, out) {
  const { plan, pal, W } = ctx;
  const { w, h } = g;
  const k = out.w / w;
  const rand = random((plan.seed ^ 0x7f4a7c15) >>> 0);
  const nz = noise3((plan.seed + 23) >>> 0);
  const n = w * h;
  const right = g.view.right;
  const up = g.view.up;
  const key = g.key;
  const ambient = pal.night ? 0.2 : 0.32;
  let horizon = h;
  for (let y = 0; y < h && horizon === h; y++) for (let x = 0; x < w; x++) if (g.sid[y * w + x] === 90) { horizon = y; break; }
  const skyLow = pal.night ? mixColor(pal.bg, [pal.bg[0] * 2.6 + 0.06, pal.bg[1] * 2.6 + 0.07, pal.bg[2] * 2.6 + 0.11], 0.9) : plan.world.time === "dusk" || plan.world.time === "golden" ? mixColor(pal.bg, rgb("#e09a5c"), 0.5) : mixColor(pal.bg, [0.2, 0.2, 0.2], 0.25);
  const skyHigh = pal.dark ? mixColor(pal.bg, pal.ink, 0.12) : mixColor(pal.bg, [0, 0, 0], 0.2);

  const lamps = g.lamps || [];
  const lampAt = (x, y) => {
    let k = 0;
    let c = [1, 0.85, 0.6];
    for (const l of lamps) {
      const r = Math.hypot(x - l.at[0], (y - l.at[1]) * 0.8) / (h * 0.45);
      const v = 1.2 / (1 + r * r * 6);
      if (v > k) [k, c] = [v, l.color];
    }
    return { k, color: c };
  };
  const angle = new Float32Array(n);
  const color = new Float32Array(n * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const s = g.sid[i];
      if (s < 0) {
        angle[i] = nz(x * 0.006, y * 0.012, 3.1) * Math.PI * 0.7;
        color.set(mixColor(skyHigh, skyLow, Math.min(1, y / Math.max(1, horizon))), i * 3);
        continue;
      }
      const nn = [g.normal[i * 3], g.normal[i * 3 + 1], g.normal[i * 3 + 2]];
      const sx = nn[0] * right[0] + nn[1] * right[1] + nn[2] * right[2];
      const sy = -(nn[0] * up[0] + nn[1] * up[1] + nn[2] * up[2]);
      const albedo = [g.albedo[i * 3], g.albedo[i * 3 + 1], g.albedo[i * 3 + 2]];
      const lam = Math.max(0, nn[0] * key[0] + nn[1] * key[1] + nn[2] * key[2]);
      const L = s === 90 ? lam * (1 - ambient) + ambient : 0.5 + lam * 0.6;
      const glow = lampAt(x, y);
      if (s === 90) {
        angle[i] = nz(x * 0.01, y * 0.04, 7.7) * 0.5;
        const c = mixColor(albedo.map((v) => v * L), pal.bg, pal.night ? 0.35 : 0.2);
        color.set(mixColor(c, glow.color, Math.min(0.85, glow.k)), i * 3);
        continue;
      }
      const mag = Math.hypot(sx, sy);
      angle[i] = mag > 0.18 ? Math.atan2(sx, -sy) : nz(x * 0.03, y * 0.03, s) * Math.PI * 2;
      let lit = albedo.map((v) => Math.min(1, v * L * 1.15));
      if (pal.dark) lit = mixColor(lit, pal.ink, 0.12);
      lit = mixColor(lit, glow.color, Math.min(0.6, glow.k * 0.7));
      color.set(mixColor(lit, L < 0.6 ? rgb("#2a2c5c") : rgb("#fff1c8"), Math.abs(L - 0.75) * 0.2), i * 3);
    }

  const occ = new Float32Array(n).fill(0);
  const lines = [];
  const near = (x, y, r) => {
    const r0 = Math.ceil(r);
    for (let dy = -r0; dy <= r0; dy++)
      for (let dx = -r0; dx <= r0; dx++) {
        const xx = Math.round(x) + dx;
        const yy = Math.round(y) + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (occ[yy * w + xx] && dx * dx + dy * dy <= r * r) return true;
      }
    return false;
  };
  const trace = (x0, y0, sid, sep, max) => {
    const pts = [];
    for (const dir of [1, -1]) {
      let x = x0;
      let y = y0;
      const half = [];
      for (let s = 0; s < max; s++) {
        const i = Math.floor(y) * w + Math.floor(x);
        if (x < 0 || y < 0 || x >= w || y >= h || g.sid[i] !== sid) break;
        if (s > 2 && near(x, y, sep * 0.5)) break;
        half.push([x, y]);
        const a = angle[i];
        const mx = x + Math.cos(a) * 0.4 * dir;
        const my = y + Math.sin(a) * 0.4 * dir;
        const j = Math.floor(Math.min(h - 1, Math.max(0, my))) * w + Math.floor(Math.min(w - 1, Math.max(0, mx)));
        const b = angle[j];
        x += Math.cos(b) * 0.8 * dir;
        y += Math.sin(b) * 0.8 * dir;
      }
      if (dir === 1) pts.push(...half.reverse());
      else pts.push(...half.slice(1));
    }
    return pts;
  };
  const seeds = [];
  const step = 2;
  for (let y = 1; y < h; y += step) for (let x = 1; x < w; x += step) seeds.push([x + (rand() - 0.5) * step, y + (rand() - 0.5) * step]);
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  const rank = (s) => (s >= 0 && s < 90 ? 0 : s === 90 ? 1 : 2);
  seeds.sort((a, b) => rank(g.sid[Math.floor(a[1]) * w + Math.floor(a[0])]) - rank(g.sid[Math.floor(b[1]) * w + Math.floor(b[0])]));
  const fx = g.focus[0];
  const fy = g.focus[1];
  const reach = Math.hypot(w, h);
  for (const [sx, sy] of seeds) {
    const i = Math.floor(sy) * w + Math.floor(sx);
    if (i < 0 || i >= n) continue;
    const sid = g.sid[i];
    const subject = sid >= 0 && sid < 90;
    const sep = subject ? 1.6 : sid === 90 ? 3.2 : 5.5;
    if (near(sx, sy, sep)) continue;
    const pts = trace(sx, sy, sid, sep, subject ? 90 : 220);
    if (pts.length < (subject ? 4 : 8)) continue;
    for (const [x, y] of pts) occ[Math.floor(y) * w + Math.floor(x)] = 1;
    const cols = pts.map(([x, y]) => {
      const j = Math.floor(y) * w + Math.floor(x);
      return [color[j * 3], color[j * 3 + 1], color[j * 3 + 2]];
    });
    const d = Math.hypot(sx - fx, sy - fy) / reach;
    const birth = subject ? W.form[0] - 0.8 + d * (W.detail[1] - W.form[0] - 1) + rand() * 1.2 : sid === 90 ? W.structure[0] + 0.4 + (1 - (sy - horizon) / Math.max(1, h - horizon)) * 3 + rand() * 0.8 : W.light[0] + (sy / Math.max(1, horizon)) * 3 + rand() * 1.5;
    lines.push({ pts: pts.map(([x, y]) => [x * k, y * k]), cols, birth, dur: subject ? 0.5 + pts.length * 0.008 : 0.9, width: subject ? 1.15 * out.dpr : sid === 90 ? 0.9 * out.dpr : 0.8 * out.dpr, alpha: subject ? 0.95 : sid === 90 ? 0.75 : 0.55 });
  }
  lines.sort((a, b) => a.birth - b.birth);

  const cache = document.createElement("canvas");
  cache.width = out.w;
  cache.height = out.h;
  const c2 = cache.getContext("2d");
  const fill = `rgb(${pal.bg.map((v) => Math.round(v * 255)).join(",")})`;
  c2.fillStyle = fill;
  c2.fillRect(0, 0, out.w, out.h);
  let baked = 0;
  const css = (c) => `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const stroke = (ctx2, line, frac) => {
    const m = Math.max(2, Math.floor(line.pts.length * frac));
    ctx2.lineWidth = line.width;
    ctx2.globalAlpha = line.alpha;
    const chunk = 6;
    for (let a = 0; a < m - 1; a += chunk) {
      const b = Math.min(m - 1, a + chunk);
      ctx2.strokeStyle = css(line.cols[a]);
      ctx2.beginPath();
      ctx2.moveTo(line.pts[a][0], line.pts[a][1]);
      for (let j = a + 1; j <= b; j++) ctx2.lineTo(line.pts[j][0], line.pts[j][1]);
      ctx2.stroke();
    }
    ctx2.globalAlpha = 1;
  };
  let bakedAt = -1;
  const sky = [];
  if (pal.night && plan.world.weather !== "storm" && plan.world.setting !== "void") for (let j = 0; j < 260; j++) {
    const x = rand() * w;
    const y = rand() * Math.min(horizon, h) * 0.9;
    if (g.sid[Math.floor(y) * w + Math.floor(x)] < 0) sky.push({ x: x * k, y: y * k, b: W.world[0] + rand() * 4, s: rand(), p: rand() * 6 });
  }
  const drops = [];
  const kinds = plan.particles.map((p) => p.kind);
  if (plan.world.weather === "snow" && !kinds.includes("snow")) kinds.push("snow");
  if ((plan.world.weather === "rain" || plan.world.weather === "storm") && !kinds.includes("rain")) kinds.push("rain");
  kinds.slice(0, 2).forEach((kd) => {
    const spec = plan.particles.find((p) => p.kind === kd);
    const base = rgb(spec?.color || (kd === "snow" ? "#f2f1ee" : kd === "rain" ? "#9fb0c2" : kd === "leaves" ? "#d4692c" : "#e8e0c8"));
    const count = kd === "snow" ? 700 : kd === "rain" ? 500 : 160;
    for (let j = 0; j < count; j++) drops.push({ x: rand() * out.w, y: rand() * out.h, v: (kd === "rain" ? 0.9 : kd === "snow" ? 0.06 : 0.08) * out.h * (0.6 + rand() * 0.8), r: (kd === "leaves" ? 3.2 : kd === "snow" ? 1.6 : 1) * out.dpr * (0.6 + rand() * 0.8), p: rand() * 6.28, c: kd === "leaves" ? mixColor(base, rand() < 0.5 ? rgb("#8c2f1c") : rgb("#e3a83b"), rand() * 0.6) : base, kd, b: W.world[0] + rand() * 3 });
  });
  const overlay = (g2, T) => {
    for (const l of lamps) {
      const on = Math.min(1, Math.max(0, (T - W.light[0]) / 2));
      if (!on) continue;
      const x = l.at[0] * k;
      const y = l.at[1] * k;
      const r = out.h * 0.32;
      const grad = g2.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(${l.color.map((v) => Math.round(v * 255)).join(",")},${0.55 * on})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g2.fillStyle = grad;
      g2.globalCompositeOperation = pal.dark ? "lighter" : "source-over";
      g2.fillRect(x - r, y - r, r * 2, r * 2);
      g2.globalCompositeOperation = "source-over";
    }
    for (const s of sky) {
      if (T < s.b) continue;
      g2.globalAlpha = (0.35 + s.s * 0.6) * (0.7 + 0.3 * Math.sin(T * 1.5 + s.p * 9));
      g2.fillStyle = css(pal.ink);
      g2.fillRect(s.x, s.y, out.dpr * (s.s > 0.85 ? 2 : 1), out.dpr * (s.s > 0.85 ? 2 : 1));
    }
    g2.globalAlpha = 1;
    for (const d of drops) {
      if (T < d.b) continue;
      const t = T - d.b;
      const x = (((d.x + Math.sin(t * 0.7 + d.p) * 18 * out.dpr + t * (d.kd === "rain" ? 40 : 12) * out.dpr) % out.w) + out.w) % out.w;
      const y = (d.y + t * d.v) % out.h;
      g2.fillStyle = css(d.c);
      g2.globalAlpha = Math.min(1, t * 0.8) * (d.kd === "rain" ? 0.5 : 0.9);
      if (d.kd === "rain") g2.fillRect(x, y, out.dpr, out.dpr * 9);
      else if (d.kd === "leaves") {
        g2.save();
        g2.translate(x, y);
        g2.rotate(t * 1.3 + d.p);
        g2.scale(1, 0.45 + 0.4 * Math.abs(Math.sin(t + d.p)));
        g2.beginPath();
        g2.ellipse(0, 0, d.r * 1.6, d.r * 0.8, 0, 0, Math.PI * 2);
        g2.fill();
        g2.restore();
      } else {
        g2.beginPath();
        g2.arc(x, y, d.r, 0, Math.PI * 2);
        g2.fill();
      }
    }
    g2.globalAlpha = 1;
  };
  return {
    lines: lines.length,
    draw(g2, T) {
      if (T < bakedAt) {
        c2.fillStyle = fill;
        c2.fillRect(0, 0, out.w, out.h);
        baked = 0;
      }
      bakedAt = T;
      c2.lineCap = "round";
      while (baked < lines.length && T >= lines[baked].birth + lines[baked].dur) {
        stroke(c2, lines[baked], 1);
        baked++;
      }
      g2.drawImage(cache, 0, 0);
      g2.lineCap = "round";
      for (let j = baked; j < lines.length; j++) {
        const line = lines[j];
        if (T < line.birth) {
          if (line.birth > T + 8) break;
          continue;
        }
        stroke(g2, line, Math.min(1, (T - line.birth) / line.dur));
      }
      overlay(g2, T);
      if (T < W.seed[1] + 0.4 && Math.floor(T * 1.9) % 2 === 0) {
        g2.fillStyle = css(pal.ink);
        g2.fillRect(fx * k - 3 * out.dpr, fy * k - 6 * out.dpr, 5 * out.dpr, 12 * out.dpr);
      }
    },
  };
}
