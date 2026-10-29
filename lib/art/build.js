import { isolines } from "./fields";
import { poisson } from "./geometry";
import { H, W } from "./world";

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(",")},${a})`;
const luma = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;

export function brush(ctx, x, y, angle, len, width, color, alpha, rand, bend = 0) {
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

export function delaunay(pts) {
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
          const k = u < v ? u * 65536 + v : v * 65536 + u;
          edges.set(k, edges.has(k) ? null : [u, v]);
        }
      } else keep.push(t);
    }
    for (const e of edges.values()) if (e) keep.push(circ(e[0], e[1], i));
    tris = keep;
  }
  return tris.filter((t) => t.a < n && t.b < n && t.c < n).map((t) => [P[t.a], P[t.b], P[t.c]]);
}

function torn(ctx, rand, n, paper = "#f5efe4") {
  ctx.fillStyle = paper;
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

function margin(ctx, m, paper, ink) {
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, W, m);
  ctx.fillRect(0, H - m, W, m);
  ctx.fillRect(0, 0, m, H);
  ctx.fillRect(W - m, 0, m, H);
  if (ink) {
    ctx.strokeStyle = css(ink, 0.7);
    ctx.lineWidth = 1;
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
  }
}

const later = (P, fn) => (P.finish ? P.finish.push(fn) : fn());

function weather(ctx, P, mode) {
  const { rand, world: wd } = P;
  // fireworks are light: drawn crisp over the finished sky, trails drooping as they fall, never across a person
  for (const o of wd.objects) {
    if (o.kind !== "firework" || !P.B || mode === "ink") continue;
    const col = [1, 3, 5].map((i) => parseInt(o.hue.slice(i, i + 2), 16));
    const open = (x, y) => !["figure", "thing", "tree", "house", "lamp"].includes(P.B.regionAt(x, y).kind);
    if (open(o.x, o.y)) {
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * 1.5);
      g.addColorStop(0, css(mix(col, [255, 255, 255], 0.5), 0.35));
      g.addColorStop(1, css(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(o.x - o.r * 1.5, o.y - o.r * 1.5, o.r * 3, o.r * 3);
    }
    const rays = 44;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + rand() * 0.08;
      const r = o.r * (0.7 + rand() * 0.35);
      let px = o.x;
      let py = o.y;
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const nx = o.x + Math.cos(a) * r * t;
        const ny = o.y + Math.sin(a) * r * t + r * 0.28 * t * t;
        if (open(nx, ny)) {
          ctx.strokeStyle = css(mix(col, [255, 255, 255], 0.45 * (1 - t)), 0.95 * (1 - t * 0.55));
          ctx.lineWidth = 1.8 * (1 - t * 0.5);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx, ny);
          ctx.stroke();
        }
        px = nx;
        py = ny;
      }
      if (open(px, py)) {
        ctx.fillStyle = css(mix(col, [255, 255, 255], 0.6), 0.9);
        ctx.fillRect(px - 1.3, py - 1.3, 2.6, 2.6);
      }
    }
  }
  for (const p of wd.particles) {
    if (p.kind === "rain") {
      ctx.strokeStyle = css(P.dark ? [200, 210, 230] : mode === "ink" ? [60, 66, 80] : [236, 240, 246], 0.45);
      ctx.lineWidth = mode === "flat" ? 1.2 : 0.8;
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
        ctx.fillStyle = css(mode === "ink" ? [60, 66, 80] : [255, 255, 255], 0.5 + rand() * 0.5);
        const s = 1 + rand() ** 2 * 4;
        if (mode === "flat") ctx.fillRect(rand() * W, rand() * H, s, s);
        else {
          ctx.beginPath();
          ctx.arc(rand() * W, rand() * H, s * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    // stars go on last and only into open sky, so no construction smears them and nobody wears them
    if (p.kind === "stars" && P.B) {
      const top = Math.min(wd.horizon, H);
      for (let i = 0; i < p.count; i++) {
        let x = rand() * W;
        let y = rand() * top;
        if (p.band && i % 3 === 0) {
          const t = rand();
          x = t * W;
          y = top * (0.12 + 0.55 * t) + rand.gauss() * H * 0.045;
        }
        if (P.B.regionAt(x, y).kind !== "sky") continue;
        const s = rand() ** 4 * 2.8 + 0.5;
        ctx.fillStyle = css([255, 248, 232], 0.4 + rand() * 0.6);
        ctx.fillRect(x, y, s, s);
        if (s > 2.6) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, s * 4);
          g.addColorStop(0, css([255, 244, 220], 0.35));
          g.addColorStop(1, css([255, 244, 220], 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - s * 4, y - s * 4, s * 8, s * 8);
        }
      }
    }
    if (p.kind === "birds")
      for (let i = 0; i < p.count; i++) {
        const x = W * rand.range(0.1, 0.9);
        const y = Math.min(wd.horizon, H) * rand.range(0.15, 0.7);
        const s = 5 + rand() * 9;
        ctx.strokeStyle = css(P.dark ? [230, 230, 240] : [40, 34, 34], 0.8);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s * 0.3);
        ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
        ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * 0.3);
        ctx.stroke();
      }
    if (p.kind === "bokeh" && mode !== "ink")
      for (let i = 0; i < p.count; i++) {
        const x = rand() * W;
        const y = rand() * H;
        const r = 8 + rand() ** 2 * 50;
        const c = rand.pick([[255, 214, 140], [255, 180, 120], [180, 210, 255]]);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, css(c, 0.3));
        g.addColorStop(1, css(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
  }
}

function edgeTangent(B, x, y) {
  const id = B.idAt(x, y);
  const h = B.idAt(x + 2, y) !== id || B.idAt(x - 2, y) !== id;
  const v = B.idAt(x, y + 2) !== id || B.idAt(x, y - 2) !== id;
  return h && !v ? Math.PI / 2 : v && !h ? 0 : Math.PI / 4;
}

function posterFigure(ctx, B, P, levels) {
  const { fig } = P;
  if (!fig) return;
  const [x0, y0, x1, y1] = fig.box.map((v, i) => (i % 2 ? Math.max(0, Math.min(H, v)) : Math.max(0, Math.min(W, v))));
  const ink = P.dark ? [10, 12, 22] : [30, 24, 26];
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      if (!fig.inside(x, y)) continue;
      const [lite, dark] = fig.fill(fig.mat(x, y), fig.person(x, y)).map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
      const v = Math.min(levels, Math.floor(fig.light(x, y) * levels * 1.1)) / levels;
      ctx.fillStyle = css(fig.rim(x, y) > 0.4 ? mix(lite, [255, 226, 170], 0.5) : mix(dark, lite, v));
      ctx.fillRect(x - 0.2, y - 0.2, 2.4, 2.4);
    }
  for (let y = y0; y < y1; y += 1.5)
    for (let x = x0; x < x1; x += 1.5) {
      const c = fig.code(x, y);
      if (c < 16) continue;
      const outer = !fig.inside(x + 2.5, y) || !fig.inside(x - 2.5, y) || !fig.inside(x, y + 2.5) || !fig.inside(x, y - 2.5);
      if (!outer && fig.code(x + 2, y) === c && fig.code(x, y + 2) === c) continue;
      ctx.fillStyle = css(ink, outer ? 0.9 : 0.5);
      ctx.fillRect(x, y, outer ? 2 : 1.2, outer ? 2 : 1.2);
    }
}

function strokes(ctx, B, P) {
  const { rand, n } = P;
  ctx.drawImage(B.canvas, 0, 0, W, H);
  const d = P.comp.density;
  const s = P.fig ? Math.max(0.6, Math.min(3, P.fig.k * 0.9)) : 1;
  const hz = P.world.horizon;
  const mark = (x, y, fine) => {
    const r = B.regionAt(x, y);
    const c = B.color(x, y);
    const m = r.material;
    const a = B.orient(x, y);
    const k = fine ? 0.6 : 1;
    if (r.kind === "figure") {
      const along = m === "hair" ? a : a + Math.PI / 2 + (rand() - 0.5) * 0.6;
      brush(ctx, x, y, along, (6 + rand() * 9) * s * k, (3 + rand() * 3) * s * k, c, 0.65, rand, (rand() - 0.5) * 0.25);
    } else if (m === "sky" || m === "cloud" || m === "sun" || m === "moon") brush(ctx, x, y, n(x / 500, y / 300, 2) * 0.35 + (rand() - 0.5) * 0.2, (50 + rand() * 150) * k, (8 + rand() * 18) * k, c, 0.22, rand, (rand() - 0.5) * 0.12);
    else if (m === "water") brush(ctx, x, y, (rand() - 0.5) * 0.06, (30 + rand() * 90) * k, 2 + rand() * 4, c, 0.5, rand);
    else if (m === "grass" || m === "field") {
      const t = Math.max(0, (y - hz) / Math.max(1, H - hz));
      brush(ctx, x, y, -Math.PI / 2 + (rand() - 0.5) * 0.6, (8 + t * 70) * k, 2 + t * 4, c, 0.5, rand, (rand() - 0.5) * 0.3);
    } else if (m === "foliage" || m === "flower") brush(ctx, x, y, rand() * Math.PI, (6 + rand() * 12) * k, 3 + rand() * 4, c, 0.65, rand);
    else brush(ctx, x, y, a + (rand() - 0.5) * 0.4, (14 + rand() * 30) * k, (4 + rand() * 6) * k, c, 0.5, rand);
  };
  for (let i = 0; i < 7000 * d; i++) mark(rand() * W, rand() * H, false);
  for (let i = 0; i < 16000 * d; i++) {
    const x = rand() * W;
    const y = rand() * H;
    if (rand() < B.imp(x, y) ** 1.5) mark(x, y, true);
  }
  for (let y = 2; y < H; y += 3)
    for (let x = 2; x < W; x += 3) {
      if (!B.edge(x, y, 2) || rand() > 0.45) continue;
      const r = B.regionAt(x, y);
      if (r.kind === "sky" || r.kind === "cloud") continue;
      const c = mix(B.color(x, y), r.kind === "figure" && P.fig?.rim(x, y) > 0.3 ? [255, 228, 170] : [16, 10, 8], 0.45);
      brush(ctx, x, y, edgeTangent(B, x, y), 5 * s, 1.6 * s, c, 0.5, rand);
    }
  later(P, () => weather(ctx, P, "paint"));
  if (rand.chance(0.45)) later(P, () => torn(ctx, rand, n));
}

function facets(ctx, B, P) {
  const { rand } = P;
  ctx.drawImage(B.canvas, 0, 0, W, H);
  const pts = [];
  const leaf = (x, y, s) => {
    const xs = [x + 1, x + s / 2, x + s - 1];
    const ids = new Set();
    let imp = 0;
    let lum0 = 2;
    let lum1 = -1;
    for (const a of xs)
      for (const b of [y + 1, y + s / 2, y + s - 1]) {
        ids.add(B.idAt(a, b));
        imp = Math.max(imp, B.imp(a, b));
        const l = B.lum(a, b);
        lum0 = Math.min(lum0, l);
        lum1 = Math.max(lum1, l);
      }
    const limit = 120 - imp * 95;
    if (s > 7 && (ids.size > 1 || lum1 - lum0 > 0.08 || s > limit)) {
      const h = s / 2;
      leaf(x, y, h);
      leaf(x + h, y, h);
      leaf(x, y + h, h);
      leaf(x + h, y + h, h);
    } else pts.push([x + s / 2 + (rand() - 0.5) * s * 0.7, y + s / 2 + (rand() - 0.5) * s * 0.7]);
  };
  for (let y = 0; y < H; y += 128) for (let x = 0; x < W; x += 128) leaf(x, y, 128);
  for (let x = -20; x <= W + 20; x += 60) pts.push([x, -20], [x, H + 20]);
  for (let y = 40; y < H; y += 60) pts.push([-20, y], [W + 20, y]);
  const keep = pts.length > 4200 ? pts.filter((_, i) => i % Math.ceil(pts.length / 4200) === 0 || B.imp(..._) > 0.8) : pts;
  for (const t of delaunay(keep)) {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const nx = (t[1][1] - t[0][1]) * (t[2][0] - t[0][0]) - (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]);
    const shade = Math.tanh(nx / 9000) * 0.06 + (rand() - 0.5) * 0.05;
    const c = mix(B.color(cx, cy), shade > 0 ? [255, 246, 228] : [8, 8, 18], Math.abs(shade));
    ctx.fillStyle = css(c);
    ctx.strokeStyle = css(c);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(...t[0]);
    ctx.lineTo(...t[1]);
    ctx.lineTo(...t[2]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  posterFigure(ctx, B, P, rand.pick([2, 3, 3, 4]));
  later(P, () => weather(ctx, P, "flat"));
  if (rand.chance(0.5)) later(P, () => margin(ctx, rand.range(18, 34), [243, 238, 229]));
}

function neighbors(sites, k) {
  const cell = 40;
  const gw = Math.ceil(W / cell) + 2;
  const grid = new Map();
  sites.forEach((p, i) => {
    const key = (Math.floor(p[1] / cell) + 1) * gw + Math.floor(p[0] / cell) + 1;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  return sites.map((p, i) => {
    const cx = Math.floor(p[0] / cell) + 1;
    const cy = Math.floor(p[1] / cell) + 1;
    const near = [];
    for (let r = 1; near.length < k * 2 && r < 6; r++) {
      near.length = 0;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) for (const j of grid.get(y * gw + x) || []) if (j !== i) near.push(j);
    }
    return near.sort((a, b) => (sites[a][0] - p[0]) ** 2 + (sites[a][1] - p[1]) ** 2 - ((sites[b][0] - p[0]) ** 2 + (sites[b][1] - p[1]) ** 2)).slice(0, k);
  });
}

function clip(poly, nx, ny, d) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = a[0] * nx + a[1] * ny - d;
    const db = b[0] * nx + b[1] * ny - d;
    if (da <= 0) out.push(a);
    if (da * db < 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

function mosaic(ctx, B, P) {
  const { rand } = P;
  const grout = P.dark ? [14, 13, 16] : [236, 230, 218];
  ctx.fillStyle = css(grout);
  ctx.fillRect(0, 0, W, H);
  const radius = (x, y) => 6 + (1 - B.imp(x, y)) ** 1.3 * 30;
  const sites = poisson(rand, { w: W, h: H, radius, tries: 26000 });
  const near = neighbors(sites, 22);
  const gap = rand.range(0.8, 2);
  sites.forEach((p, i) => {
    const R = radius(p[0], p[1]) * 2.2 + 3;
    let poly = [[p[0] - R, p[1] - R], [p[0] + R, p[1] - R], [p[0] + R, p[1] + R], [p[0] - R, p[1] + R]];
    for (const j of near[i]) {
      const q = sites[j];
      const nx = q[0] - p[0];
      const ny = q[1] - p[1];
      const l = Math.hypot(nx, ny) || 1;
      poly = clip(poly, nx / l, ny / l, ((nx / l) * (p[0] + q[0])) / 2 + ((ny / l) * (p[1] + q[1])) / 2 - gap / 2);
      if (poly.length < 3) return;
    }
    const c = B.color(p[0], p[1]).map((v) => v + (rand() - 0.5) * 10);
    ctx.fillStyle = css(c);
    ctx.beginPath();
    poly.forEach((v, k) => (k ? ctx.lineTo(...v) : ctx.moveTo(...v)));
    ctx.closePath();
    ctx.fill();
  });
  later(P, () => weather(ctx, P, "flat"));
}

function contours(ctx, B, P) {
  const { rand } = P;
  const dark = P.dark;
  const paper = dark ? [16, 18, 28] : [244, 239, 228];
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = dark ? 0.35 : 0.28;
  ctx.drawImage(B.canvas, 0, 0, W, H);
  ctx.globalAlpha = 1;
  const cell = 4;
  const gw = Math.ceil(W / cell) + 1;
  const gh = Math.ceil(H / cell) + 1;
  const L = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) L[j * gw + i] = B.lum(i * cell, j * cell) + P.n(i / 18, j / 18, 31) * 0.035;
  const S = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++)
    for (let i = 0; i < gw; i++) {
      let s = 0;
      let k = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= gw || b >= gh) continue;
          s += L[b * gw + a];
          k++;
        }
      S[j * gw + i] = s / k;
    }
  const count = rand.int(14, 22);
  const levels = Array.from({ length: count }, (_, i) => 0.04 + (i / count) * 0.92);
  const lines = isolines((x, y) => S[Math.min(gh - 1, Math.round(y / cell)) * gw + Math.min(gw - 1, Math.round(x / cell))], { w: W, h: H, cell, levels });
  ctx.lineJoin = "round";
  for (const l of lines) {
    if (l.pts.length < 8) continue;
    const m = Math.floor(l.pts.length / 4) * 2;
    const x = l.pts[m];
    const y = l.pts[m + 1];
    const c = B.color(x, y);
    ctx.strokeStyle = css(dark ? mix(c, [255, 255, 255], 0.35) : mix(c, [20, 16, 18], 0.45), 0.9);
    ctx.lineWidth = 0.7 + B.imp(x, y) * 1.1;
    ctx.beginPath();
    for (let k = 0; k < l.pts.length; k += 2) (k ? ctx.lineTo : ctx.moveTo).call(ctx, l.pts[k], l.pts[k + 1]);
    ctx.stroke();
  }
  const E = (x, y) => (B.idAt(x, y) !== B.idAt(x + 3, y) || B.idAt(x, y) !== B.idAt(x, y + 3) ? 1 : 0);
  for (const l of isolines(E, { w: W, h: H, cell: 3, levels: [0.5] })) {
    if (l.pts.length < 6) continue;
    ctx.strokeStyle = css(dark ? [236, 232, 220] : [26, 22, 26], 0.8);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let k = 0; k < l.pts.length; k += 2) (k ? ctx.lineTo : ctx.moveTo).call(ctx, l.pts[k], l.pts[k + 1]);
    ctx.stroke();
  }
  later(P, () => weather(ctx, P, "ink"));
  later(P, () => margin(ctx, 36, paper, dark ? [220, 220, 230] : [40, 34, 40]));
}

function engraving(ctx, B, P) {
  const { rand, n } = P;
  const paper = [246, 241, 230];
  const ink = P.dark ? [24, 30, 58] : [42, 34, 40];
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, W, H);
  const g = rand.range(4.2, 5.6);
  ctx.lineCap = "round";
  for (let y = 0; y < H; y += g)
    for (let x = (y / g) % 2 ? g / 2 : 0; x < W; x += g) {
      const px = x + (rand() - 0.5) * 1.2;
      const py = y + (rand() - 0.5) * 1.2;
      const c = B.color(px, py);
      const v = Math.min(1, (1 - luma(c)) * 1.25 + 0.06 + n(px / 120, py / 80, 60) * 0.1);
      if (v < 0.07) continue;
      const r = B.regionAt(px, py);
      const a = r.kind === "sky" || r.kind === "cloud" ? n(py / 300, px / 900, 5) * 0.08 : B.orient(px, py) + (r.kind === "figure" ? Math.PI / 2 : 0);
      const l = g * 0.85;
      ctx.strokeStyle = css(mix(ink, c, 0.45), 0.9);
      ctx.lineWidth = v * g * 0.75;
      ctx.beginPath();
      ctx.moveTo(px - Math.cos(a) * l, py - Math.sin(a) * l);
      ctx.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      ctx.stroke();
      if (v > 0.62 && r.kind !== "sky") {
        ctx.lineWidth = (v - 0.55) * g * 0.8;
        ctx.beginPath();
        ctx.moveTo(px + Math.sin(a) * l, py - Math.cos(a) * l);
        ctx.lineTo(px - Math.sin(a) * l, py + Math.cos(a) * l);
        ctx.stroke();
      }
    }
  for (let y = 1; y < H; y += 2)
    for (let x = 1; x < W; x += 2)
      if (B.edge(x, y, 1.5) && B.regionAt(x, y).kind !== "sky") {
        ctx.fillStyle = css(ink, 0.55);
        ctx.fillRect(x, y, 1.2, 1.2);
      }
  later(P, () => weather(ctx, P, "ink"));
  later(P, () => margin(ctx, 40, paper, ink));
}

function stipple(ctx, B, P) {
  const { rand } = P;
  const dark = P.dark || rand.chance(0.3);
  const bg = dark ? [12, 12, 18] : [245, 240, 230];
  ctx.fillStyle = css(bg);
  ctx.fillRect(0, 0, W, H);
  const net = new Map();
  const sample = Array.from({ length: 3000 }, () => B.lum(rand() * W, rand() * H)).sort((a, b) => a - b);
  const lo = sample[150];
  const hi = sample[2850];
  const tone = (l) => Math.min(1, Math.max(0, (l - lo) / Math.max(0.05, hi - lo)));
  for (let i = 0; i < 120000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const c = B.color(x, y);
    const t = tone(luma(c));
    const v = dark ? t : 1 - t;
    const imp = B.imp(x, y);
    if (rand() > Math.min(1, 0.06 + v ** 1.15 * 0.8 + imp * 0.14)) continue;
    ctx.fillStyle = css(dark ? mix(c, [255, 255, 255], 0.25 + v * 0.3) : mix(c, [20, 16, 18], 0.2 + v * 0.3), 0.9);
    const r = 0.7 + v * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (imp > 0.7 && rand() < 0.06) {
      const id = B.idAt(x, y);
      if (!net.has(id)) net.set(id, []);
      net.get(id).push([x, y, c]);
    }
  }
  for (const pts of net.values()) {
    const near = neighbors(pts, 2);
    pts.forEach((p, i) => {
      for (const j of near[i]) {
        const q = pts[j];
        if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 26) continue;
        ctx.strokeStyle = css(dark ? mix(p[2], [255, 255, 255], 0.4) : mix(p[2], [0, 0, 0], 0.4), 0.45);
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      }
    });
  }
  later(P, () => weather(ctx, P, dark ? "paint" : "ink"));
}

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

function growth(ctx, B, P) {
  const { rand, n, world: wd, fig } = P;
  const earth = P.dark ? [14, 24, 34] : [92, 66, 40];
  ctx.drawImage(B.canvas, 0, 0, W, H);
  ctx.fillStyle = css(earth, P.dark ? 0.3 : 0.22);
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.fillStyle = css(mix(B.color(x, y), rand() < 0.5 ? [255, 245, 220] : [0, 0, 0], 0.22), 0.05 + rand() * 0.05);
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + rand() * 60, 6 + rand() * 30, n(x / 300, y / 300, 1) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const hz = wd.horizon;
  for (const L of wd.layers) {
    if (L.kind === "road") continue;
    const gap = L.kind === "water" ? 7 : L.kind === "mountain" ? 9 : 12;
    let lo = Infinity;
    for (let x = 0; x <= W; x += 25) lo = Math.min(lo, L.top(x));
    const count = Math.min(80, Math.ceil((Math.min(H, Math.max(L.bottom(0), L.bottom(W / 2), L.bottom(W))) - lo) / gap) + 4);
    for (let i = 1; i < count; i++) {
      ctx.beginPath();
      let started = false;
      for (let x = -10; x <= W + 10; x += 6) {
        const y = L.kind === "water" ? hz + i * gap * (1 + i * 0.04) + Math.sin(x / (30 + i * 3) + i) * (1 + i * 0.15) : L.top(x) + i * gap + n(x / 180, i * 0.3, 70) * gap * 1.6;
        const inside = y > L.top(x) && y < L.bottom(x) && B.regionAt(x, y).kind !== "figure";
        if (!inside) {
          started = false;
          continue;
        }
        if (!started) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        started = true;
      }
      const c = B.color(W / 2, Math.min(H - 1, lo + i * gap));
      ctx.strokeStyle = css(mix(c, i % 3 ? [255, 236, 200] : [0, 0, 0], 0.3), 0.35);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }
  for (const o of wd.objects)
    if (o.kind === "tree" && !o.front) branch(ctx, o.x, o.base, -Math.PI / 2 + (rand() - 0.5) * 0.1, o.h * 0.32, Math.max(1, o.h * 0.035), o.conifer ? 6 : 8, rand, P.dark ? [8, 12, 16] : [40, 28, 18], 0.75);
  if (fig) {
    const [x0, y0, x1, y1] = fig.box.map((v, i) => (i % 2 ? Math.max(0, Math.min(H, v)) : Math.max(0, Math.min(W, v))));
    const deep = P.dark ? [3, 4, 9] : [27, 20, 15];
    const lift = P.dark ? [40, 46, 70] : [110, 82, 52];
    const glow = P.dark ? [190, 220, 255] : [255, 230, 170];
    for (let y = y0; y < y1; y += 2)
      for (let x = x0; x < x1; x += 2) {
        if (!fig.inside(x, y)) continue;
        ctx.fillStyle = css(mix(deep, lift, fig.light(x, y) * 0.5 + ((n(x / 40, y / 40, 8) + 1) / 2) * 0.3));
        ctx.fillRect(x - 0.5, y - 0.5, 3, 3);
        if (!fig.inside(x + 3, y) || !fig.inside(x - 3, y) || !fig.inside(x, y - 3)) {
          ctx.fillStyle = css(glow, P.dark ? 0.75 : 0.4);
          ctx.fillRect(x, y, 1.6, 1.6);
        }
      }
    const s = Math.max(0.6, Math.min(3, fig.k * 0.9));
    for (let v = 0; v < 4 + rand.int(0, 2); v++) {
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
  const light = wd.lights[0] || { x: P.comp.lightX, y: Math.min(hz, H) * 0.5 };
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = css(rand.pick([[255, 242, 207], [233, 201, 122], [184, 135, 62]]), 0.3 + rand() * 0.5);
    ctx.fillRect(light.x + rand.gauss() * W * 0.35, light.y + rand.gauss() * H * 0.4, rand() * 2 + 0.4, rand() * 2 + 0.4);
  }
  later(P, () => weather(ctx, P, "paint"));
}

export const CONSTRUCTIONS = { expressive: strokes, geometric: facets, organic: growth, lines: engraving, mosaic, contours, stipple };
