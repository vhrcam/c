import { H, W, tone } from "./world";

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(Math.min(255, Math.max(0, v)))).join(",")},${a})`;

const MATERIAL = { 1: "skin", 2: "hair", 4: "cloth", 5: "cloth", 6: "cloth", 7: "shoe", 9: "cloth", 11: "fur", 12: "fur", 13: "dark", 14: "beak", 15: "fur" };

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
        if (night)
          for (let i = 0; i < (o.moving ? 14 : 30); i++) {
            c.fillStyle = css(rand.pick([[255, 214, 140], [255, 240, 220], [200, 220, 255]]), 0.85);
            if (o.moving) c.fillRect(o.x + rand() * o.w * 0.7, o.y + o.h * (0.45 + rand() * 0.5), o.w * (0.1 + rand() * 0.3), 1.6);
            else c.fillRect(o.x + rand() * o.w, o.y + o.h * (0.55 + rand() * 0.45), 2.4, 2.4);
          }
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
      const leaf = mix(rgb(tone("forest", wd.time)), sky[0], (1 - far) * 0.35);
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
    const key = new Map();
    const shot = c.getImageData(0, 0, w, h);
    const ids = q.getImageData(0, 0, w, h);
    const sunCol = sun && sun.kind === "sun" ? [255, 214, 150] : [205, 215, 245];
    const dir = [0, 0];
    for (let py = Math.max(0, Math.floor(fig.box[1] * scale) - 2); py < Math.min(h, Math.ceil(fig.box[3] * scale) + 2); py++)
      for (let px = Math.max(0, Math.floor(fig.box[0] * scale) - 2); px < Math.min(w, Math.ceil(fig.box[2] * scale) + 2); px++) {
        const x = (px + 0.5) / scale;
        const y = (py + 0.5) / scale;
        if (!fig.inside(x, y)) continue;
        const m = fig.mat(x, y);
        const who = fig.person(x, y);
        const k = who * 16 + m;
        if (!key.has(k)) {
          const id = regions.length;
          regions.push({ id, kind: "figure", material: MATERIAL[m] || "cloth", imp: 1, depth: 0.95, person: who, mat: m, orient: (xx, yy) => Math.atan2(fig.along(xx, yy, dir)[1], dir[0]) });
          key.set(k, id);
        }
        const [lite, dark] = fig.fill(m, who);
        const l = fig.light(x, y);
        const r = fig.rim(x, y);
        let col = mix(rgb(dark), rgb(lite), l);
        if (r > 0.25) col = mix(col, sunCol, Math.min(0.7, r));
        const i = (py * w + px) * 4;
        shot.data[i] = col[0];
        shot.data[i + 1] = col[1];
        shot.data[i + 2] = col[2];
        const cd = code(key.get(k));
        ids.data[i] = cd[0];
        ids.data[i + 1] = cd[1];
        ids.data[i + 2] = cd[2];
      }
    c.putImageData(shot, 0, 0);
    q.putImageData(ids, 0, 0);
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
