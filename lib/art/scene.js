import { random } from "../random";
import { H, W, tone } from "./world";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(",")},${a})`;

const MATERIAL = { 1: "skin", 2: "hair", 4: "cloth", 5: "cloth", 6: "cloth", 7: "shoe", 9: "cloth", 10: "object", 11: "fur", 12: "fur", 13: "dark", 14: "beak", 15: "fur" };

function layerPath(ctx, L, P) {
  ctx.beginPath();
  if (L.kind === "road") {
    const hz = P.world.horizon;
    const s = P.comp.roadSpread;
    [[L.vx - 2, hz], [L.vx + 2, hz], [L.vx + (H - hz) * s, H + 10], [L.vx - (H - hz) * s, H + 10]].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
  } else {
    ctx.moveTo(-10, L.bottom(-10));
    for (let x = -10; x <= W + 10; x += 5) ctx.lineTo(x, Math.min(L.top(x), L.bottom(x)));
    for (let x = W + 10; x >= -10; x -= 5) ctx.lineTo(x, L.bottom(x));
  }
  ctx.closePath();
}

function shapePath(x, sh, o) {
  const X = (u) => o.x + u * o.w;
  const Y = (v) => o.y + v * o.h;
  x.beginPath();
  if (sh.type === "rect") {
    const cx = X(sh.x + sh.w / 2);
    const cy = Y(sh.y + sh.h / 2);
    const a = ((sh.r || 0) * Math.PI) / 180;
    const hw = (sh.w * o.w) / 2;
    const hh = (sh.h * o.h) / 2;
    [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].forEach(([dx, dy], i) => {
      const px = cx + dx * Math.cos(a) - dy * Math.sin(a);
      const py = cy + dx * Math.sin(a) + dy * Math.cos(a);
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    });
    x.closePath();
  } else if (sh.type === "ellipse") x.ellipse(X(sh.x), Y(sh.y), Math.max(0.5, (sh.w * o.w) / 2), Math.max(0.5, (sh.h * o.h) / 2), ((sh.r || 0) * Math.PI) / 180, 0, Math.PI * 2);
  else if (sh.type === "circle" || sh.type === "ring") x.arc(X(sh.x), Y(sh.y), Math.max(0.5, (sh.w * o.w) / 2), 0, Math.PI * 2);
  else if (sh.type === "tri") {
    x.moveTo(X(sh.x), Y(sh.y + sh.h));
    x.lineTo(X(sh.x + sh.w), Y(sh.y + sh.h));
    x.lineTo(X(sh.x + sh.w / 2), Y(sh.y));
    x.closePath();
  } else if (sh.points?.length) {
    sh.points.forEach(([u, v], i) => (i ? x.lineTo(X(u), Y(v)) : x.moveTo(X(u), Y(v))));
    if (sh.type === "poly") x.closePath();
  }
}

function smooth(x, pts, closed = true) {
  x.beginPath();
  const n = pts.length;
  if (n < 3) {
    pts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p)));
    return;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (closed) {
    x.moveTo(...mid(pts[n - 1], pts[0]));
    for (let i = 0; i < n; i++) x.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]));
    x.closePath();
  } else {
    x.moveTo(...pts[0]);
    for (let i = 1; i < n - 1; i++) x.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[i + 1]));
    x.lineTo(...pts[n - 1]);
  }
}

function bounds(pts) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [px, py] of pts) {
    x0 = Math.min(x0, px);
    y0 = Math.min(y0, py);
    x1 = Math.max(x1, px);
    y1 = Math.max(y1, py);
  }
  return [x0, y0, x1, y1];
}

const KEYS = { day: [255, 248, 236], golden: [255, 190, 120], dusk: [236, 160, 172], dawn: [255, 206, 186], night: [150, 175, 235] };

// how the scene's light colours the characters: key tint on lit sides, sky ambience in the shadows
function gradeOf(P) {
  const wd = P.world;
  const time = wd.time || "day";
  const lamp = wd.interior && wd.lights[0]?.kind === "lamp";
  const sky = wd.sky.map(rgb);
  // a fire after dark becomes the key light: warm on the side facing it, the night sky in the shadows
  if (wd.fire && (time === "night" || time === "dusk" || wd.interior)) return { key: [255, 160, 84], amb: sky[Math.min(2, sky.length - 1)], k: 0.34, dim: 0.9 };
  const key = lamp ? [255, 205, 150] : KEYS[time] || KEYS.day;
  return { key, amb: sky[Math.min(2, sky.length - 1)], k: { day: 0.06, golden: 0.2, dusk: 0.2, dawn: 0.14, night: 0.3 }[time] ?? 0.08, dim: time === "night" ? (lamp ? 0.85 : 0.62) : time === "dusk" ? 0.85 : 1 };
}

function trace(x, pts) {
  const n = pts.length;
  if (n < 3) {
    pts.forEach((p, i) => (i ? x.lineTo(...p) : x.moveTo(...p)));
    return;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  x.moveTo(...mid(pts[n - 1], pts[0]));
  for (let i = 0; i < n; i++) x.quadraticCurveTo(...pts[i], ...mid(pts[i], pts[(i + 1) % n]));
  x.closePath();
}

const PAPER = [247, 242, 233];

// how this generation draws its people: which line system shades them, how dense, which ink; every seed differs a little
export function lookOf(P) {
  const r = random(((P.plan?.seed || 1) ^ 0x51ed1) >>> 0);
  return {
    mode: r.pick(["hatch", "hatch", "flow", "contour", "cross"]),
    sp: r.range(3, 5.2),
    lw: r.range(0.7, 1.15),
    angle: r.range(-0.55, 0.55),
    jitter: r.chance(0.5) ? r.range(0.3, 1.1) : 0,
    ink: r.pick([[34, 24, 30], [24, 30, 58], [62, 38, 26], [48, 26, 54]]),
    tint: r.range(0.2, 0.5),
    shade: r.range(0.12, 0.32),
    weight: r.range(1.3, 2.3),
  };
}

// people are drawn the way a plotter would: pale colour, a crisp ink outline that is heavier on the shadow side,
// and shading built from generated line systems (hatching, flow along the limb, contour rings, cross-hatching) that thicken away from the light
function drawFigures(x, fig, grade, look) {
  const L = fig.lightAt;
  const scale = Math.max(0.7, Math.min(1.7, Math.sqrt(fig.k * 1.4)));
  const sp = look.sp * scale;
  const lw = look.lw * scale;
  const ink = Math.max(0.8, Math.min(4.2, look.weight * scale));
  const R = random(((fig.items.length * 7919) ^ 0x2b) >>> 0);
  const tone = new Map();
  const toneOf = (it) => {
    const k = it.person * 16 + (it.mat || 1);
    if (!tone.has(k)) {
      const [lite, dark] = fig.fill(it.mat || 1, it.person).map(rgb);
      const dim = (c) => c.map((v) => v * grade.dim);
      const base = dim(mix(mix(lite, PAPER, look.tint), grade.key, grade.k));
      const shadow = dim(mix(mix(lite, dark, 0.5), grade.amb, 0.22));
      tone.set(k, {
        base,
        shadow: mix(base, shadow, look.shade),
        rim: mix(lite, grade.key, 0.55).map((v) => Math.min(255, v * 1.12)),
        line: mix(dim(dark), look.ink, 0.45),
        ink: mix(dark, look.ink, 0.7),
      });
    }
    return tone.get(k);
  };
  const lines = (box, angle, step) => {
    const [x0, y0, x1, y1] = box;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const half = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    const d = [Math.cos(angle), Math.sin(angle)];
    const n = [-d[1], d[0]];
    x.beginPath();
    for (let o = -half; o <= half; o += step) {
      const segs = look.jitter ? 5 : 1;
      for (let k = 0; k <= segs; k++) {
        const t = -half + (2 * half * k) / segs;
        const w = look.jitter && k > 0 && k < segs ? (R() - 0.5) * look.jitter * scale : 0;
        const px = cx + n[0] * (o + w) + d[0] * t;
        const py = cy + n[1] * (o + w) + d[1] * t;
        if (k) x.lineTo(px, py);
        else x.moveTo(px, py);
      }
    }
    x.stroke();
  };
  const rings = (c, r, step) => {
    x.beginPath();
    for (let k = step; k < r * 1.6; k += step) {
      x.moveTo(c[0] + k, c[1]);
      x.arc(c[0], c[1], k, 0, Math.PI * 2);
    }
    x.stroke();
  };
  // strands fall from along the parting in uneven clumps, curving outward as they come down
  const rays = (c, r, step) => {
    x.beginPath();
    const count = Math.max(10, Math.round((Math.PI * r) / step / 1.5));
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count;
      const a = Math.PI * (0.1 + 0.8 * u) + (R() - 0.5) * 0.12;
      const crown = [c[0] + (u - 0.5) * r * 0.5 + (R() - 0.5) * r * 0.12, c[1] - r * (0.9 + R() * 0.1)];
      const r1 = r * (1.9 + R() * 0.9);
      const bend = (a - Math.PI / 2) * (0.25 + R() * 0.3);
      x.moveTo(crown[0], crown[1]);
      x.quadraticCurveTo(crown[0] + Math.cos(a - bend) * r1 * 0.5, crown[1] + Math.sin(a - bend) * r1 * 0.5, crown[0] + Math.cos(a) * r1, crown[1] + Math.sin(a) * r1);
    }
    x.stroke();
  };
  for (const it of fig.items) {
    x.save();
    if (it.clip != null) {
      x.beginPath();
      x.rect(0, 0, W, it.clip);
      x.clip();
    }
    if (it.within) {
      smooth(x, it.within);
      x.clip();
    }
    if (it.kind === "line") {
      smooth(x, it.pts, false);
      const c = it.hex ? rgb(it.hex) : toneOf(it).ink;
      x.strokeStyle = css(it.hex ? c.map((v) => v * (it.mat === 10 ? grade.dim : 1)) : c, it.alpha ?? 0.9);
      x.lineWidth = Math.max(0.6, it.width);
      x.lineCap = "round";
      x.lineJoin = "round";
      x.stroke();
    } else if (it.hex) {
      smooth(x, it.pts);
      if (it.grad) {
        const [, y0, , y1] = bounds(it.pts);
        const g = x.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, it.grad[0]);
        g.addColorStop(1, it.grad[1]);
        x.fillStyle = g;
      } else x.fillStyle = css(rgb(it.hex).map((v) => v * (it.mat === 10 ? grade.dim : 1)));
      x.globalAlpha = it.alpha ?? 1;
      x.fill();
      x.globalAlpha = 1;
      if (it.line) {
        x.strokeStyle = css(mix([40, 26, 30], look.ink, 0.5), 0.85);
        x.lineWidth = ink * 0.6;
        x.stroke();
      }
    } else {
      const t = toneOf(it);
      const box = bounds(it.pts);
      const [x0, y0, x1, y1] = box;
      let ctr = it.shade?.center || [(x0 + x1) / 2, (y0 + y1) / 2];
      let thick = it.shade?.r || Math.min(x1 - x0, y1 - y0) / 2;
      let along = null;
      if (it.shade?.axis) {
        const [a, b] = it.shade.axis;
        ctr = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const d = [b[0] - a[0], b[1] - a[1]];
        const dl = Math.hypot(...d) || 1;
        const n = [-d[1] / dl, d[0] / dl];
        along = Math.atan2(d[1], d[0]);
        thick = 1;
        for (const [px, py] of it.pts) thick = Math.max(thick, Math.abs((px - ctr[0]) * n[0] + (py - ctr[1]) * n[1]));
      }
      const lv = [L[0] - ctr[0], L[1] - ctr[1]];
      const ll = Math.hypot(...lv) || 1;
      const off = Math.max(1, thick * 0.42);
      const ox = (lv[0] / ll) * off;
      const oy = (lv[1] / ll) * off;
      const back = it.person >= 3 ? fig.lightBehind : fig.backlit;
      const hair = it.mat === 2;
      const skin = it.mat === 1;
      const moved = (k) => it.pts.map(([px, py]) => [px + ox * k, py + oy * k]);
      // the part of the shape turned away from the light
      const shadowed = (k) => {
        x.beginPath();
        trace(x, it.pts);
        x.clip();
        x.beginPath();
        if (back) {
          trace(x, moved(-0.45 * k));
          x.clip();
        } else {
          trace(x, it.pts);
          trace(x, moved(k));
          x.clip("evenodd");
        }
      };
      smooth(x, it.pts);
      x.fillStyle = css(back ? t.rim : t.base);
      x.fill();
      if (it.line !== false) {
        x.save();
        shadowed(1);
        smooth(x, it.pts);
        x.fillStyle = css(t.shadow);
        x.fill();
        x.strokeStyle = css(t.line, skin ? 0.45 : 0.85);
        x.lineWidth = lw * (skin ? 0.7 : 1);
        x.lineCap = "butt";
        const step = sp * (skin ? 1.4 : 1);
        const mode = hair ? "strands" : look.mode;
        if (mode === "strands") {
          if (along !== null) lines(box, along, step * 0.75);
          else rays(ctr, thick, step);
        } else if (mode === "contour" && along === null) rings(ctr, thick, step);
        else if (mode === "flow" || mode === "contour") lines(box, along ?? Math.PI / 2, step);
        else lines(box, (along ?? Math.PI / 4) + Math.PI / 2 + look.angle, step);
        x.restore();
        if (mode === "cross" || (!skin && !hair)) {
          // the core of the shadow gets a second layer of lines across the first
          x.save();
          shadowed(1.9);
          x.strokeStyle = css(t.line, skin ? 0.35 : 0.8);
          x.lineWidth = lw * 0.9;
          lines(box, (along ?? Math.PI / 4) + Math.PI / 2 + look.angle + (mode === "cross" ? 1.15 : 0.6), step * (mode === "cross" ? 1 : 1.3));
          x.restore();
        }
        if (hair) {
          // strands run through the lit side too, sparser, so the hair reads as hair everywhere
          x.save();
          smooth(x, it.pts);
          x.clip();
          x.strokeStyle = css(t.line, 0.35);
          x.lineWidth = lw * 0.7;
          if (along !== null) lines(box, along, step * 1.6);
          else rays(ctr, thick, step * 1.8);
          x.restore();
        }
        smooth(x, it.pts);
        x.strokeStyle = css(t.ink, 0.92);
        x.lineWidth = ink * 0.55;
        x.lineJoin = "round";
        x.stroke();
        x.save();
        shadowed(1);
        smooth(x, it.pts);
        x.lineWidth = ink * 1.5;
        x.stroke();
        x.restore();
      }
    }
    x.restore();
  }
}

// the characters on their own clean layer, laid over whatever construction built the world
export function figureLayer(P, scale) {
  const { fig, world: wd } = P;
  if (!fig) return null;
  const cv = document.createElement("canvas");
  cv.width = Math.round(W * scale);
  cv.height = Math.round(H * scale);
  const x = cv.getContext("2d");
  x.setTransform(scale, 0, 0, scale, 0, 0);
  for (const [ox, oy, u, cast] of fig.feet || []) {
    if (!cast) continue;
    const g = x.createRadialGradient(ox, oy, 0, ox, oy, u * 0.22);
    g.addColorStop(0, css([20, 14, 24], 0.32));
    g.addColorStop(1, css([20, 14, 24], 0));
    x.save();
    x.translate(ox, oy);
    x.scale(1, 0.16);
    x.translate(-ox, -oy);
    x.fillStyle = g;
    x.fillRect(ox - u * 0.22, oy - u * 0.22, u * 0.44, u * 0.44);
    x.restore();
  }
  // props the people use are drawn in the same clean style: behind them first, in front of them after
  const grade = gradeOf(P);
  const props = (front) => {
    for (const o of wd.objects) {
      if (!o.cel || Boolean(o.front) !== front) continue;
      for (const sh of o.shapes) {
        const col = rgb(sh.color).map((v, i) => (v + (grade.key[i] - v) * grade.k) * grade.dim);
        const line = mix(col, [28, 16, 26], 0.65);
        x.lineJoin = "round";
        if (sh.type === "ring" || sh.type === "line") {
          shapePath(x, sh, o);
          x.strokeStyle = css(line);
          x.lineWidth = (sh.type === "ring" ? Math.max(2, o.w * 0.022) : Math.max(1.5, sh.w * o.w)) + 2;
          x.stroke();
          shapePath(x, sh, o);
          x.strokeStyle = css(col);
          x.lineWidth = sh.type === "ring" ? Math.max(2, o.w * 0.022) : Math.max(1.5, sh.w * o.w);
          x.stroke();
        } else {
          shapePath(x, sh, o);
          x.fillStyle = css(col);
          x.fill();
          x.strokeStyle = css(line, 0.9);
          x.lineWidth = Math.max(1, Math.min(3, fig.k * 1.8));
          x.stroke();
        }
      }
    }
  };
  props(false);
  drawFigures(x, fig, grade, lookOf(P));
  props(true);
  x.globalCompositeOperation = "source-atop";
  for (const o of wd.objects) {
    if (!o.front || o.kind !== "thing" || o.cel) continue;
    for (const sh of o.shapes) {
      x.fillStyle = css(rgb(sh.color));
      x.strokeStyle = css(rgb(sh.color));
      if (sh.type === "ring" || sh.type === "line") {
        x.lineWidth = sh.type === "ring" ? Math.max(2, o.w * 0.022) : Math.max(1.5, sh.w * o.w);
        shapePath(x, sh, o);
        x.stroke();
      } else {
        shapePath(x, sh, o);
        x.fill();
      }
    }
  }
  x.globalCompositeOperation = "source-over";
  return cv;
}

export function sceneBuffer(P, scale = 0.5) {
  const { world: wd, comp, fig, rand } = P;
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const make = () => {
    const el = document.createElement("canvas");
    el.width = w;
    el.height = h;
    const x = el.getContext("2d", { willReadFrequently: true });
    x.setTransform(scale, 0, 0, scale, 0, 0);
    return [el, x];
  };
  const [cc, c] = make();
  const [, q] = make();
  const regions = [{ id: 0, kind: "none", material: "none", imp: 0, depth: 0, orient: 0 }];
  const code = (id) => {
    const r = id & 255;
    const g = (id >> 8) & 255;
    return [r, g, (r * 31 + g * 17 + 101) & 255];
  };
  const region = (kind, props = {}) => {
    const id = regions.length;
    regions.push({ id, kind, material: kind, imp: 0.3, depth: 0.5, orient: 0, ...props });
    q.fillStyle = q.strokeStyle = `rgb(${code(id).join(",")})`;
    return id;
  };
  const fill = (path, color) => {
    path(c);
    c.fillStyle = color;
    c.fill();
    path(q);
    q.fill();
  };
  const stroke = (path, color, width) => {
    path(c);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke();
    path(q);
    q.lineWidth = width;
    q.stroke();
  };
  const hz = wd.horizon;
  const sky = wd.sky.map(rgb);
  const sun = wd.lights[0];

  region("sky", { imp: 0.12, depth: 0, orient: 0, material: "sky" });
  q.fillRect(0, 0, W, H);
  const img = c.createImageData(w, h);
  for (let py = 0; py < h; py++)
    for (let px = 0; px < w; px++) {
      const col = P.skyAt(px / scale, py / scale);
      const i = (py * w + px) * 4;
      img.data[i] = col[0];
      img.data[i + 1] = col[1];
      img.data[i + 2] = col[2];
      img.data[i + 3] = 255;
    }
  c.putImageData(img, 0, 0);
  const indoor = sun && (sun.kind === "lamp" || sun.kind === "window");
  if (sun && !indoor) {
    const g = c.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, W * 0.55);
    g.addColorStop(0, css(sun.kind === "moon" ? [235, 238, 250] : [255, 244, 214], 0.75));
    g.addColorStop(0.25, css(sky[0], 0.35));
    g.addColorStop(1, css(sky[0], 0));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    region("light", { imp: 0.6, depth: 0, material: sun.kind, orient: 0 });
    fill((x) => {
      x.beginPath();
      x.arc(sun.x, sun.y, sun.r, 0, Math.PI * 2);
    }, css(sun.kind === "moon" ? [240, 240, 236] : [255, 226, 160]));
  }
  if (wd.rainbow) {
    // a soft band of colour arching out of the horizon, drawn before the clouds so they can cross it
    const { x: rx, y: ry, r: rr } = wd.rainbow;
    const bands = [[220, 70, 70], [236, 150, 70], [236, 214, 92], [110, 186, 104], [90, 140, 210], [120, 100, 190]];
    region("light", { imp: 0.3, depth: 0.05, orient: 0, material: "light" });
    bands.forEach((col, i) => {
      c.strokeStyle = css(col, 0.5);
      c.lineWidth = rr * 0.03;
      c.beginPath();
      c.arc(rx, ry, rr - i * rr * 0.026, Math.PI, Math.PI * 2);
      c.stroke();
    });
  }
  for (const cl of wd.clouds) {
    const lit = sun ? Math.max(0, 1 - Math.hypot(cl.x - sun.x, cl.y - sun.y) / (W * 0.6)) : 0.3;
    const top = mix(P.skyAt(cl.x, cl.y - 80), [255, 248, 236], 0.55 + lit * 0.3);
    const under = mix(P.skyAt(cl.x, cl.y + 40), [60, 50, 70], 0.18);
    region("cloud", { imp: 0.2, depth: 0.05, orient: 0, material: "cloud" });
    for (let i = 0; i < cl.puffs; i++) {
      const t = i / (cl.puffs - 1);
      const px = cl.x + (t - 0.5) * cl.w;
      const py = cl.y - Math.sin(t * Math.PI) * cl.h * 0.7;
      const r = cl.h * (0.6 + Math.sin(t * Math.PI) * 0.5);
      fill((x) => {
        x.beginPath();
        x.ellipse(px, py, r * 1.3, r * 0.8, 0, 0, Math.PI * 2);
      }, css(under));
      c.fillStyle = css(top, 0.85);
      c.beginPath();
      c.ellipse(px, py - r * 0.25, r * 1.1, r * 0.55, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (wd.particles.some((p) => p.kind === "stars"))
    for (let i = 0; i < 260; i++) {
      c.fillStyle = css([255, 248, 230], 0.5 + rand() * 0.5);
      const s = rand() ** 3 * 2.4 + 0.6;
      c.fillRect(rand() * W, rand() * Math.min(hz, H) * 0.9, s, s);
    }

  for (const L of wd.layers) {
    const base = P.colorOf(L);
    let lo = Infinity;
    for (let x = 0; x <= W; x += 25) lo = Math.min(lo, L.top(x));
    const vp = [L.vx ?? W / 2, hz - H * 0.35];
    const orient = L.kind === "floor" ? (x, y) => Math.atan2(y - vp[1], x - vp[0]) : L.kind === "wall" ? 0 : L.kind === "mountain" ? (x) => Math.atan2(L.top(x + 6) - L.top(x - 6), 12) : L.kind === "road" ? (x, y) => Math.atan2(y - hz, x - L.vx) : L.kind === "city" || L.kind === "treeline" ? -Math.PI / 2 : L.kind === "ground" && ["grass", "field"].includes(L.material) ? -Math.PI / 2 : 0;
    region(L.kind, { material: L.kind === "ground" ? L.material : L.kind === "treeline" ? "foliage" : L.kind, imp: L.kind === "water" ? 0.3 : 0.22, depth: L.depth, orient });
    const g = c.createLinearGradient(0, Math.max(0, lo), 0, H);
    g.addColorStop(0, css(mix(base, [255, 240, 220], 0.08)));
    g.addColorStop(1, css(mix(base, [10, 8, 14], L.kind === "ground" ? 0.3 : 0.12)));
    fill((x) => layerPath(x, L, P), g);
    if (L.kind === "city")
      for (const b of L.blocks) {
        const col = mix(base, rand() < 0.5 ? [0, 0, 0] : [255, 255, 255], rand() * 0.18);
        fill((x) => {
          x.beginPath();
          x.rect(b.x, hz - b.h, b.w - 2, b.h + 2);
        }, css(col));
        const lit = P.dark || wd.time === "dusk";
        for (let wy = hz - b.h + 8; wy < hz - 6; wy += 11)
          for (let wx = b.x + 6; wx < b.x + b.w - 8; wx += 10)
            if (rand() < (lit ? 0.4 : 0.15)) {
              c.fillStyle = css(lit ? [255, 214, 140] : mix(col, [255, 255, 255], 0.3), 0.9);
              c.fillRect(wx, wy, 4, 6);
            }
      }
    if (L.kind === "floor") {
      c.strokeStyle = css(mix(base, [0, 0, 0], 0.35), 0.4);
      c.lineWidth = 1.2;
      for (let i = -14; i <= 14; i++) {
        const xb = W / 2 + i * W * 0.085;
        const t = (H - hz) / (H - vp[1]);
        c.beginPath();
        c.moveTo(xb, H);
        c.lineTo(xb + (vp[0] - xb) * t, hz);
        c.stroke();
      }
      for (let k = 1; k < 12; k++) {
        const y = hz + (H - hz) * (k / 12) ** 1.8;
        c.strokeStyle = css(mix(base, [0, 0, 0], 0.3), 0.18);
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
    }
    if (L.kind === "water") {
      if (sun)
        for (let y = hz + 3; y < Math.min(H, L.bottom(sun.x)); y += 3 + (y - hz) * 0.02) {
          const half = sun.r * (0.8 + ((y - hz) / H) * 1.6) * (0.4 + rand() * 0.6);
          c.fillStyle = css(sun.kind === "moon" ? [236, 238, 250] : [255, 220, 150], 0.55);
          c.fillRect(sun.x - half + (rand() - 0.5) * 20, y, half * 2, 1.6);
        }
      for (let i = 0; i < 120; i++) {
        const y = hz + rand() ** 1.6 * (L.bottom(W / 2) - hz);
        c.fillStyle = css(mix(base, P.skyAt(rand() * W, hz - 30), 0.6), 0.5);
        c.fillRect(rand() * W, y, 20 + rand() * 120, 1.2);
      }
    }
  }

  if (indoor) {
    const g = c.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, H * 0.75);
    g.addColorStop(0, css(sun.kind === "lamp" ? [255, 214, 150] : [236, 240, 255], 0.5));
    g.addColorStop(1, css([255, 214, 150], 0));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
  const objects = (front) => {
    for (const o of wd.objects) {
      if (Boolean(o.front) !== front) continue;
      if (o.kind === "aura") {
        const g = c.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
        g.addColorStop(0, css(rgb(o.color), 0.55));
        g.addColorStop(1, css(rgb(o.color), 0));
        c.fillStyle = g;
        c.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
      }
      if (o.kind === "shadow") {
        c.fillStyle = css([0, 0, 0], 0.18);
        c.beginPath();
        c.ellipse(o.x, o.y, Math.max(0.5, Math.abs(o.w) * 0.5), Math.max(0.5, Math.abs(o.w) * 0.06), 0, 0, Math.PI * 2);
        c.fill();
      }
      if (o.kind === "window") {
        region("window", { material: "glass", imp: 0.45, depth: 0.3, orient: 0 });
        fill((x) => {
          x.beginPath();
          x.rect(o.x - 6, o.y - 6, o.w + 12, o.h + 12);
        }, css(mix(rgb(wd.layers[0]?.hex || "#cccccc"), [0, 0, 0], 0.35)));
        const night = o.outside === "night";
        const g = c.createLinearGradient(0, o.y, 0, o.y + o.h);
        const out = wd.sky.map(rgb);
        g.addColorStop(0, css(night ? [12, 18, 40] : out[out.length - 1]));
        g.addColorStop(1, css(night ? [34, 44, 76] : out[0]));
        c.fillStyle = g;
        c.fillRect(o.x, o.y, o.w, o.h);
        c.save();
        c.beginPath();
        c.rect(o.x, o.y, o.w, o.h);
        c.clip();
        if (!o.moving) {
          // the world outside: a soft band of rooftops and trees sitting low in the pane
          const far = mix(out[0], night ? [8, 10, 22] : [70, 80, 90], 0.55);
          c.fillStyle = css(far);
          c.beginPath();
          c.moveTo(o.x, o.y + o.h);
          for (let u = 0; u <= 1.001; u += 0.02) {
            const roof = Math.sin(u * 23 + o.x) * 0.5 + Math.sin(u * 61 + o.y) * 0.3 > 0.35 ? 0.1 : 0;
            c.lineTo(o.x + u * o.w, o.y + o.h * (0.78 - roof - Math.abs(Math.sin(u * 37 + o.w)) * 0.06));
          }
          c.lineTo(o.x + o.w, o.y + o.h);
          c.closePath();
          c.fill();
        }
        if (o.plane) {
          // an airliner on the apron beyond the glass
          const L = o.w * 0.32;
          const px = o.x + o.w * 0.64;
          const py = o.y + o.h * 0.7;
          c.fillStyle = css(mix(out[0], night ? [120, 130, 150] : [238, 240, 244], 0.65));
          c.beginPath();
          c.ellipse(px, py, L * 0.5, L * 0.055, 0, 0, Math.PI * 2);
          c.fill();
          c.beginPath();
          c.moveTo(px + L * 0.36, py - L * 0.03);
          c.lineTo(px + L * 0.5, py - L * 0.21);
          c.lineTo(px + L * 0.53, py - L * 0.02);
          c.closePath();
          c.fill();
          c.beginPath();
          c.moveTo(px - L * 0.06, py + L * 0.01);
          c.lineTo(px + L * 0.12, py + L * 0.13);
          c.lineTo(px + L * 0.21, py + L * 0.13);
          c.lineTo(px + L * 0.08, py + L * 0.01);
          c.closePath();
          c.fill();
          c.fillStyle = css([60, 70, 90], 0.55);
          c.fillRect(px - L * 0.38, py - L * 0.014, L * 0.68, L * 0.012);
        }
        if (night)
          for (let i = 0; i < (o.moving ? 14 : 30); i++) {
            c.fillStyle = css(rand.pick([[255, 214, 140], [255, 240, 220], [200, 220, 255]]), 0.85);
            if (o.moving) c.fillRect(o.x + rand() * o.w * 0.7, o.y + o.h * (0.45 + rand() * 0.5), o.w * (0.1 + rand() * 0.3), 1.6);
            else c.fillRect(o.x + rand() * o.w, o.y + o.h * (0.7 + rand() * 0.3), 2.4, 2.4);
          }
        if (o.weather === "rain") {
          // rain beyond the glass, then drops sitting on it
          c.strokeStyle = css([225, 232, 240], 0.32);
          c.lineWidth = Math.max(1, o.w * 0.0025);
          for (let i = 0; i < 160; i++) {
            const x = o.x + rand() * o.w * 1.1;
            const y = o.y + rand() * o.h;
            const len = o.h * (0.04 + rand() * 0.06);
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x - len * 0.18, y + len);
            c.stroke();
          }
          c.fillStyle = css([255, 255, 255], 0.1);
          c.fillRect(o.x, o.y, o.w, o.h);
          for (let i = 0; i < 70; i++) {
            const x = o.x + rand() * o.w;
            const y = o.y + rand() * o.h;
            const r = Math.max(1.2, o.w * (0.003 + rand() * 0.007));
            const trail = rand() < 0.35 ? r * (4 + rand() * 10) : 0;
            c.fillStyle = css(mix(out[0], [20, 28, 40], 0.45), 0.5);
            c.beginPath();
            c.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
            if (trail) c.rect(x - r * 0.35, y - trail, r * 0.7, trail);
            c.fill();
            c.fillStyle = css([255, 255, 255], 0.75);
            c.beginPath();
            c.arc(x - r * 0.35, y - r * 0.4, r * 0.32, 0, Math.PI * 2);
            c.fill();
          }
        } else if (o.weather === "snow") {
          c.fillStyle = css([255, 255, 255], 0.85);
          for (let i = 0; i < 140; i++) {
            c.beginPath();
            c.arc(o.x + rand() * o.w, o.y + rand() * o.h, Math.max(1, o.w * (0.002 + rand() * 0.004)), 0, Math.PI * 2);
            c.fill();
          }
        } else if (o.weather === "fog") {
          c.fillStyle = css([235, 236, 238], 0.45);
          c.fillRect(o.x, o.y, o.w, o.h);
        }
        c.restore();
        c.strokeStyle = css(mix(rgb(wd.layers[0]?.hex || "#cccccc"), [0, 0, 0], 0.35));
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(o.x + o.w / 2, o.y);
        c.lineTo(o.x + o.w / 2, o.y + o.h);
        if (!o.moving) {
          c.moveTo(o.x, o.y + o.h / 2);
          c.lineTo(o.x + o.w, o.y + o.h / 2);
        }
        c.stroke();
      }
      if (o.kind === "thing") {
        const vehicle = /\b(car|truck|van|jeep|bus|train|taxi|convertible|pickup|suv)\b/.test(String(o.label).toLowerCase());
        const lit = vehicle && (P.dark || wd.time === "dusk");
        if (lit) {
          const fx = o.x + o.w * 0.97;
          const fy = o.y + o.h * 0.55;
          const g = c.createLinearGradient(fx, fy, fx + o.w * 0.9, fy);
          g.addColorStop(0, css([255, 226, 160], 0.55));
          g.addColorStop(1, css([255, 226, 160], 0));
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(fx, fy - o.h * 0.05);
          c.lineTo(fx + o.w * 0.9, fy - o.h * 0.35);
          c.lineTo(fx + o.w * 0.9, fy + o.h * 0.45);
          c.closePath();
          c.fill();
        }
        region("thing", { material: "object", imp: o.imp, depth: 0.7, orient: o.h > o.w ? -Math.PI / 2 : 0, label: o.label });
        for (const sh of o.shapes) {
          const col = rgb(sh.color);
          const glass = col[2] > col[0] + 25 && col[1] > 120 && col[2] > 150;
          const tone = lit && glass ? [255, 206, 130] : lit ? mix(col, [255, 220, 170], 0.18) : col;
          if (sh.type === "ring") stroke((x) => shapePath(x, sh, o), css(tone), Math.max(2, o.w * 0.022));
          else if (sh.type === "line") stroke((x) => shapePath(x, sh, o), css(tone), Math.max(1.5, sh.w * o.w));
          else fill((x) => shapePath(x, sh, o), css(tone));
        }
        if (lit) {
          const g = c.createRadialGradient(o.x + o.w / 2, o.y + o.h * 0.4, 0, o.x + o.w / 2, o.y + o.h * 0.4, o.w * 0.7);
          g.addColorStop(0, css([255, 214, 150], 0.25));
          g.addColorStop(1, css([255, 214, 150], 0));
          c.fillStyle = g;
          c.fillRect(o.x - o.w * 0.2, o.y - o.h, o.w * 1.4, o.h * 2.2);
        }
      }
      const far = o.base ? Math.max(0, Math.min(1, (o.base - hz) / (H - hz))) : 0.5;
      const turned = wd.season === "autumn" ? mix(rand.pick([[214, 112, 40], [196, 70, 44], [226, 168, 58], [170, 90, 50]]), rgb(tone("forest", wd.time)), wd.time === "night" ? 0.6 : 0.15) : null;
      const leaf = mix(turned || rgb(tone("forest", wd.time)), sky[0], (1 - far) * 0.35);
      if (o.kind === "tree") {
        region("tree", { material: "foliage", imp: 0.35, depth: 0.4 + far * 0.5, orient: (x, y) => Math.atan2(y - (o.base - o.h * 0.55), x - o.x) });
        fill((x) => {
          x.beginPath();
          x.moveTo(o.x - o.h * 0.025, o.base);
          x.lineTo(o.x - o.h * 0.012, o.base - o.h * 0.55);
          x.lineTo(o.x + o.h * 0.012, o.base - o.h * 0.55);
          x.lineTo(o.x + o.h * 0.025, o.base);
        }, css(mix(leaf, [30, 20, 14], 0.5)));
        if (o.conifer)
          for (let k = 0; k < 4; k++) {
            const y0 = o.base - o.h * (0.18 + k * 0.2);
            const half = o.h * (0.24 - k * 0.045);
            fill((x) => {
              x.beginPath();
              x.moveTo(o.x - half, y0);
              x.lineTo(o.x + half, y0);
              x.lineTo(o.x, y0 - o.h * 0.32);
            }, css(mix(leaf, [255, 240, 200], k * 0.04)));
          }
        else
          for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2;
            const cx = o.x + Math.cos(a) * o.h * 0.16 * (0.6 + rand() * 0.6);
            const cy = o.base - o.h * 0.66 + Math.sin(a) * o.h * 0.12;
            const up = (o.base - o.h * 0.66 - cy) / (o.h * 0.2);
            fill((x) => {
              x.beginPath();
              x.ellipse(cx, cy, Math.max(0.5, o.h * (0.14 + rand() * 0.06)), Math.max(0.5, o.h * (0.11 + rand() * 0.05)), 0, 0, Math.PI * 2);
            }, css(mix(leaf, up > 0 ? [255, 236, 180] : [0, 0, 0], Math.abs(up) * 0.15 + 0.03)));
          }
      }
      if (o.kind === "house") {
        const hh = o.w * 0.6;
        const wall = mix(rgb(tone("wood", wd.time)), sky[0], 0.2);
        region("house", { material: "wood", imp: 0.5, depth: 0.5 + far * 0.4, orient: -Math.PI / 2 });
        fill((x) => {
          x.beginPath();
          x.rect(o.x - o.w / 2, o.y - hh, o.w, hh);
        }, css(wall));
        fill((x) => {
          x.beginPath();
          x.moveTo(o.x - o.w * 0.6, o.y - hh);
          x.lineTo(o.x, o.y - hh - o.w * 0.42);
          x.lineTo(o.x + o.w * 0.6, o.y - hh);
        }, css(mix(wall, [0, 0, 0], 0.35)));
        c.fillStyle = css(o.lit ? [255, 205, 120] : mix(wall, [255, 255, 255], 0.3));
        c.fillRect(o.x - o.w * 0.25, o.y - hh * 0.65, o.w * 0.14, hh * 0.28);
        c.fillRect(o.x + o.w * 0.1, o.y - hh * 0.65, o.w * 0.14, hh * 0.28);
      }
      if (o.kind === "dock") {
        region("dock", { material: "wood", imp: 0.4, depth: 0.85, orient: 0 });
        const col = mix(rgb(tone("wood", wd.time)), [0, 0, 0], 0.2);
        fill((x) => {
          x.beginPath();
          x.rect(o.x0, o.y, o.x1 - o.x0, o.h);
          for (let px = o.x0 + 20; px < o.x1; px += 70) x.rect(px, o.y + o.h, 8, 60);
        }, css(col));
      }
      if (o.kind === "foam") {
        c.strokeStyle = css(mix([250, 250, 246], sky[0], 0.25), 0.8);
        c.lineWidth = 1.6;
        c.beginPath();
        for (let x = o.x0; x <= o.x1; x += 6) {
          const y = o.y + Math.sin(x / 38 + o.phase) * o.amp;
          if (x === o.x0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.stroke();
      }
      if (o.kind === "print") {
        c.fillStyle = css(mix(rgb(tone("sand", wd.time)), [40, 30, 20], 0.35), 0.6);
        for (const d of [-1, 1]) {
          c.beginPath();
          c.ellipse(o.x + d * o.s * 1.2, o.y - (d > 0 ? o.s : 0), o.s, o.s * 0.45, 0, 0, Math.PI * 2);
          c.fill();
        }
      }
      if (o.kind === "tuft" || o.kind === "reed") {
        region("grass", { material: "grass", imp: 0.3, depth: 0.8, orient: -Math.PI / 2 });
        const col = mix(rgb(tone(o.kind === "reed" ? "forest" : "grass", wd.time)), [10, 14, 6], 0.35);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i / 6 - 0.5) * 1.0;
          stroke((x) => {
            x.beginPath();
            x.moveTo(o.x + i * 1.5, o.base);
            x.quadraticCurveTo(o.x + Math.cos(a) * o.h * 0.3, o.base - o.h * 0.6, o.x + Math.cos(a) * o.h, o.base + Math.sin(a) * o.h);
          }, css(col), o.kind === "reed" ? 1.6 : 1.4);
        }
      }
      if (o.kind === "flower") {
        region("flower", { material: "flower", imp: 0.45, depth: 0.85, orient: -Math.PI / 2 });
        stroke((x) => {
          x.beginPath();
          x.moveTo(o.x, o.base);
          x.lineTo(o.x, o.base - o.s * 1.6);
        }, css(mix(rgb(tone("grass", wd.time)), [0, 0, 0], 0.3)), Math.max(1, o.s * 0.08));
        const petals = 6;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * Math.PI * 2;
          fill((x) => {
            x.beginPath();
            x.ellipse(o.x + Math.cos(a) * o.s * 0.3, o.base - o.s * 1.7 + Math.sin(a) * o.s * 0.3, o.s * 0.32, o.s * 0.16, a, 0, Math.PI * 2);
          }, css(mix(rgb(o.hue), [255, 255, 255], (i % 2) * 0.12)));
        }
      }
      if (o.kind === "lamp") {
        region("lamp", { material: "metal", imp: 0.4, depth: 0.7, orient: -Math.PI / 2 });
        stroke((x) => {
          x.beginPath();
          x.moveTo(o.x, o.base);
          x.lineTo(o.x, o.base - o.h);
        }, css([28, 28, 36]), Math.max(2, o.h * 0.025));
        if (o.lit) {
          const R = Math.max(3, o.h * 0.035) * 9;
          const g = c.createRadialGradient(o.x, o.base - o.h, 0, o.x, o.base - o.h, R);
          g.addColorStop(0, css([255, 214, 140], 0.9));
          g.addColorStop(1, css([255, 214, 140], 0));
          c.fillStyle = g;
          c.fillRect(o.x - R, o.base - o.h - R, R * 2, R * 2);
        }
      }
      if (o.kind === "stage") {
        region("thing", { material: "object", imp: 0.8, depth: 0.2, orient: 0, label: "stage" });
        // the lit stage everyone faces: a bright wash with the band small against it under the rig
        const g = c.createLinearGradient(0, o.y, 0, o.y + o.h);
        g.addColorStop(0, css(mix(rgb(o.hues[0]), [255, 255, 255], 0.55)));
        g.addColorStop(1, css(mix(rgb(o.hues[1]), [40, 30, 50], 0.35)));
        fill((x) => {
          x.beginPath();
          x.rect(o.x, o.y, o.w, o.h);
        }, g);
        for (let i = 0; i < 3; i++) {
          const bx = o.x + o.w * (0.3 + i * 0.2);
          const bh = o.h * 0.42;
          fill((x) => {
            x.beginPath();
            x.ellipse(bx, o.y + o.h - bh, bh * 0.12, bh * 0.14, 0, 0, Math.PI * 2);
            x.rect(bx - bh * 0.14, o.y + o.h - bh * 0.88, bh * 0.28, bh * 0.88);
          }, css([20, 16, 28]));
        }
        c.strokeStyle = css([70, 66, 82]);
        c.lineWidth = 3;
        c.strokeRect(o.x - 6, o.y - o.h * 0.25, o.w + 12, o.h * 1.25);
      }
      if (o.kind === "crowd") {
        // heads and shoulders in silhouette, some hands raised, catching the stage light on top
        region("thing", { material: "object", imp: 0.4, depth: 0.6, orient: 0, label: "crowd" });
        const R = random(Math.floor(o.seed));
        const ink = [18, 16, 26];
        for (let x = -o.s; x < W + o.s; x += o.s * (1.5 + R() * 0.8)) {
          const hx = x + R() * o.s * 0.5;
          const hy = o.y - o.s * (1.4 + R() * 0.3);
          fill((g) => {
            g.beginPath();
            g.ellipse(hx, hy, o.s * 0.42, o.s * 0.5, 0, 0, Math.PI * 2);
            g.moveTo(hx - o.s * 0.95, o.y + o.s);
            g.quadraticCurveTo(hx - o.s * 0.9, hy + o.s * 0.5, hx, hy + o.s * 0.45);
            g.quadraticCurveTo(hx + o.s * 0.9, hy + o.s * 0.5, hx + o.s * 0.95, o.y + o.s);
            g.closePath();
          }, css(ink));
          if (R() < 0.18)
            stroke((g) => {
              g.beginPath();
              g.moveTo(hx + o.s * 0.6, hy + o.s * 0.6);
              g.lineTo(hx + o.s * 0.75, hy - o.s * 1.3);
            }, css(ink), Math.max(1.5, o.s * 0.22));
        }
      }
      if (o.kind === "firework") {
        const col = rgb(o.hue);
        const rays = 30;
        for (let i = 0; i < rays; i++) {
          const a = (i / rays) * Math.PI * 2 + rand() * 0.1;
          const r = o.r * (0.6 + rand() * 0.4);
          c.strokeStyle = css(col, 0.85);
          c.lineWidth = 1.4;
          c.beginPath();
          c.moveTo(o.x + Math.cos(a) * r * 0.2, o.y + Math.sin(a) * r * 0.2);
          c.lineTo(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r + r * 0.15);
          c.stroke();
        }
      }
    }
  };
  objects(false);

  if (fig) {
    // regions per person and material, so every construction can still read the figures
    const key = new Map();
    const regionOf = (it) => {
      const k = it.person * 16 + (it.mat || 1);
      if (!key.has(k)) {
        const [lite, dark] = fig.fill(it.mat || 1, it.person).map(rgb);
        key.set(k, regions.length);
        regions.push({ id: regions.length, kind: "figure", material: MATERIAL[it.mat || 1] || "cloth", imp: 1, depth: 0.95, person: it.person, mat: it.mat || 1, lite, dark, items: [], orient: 0 });
      }
      return regions[key.get(k)];
    };
    drawFigures(c, fig, gradeOf(P), lookOf(P));
    for (const it of fig.items) {
      if (it.kind !== "path") continue;
      const reg = regionOf(it);
      const [x0, y0, x1, y1] = bounds(it.pts);
      if (!it.hex) reg.items.push({ box: [x0, y0, x1, y1], shade: it.shade });
      q.save();
      if (it.clip != null) {
        q.beginPath();
        q.rect(0, 0, W, it.clip);
        q.clip();
      }
      smooth(q, it.pts);
      q.fillStyle = `rgb(${code(reg.id).join(",")})`;
      q.fill();
      q.restore();
    }
    for (const reg of regions)
      if (reg.kind === "figure")
        reg.orient = (x, y) => {
          for (let i = reg.items.length - 1; i >= 0; i--) {
            const it = reg.items[i];
            if (x < it.box[0] || x > it.box[2] || y < it.box[1] || y > it.box[3]) continue;
            if (it.shade?.axis) return Math.atan2(it.shade.axis[1][1] - it.shade.axis[0][1], it.shade.axis[1][0] - it.shade.axis[0][0]);
            if (it.shade?.center) return Math.atan2(y - it.shade.center[1], x - it.shade.center[0]) + Math.PI / 2;
          }
          return 0;
        };
  }
  objects(true);
  for (const p of wd.particles)
    if (p.kind === "fog")
      for (let i = 0; i < 6; i++) {
        const y = hz + (rand() - 0.6) * H * 0.3;
        const g = c.createLinearGradient(0, y - 60, 0, y + 60);
        g.addColorStop(0, css(sky[0], 0));
        g.addColorStop(0.5, css(sky[0], 0.4));
        g.addColorStop(1, css(sky[0], 0));
        c.fillStyle = g;
        c.fillRect(0, y - 60, W, 120);
      }

  const raw = q.getImageData(0, 0, w, h).data;
  const ids = new Int32Array(w * h).fill(-1);
  for (let i = 0; i < w * h; i++) {
    const r = raw[i * 4];
    const g = raw[i * 4 + 1];
    const b = raw[i * 4 + 2];
    const id = r | (g << 8);
    if (b === ((r * 31 + g * 17 + 101) & 255) && id < regions.length) ids[i] = id;
  }
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < w * h; i++)
      if (ids[i] < 0) {
        const l = i % w ? ids[i - 1] : -1;
        const u = i >= w ? ids[i - w] : -1;
        const r = (i + 1) % w ? ids[i + 1] : -1;
        const d = i + w < w * h ? ids[i + w] : -1;
        ids[i] = Math.max(l, u, r, d);
      }
  for (let i = 0; i < w * h; i++) if (ids[i] < 0) ids[i] = 1;
  const rgba = c.getImageData(0, 0, w, h).data;
  const ix = (x, y) => Math.min(h - 1, Math.max(0, Math.floor(y * scale))) * w + Math.min(w - 1, Math.max(0, Math.floor(x * scale)));
  const regionAt = (x, y) => regions[ids[ix(x, y)]] || regions[1];
  const lumAt = (x, y) => {
    const i = ix(x, y) * 4;
    return (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
  };
  const luma = (v) => (0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]) / 255;
  if (fig) {
    const figAt = (x, y) => {
      const r = regionAt(x, y);
      return r.kind === "figure" ? r : null;
    };
    fig.inside = (x, y) => figAt(x, y) !== null;
    fig.code = (x, y) => {
      const r = figAt(x, y);
      return r ? r.person * 16 + r.mat : 0;
    };
    fig.mat = (x, y) => figAt(x, y)?.mat || 0;
    fig.person = (x, y) => figAt(x, y)?.person || 0;
    fig.light = (x, y) => {
      const r = figAt(x, y);
      if (!r) return 0;
      const lo = luma(r.dark);
      const hi = luma(r.lite);
      return Math.min(1, Math.max(0, (lumAt(x, y) - lo) / Math.max(0.05, hi - lo)));
    };
    fig.rim = (x, y) => {
      const r = figAt(x, y);
      return r ? Math.min(1, Math.max(0, (lumAt(x, y) - luma(r.lite)) / 0.12)) : 0;
    };
    fig.ao = () => 1;
    fig.along = (x, y, out) => {
      const r = figAt(x, y);
      const a = r ? r.orient(x, y) : 0;
      out[0] = Math.cos(a);
      out[1] = Math.sin(a);
      return out;
    };
  }
  return {
    w,
    h,
    scale,
    canvas: cc,
    rgba,
    ids,
    regions,
    ix,
    regionAt,
    idAt: (x, y) => ids[ix(x, y)],
    color: (x, y) => {
      const i = ix(x, y) * 4;
      return [rgba[i], rgba[i + 1], rgba[i + 2]];
    },
    lum: (x, y) => {
      const i = ix(x, y) * 4;
      return (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
    },
    orient: (x, y) => {
      const r = regionAt(x, y);
      return typeof r.orient === "function" ? r.orient(x, y) : r.orient;
    },
    imp: (x, y) => regionAt(x, y).imp,
    edge: (x, y, d = 2) => {
      const id = ids[ix(x, y)];
      return ids[ix(x + d, y)] !== id || ids[ix(x - d, y)] !== id || ids[ix(x, y + d)] !== id || ids[ix(x, y - d)] !== id;
    },
  };
}
