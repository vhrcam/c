import { noise3 } from "../engine/noise";
import { random } from "../random";
import { patternsOf } from "../plot/compose.js";
import { detailLines, halo } from "../plot/details.js";
import { faceLines, figureLines, foldLines, toneField } from "../plot/figurelines.js";
import { hairLines } from "../plot/hairlines.js";
import { handLines } from "../plot/handlines.js";
import { poisson } from "./geometry";
import { composition } from "./plan";
import { figure } from "./subject";
import { H, W, tone, world } from "./world";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(",")},${a})`;
const ramp = (list, t) => {
  const k = Math.min(list.length - 1.0001, Math.max(0, t * (list.length - 1)));
  const i = Math.floor(k);
  return mix(list[i], list[i + 1], k - i);
};
const luma = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

function setup(P) {
  const { world: wd } = P;
  const sky = wd.sky.map(rgb);
  const sun = wd.lights[0];
  const hz = wd.horizon;
  P.skyAt = (x, y) => {
    const v = Math.min(1, Math.max(0, (hz - y) / hz));
    const d = sun ? Math.min(1, Math.hypot(x - sun.x, y - sun.y) / (W * 0.7)) : 0.5;
    return ramp(sky, Math.min(1, v * 0.62 + d * 0.5));
  };
  P.inLayer = (L) => L.inside || ((x, y) => y >= L.top(x) && y < L.bottom(x));
  P.colorOf = (L) => mix(rgb(tone(L.material, wd.time)), sky[0], (1 - L.depth) * 0.42);
  P.sky = sky;
  P.dark = wd.time === "night";
}

function layerPath(ctx, L, step = 6) {
  ctx.beginPath();
  ctx.moveTo(-10, L.bottom(-10));
  for (let x = -10; x <= W + 10; x += step) ctx.lineTo(x, Math.min(L.top(x), L.bottom(x)));
  for (let x = W + 10; x >= -10; x -= step) ctx.lineTo(x, L.bottom(x));
  ctx.closePath();
}

function shape(ctx, L, P, step) {
  if (L.kind !== "road") return layerPath(ctx, L, step);
  const hz = P.world.horizon;
  const s = P.comp.roadSpread;
  ctx.beginPath();
  [[L.vx - 2, hz], [L.vx + 2, hz], [L.vx + (H - hz) * s, H + 10], [L.vx - (H - hz) * s, H + 10]].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
  ctx.closePath();
}

function sample(P, L, tries, fn) {
  const inside = P.inLayer(L);
  let lo = Infinity;
  for (let x = 0; x <= W; x += 25) lo = Math.min(lo, L.top(x));
  lo = Math.max(0, lo);
  for (let i = 0; i < tries; i++) {
    const x = P.rand() * W;
    const y = lo + P.rand() * (H - lo);
    if (inside(x, y) && !(P.fig && P.fig.inside(x, y))) fn(x, y);
  }
}

function brush(ctx, x, y, angle, len, width, color, alpha, rand, bend = 0) {
  const bristles = Math.max(2, Math.round(width / 1.7));
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let b = 0; b < bristles; b++) {
    const o = (b / (bristles - 1) - 0.5) * width;
    const l = len * (0.7 + rand() * 0.3);
    const sx = x - dy * o - dx * l * 0.5 + (rand() - 0.5) * 2;
    const sy = y + dx * o - dy * l * 0.5 + (rand() - 0.5) * 2;
    ctx.strokeStyle = css(color.map((v) => v + (rand() - 0.5) * 16), alpha * (0.5 + rand() * 0.5));
    ctx.lineWidth = 1 + rand() * 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + dx * l * 0.5 - dy * bend * l, sy + dy * l * 0.5 + dx * bend * l, sx + dx * l, sy + dy * l);
    ctx.stroke();
  }
}

function delaunay(pts) {
  const n = pts.length;
  const P = [...pts, [-1e5, -1e5], [1e5, -1e5], [0, 1e5]];
  const circ = (a, b, c) => {
    const [ax, ay] = P[a];
    const [bx, by] = P[b];
    const [cx, cy] = P[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) || 1e-9;
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { a, b, c, x: ux, y: uy, r: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let tris = [circ(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const [px, py] = P[i];
    const edges = new Map();
    const keep = [];
    for (const t of tris) {
      if ((px - t.x) ** 2 + (py - t.y) ** 2 < t.r) {
        for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]]) {
          const k = u < v ? `${u},${v}` : `${v},${u}`;
          edges.set(k, edges.has(k) ? null : [u, v]);
        }
      } else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(circ(e[0], e[1], i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [P[t.a], P[t.b], P[t.c]]);
}

const tri = (ctx, t) => {
  ctx.beginPath();
  ctx.moveTo(...t[0]);
  ctx.lineTo(...t[1]);
  ctx.lineTo(...t[2]);
  ctx.closePath();
};

function branch(ctx, x, y, angle, len, width, depth, rand, color, alpha) {
  if (depth <= 0 || len < 2) return;
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  ctx.strokeStyle = css(color, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + x2) / 2 + (rand() - 0.5) * len * 0.2, (y + y2) / 2, x2, y2);
  ctx.stroke();
  const kids = rand() < 0.3 ? 3 : 2;
  for (let i = 0; i < kids; i++) branch(ctx, x2, y2, angle + (i - (kids - 1) / 2) * rand.range(0.35, 0.7) + (rand() - 0.5) * 0.3, len * rand.range(0.62, 0.8), width * 0.68, depth - 1, rand, color, alpha);
}

const only = (P, keep) => ({ ...P, world: { ...P.world, particles: P.world.particles.filter((p) => keep === (p.kind === "stars")) } });

function particles(ctx, P, style) {
  const { rand } = P;
  for (const p of P.world.particles) {
    if (p.kind === "stars")
      for (let i = 0; i < p.count; i++) {
        const x = rand() * W;
        const y = rand() * P.world.horizon * 0.9;
        ctx.fillStyle = css([255, 248, 230], 0.4 + rand() * 0.6);
        const s = rand() ** 3 * 2.4 + 0.5;
        if (style === "geometric") {
          ctx.fillRect(x - s, y - s * 0.25, s * 2, s * 0.5);
          ctx.fillRect(x - s * 0.25, y - s, s * 0.5, s * 2);
        } else ctx.fillRect(x, y, s, s);
      }
    if (p.kind === "rain") {
      ctx.strokeStyle = css(P.dark ? [200, 210, 230] : [90, 100, 120], 0.35);
      ctx.lineWidth = style === "geometric" ? 1.2 : 0.8;
      for (let i = 0; i < p.count; i++) {
        const x = rand() * (W + 200) - 100;
        const y = rand() * H;
        const l = 14 + rand() * 26;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - l * 0.25, y + l);
        ctx.stroke();
      }
    }
    if (p.kind === "snow")
      for (let i = 0; i < p.count; i++) {
        ctx.fillStyle = css([255, 255, 255], 0.5 + rand() * 0.5);
        const s = 1 + rand() ** 2 * 4;
        ctx.beginPath();
        if (style === "geometric") ctx.rect(rand() * W, rand() * H, s, s);
        else ctx.arc(rand() * W, rand() * H, s * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    if (p.kind === "birds")
      for (let i = 0; i < p.count; i++) {
        const x = W * rand.range(0.1, 0.9);
        const y = P.world.horizon * rand.range(0.15, 0.7);
        const s = 5 + rand() * 9;
        ctx.strokeStyle = css(P.dark ? [230, 230, 240] : [40, 34, 34], 0.8);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s * 0.3);
        ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
        ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * 0.3);
        ctx.stroke();
      }
    if (p.kind === "fog")
      for (let i = 0; i < 6; i++) {
        const y = P.world.horizon + (rand() - 0.6) * H * 0.3;
        const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
        g.addColorStop(0, css(P.sky[0], 0));
        g.addColorStop(0.5, css(P.sky[0], 0.35));
        g.addColorStop(1, css(P.sky[0], 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, y - 60, W, 120);
      }
  }
}

function clouds(ctx, P, style) {
  const { rand, n, world: wd } = P;
  const sun = wd.lights[0];
  for (const c of wd.clouds) {
    const lit = sun ? Math.max(0, 1 - Math.hypot(c.x - sun.x, c.y - sun.y) / (W * 0.6)) : 0.3;
    const top = mix(P.skyAt(c.x, c.y - 80), [255, 248, 236], 0.55 + lit * 0.3);
    const under = mix(P.skyAt(c.x, c.y + 40), [60, 50, 70], 0.18);
    const puffs = Array.from({ length: c.puffs }, (_, i) => ({ x: c.x + (i / (c.puffs - 1) - 0.5) * c.w + (rand() - 0.5) * c.w * 0.1, y: c.y - Math.sin((i / (c.puffs - 1)) * Math.PI) * c.h * rand.range(0.4, 1), r: c.h * rand.range(0.5, 1.1) }));
    if (style === "expressive")
      for (let i = 0; i < c.puffs * 40; i++) {
        const p = rand.pick(puffs);
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * p.r;
        const y = p.y + Math.sin(a) * r * 0.6;
        brush(ctx, p.x + Math.cos(a) * r, y, (rand() - 0.5) * 0.25, 14 + rand() * 30, 5 + rand() * 6, mix(under, top, (p.y + p.r * 0.6 - y) / (p.r * 1.2)), 0.5, rand);
      }
    if (style === "geometric") {
      const pts = [];
      for (const p of puffs) for (let a = Math.PI; a <= Math.PI * 2.001; a += Math.PI / 4) pts.push([p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r * 0.8]);
      pts.push([c.x - c.w * 0.6, c.y + c.h * 0.2], [c.x + c.w * 0.6, c.y + c.h * 0.2]);
      for (const t of delaunay(pts)) {
        const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        if (!puffs.some((p) => Math.hypot(cx - p.x, (cy - p.y) / 0.8) < p.r * 1.05) && cy < c.y) continue;
        ctx.fillStyle = css(mix(under, top, (c.y + c.h * 0.2 - cy) / (c.h * 1.4) + (rand() - 0.5) * 0.15));
        tri(ctx, t);
        ctx.fill();
      }
    }
    if (style === "organic")
      for (let i = 0; i < c.puffs * 260; i++) {
        const p = rand.pick(puffs);
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * p.r;
        const y = p.y + Math.sin(a) * r * 0.7;
        ctx.fillStyle = css(mix(under, top, (p.y + p.r * 0.7 - y) / (p.r * 1.4)), 0.35);
        ctx.fillRect(p.x + Math.cos(a) * r, y, 1.6, 1.6);
      }
    if (style === "lines") {
      ctx.strokeStyle = css([60, 52, 60], 0.75);
      for (let y = c.y - c.h * 1.2; y < c.y + c.h * 0.3; y += 4) {
        let run = null;
        for (let x = c.x - c.w; x <= c.x + c.w; x += 3) {
          const inside = puffs.some((p) => Math.hypot(x - p.x, (y - p.y) / 0.7) < p.r) && y < c.y + c.h * 0.3;
          if (inside && !run) run = x;
          if ((!inside || x + 3 > c.x + c.w) && run !== null) {
            ctx.lineWidth = 0.5 + Math.max(0, (y - c.y + c.h * 0.4) / c.h) * 1.4;
            ctx.beginPath();
            ctx.moveTo(run, y + n(run / 50, y / 20, 80));
            ctx.lineTo(x, y + n(x / 50, y / 20, 80));
            ctx.stroke();
            run = null;
          }
        }
      }
    }
  }
}

function objects(ctx, P, style) {
  const { rand, world: wd } = P;
  for (const o of wd.objects) {
    const far = o.base ? (o.base - wd.horizon) / (H - wd.horizon) : 0.5;
    const ink = mix(rgb(tone("forest", wd.time)), P.sky[0], (1 - far) * 0.35);
    if (o.kind === "tree") {
      const top = o.base - o.h;
      if (style === "organic" || style === "lines") {
        const c = style === "lines" ? [40, 36, 40] : mix(ink, [10, 8, 6], 0.4);
        branch(ctx, o.x, o.base, -Math.PI / 2 + (rand() - 0.5) * 0.1, o.h * 0.32, Math.max(1, o.h * 0.035), o.conifer ? 6 : 8, rand, c, 0.82);
        if (P.plan.setting.weather !== "snow" && P.plan.setting.place !== "snow") {
          const leaf = style === "lines" ? [44, 52, 40] : mix(rgb(tone("grass", wd.time)), [20, 30, 10], 0.25);
          for (let i = 0; i < o.h * 14; i++) {
            const a = rand() * Math.PI * 2;
            const r = Math.sqrt(rand()) * o.h * 0.36;
            const x = o.x + Math.cos(a) * r * 1.1;
            const y = top + o.h * 0.36 + Math.sin(a) * r * 0.75;
            const lit = (top + o.h * 0.36 - y) / (o.h * 0.36);
            ctx.fillStyle = css(mix(leaf, lit > 0 ? [255, 240, 190] : [0, 0, 0], Math.abs(lit) * 0.35 + rand() * 0.1), style === "lines" ? 0.85 : 0.8);
            if (style === "lines") ctx.fillRect(x, y, 2.6, 1);
            else {
              ctx.beginPath();
              ctx.ellipse(x, y, 1.6 + rand() * 3.2, 1 + rand() * 2, rand() * Math.PI, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      } else if (style === "geometric") {
        ctx.fillStyle = css(mix(ink, [0, 0, 0], 0.2));
        ctx.fillRect(o.x - o.h * 0.02, o.base - o.h * 0.3, o.h * 0.04, o.h * 0.3);
        const tiers = o.conifer ? 3 : 1;
        for (let k = 0; k < tiers; k++) {
          if (o.conifer) {
            ctx.fillStyle = css(mix(ink, [255, 255, 255], k * 0.08 + rand() * 0.05));
            ctx.beginPath();
            const y0 = o.base - o.h * (0.25 + k * 0.22);
            ctx.moveTo(o.x - o.h * (0.22 - k * 0.05), y0);
            ctx.lineTo(o.x + o.h * (0.22 - k * 0.05), y0);
            ctx.lineTo(o.x, y0 - o.h * 0.38);
            ctx.closePath();
            ctx.fill();
          }
        }
        if (!o.conifer) {
          const cy = top + o.h * 0.36;
          const pts = [];
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) pts.push([o.x + Math.cos(a) * o.h * (0.26 + rand() * 0.06), cy + Math.sin(a) * o.h * (0.24 + rand() * 0.06)]);
          pts.push(...Array.from({ length: 8 }, () => [o.x + (rand() - 0.5) * o.h * 0.36, cy + (rand() - 0.5) * o.h * 0.3]));
          for (const t of delaunay(pts)) {
            const sy = (t[0][1] + t[1][1] + t[2][1]) / 3;
            ctx.fillStyle = css(mix(ink, sy - cy < 0 ? [255, 240, 200] : [0, 0, 0], 0.1 + rand() * 0.12));
            tri(ctx, t);
            ctx.fill();
          }
        }
      } else {
        brush(ctx, o.x, o.base - o.h * 0.2, -Math.PI / 2, o.h * 0.4, Math.max(3, o.h * 0.04), mix(ink, [20, 12, 8], 0.5), 0.9, rand);
        for (let i = 0; i < 240; i++) {
          const a = rand() * Math.PI * 2;
          const r = Math.sqrt(rand()) * o.h * (o.conifer ? 0.18 : 0.3);
          const cy = o.conifer ? o.base - o.h * (0.3 + rand() * 0.65) : top + o.h * 0.32;
          const cx = o.conifer ? o.x + (rand() - 0.5) * o.h * 0.4 * (1 - (o.base - cy) / o.h) : o.x + Math.cos(a) * r;
          const ly = o.conifer ? cy : cy + Math.sin(a) * r * 0.85;
          const up = (top + o.h * 0.32 - ly) / (o.h * 0.3);
          brush(ctx, cx, ly, rand() * Math.PI, 8 + o.h * 0.06, 5 + o.h * 0.025, mix(ink, up > 0 ? [255, 228, 170] : [0, 0, 0], Math.abs(up) * 0.3 + 0.05), 0.75, rand);
        }
      }
    }
    if (o.kind === "house") {
      const { x, y, w } = o;
      const h = w * 0.6;
      const wall = mix(rgb(tone("wood", wd.time)), P.sky[0], 0.2);
      ctx.fillStyle = css(style === "organic" ? mix(wall, [10, 8, 6], 0.6) : wall);
      ctx.fillRect(x - w / 2, y - h, w, h);
      if (style === "expressive") {
        for (let i = 0; i < w * 3; i++) brush(ctx, x - w / 2 + rand() * w, y - h + rand() * h, Math.PI / 2 + (rand() - 0.5) * 0.2, h * 0.3, 3, mix(wall, rand() < 0.5 ? [255, 230, 190] : [0, 0, 0], 0.15), 0.5, rand);
      }
      if (style === "lines") {
        ctx.strokeStyle = css([42, 34, 40], 0.7);
        ctx.lineWidth = 0.8;
        for (let yy = y - h + 3; yy < y; yy += 3.5) {
          ctx.beginPath();
          ctx.moveTo(x - w / 2, yy);
          ctx.lineTo(x + w / 2, yy);
          ctx.stroke();
        }
      }
      ctx.fillStyle = css(mix(wall, [0, 0, 0], 0.35));
      ctx.beginPath();
      ctx.moveTo(x - w * 0.6, y - h);
      ctx.lineTo(x, y - h - w * 0.42);
      ctx.lineTo(x + w * 0.6, y - h);
      ctx.fill();
      ctx.fillStyle = css(o.lit ? [255, 205, 120] : mix(wall, [255, 255, 255], 0.3));
      ctx.fillRect(x - w * 0.25, y - h * 0.65, w * 0.14, h * 0.28);
      ctx.fillRect(x + w * 0.1, y - h * 0.65, w * 0.14, h * 0.28);
    }
    if (o.kind === "dock") {
      const c = mix(rgb(tone("wood", wd.time)), [0, 0, 0], 0.2);
      ctx.fillStyle = css(c);
      ctx.fillRect(o.x0, o.y, o.x1 - o.x0, o.h);
      for (let x = o.x0 + 20; x < o.x1; x += 70) ctx.fillRect(x, o.y + o.h, 8, 60);
      ctx.strokeStyle = css(mix(c, [0, 0, 0], 0.3), 0.6);
      for (let x = o.x0; x < o.x1; x += 14) {
        ctx.beginPath();
        ctx.moveTo(x, o.y);
        ctx.lineTo(x, o.y + o.h);
        ctx.stroke();
      }
    }
  }
}

function paintFigure(ctx, P, style) {
  const { fig, rand } = P;
  const [x0, y0, x1, y1] = fig.box.map((v, i) => (i % 2 ? Math.max(0, Math.min(H, v)) : Math.max(0, Math.min(W, v))));
  const sun = P.world.lights[0];
  const warm = sun && sun.kind === "sun" ? [255, 214, 150] : [210, 220, 255];
  const shadow = P.dark ? [12, 14, 26] : [42, 26, 22];
  const s = Math.max(0.6, Math.min(3, fig.k * 0.9));
  if (style === "expressive") {
    for (let y = y0; y < y1; y += 2)
      for (let x = x0; x < x1; x += 2) {
        if (!fig.inside(x, y)) continue;
        const [lite, dark] = fig.fill(fig.mat(x, y), fig.person(x, y));
        ctx.fillStyle = css(mix(mix(rgb(dark), shadow, 0.5), rgb(lite), fig.light(x, y) * fig.ao(x, y) * 0.5));
        ctx.fillRect(x - 0.5, y - 0.5, 3, 3);
      }
    const dir = [0, 0];
    const count = Math.min(60000, ((x1 - x0) * (y1 - y0)) / (14 * s));
    for (let i = 0; i < count; i++) {
      const x = x0 + rand() * (x1 - x0);
      const y = y0 + rand() * (y1 - y0);
      if (!fig.inside(x, y)) continue;
      const m = fig.mat(x, y);
      const [lite, dark] = fig.fill(m, fig.person(x, y));
      fig.along(x, y, dir);
      const flowing = m === 2 || m === 3 || m === 6;
      const a = Math.atan2(dir[1], dir[0]) + (flowing ? 0 : Math.PI / 2 + (rand() - 0.5) * 0.6);
      const rim = fig.rim(x, y);
      const c = rim > 0.3 ? mix(warm, [255, 250, 235], rand()) : mix(mix(rgb(dark), shadow, 0.35), mix(rgb(lite), warm, 0.25), fig.light(x, y) * fig.ao(x, y) * 0.9);
      brush(ctx, x, y, a, ((flowing ? 12 : 6) + rand() * 9) * s, (rim > 0.3 ? 2.2 : 3.5 + rand() * 3) * s, c, rim > 0.3 ? 0.85 : 0.6, rand, (rand() - 0.5) * 0.25);
    }
  }
  if (style === "geometric") {
    const r = Math.max(5, 7 * s);
    const pts = poisson(rand, { w: W, h: H, radius: (x, y) => (Math.hypot(x - fig.focus[0], y - fig.focus[1]) < 160 * s ? r : r * 1.9), inside: (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && fig.inside(x, y), tries: 70000 });
    const edge = (x, y) => fig.inside(x, y) && (!fig.inside(x + 3, y) || !fig.inside(x - 3, y) || !fig.inside(x, y + 3) || !fig.inside(x, y - 3));
    for (let y = y0; y < y1; y += 5) for (let x = x0; x < x1; x += 5) if (edge(x, y)) pts.push([x, y]);
    const accents = ["#e9b44c", "#8fb8de", "#e58fa8", "#c8553d", "#2b3a67", "#f7f3ec"].map(rgb);
    const shatter = P.comp.framing === "wide" && rand.chance(0.3);
    const away = [rand.pick([1, -1]), -0.6];
    for (const t of delaunay(pts)) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      if (!fig.inside(cx, cy)) continue;
      const [lite, dark] = fig.fill(fig.mat(cx, cy), fig.person(cx, cy));
      let c = mix(rgb(dark), rgb(lite), fig.light(cx, cy) * fig.ao(cx, cy) * 1.1);
      if (fig.rim(cx, cy) > 0.35) c = mix(c, warm, 0.5);
      if (rand() < 0.04 && [4, 5, 6, 9].includes(fig.mat(cx, cy))) c = rand.pick(accents);
      let off = [0, 0];
      if (shatter) {
        const along = ((cx - fig.focus[0]) * away[0] + (cy - fig.focus[1]) * away[1]) / (H * 0.3);
        const k = Math.max(0, Math.min(1, (along - 0.4) / 0.6));
        if (k > 0 && rand() < k * 0.4) continue;
        off = [away[0] * k * k * 160 * (0.5 + rand()), away[1] * k * k * 160 * (0.5 + rand())];
      }
      ctx.fillStyle = css(c);
      tri(ctx, t.map(([x, y]) => [x + off[0], y + off[1]]));
      ctx.fill();
      ctx.strokeStyle = css(c);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }
  if (style === "organic") {
    const deep = P.dark ? [3, 4, 9] : [27, 20, 15];
    const lift = P.dark ? [40, 46, 70] : [110, 82, 52];
    for (let y = y0; y < y1; y += 2)
      for (let x = x0; x < x1; x += 2) {
        if (!fig.inside(x, y)) continue;
        const mottle = (P.n(x / 40, y / 40, 8) + 1) / 2;
        ctx.fillStyle = css(mix(deep, lift, fig.light(x, y) * fig.ao(x, y) * 0.5 + mottle * 0.3));
        ctx.fillRect(x - 0.5, y - 0.5, 3, 3);
      }
    const glow = P.dark ? [190, 220, 255] : [255, 230, 170];
    for (let y = y0; y < y1; y += 1.5)
      for (let x = x0; x < x1; x += 1.5)
        if (fig.inside(x, y) && (!fig.inside(x + 3, y) || !fig.inside(x - 3, y) || !fig.inside(x, y - 3))) {
          ctx.fillStyle = css(glow, P.dark ? 0.75 : 0.35);
          ctx.fillRect(x, y, 1.5, 1.5);
        }
    for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 30; i++) {
      const x = x0 + rand() * (x1 - x0);
      const y = y0 + rand() * (y1 - y0);
      if (!fig.inside(x, y)) continue;
      const r = fig.rim(x, y) + fig.light(x, y) * 0.4;
      if (rand() > r) continue;
      ctx.fillStyle = css(glow, Math.min(0.9, r));
      ctx.fillRect(x, y, 1.3, 1.3);
    }
    const veins = 3 + Math.floor(rand() * 3);
    for (let v = 0; v < veins; v++) {
      let x = fig.focus[0] + (rand() - 0.5) * 40 * s;
      let y = fig.focus[1] + rand() * 80 * s;
      let a = Math.PI / 2 + (rand() - 0.5) * 1.2;
      ctx.strokeStyle = css(glow, 0.85);
      for (let k = 0; k < 160; k++) {
        a += (rand() - 0.5) * 0.5;
        const nx = x + Math.cos(a) * 4 * s;
        const ny = y + Math.sin(a) * 4 * s;
        if (!fig.inside(nx, ny)) {
          a += Math.PI * 0.6;
          continue;
        }
        ctx.lineWidth = Math.max(0.4, 2.2 * (1 - k / 160)) * s * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        if (rand() < 0.06) branch(ctx, nx, ny, a + (rand() < 0.5 ? 0.8 : -0.8), 10 * s, 0.8 * s, 3, rand, glow, 0.6);
        x = nx;
        y = ny;
      }
    }
  }
  if (style === "lines") {
    const { F, scene, cam, pens, figPal } = fig.st;
    const all = [
      ...figureLines(F, { pens, rng: rand, tone: toneField(F, 0.9), patterns: patternsOf(scene), avoid: halo([], W, H) }),
      ...faceLines(scene, cam, F, pens),
      ...handLines(scene, cam, F, pens),
      ...detailLines(scene, cam, F, pens, P.comp.seed),
      ...hairLines(scene, cam, F, pens, figPal, P.comp.seed),
      ...foldLines(scene, cam, F, pens, rand),
    ];
    for (let y = y0; y < y1; y += 2)
      for (let x = x0; x < x1; x += 2)
        if (fig.inside(x, y)) {
          ctx.fillStyle = "#f6f1e6";
          ctx.fillRect(x - 0.5, y - 0.5, 3, 3);
        }
    ctx.lineJoin = "round";
    for (const l of all) {
      const pts = fig.map(l.pts);
      ctx.strokeStyle = l.pen;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = (l.width || 1) * Math.sqrt(fig.k);
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function torn(ctx, P) {
  const { rand, n } = P;
  ctx.fillStyle = "#f5efe4";
  for (let i = 0; i < 5200; i++) {
    const side = Math.floor(rand() * 4);
    const u = rand();
    const d = rand() ** 3 * 90 * (0.3 + (n(u * 9, side, 3) + 1) * 0.6);
    const x = side < 2 ? u * W : side === 2 ? d : W - d;
    const y = side === 0 ? d : side === 1 ? H - d : u * H;
    const r = 2 + rand() * 9 * (1 - d / 90);
    const a0 = rand() * Math.PI;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k / 5) * Math.PI * 2;
      const rr = r * (0.4 + rand() * 0.9);
      ctx.lineTo(x + Math.cos(a) * rr * 1.8, y + Math.sin(a) * rr * 0.6);
    }
    ctx.fill();
  }
  ctx.fillRect(0, 0, W, 12);
  ctx.fillRect(0, H - 12, W, 12);
  ctx.fillRect(0, 0, 12, H);
  ctx.fillRect(W - 12, 0, 12, H);
}

function expressive(ctx, P) {
  const { rand, n, world: wd, fig } = P;
  const hz = wd.horizon;
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  [...P.sky].reverse().forEach((c, i) => g.addColorStop(i / (P.sky.length - 1), css(c)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const sun = wd.lights[0];
  if (sun) {
    const r = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, W * 0.6);
    r.addColorStop(0, css(sun.kind === "moon" ? [240, 240, 255] : [255, 246, 214], 0.95));
    r.addColorStop(0.2, css(P.sky[0], 0.5));
    r.addColorStop(1, css(P.sky[0], 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, W, H);
  }
  const d = P.comp.density;
  for (let i = 0; i < 1300 * d; i++) {
    const x = rand() * W;
    const y = rand() * hz;
    brush(ctx, x, y, n(x / 500, y / 300, 2) * 0.35 + (rand() - 0.5) * 0.2, 50 + rand() * 170, 8 + rand() * 20, P.skyAt(x, y + (rand() - 0.5) * 60), 0.16 + rand() * 0.14, rand, (rand() - 0.5) * 0.12);
  }
  particles(ctx, only(P, true), "expressive");
  if (sun)
    for (let i = 0; i < 700; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * sun.r;
      const x = sun.x + Math.cos(a) * r;
      const y = sun.y + Math.sin(a) * r;
      if (y > hz) continue;
      brush(ctx, x, y, (rand() - 0.5) * 0.3, 8 + rand() * 18, 4 + rand() * 4, sun.kind === "moon" ? mix([236, 236, 246], [200, 206, 226], rand()) : mix([255, 238, 190], [252, 196, 110], r / sun.r), 0.7, rand);
    }
  clouds(ctx, P, "expressive");
  P.mark?.("sky");
  for (const L of wd.layers) {
    const base = P.colorOf(L);
    ctx.fillStyle = css(base);
    shape(ctx, L, P, 5);
    ctx.fill();
    if (L.kind === "city")
      for (const b of L.blocks) {
        const top = hz - b.h;
        ctx.fillStyle = css(mix(base, [0, 0, 0], rand() * 0.25));
        ctx.fillRect(b.x, top, b.w - 2, b.h + 2);
        for (let wy = top + 8; wy < hz - 6; wy += 11)
          for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += 10)
            if (rand() < (P.dark || wd.time === "dusk" ? 0.4 : 0.15)) {
              ctx.fillStyle = css(P.dark || wd.time === "dusk" ? [255, 214, 140] : mix(base, [255, 255, 255], 0.3), 0.85);
              ctx.fillRect(wx, wy, 4, 6);
            }
      }
    const area = L.kind === "water" ? 2600 : L.kind === "ground" ? 5200 : 1600;
    sample(P, L, area * d, (x, y) => {
      const t = (y - L.top(x)) / Math.max(1, H - L.top(x));
      const lit = sun ? Math.max(0, 1 - Math.abs(x - sun.x) / (W * 0.5)) : 0.3;
      let c = mix(base, [255, 236, 200], lit * 0.25 * (1 - t));
      c = mix(c, [20, 14, 12], t * 0.35);
      if (L.kind === "water") {
        const glint = sun && Math.abs(x - sun.x) < sun.r * (1.2 + t * 2);
        brush(ctx, x, y, (rand() - 0.5) * 0.06, 30 + rand() * 90 * (1 - t * 0.5), 2 + rand() * 4, glint ? mix([255, 230, 170], P.sky[0], rand() * 0.4) : mix(c, P.skyAt(x, hz - (y - hz)), 0.35), glint ? 0.75 : 0.45, rand);
      } else if (L.kind === "mountain") {
        const slope = Math.atan2(L.top(x + 6) - L.top(x - 6), 12);
        brush(ctx, x, y, slope + (rand() - 0.5) * 0.4, 14 + rand() * 30, 4 + rand() * 6, mix(c, x < (sun?.x ?? W / 2) === L.top(x + 6) > L.top(x - 6) ? [255, 230, 200] : [30, 30, 50], 0.18), 0.5, rand);
      } else if (L.kind === "road") {
        brush(ctx, x, y, Math.atan2(y - hz, x - L.vx), 20 + t * 60, 3 + t * 6, c, 0.5, rand);
      } else if (L.kind === "treeline" || L.kind === "city") {
        brush(ctx, x, y, rand() * Math.PI, 6 + rand() * 10, 3 + rand() * 3, mix(c, [0, 0, 0], rand() * 0.3), 0.55, rand);
      } else {
        const grass = ["grass", "field"].includes(L.material);
        brush(ctx, x, y, grass ? -Math.PI / 2 + (rand() - 0.5) * 0.6 : (rand() - 0.5) * 0.3, grass ? 8 + t * 70 : 14 + rand() * 30, grass ? 2 + t * 4 : 5 + rand() * 6, c, 0.4 + t * 0.4, rand, (rand() - 0.5) * 0.3);
      }
    });
  }
  objects(ctx, P, "expressive");
  P.mark?.("world");
  if (fig) paintFigure(ctx, P, "expressive");
  P.mark?.("subject");
  particles(ctx, only(P, false), "expressive");
  if (rand.chance(0.45)) torn(ctx, P);
}

function geometric(ctx, P) {
  const { rand, world: wd, fig } = P;
  const hz = wd.horizon;
  ctx.fillStyle = css(P.sky[P.sky.length - 1]);
  ctx.fillRect(0, 0, W, H);
  if (rand.chance(0.5)) {
    const bands = rand.int(5, 8);
    const tilt = (rand() - 0.5) * 0.12;
    for (let i = 0; i < bands; i++) {
      const y0 = (hz * i) / bands;
      ctx.fillStyle = css(ramp(P.sky, 1 - i / (bands - 1)));
      ctx.beginPath();
      ctx.moveTo(0, y0 - W * tilt * 0.5);
      ctx.lineTo(W, y0 + W * tilt * 0.5);
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.fill();
    }
  } else {
    const pts = [];
    for (let y = -40, row = 0; y <= hz + 80; y += 75, row++) for (let x = -60 + (row % 2) * 45; x <= W + 60; x += 90) pts.push([x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 30]);
    for (const t of delaunay(pts)) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      const c = mix(P.skyAt(cx, cy), [255, 255, 255], (rand() - 0.5) * 0.08);
      ctx.fillStyle = css(c);
      tri(ctx, t);
      ctx.fill();
      ctx.strokeStyle = css(c);
      ctx.stroke();
    }
  }
  particles(ctx, only(P, true), "geometric");
  const sun = wd.lights[0];
  if (sun) {
    const pts = [];
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) pts.push([sun.x + Math.cos(a) * sun.r, sun.y + Math.sin(a) * sun.r]);
    pts.push(...poisson(rand, { w: sun.r * 2, h: sun.r * 2, radius: () => sun.r * 0.28, tries: 400 }).map(([x, y]) => [x + sun.x - sun.r, y + sun.y - sun.r]).filter(([x, y]) => Math.hypot(x - sun.x, y - sun.y) < sun.r * 0.92));
    for (const t of delaunay(pts)) {
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      ctx.fillStyle = css(sun.kind === "moon" ? mix([244, 242, 232], [200, 204, 220], rand() * 0.6) : ramp([[255, 226, 140], [250, 170, 80], [232, 100, 60]], (cy - sun.y + sun.r) / (sun.r * 2) + (rand() - 0.5) * 0.25));
      tri(ctx, t);
      ctx.fill();
    }
  }
  clouds(ctx, P, "geometric");
  P.mark?.("sky");
  for (const L of wd.layers) {
    const base = P.colorOf(L);
    if (L.kind === "city") {
      for (const b of L.blocks) {
        const c = mix(base, [255, 255, 255], (rand() - 0.5) * 0.18);
        ctx.fillStyle = css(c);
        ctx.fillRect(b.x, hz - b.h, b.w - 3, b.h + 3);
        ctx.fillStyle = css(P.dark ? [255, 210, 130] : mix(c, [255, 255, 255], 0.25), 0.9);
        for (let wy = hz - b.h + 10; wy < hz - 8; wy += 16) for (let wx = b.x + 8; wx < b.x + b.w - 10; wx += 14) if (rand() < 0.45) ctx.fillRect(wx, wy, 6, 8);
      }
      continue;
    }
    if (L.kind === "road") {
      ctx.fillStyle = css(base);
      shape(ctx, L, P, 10);
      ctx.fill();
      ctx.fillStyle = css(mix(base, [255, 255, 255], 0.5));
      for (let t = 0.05; t < 1; t += 0.12) {
        const y = hz + (H - hz) * t * t;
        ctx.fillRect(L.vx - 1 - t * 4, y, 2 + t * 8, 6 + t * 30);
      }
      continue;
    }
    const step = L.kind === "mountain" ? rand.range(60, 140) : 120;
    const top = [];
    for (let x = -20; x <= W + 20; x += step) top.push([x, L.top(x)]);
    ctx.fillStyle = css(base);
    ctx.beginPath();
    ctx.moveTo(-20, H + 20);
    for (const p of top) ctx.lineTo(...p);
    ctx.lineTo(W + 20, H + 20);
    ctx.closePath();
    ctx.fill();
    if (L.kind === "water") {
      for (let y = hz + 6; y < L.bottom(W / 2); y += 6 + ((y - hz) / H) * 30) {
        const x = rand() * W;
        ctx.fillStyle = css(mix(base, P.skyAt(x, hz - 40), 0.5), 0.7);
        ctx.fillRect(x - 40 - rand() * 200, y, 80 + rand() * 300, 2 + ((y - hz) / H) * 6);
      }
      if (sun)
        for (let y = hz + 4; y < L.bottom(sun.x) - 4; y += 9) {
          const w = sun.r * (1 - (y - hz) / H) * rand.range(0.5, 1.3);
          ctx.fillStyle = css(sun.kind === "moon" ? [236, 236, 246] : [252, 190, 100], 0.85);
          ctx.fillRect(sun.x - w / 2, y, w, 3.5);
        }
      continue;
    }
    const lo = Math.min(...top.map((p) => p[1]));
    const inside = P.inLayer(L);
    const pts = top.slice();
    pts.push(...poisson(rand, { w: W, h: H - lo, radius: () => (L.kind === "ground" ? 70 : 55), inside: (x, y) => inside(x, y + lo), tries: 4000 }).map(([x, y]) => [x, y + lo]));
    for (let x = -20; x <= W + 20; x += 150) pts.push([x, Math.min(H + 20, L.bottom(x))]);
    for (const t of delaunay(pts)) {
      const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
      const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
      if (!inside(cx, cy)) continue;
      const nx = (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]);
      const shade = Math.tanh(nx / 6000) * 0.12 + (rand() - 0.5) * 0.08;
      const c = mix(base, shade > 0 ? [255, 244, 225] : [10, 10, 20], Math.abs(shade));
      ctx.fillStyle = css(c);
      tri(ctx, t);
      ctx.fill();
      ctx.strokeStyle = css(c);
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
  objects(ctx, P, "geometric");
  P.mark?.("world");
  if (fig) paintFigure(ctx, P, "geometric");
  P.mark?.("subject");
  particles(ctx, only(P, false), "geometric");
  const m = rand.chance(0.5) ? rand.range(18, 34) : 0;
  if (m) {
    ctx.fillStyle = "#f3eee5";
    ctx.fillRect(0, 0, W, m);
    ctx.fillRect(0, H - m, W, m);
    ctx.fillRect(0, 0, m, H);
    ctx.fillRect(W - m, 0, m, H);
  }
}

function organic(ctx, P) {
  const { rand, n, world: wd, fig } = P;
  const hz = wd.horizon;
  const earth = P.dark ? [14, 24, 34] : [92, 66, 40];
  const tint = P.sky.map((c) => mix(c, earth, P.dark ? 0.35 : 0.45));
  const light = wd.lights[0] || { x: P.comp.lightX, y: hz - 200 };
  const g = ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, Math.hypot(W, H) * 0.75);
  tint.forEach((c, i) => g.addColorStop(i / (tint.length - 1), css(c)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.fillStyle = css(mix(tint[Math.floor(rand() * tint.length)], rand() < 0.5 ? [255, 245, 220] : [0, 0, 0], 0.2), 0.03 + rand() * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + rand() * 60, 6 + rand() * 30, n(x / 300, y / 300, 1) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  particles(ctx, only(P, true), "organic");
  if (wd.lights[0]) {
    const s = wd.lights[0];
    for (let i = 0; i < 5000; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * s.r * 1.15;
      ctx.fillStyle = css(s.kind === "moon" ? [235, 240, 255] : mix([255, 240, 200], [240, 160, 80], r / s.r), Math.max(0, 1 - r / (s.r * 1.15)) * 0.9);
      ctx.fillRect(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 1.4, 1.4);
    }
  }
  clouds(ctx, P, "organic");
  P.mark?.("sky");
  for (const L of wd.layers) {
    const base = mix(P.colorOf(L), earth, 0.3);
    ctx.save();
    shape(ctx, L, P, 5);
    ctx.fillStyle = css(base);
    ctx.fill();
    ctx.clip();
    let lo = Infinity;
    for (let x = 0; x <= W; x += 25) lo = Math.min(lo, L.top(x));
    for (let i = 0; i < 500; i++) {
      const x = rand() * W;
      const y = lo + rand() * (H - lo);
      ctx.fillStyle = css(mix(base, rand() < 0.5 ? [255, 240, 210] : [0, 0, 0], 0.25), 0.06);
      ctx.beginPath();
      ctx.ellipse(x, y, 20 + rand() * 80, 6 + rand() * 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const gap = L.kind === "water" ? 7 : L.kind === "mountain" ? 9 : 12;
    const count = Math.ceil((Math.min(H, Math.max(L.bottom(0), L.bottom(W / 2), L.bottom(W))) - lo) / gap) + 4;
    for (let i = 1; i < count; i++) {
      ctx.strokeStyle = css(mix(base, i % 3 ? [255, 236, 200] : [0, 0, 0], 0.3), 0.35);
      ctx.lineWidth = L.kind === "water" ? 1 : 0.8;
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 6) {
        const y = L.kind === "water" ? hz + i * gap * (1 + i * 0.04) + Math.sin(x / (30 + i * 3) + i) * (1 + i * 0.15) : L.top(x) + i * gap + n(x / 180, i * 0.3, 70) * gap * 1.6;
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (L.kind === "city")
      for (const b of L.blocks)
        for (let wy = hz - b.h + 8; wy < hz - 6; wy += 12)
          for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += 11)
            if (rand() < 0.3) {
              ctx.fillStyle = css(P.dark ? [255, 210, 130] : [240, 220, 180], 0.8);
              ctx.fillRect(wx, wy, 3, 4);
            }
    if (L.kind === "water" && wd.lights[0]) {
      const s = wd.lights[0];
      for (let i = 0; i < 1600; i++) {
        const y = hz + rand() ** 1.5 * (L.bottom(s.x) - hz);
        const x = s.x + rand.gauss() * s.r * 0.6 * (1 + (y - hz) / 200);
        ctx.fillStyle = css(s.kind === "moon" ? [235, 240, 255] : [255, 220, 150], 0.6);
        ctx.fillRect(x, y, 2 + rand() * 6, 1.2);
      }
    }
    ctx.restore();
  }
  objects(ctx, P, "organic");
  P.mark?.("world");
  if (fig) paintFigure(ctx, P, "organic");
  P.mark?.("subject");
  for (let i = 0; i < 1400; i++) {
    const x = light.x + rand.gauss() * W * 0.35;
    const y = light.y + rand.gauss() * H * 0.4;
    ctx.fillStyle = css(rand.pick([[255, 242, 207], [233, 201, 122], [184, 135, 62]]), 0.3 + rand() * 0.5);
    ctx.fillRect(x, y, rand() * 2 + 0.4, rand() * 2 + 0.4);
  }
  particles(ctx, only(P, false), "organic");
}

function lines(ctx, P) {
  const { rand, n, world: wd, fig } = P;
  const hz = wd.horizon;
  const paper = [246, 241, 230];
  const ink = P.dark ? [24, 30, 58] : [42, 34, 40];
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, W, H);
  const engrave = (L, angle, gap, valueAt, color) => {
    ctx.save();
    shape(ctx, L, P, 5);
    ctx.clip();
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const span = Math.hypot(W, H) / 2 + 20;
    for (let o = -span; o < span; o += gap) {
      const ox = W / 2 - dy * o;
      const oy = H / 2 + dx * o;
      let px = null;
      let py = null;
      for (let t = -span; t < span; t += 5) {
        const x = ox + dx * t + n(o / 40, t / 200, 4) * 1.2;
        const y = oy + dy * t + n(t / 200, o / 40, 5) * 1.2;
        const v = x > -10 && x < W + 10 && y > -10 && y < H + 10 && !(fig && fig.inside(x, y)) ? valueAt(x, y) : 0;
        if (v > 0.04 && px !== null) {
          ctx.strokeStyle = css(color(x, y), 0.9);
          ctx.lineWidth = v * gap * 0.8;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        px = x;
        py = y;
      }
    }
    ctx.restore();
  };
  const tinted = (c) => mix(ink, c, 0.55);
  const sun = wd.lights[0];
  engrave({ kind: "sky", top: () => -10, bottom: () => hz + 2 }, rand.pick([0, 0, 0.04, -0.04]), rand.range(5.5, 7.5), (x, y) => {
    let v = (1 - luma(P.skyAt(x, y))) * 1.15 + 0.04 + ((hz - y) / hz) * 0.18;
    if (sun) v *= Math.min(1, Math.hypot(x - sun.x, y - sun.y) / (sun.r * 1.15)) ** 0.6;
    return v;
  }, (x, y) => tinted(P.skyAt(x, y)));
  if (sun)
    for (let r = sun.r; r > 4; r -= 7) {
      ctx.strokeStyle = css(tinted([240, 150, 80]), 0.5);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, r, Math.PI, 0);
      ctx.stroke();
    }
  particles(ctx, only(P, true), "lines");
  clouds(ctx, P, "lines");
  P.mark?.("sky");
  const angles = { water: 0, treeline: Math.PI / 2, city: Math.PI / 2, hills: 0.3, road: -0.6 };
  for (const L of wd.layers) {
    const base = P.colorOf(L);
    const ang = L.kind === "mountain" ? (rand.chance(0.5) ? 0.55 : -0.55) : L.kind === "ground" ? rand.pick([0.12, -0.12, 0]) : angles[L.kind] ?? 0.2;
    engrave(L, ang, L.kind === "water" ? 4 : 5, (x, y) => {
      const t = (y - L.top(x)) / Math.max(1, H - hz);
      let v = (1 - luma(base)) * 1.25 + 0.15 + t * 0.3 + n(x / 120, y / 80, 60) * 0.15;
      if (L.kind === "water" && sun && Math.abs(x - sun.x) < sun.r * (1 + t * 3)) v *= 0.25;
      return Math.min(1, v);
    }, () => tinted(base));
    if (L.kind === "city")
      for (const b of L.blocks) {
        ctx.strokeStyle = css(ink, 0.8);
        ctx.lineWidth = 0.9;
        ctx.strokeRect(b.x, hz - b.h, b.w - 2, b.h);
      }
  }
  objects(ctx, P, "lines");
  P.mark?.("world");
  if (fig) paintFigure(ctx, P, "lines");
  P.mark?.("subject");
  particles(ctx, only(P, false), "lines");
  const m = 40;
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, W, m);
  ctx.fillRect(0, H - m, W, m);
  ctx.fillRect(0, 0, m, H);
  ctx.fillRect(W - m, 0, m, H);
  ctx.strokeStyle = css(ink, 0.7);
  ctx.lineWidth = 1;
  ctx.strokeRect(m, m, W - m * 2, H - m * 2);
}

export const DIRECTIONS = { expressive, geometric, organic, lines };

export async function prepare(plan, seed, override = {}) {
  const comp = { ...composition(plan, seed), ...override };
  const rand = random((seed ^ 0x3c6ef372) >>> 0);
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const wd = world(plan, comp, rand, n);
  const fig = await figure(plan, comp, wd, seed);
  const P = { plan, comp, world: wd, fig, rand, n };
  setup(P);
  return P;
}

export async function paint(plan, seed, { scale = 0.5, mark, ...override } = {}) {
  const P = await prepare(plan, seed, override);
  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  P.mark = mark && ((key) => mark(key, canvas));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.lineCap = "round";
  DIRECTIONS[P.comp.direction](ctx, P);
  canvas.meta = { direction: P.comp.direction, framing: P.comp.framing, place: plan.setting.place, time: plan.setting.time, pose: plan.people.pose, focus: P.fig?.focus || [P.comp.focusX, P.world.horizon], light: P.world.lights[0] ? [P.world.lights[0].x, P.world.lights[0].y] : [P.comp.lightX, P.world.horizon * 0.5], horizon: P.world.horizon };
  return canvas;
}
