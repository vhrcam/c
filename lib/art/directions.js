import { noise3 } from "../engine/noise";
import { random } from "../random";
import { colonize } from "./fields";
import { poisson } from "./geometry";
import { stage } from "./subject";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(v)).join(",")},${a})`;
const ramp = (list, t) => {
  const k = Math.min(list.length - 1.0001, Math.max(0, t * (list.length - 1)));
  const i = Math.floor(k);
  return mix(list[i], list[i + 1], k - i);
};

function brush(ctx, x, y, angle, len, width, color, alpha, rand, bend = 0) {
  const bristles = Math.max(3, Math.round(width / 1.6));
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let b = 0; b < bristles; b++) {
    const o = (b / (bristles - 1) - 0.5) * width;
    const l = len * (0.7 + rand() * 0.3);
    const sx = x - dy * o - dx * l * 0.5 + (rand() - 0.5) * 2;
    const sy = y + dx * o - dy * l * 0.5 + (rand() - 0.5) * 2;
    ctx.strokeStyle = css(color.map((v) => v + (rand() - 0.5) * 18), alpha * (0.5 + rand() * 0.5));
    ctx.lineWidth = 1 + rand() * 1.6;
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

function tornEdge(ctx, w, h, paper, rand, n, depth = 90) {
  ctx.fillStyle = paper;
  for (let i = 0; i < 5200; i++) {
    const side = Math.floor(rand() * 4);
    const u = rand();
    const d = rand() ** 3 * depth * (0.3 + (n(u * 9, side, 3) + 1) * 0.6);
    const x = side === 0 ? u * w : side === 1 ? u * w : side === 2 ? d : w - d;
    const y = side === 0 ? d : side === 1 ? h - d : u * h;
    const r = 2 + rand() * 9 * (1 - d / depth);
    const a0 = rand() * Math.PI;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k / 5) * Math.PI * 2;
      const rr = r * (0.4 + rand() * 0.9);
      ctx.lineTo(x + Math.cos(a) * rr * 1.8, y + Math.sin(a) * rr * 0.6);
    }
    ctx.fill();
  }
  ctx.fillRect(0, 0, w, 14);
  ctx.fillRect(0, h - 14, w, 14);
  ctx.fillRect(0, 0, 14, h);
  ctx.fillRect(w - 14, 0, 14, h);
}

const figureAt = (st) => (x, y) => st.F.codeAt(x, y) >= 16;
const edgeOf = (inside, r = 3) => (x, y) => inside(x, y) && (!inside(x + r, y) || !inside(x - r, y) || !inside(x, y + r) || !inside(x, y - r));

async function expressive(ctx, seed) {
  const st = await stage(seed, { shot: random(seed + 1).pick(["medium", "close"]) });
  const { width: w, height: h, F, kx, ky, rng: rand } = st;
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const inside = figureAt(st);
  const glow = [kx + rand.range(-0.08, 0.08) * w, ky - h * rand.range(0.02, 0.12)];
  const sky = ["#fff3cf", "#f7c45c", "#ef8f3a", "#c9522c", "#8c2f2a", "#40211c"].map(rgb);
  const reach = Math.hypot(w, h) * 0.62;
  const paper = "#f5efe4";
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(glow[0], glow[1], 0, glow[0], glow[1], reach);
  sky.forEach((c, i) => g.addColorStop(i / (sky.length - 1), css(c)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) {
    const x = rand() * w;
    const y = rand() * h * 0.95;
    const d = Math.hypot(x - glow[0], y - glow[1]) / reach;
    const a = n(x / 500, y / 400, 2) * 0.5 + (rand() - 0.5) * 0.3;
    brush(ctx, x, y, a, 60 + rand() * 180, 10 + rand() * 24, ramp(sky, d + (rand() - 0.5) * 0.18), 0.14 + rand() * 0.16, rand, (rand() - 0.5) * 0.15);
  }
  const ground = Math.max(st.horizon, h * 0.62);
  for (let i = 0; i < 2400; i++) {
    const x = rand() * w;
    const y = ground + rand() ** 0.7 * (h - ground);
    const t = (y - ground) / (h - ground);
    brush(ctx, x, y, -Math.PI / 2 + (rand() - 0.5) * 0.7, 20 + rand() * 70 * (0.4 + t), 3 + rand() * 4, mix(rgb("#8c2f2a"), rgb("#22130f"), t * 0.8 + rand() * 0.2), 0.35 + t * 0.4, rand, (rand() - 0.5) * 0.3);
  }
  const umber = rgb("#2a1712");
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      if (!inside(x, y)) continue;
      const [lite, dark] = st.pens.fill(st.mat(x, y), st.person(x, y));
      const shade = F.light(x, y) * F.ao(x, y);
      ctx.fillStyle = css(mix(mix(rgb(dark), umber, 0.55), rgb(lite), shade * 0.45));
      ctx.fillRect(x - 0.5, y - 0.5, 3, 3);
    }
  const dir = [0, 0];
  for (let i = 0; i < 26000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    if (!inside(x, y)) continue;
    const m = st.mat(x, y);
    const [lite, dark] = st.pens.fill(m, st.person(x, y));
    F.along(x, y, dir);
    const flowing = m === 2 || m === 3 || m === 6;
    const a = flowing ? Math.atan2(dir[1], dir[0]) : Math.atan2(dir[1], dir[0]) + Math.PI / 2 + (rand() - 0.5) * 0.6;
    const lit = F.light(x, y) * F.ao(x, y);
    const rim = F.rim(x, y);
    const c = rim > 0.3 ? mix(rgb("#ffd98a"), rgb("#fff6dc"), rand()) : mix(mix(rgb(dark), umber, 0.4), mix(rgb(lite), rgb("#f0a85a"), 0.3), lit * 0.9);
    brush(ctx, x, y, a, (flowing ? 14 : 7) + rand() * 10, rim > 0.3 ? 2.5 : 4 + rand() * 3, c, rim > 0.3 ? 0.85 : 0.55, rand, (rand() - 0.5) * 0.25);
  }
  for (let i = 0; i < 260; i++) {
    const x = glow[0] + rand.gauss() * w * 0.25;
    const y = glow[1] + rand.gauss() * h * 0.25;
    ctx.fillStyle = css(rgb(rand.pick(["#fff1c4", "#ffd27a", "#f39a4a"])), 0.5 + rand() * 0.5);
    ctx.beginPath();
    ctx.arc(x, y, rand() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  tornEdge(ctx, w, h, paper, rand, n, 110);
  for (let i = 0; i < 140; i++) {
    const side = rand() < 0.5;
    const x = side ? rand() * w : rand() < 0.5 ? rand() * 120 : w - rand() * 120;
    const y = side ? (rand() < 0.5 ? rand() * 120 : h - rand() * 120) : rand() * h;
    ctx.fillStyle = css(rgb(rand.pick(["#8c2f2a", "#c9522c", "#40211c"])), 0.7);
    ctx.beginPath();
    ctx.arc(x, y, rand() ** 2 * 4 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return { direction: "expressive", shot: st.shot };
}

async function geometric(ctx, seed) {
  const st = await stage(seed, { shot: random(seed + 2).pick(["medium", "medium", "close"]) });
  const { width: w, height: h, kx, ky, rng: rand } = st;
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const inside = figureAt(st);
  const edge = edgeOf(inside, 2);
  const paper = rgb("#ddd5c9");
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = css(mix(paper, rgb("#6b6157"), rand() * 0.5), 0.35);
    ctx.fillRect(rand() * w, rand() * h, 1, 1);
  }
  const accents = ["#e9b44c", "#8fb8de", "#e58fa8", "#c8553d", "#2b3a67", "#f7f3ec", "#5d8a72"].map(rgb);
  const sun = { x: rand.pick([0.2, 0.8]) * w, y: Math.min(st.horizon, h * 0.62), r: h * rand.range(0.16, 0.24) };
  const sunPts = poisson(rand, { w: sun.r * 2, h: sun.r, radius: () => sun.r * 0.12, tries: 3000 }).map(([x, y]) => [x + sun.x - sun.r, y + sun.y - sun.r]).filter(([x, y]) => Math.hypot(x - sun.x, y - sun.y) < sun.r);
  for (let a = 0; a <= Math.PI; a += Math.PI / 14) sunPts.push([sun.x + Math.cos(a) * sun.r, sun.y - Math.sin(a) * sun.r]);
  for (const t of delaunay(sunPts)) {
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    ctx.fillStyle = css(ramp(["#f6d36b", "#f2a04a", "#e0663f"].map(rgb), (cy - (sun.y - sun.r)) / sun.r + (rand() - 0.5) * 0.3), 0.92);
    ctx.beginPath();
    ctx.moveTo(...t[0]);
    ctx.lineTo(...t[1]);
    ctx.lineTo(...t[2]);
    ctx.fill();
  }
  ctx.strokeStyle = css(rgb("#2b2b2b"), 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w * 0.04, sun.y);
  ctx.lineTo(w * 0.96, sun.y);
  ctx.stroke();

  const solid = [rgb(rand.pick(["#c8553d", "#b4483a"])), rgb("#f7f3ec")];
  const split = ky + (h - ky) * rand.range(0.25, 0.45);
  for (let y = 0; y < h; y += 1.5)
    for (let x = 0; x < w; x += 1.5) {
      if (!inside(x, y) || y < split) continue;
      ctx.fillStyle = css(solid[(st.person(x, y) - 1) % 2]);
      ctx.fillRect(x, y, 2, 2);
    }
  const pts = poisson(rand, { w, h, radius: (x, y) => (Math.hypot(x - kx, y - ky) < h * 0.15 ? 7 : 14), inside: (x, y) => inside(x, y) && y < split + 30, tries: 60000 });
  for (let y = 0; y < split + 30; y += 6) for (let x = 0; x < w; x += 6) if (edge(x, y)) pts.push([x, y]);
  const away = rand.pick([[1, -0.6], [-1, -0.6], [0.3, -1]]);
  const al = Math.hypot(...away);
  for (const t of delaunay(pts)) {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    if (!inside(cx, cy)) continue;
    const [lite, dark] = st.pens.fill(st.mat(cx, cy), st.person(cx, cy));
    const lit = st.F.light(cx, cy) * st.F.ao(cx, cy);
    let c = mix(rgb(dark), rgb(lite), lit);
    if (rand() < 0.3) c = rand.pick(accents);
    const along = ((cx - kx) * away[0] + (cy - ky) * away[1]) / al / (h * 0.3) + n(cx / 160, cy / 160, 5) * 0.4;
    const s = Math.min(1, Math.max(0, (along - 0.35) / 0.6));
    if (s > 0 && rand() < s * 0.35) continue;
    const off = s * s * h * 0.35 * (0.5 + rand());
    const rot = s * (rand() - 0.5) * 1.6;
    const k = 1 - s * 0.45;
    ctx.save();
    ctx.translate(cx + (away[0] / al) * off + (rand() - 0.5) * s * 60, cy + (away[1] / al) * off + (rand() - 0.5) * s * 60);
    ctx.rotate(rot);
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.moveTo(t[0][0] - cx, t[0][1] - cy);
    ctx.lineTo(t[1][0] - cx, t[1][1] - cy);
    ctx.lineTo(t[2][0] - cx, t[2][1] - cy);
    ctx.closePath();
    ctx.fillStyle = css(c);
    ctx.fill();
    if (rand() < 0.45) {
      ctx.strokeStyle = css(rand() < 0.5 ? rgb("#2b2b2b") : rgb("#f7f3ec"), 0.6);
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    ctx.restore();
  }
  for (let i = 0; i < 900; i++) {
    const r = rand() ** 0.6;
    const x = kx + (away[0] / al) * r * h * 0.6 + rand.gauss() * h * 0.12;
    const y = ky + (away[1] / al) * r * h * 0.6 + rand.gauss() * h * 0.12;
    const s = 1.5 + rand() * 7 * (1 - r);
    const a = rand() * Math.PI * 2;
    ctx.fillStyle = css(rand.pick([...accents, rgb("#2b2b2b")]), 0.85);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    ctx.lineTo(x + Math.cos(a + 2.1) * s * 0.7, y + Math.sin(a + 2.1) * s * 0.7);
    ctx.lineTo(x + Math.cos(a + 4.2) * s * 0.9, y + Math.sin(a + 4.2) * s * 0.9);
    ctx.fill();
  }
  return { direction: "geometric", shot: st.shot };
}

async function organic(ctx, seed) {
  const st = await stage(seed, { shot: "close" });
  const { width: w, height: h, kx, ky, rng: rand } = st;
  const n3 = noise3(seed);
  const n = (x, y, z = 0) => n3(x, y, z, 2);
  const inside = figureAt(st);
  const edge = edgeOf(inside, 3);
  const light = [kx + rand.range(-0.25, 0.25) * w, ky - h * 0.1];
  const g = ctx.createRadialGradient(light[0], light[1], 0, light[0], light[1], Math.hypot(w, h) * 0.6);
  ["#efe0b8", "#d9b878", "#a9824c", "#5c4129", "#241a12"].forEach((c, i) => g.addColorStop(i / 4, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = css(rgb(rand.pick(["#f3e6c4", "#8a6a3e", "#3a2a1c", "#c9a464"])), 0.03 + rand() * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + rand() * 60, 6 + rand() * 30, n(x / 300, y / 300, 1) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const deep = rgb("#1b140f");
  const warmDark = rgb("#5a4028");
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      if (!inside(x, y)) continue;
      const lit = st.F.light(x, y) * st.F.ao(x, y);
      const mottle = (n(x / 40, y / 40, 8) + 1) / 2;
      ctx.fillStyle = css(mix(deep, warmDark, lit * 0.55 + mottle * 0.35));
      ctx.fillRect(x - 0.5, y - 0.5, 3, 3);
    }
  for (let i = 0; i < 16000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    if (!inside(x, y)) continue;
    const lit = st.F.light(x, y) + st.F.rim(x, y);
    ctx.fillStyle = css(rgb(rand.pick(["#c9a464", "#e9d3a0", "#8a6a3e"])), Math.min(0.8, lit * 0.5));
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  const away = [light[0] < kx ? 1 : -1, -0.2];
  for (let i = 0; i < 70000; i++) {
    const x = rand() * w;
    const y = rand() * h;
    if (!edge(x, y)) continue;
    const trail = Math.max(0, n(x / 120, y / 120, 9) + 0.2 + (away[0] * (x - kx)) / (w * 0.3));
    if (rand() > trail * 0.5) continue;
    const d = rand() ** 2 * 260 * trail;
    const px = x + away[0] * d + rand.gauss() * d * 0.25;
    const py = y + away[1] * d + rand.gauss() * d * 0.25;
    const s = 0.6 + rand() * 3 * (1 - d / 300);
    ctx.fillStyle = css(rand() < 0.75 ? deep : rgb("#e9c97a"), 0.9 - d / 400);
    ctx.fillRect(px, py, s, s * (0.5 + rand()));
  }
  const attractors = [];
  for (let t = 0; attractors.length < 520 && t < 300000; t++) {
    const x = rand() * w;
    const y = rand() * h;
    if (inside(x, y)) attractors.push([x, y]);
  }
  const roots = [{ x: kx, y: ky + 4, dx: 0, dy: 1 }, ...[0, 1].map(() => attractors[Math.floor(rand() * attractors.length)]).map(([x, y]) => ({ x, y, dx: 0, dy: -1 }))];
  const veins = colonize({ roots, attractors, influence: 90, kill: 9, step: 5, iterations: 170 });
  const outside = [];
  for (let t = 0; outside.length < 260 && t < 200000; t++) {
    const x = rand() * w;
    const y = rand() * h;
    if (!inside(x, y) && (x - kx) * away[0] < 0 && Math.hypot(x - kx, y - ky) < h * 0.55) outside.push([x, y]);
  }
  const edgePts = [];
  for (let t = 0; edgePts.length < 4 && t < 200000; t++) {
    const x = rand() * w;
    const y = rand() * h;
    if (edge(x, y) && (x - kx) * away[0] < 0) edgePts.push({ x, y, dx: -away[0], dy: 0 });
  }
  const tendrils = edgePts.length ? colonize({ roots: edgePts, attractors: outside, influence: 110, kill: 10, step: 6, iterations: 140 }) : [];
  const top = Math.max(1, ...veins.map((p) => p.weight));
  const stroke = (p, base, color, alpha) => {
    ctx.strokeStyle = css(rgb(color), alpha);
    ctx.lineWidth = base;
    ctx.beginPath();
    ctx.moveTo(p.pts[0], p.pts[1]);
    for (let k = 2; k < p.pts.length; k += 2) ctx.lineTo(p.pts[k], p.pts[k + 1]);
    ctx.stroke();
  };
  ctx.lineCap = "round";
  for (const p of tendrils) stroke(p, 0.6 + Math.sqrt(p.weight / top) * 3, "#2a1d14", 0.8);
  for (const p of veins) stroke(p, (0.5 + Math.sqrt(p.weight / top) * 4) * 3, "#f3d48a", 0.12);
  for (const p of veins) stroke(p, 0.4 + Math.sqrt(p.weight / top) * 2.2, "#fff2cf", 0.9);
  for (let i = 0; i < 1600; i++) {
    const x = light[0] + rand.gauss() * w * 0.3;
    const y = light[1] + rand.gauss() * h * 0.35;
    ctx.fillStyle = css(rgb(rand.pick(["#fff2cf", "#e9c97a", "#b8873e"])), 0.4 + rand() * 0.5);
    ctx.fillRect(x, y, rand() * 2 + 0.4, rand() * 2 + 0.4);
  }
  return { direction: "organic", shot: st.shot };
}

export const DIRECTIONS = { expressive, geometric, organic };

export async function paint(direction, seed, scale = 0.5) {
  const canvas = document.createElement("canvas");
  canvas.width = 1500 * scale;
  canvas.height = 1000 * scale;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.meta = await DIRECTIONS[direction](ctx, seed);
  return canvas;
}
