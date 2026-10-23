import { mix } from "../color.js";
import { noise } from "../random.js";
import { H, W, blob, box, clamp, lengths, mask, sprite, trace, vector } from "./brush.js";

const PLACE = {
  meadow: { horizon: 610, near: 745, amp: 22, mound: 26, figure: 298, sink: 22 },
  beach: { horizon: 600, near: 806, shore: 780, amp: 3, mound: 0, figure: 322, sink: 66 },
  mountains: { horizon: 655, near: 778, amp: 30, mound: 28, figure: 272, sink: 26 },
  forest: { horizon: 640, near: 765, amp: 14, mound: 16, figure: 276, sink: 34 },
  lake: { horizon: 590, near: 806, shore: 800, amp: 10, mound: 10, figure: 300, sink: 44 },
  city: { horizon: 720, near: 805, amp: 0, mound: 0, figure: 320, sink: 80 },
  snow: { horizon: 620, near: 752, amp: 22, mound: 24, figure: 290, sink: 24 },
};

const vgrad = (y0, y1, stops, at) => ({ y0, y1, stops, at });
const fillDown = (top, bottom = H + 60) => [...top, [W + 60, bottom], [-60, bottom]];
const inside = ([x, y, w, h]) => {
  const x0 = Math.max(-30, x);
  const y0 = Math.max(-30, y);
  return [x0, y0, Math.min(W + 30, x + w) - x0, Math.min(H + 30, y + h) - y0];
};
const has = (kit, extra) => kit.scene.extras.includes(extra);
const fog = (kit, y) => kit.scene.weather === "fog" && mist(kit, `fog-${Math.round(y)}`, y, 70, 0.75);

export function layout(scene, r) {
  const P = PLACE[scene.place];
  const n = noise(r.int(1, 1e9));
  const cx = W * r.range(0.4, 0.6);
  const nearTop = [];
  for (let x = -60; x <= W + 60; x += 10) {
    const mound = scene.people.length ? -P.mound * Math.exp(-(((x - cx) / 260) ** 2)) : 0;
    nearTop.push([x, P.near + (n(x * 0.0024, 3) - 0.5) * 2 * P.amp + mound]);
  }
  const groundAt = (x) => {
    const i = clamp(Math.floor((x + 60) / 10), 0, nearTop.length - 2);
    const t = (x + 60 - i * 10) / 10;
    return nearTop[i][1] + (nearTop[i + 1][1] - nearTop[i][1]) * t;
  };
  const side = r.chance(0.5) ? 1 : -1;
  const people = scene.people.length > 0;
  const sunX = (lo, hi) => clamp(people ? cx + side * r.range(lo, hi) : W * r.range(0.34, 0.66), 170, W - 170);
  let sun;
  if (scene.time === "night") sun = { x: sunX(260, 380), y: r.range(150, 230), r: 34 };
  else if (scene.time === "sunset" || scene.time === "sunrise") sun = { x: sunX(170, 250), y: P.horizon - r.range(16, 36), r: 66 };
  else if (scene.time === "golden") sun = { x: sunX(190, 280), y: P.horizon - r.range(170, 230), r: 52 };
  else sun = { x: sunX(220, 330), y: r.range(130, 200), r: 44 };
  return { ...P, cx, side, nearTop, groundAt, sun, stand: { x: cx, y: groundAt(cx) + P.sink, h: P.figure } };
}

function ridge(n, base, amp, freq, step = 12, octaves = 3) {
  const pts = [];
  for (let x = -60; x <= W + 60; x += step) pts.push([x, base - (n(x * freq, octaves) - 0.5) * 2 * amp]);
  return pts;
}

function peaks(n, base, amp, freq, step = 8) {
  const pts = [];
  for (let x = -60; x <= W + 60; x += step) {
    let v = 0;
    let a = 1;
    let norm = 0;
    let f = freq;
    for (let o = 0; o < 4; o++) {
      v += (1 - Math.abs(2 * n(x * f + o * 17) - 1)) ** 2.2 * a;
      norm += a;
      a *= 0.45;
      f *= 2.2;
    }
    pts.push([x, base - Math.min(1, (v / norm) * 1.5) ** 1.25 * amp]);
  }
  return pts;
}

const snowline = (top, base, k) => {
  const peak = Math.min(...top.map((p) => p[1]));
  return peak + (base - peak) * k;
};

function snowCap(top, line, n) {
  const upper = top.map(([x, y]) => [x, y - 12]);
  const lower = top.map(([x, y]) => [x, y + Math.max(0, line - y) * (0.35 + n(x * 0.02, 2) * 0.55)]);
  return [...upper, ...lower.reverse()];
}

function hill(kit, id, top, fill, o = {}) {
  const poly = fillDown(top, o.bottom);
  const paint = (ctx) => {
    kit.style.area(ctx, poly, fill, kit.rng(id), o.area);
    if (o.snow) {
      ctx.save();
      trace(ctx, poly);
      ctx.clip();
      kit.style.area(ctx, snowCap(top, o.snow.line, kit.noise(id + "snow")), o.snow.color, kit.rng(id + "cap"), { spread: 5, layers: 10 });
      ctx.restore();
    }
  };
  kit.sketch.push(top.filter(([x]) => x > -10 && x < W + 10));
  const far = /^(far|peaks|range|headland)/.test(id);
  kit.add(id, o.phase || "shapes", kit.deps(), [sprite(inside(box(poly, 40)), paint, mask.sweep(o.dir || "right", 70, kit.seed(id)), { feather: 9, res: far ? 0.6 : 1 })], o.weight ?? 1);
}

function conifer(x, base, h, w, r) {
  const tiers = 6;
  const widths = Array.from({ length: tiers }, (_, i) => w * ((i + 1) / tiers) * r.range(0.82, 1.1));
  const y = (i) => base - h + (h * 0.9 * (i + 1)) / tiers;
  const right = widths.flatMap((ww, i) => [[x + ww * 0.32, y(i) - h * 0.05], [x + ww * 0.5, y(i)]]);
  const left = widths.map((ww, i) => [[x - ww * 0.5, y(i)], [x - ww * 0.32, y(i) - h * 0.05]]).reverse().flat();
  return [[x, base - h], ...right, [x + w * 0.06, base - h * 0.06], [x + w * 0.05, base + 6], [x - w * 0.05, base + 6], [x - w * 0.06, base - h * 0.06], ...left];
}

function pines(kit, id, list, color, o = {}) {
  const paint = (ctx) => {
    const r = kit.rng(id);
    for (const t of list) {
      kit.style.area(ctx, conifer(t.x, t.base, t.h, t.w, r), color, r, { layers: 6, spread: 3, grain: 0.4 });
      if (o.snow) {
        for (let i = 1; i < 6; i++) {
          const y = t.base - t.h + (t.h * 0.9 * i) / 6;
          const ww = (t.w * i) / 6;
          kit.style.area(ctx, blob(t.x + r.range(-3, 3), y - t.h * 0.035, ww * 0.34, t.h * 0.018, r, 0.25, 10), o.snow, r, { layers: 4, spread: 2, grain: 0 });
        }
      }
    }
  };
  const pts = list.flatMap((t) => [[t.x - t.w, t.base + 10], [t.x + t.w, t.base - t.h - 10]]);
  list.forEach((t) => kit.sketch.push([[t.x, t.base], [t.x, t.base - t.h]]));
  kit.add(id, "shapes", kit.deps(), [sprite(inside(box(pts, 30)), paint, o.reveal || mask.sweep("right", 50, kit.seed(id)))], o.weight ?? 0.8);
}

function lonelyTree(kit, x, base, h) {
  const { pal, style, L } = kit;
  const r = kit.rng("tree");
  const lean = r.range(-0.08, 0.08) * h;
  const trunk = [[x, base + 8], [x + lean * 0.3, base - h * 0.3], [x + lean * 0.7, base - h * 0.55], [x + lean, base - h * 0.7]];
  const branches = Array.from({ length: 4 }, (_, i) => {
    const s = 0.38 + i * 0.08;
    const dir = i % 2 ? 1 : -1;
    const bx = x + lean * s;
    const by = base - h * s;
    return [[bx, by], [bx + dir * h * 0.14, by - h * 0.12], [bx + dir * h * r.range(0.22, 0.3), by - h * r.range(0.2, 0.28)]];
  });
  const cx = x + lean;
  const cy = base - h * 0.74;
  const lit = pal.grade(mix(pal.land.mid || "#5f8b4d", "#9cba5e", 0.4), 0.75);
  const dark = pal.grade(pal.land.deep || "#2b4c28", 0.85);
  const toward = Math.sign(L.sun.x - x) || 1;
  const leaves = Array.from({ length: 16 }, () => {
    const a = r.range(0, Math.PI * 2);
    const d = Math.sqrt(r()) * 0.85;
    return { x: cx + Math.cos(a) * h * 0.4 * d, y: cy + Math.sin(a) * h * 0.26 * d, s: h * r.range(0.11, 0.17) };
  }).sort((a, b) => b.y - a.y);
  const paint = (ctx) => {
    const bark = pal.grade("#4a3628", 0.9);
    style.line(ctx, trunk, h * 0.07, bark, 1);
    branches.forEach((b) => style.line(ctx, b, h * 0.03, bark, 1));
    const rr = kit.rng("leaves");
    for (const leaf of leaves) {
      const t = clamp(0.5 + ((leaf.x - cx) / (h * 0.8)) * toward);
      kit.style.area(ctx, blob(leaf.x, leaf.y, leaf.s * 1.25, leaf.s, rr, 0.3, 12), mix(dark, lit, t * 0.85), rr, { layers: 7, spread: 5, grain: 0.5 });
    }
  };
  const crown = blob(cx, cy, h * 0.42, h * 0.28, r, 0.1, 18);
  kit.sketch.push(trunk, [...crown, crown[0]]);
  kit.add("tree", "shapes", kit.deps(), [sprite(inside([x - h * 0.7, base - h * 1.15, h * 1.4, h * 1.25]), paint, mask.sweep("up", 40, kit.seed("tree")))], 0.9);
}

function grass(kit, colors, { count = 900, tall = 1, top = kit.L.groundAt, id = "grass" } = {}) {
  const { L, pal, style } = kit;
  const r = kit.rng(id);
  const wind = r.range(-0.25, 0.25);
  const lit = pal.low || pal.time === "golden";
  const strokes = [];
  for (let i = 0; i < count; i++) {
    const x = r.range(-20, W + 20);
    const y0 = top(x) + 2;
    const y = y0 + (H + 30 - y0) * r() ** 0.75;
    const near = clamp((y - L.horizon) / (H - L.horizon));
    const h = (7 + near * 52) * r.range(0.55, 1.25) * tall;
    const lean = (wind + r.gauss() * 0.22) * h;
    const pts = [0, 0.3, 0.6, 0.85, 1].map((k) => [x + lean * k * k, y - h * k]);
    let color = pal.grade(r.pick(colors), 0.55 + near * 0.45);
    if (lit && r.chance(0.3)) color = mix(color, pal.light, 0.35);
    const width = (1.1 + near * 3.4) * r.range(0.7, 1.2);
    const lens = lengths(pts);
    strokes.push(vector((ctx, p) => style.line(ctx, pts, width, color, p, lens), clamp(x / W) * 0.72 + r() * 0.2, 0.1));
  }
  strokes.sort((a, b) => a.a - b.a);
  kit.add(id, "details", kit.deps(), strokes, 1.5);
}

function flowers(kit, colors) {
  const { L, pal, style } = kit;
  const r = kit.rng("flowers");
  const list = Array.from({ length: 150 }, () => {
    const x = r.range(10, W - 10);
    const y0 = L.groundAt(x) + 10;
    const y = y0 + (H - y0) * r() ** 0.7;
    const near = clamp((y - L.horizon) / (H - L.horizon));
    return { x, y, s: 1.6 + near * 6.5, c: pal.night ? pal.grade(r.pick(colors), 0.7) : pal.finish(r.pick(colors)), t: clamp(x / W) * 0.7 + r() * 0.3 };
  });
  const paint = (ctx) => {
    const rr = kit.rng("petals");
    const stem = pal.grade(pal.land.grass?.[1] || "#4f8139", 0.85);
    for (const f of list) {
      style.line(ctx, [[f.x, f.y + f.s * 3], [f.x + rr.range(-2, 2), f.y + f.s]], Math.max(1, f.s * 0.28), stem, 1);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + rr();
        style.dab(ctx, f.x + Math.cos(a) * f.s * 0.6, f.y + Math.sin(a) * f.s * 0.45, f.s * 0.55, f.c, rr);
      }
      style.dab(ctx, f.x, f.y, f.s * 0.3, pal.finish("#f2c94c"), rr);
    }
  };
  kit.add("flowers", "details", kit.deps("extras"), [sprite([0, L.horizon - 20, W, H - L.horizon + 30], paint, mask.dabs(list.map((f) => [f.x, f.y, f.s * 3.4, f.t])), { feather: 4 })], 0.8);
}

function waterSprite(kit, id, y0, y1, stops, extra) {
  const { style, pal } = kit;
  const poly = [[-60, y0], [W + 60, y0], [W + 60, y1], [-60, y1]];
  const fill = vgrad(y0, y1, stops);
  const paint = (ctx) => {
    style.area(ctx, poly, fill, kit.rng(id), { spread: 4, layers: 10, grain: 0.3 });
    ctx.save();
    trace(ctx, poly);
    ctx.clip();
    extra?.(ctx);
    const r = kit.rng(id + "streaks");
    for (let k = 0; k < 60; k++) {
      const t = r() ** 1.5;
      const y = y0 + (y1 - y0) * t;
      const len = 40 + r() * 220 * (0.4 + t);
      const x = r.range(-40, W);
      style.line(ctx, [[x, y], [x + len, y + r.range(-1, 1)]], 1 + t * 3, mix(pal.light, pal.sky[3], 0.5), 1);
    }
    ctx.restore();
  };
  kit.add(id, "shapes", kit.deps("skyTint"), [sprite([-30, y0 - 20, W + 60, y1 - y0 + 40], paint, mask.bands(4, 0.005, kit.seed(id)), { feather: 12 })], 1.2);
}

function ripples(kit, y0, y1, count = 70) {
  const { pal, style } = kit;
  const r = kit.rng("ripples");
  const strokes = Array.from({ length: count }, () => {
    const t = r() ** 1.3;
    const y = y0 + (y1 - y0) * t;
    const x = r.range(0, W);
    const len = 12 + t * 60;
    const pts = [[x, y], [x + len * 0.5, y - 1], [x + len, y]];
    const color = r.chance(0.5) ? mix(pal.light, "#ffffff", 0.3) : pal.grade(pal.land.water?.[1] || pal.land.sea?.[1] || "#3b6684", 1);
    const lens = lengths(pts);
    return vector((ctx, p) => style.line(ctx, pts, 1 + t * 2.2, color, p, lens), r() * 0.9, 0.1);
  }).sort((a, b) => a.a - b.a);
  kit.add("ripples", "details", kit.deps(), strokes, 0.6);
}

const PLACES = {
  meadow(kit) {
    const { L, pal } = kit;
    const l = pal.land;
    const mid = ridge(kit.noise("mid"), L.horizon + 72, 32, 0.0026);
    hill(kit, "far", ridge(kit.noise("far"), L.horizon - 6, 34, 0.0021), pal.grade(l.far, 0.1));
    hill(kit, "far2", ridge(kit.noise("far2"), L.horizon + 26, 22, 0.0032), pal.grade(mix(l.far, l.mid, 0.5), 0.3), { dir: "left" });
    fog(kit, L.horizon + 20);
    hill(kit, "mid", mid, vgrad(L.horizon + 40, L.horizon + 200, [pal.grade(l.mid, 0.5), pal.grade(l.near, 0.7)]));
    if (has(kit, "trees") || kit.rng("lonely").chance(0.45)) {
      const x = clamp(L.cx - L.side * kit.rng("tx").range(330, 460), 120, W - 120);
      const y = mid[Math.round((x + 60) / 12)][1] + 26;
      lonelyTree(kit, x, y, kit.rng("th").range(230, 290));
    }
    hill(kit, "near", L.nearTop, vgrad(L.near - 40, H, [pal.grade(l.near, 0.85), pal.grade(l.deep, 1)]), { dir: "left", weight: 1.2 });
    grass(kit, l.grass);
    if (has(kit, "flowers")) flowers(kit, l.bloom);
  },

  beach(kit) {
    const { L, pal } = kit;
    const l = pal.land;
    const r = kit.rng("beach");
    if (r.chance(0.7)) {
      const left = L.sun.x > W / 2;
      const n = kit.noise("headland");
      const top = [];
      for (let x = -60; x <= W + 60; x += 12) {
        const edge = left ? x : W - x;
        const env = clamp(1 - edge / 520) ** 1.4;
        top.push([x, L.horizon + 4 - env * (70 + n(x * 0.01, 3) * 60)]);
      }
      hill(kit, "headland", top, pal.grade(l.far, 0.15), { bottom: L.horizon + 30, dir: left ? "right" : "left", weight: 0.6 });
    }
    fog(kit, L.horizon - 6);
    const sea = [mix(pal.sky[4], pal.grade(l.sea[0], 0.3), 0.45), pal.grade(l.sea[0], 0.45), pal.grade(l.sea[1], 0.85)];
    waterSprite(kit, "sea", L.horizon - 1, L.shore + 10, sea);
    const n = kit.noise("shore");
    const shoreLine = (y, amp) => {
      const pts = [];
      for (let x = -60; x <= W + 60; x += 14) pts.push([x, y + (n(x * 0.004, 3) - 0.5) * amp + Math.sin(x * 0.012) * 3]);
      return pts;
    };
    const wet = shoreLine(L.shore, 10);
    hill(kit, "wet", wet, vgrad(L.shore, L.shore + 50, [mix(pal.grade(l.sand[1], 0.8), pal.sky[4], 0.35), pal.grade(l.sand[1], 0.85)]), { bottom: L.shore + 60, weight: 0.5 });
    hill(kit, "sand", shoreLine(L.shore + 30, 14), vgrad(L.shore + 30, H, [pal.grade(l.sand[0], 0.8), pal.grade(l.sand[1], 1)]), { dir: "left" });
    const foam = [0, 1, 2].map((k) => {
      const pts = wet.map(([x, y]) => [x, y - 4 - k * 9 + Math.sin(x * 0.02 + k) * 3]);
      const lens = lengths(pts);
      const color = mix(l.foam, pal.light, 0.2);
      return vector((ctx, p) => kit.style.line(ctx, pts, 3.2 - k * 0.7, pal.finish(color), p, lens), k * 0.25, 0.6);
    });
    kit.add("foam", "details", kit.deps(), foam, 0.6);
    ripples(kit, L.horizon + 6, L.shore - 12);
  },

  mountains(kit) {
    const { L, pal } = kit;
    const l = pal.land;
    const snow = pal.grade(mix(l.snow, pal.light, pal.low ? 0.45 : 0.12), 0.25);
    const back = peaks(kit.noise("peaks"), L.horizon - 20, 400, 0.0016);
    const range = peaks(kit.noise("range"), L.horizon + 14, 230, 0.0025);
    hill(kit, "peaks", back, vgrad(L.horizon - 420, L.horizon, [pal.grade(l.far, 0.05), pal.grade(l.rock, 0.2)]), { snow: { line: snowline(back, L.horizon - 20, 0.42), color: snow } });
    hill(kit, "range", range, vgrad(L.horizon - 230, L.horizon + 20, [pal.grade(l.mid, 0.3), pal.grade(l.rock, 0.45)]), { snow: { line: snowline(range, L.horizon + 14, 0.3), color: pal.grade(snow, 0.5) }, dir: "left" });
    if (kit.scene.weather === "fog" || kit.rng("mist").chance(0.4)) mist(kit, "valley", L.horizon - 50, 90, 0.55);
    const foot = ridge(kit.noise("foot"), L.horizon + 58, 36, 0.003);
    hill(kit, "foothills", foot, vgrad(L.horizon + 20, L.horizon + 160, [pal.grade(mix(l.mid, l.near, 0.6), 0.5), pal.grade(l.near, 0.7)]));
    const r = kit.rng("pines");
    const list = [];
    for (let i = 0; i < 16; i++) {
      const x = r.chance(0.5) ? r.range(-20, L.cx - 260) : r.range(L.cx + 260, W + 20);
      const base = foot[clamp(Math.round((x + 60) / 12), 0, foot.length - 1)][1] + r.range(20, 70);
      list.push({ x, base, h: r.range(60, 120), w: r.range(30, 46) });
    }
    pines(kit, "pines", list.sort((a, b) => a.base - b.base), pal.grade(l.deep, 0.75));
    hill(kit, "near", L.nearTop, vgrad(L.near - 40, H, [pal.grade(l.near, 0.85), pal.grade(l.deep, 1)]), { dir: "left", weight: 1.2 });
    grass(kit, l.grass, { count: 650, tall: 0.75 });
    if (has(kit, "flowers")) flowers(kit, ["#f2b3c4", "#f4efe4", "#b89bd8", "#f2cc5f"]);
  },

  forest(kit) {
    const { L, pal } = kit;
    const l = pal.land;
    const r = kit.rng("forest");
    const far = ridge(kit.noise("far"), L.horizon - 8, 16, 0.003);
    hill(kit, "far", far, pal.grade(l.far, 0.1));
    const row = (base, step, lo, hi, w) => {
      const list = [];
      for (let x = -40; x < W + 40; x += r.range(step * 0.7, step * 1.3)) list.push({ x, base: base(x) + r.range(4, 14), h: r.range(lo, hi), w: r.range(w * 0.8, w * 1.2) });
      return list;
    };
    pines(kit, "far-trees", row((x) => far[clamp(Math.round((x + 60) / 12), 0, far.length - 1)][1], 20, 26, 66, 22), pal.grade(l.far, 0.15), { weight: 0.9 });
    fog(kit, L.horizon + 10);
    const mid = ridge(kit.noise("mid"), L.horizon + 52, 18, 0.003);
    hill(kit, "mid", mid, pal.grade(l.mid, 0.4), { dir: "left" });
    pines(kit, "mid-trees", row((x) => mid[clamp(Math.round((x + 60) / 12), 0, mid.length - 1)][1], 34, 70, 150, 44).filter((t) => Math.abs(t.x - L.cx) > 120 || t.h < 95), pal.grade(l.mid, 0.5), { weight: 1 });
    hill(kit, "near", L.nearTop, vgrad(L.near - 30, H, [pal.grade(l.near, 0.8), pal.grade(l.deep, 1)]), { weight: 1.1 });
    const framing = [
      { x: r.range(-60, 60), base: H + 40, h: r.range(620, 780), w: r.range(190, 250) },
      { x: r.range(110, 200), base: H + 60, h: r.range(480, 600), w: r.range(150, 200) },
      { x: W - r.range(-60, 60), base: H + 40, h: r.range(620, 780), w: r.range(190, 250) },
    ];
    pines(kit, "framing", framing, pal.grade(l.deep, 1), { reveal: mask.sweep("up", 50, kit.seed("framing")), weight: 0.8 });
    grass(kit, l.grass, { count: 700 });
    if (has(kit, "flowers")) flowers(kit, ["#f4efe4", "#f2cc5f", "#b89bd8"]);
  },

  lake(kit) {
    const { L, pal } = kit;
    const l = pal.land;
    const far = ridge(kit.noise("far"), L.horizon - 26, 42, 0.0024);
    hill(kit, "far", far, pal.grade(l.far, 0.12), { bottom: L.horizon + 20 });
    const r = kit.rng("shore-trees");
    if (r.chance(0.65)) {
      const list = [];
      for (let x = -30; x < W + 30; x += r.range(14, 30)) list.push({ x, base: far[clamp(Math.round((x + 60) / 12), 0, far.length - 1)][1] + 8, h: r.range(20, 48), w: r.range(14, 22) });
      pines(kit, "far-trees", list, pal.grade(mix(l.far, l.mid, 0.5), 0.2), { weight: 0.6 });
    }
    fog(kit, L.horizon - 4);
    const reflection = mix(pal.grade(l.far, 0.2), pal.grade(l.water[1], 0.6), 0.45);
    const water = [mix(pal.sky[4], pal.grade(l.water[0], 0.3), 0.5), mix(pal.sky[2], pal.grade(l.water[0], 0.5), 0.55), pal.grade(l.water[1], 0.85)];
    waterSprite(kit, "water", L.horizon, L.shore + 10, water, (ctx) => {
      ctx.globalAlpha = 0.55;
      kit.style.area(ctx, [...far.map(([x, y]) => [x, 2 * L.horizon - y]), [W + 60, L.horizon], [-60, L.horizon]], reflection, kit.rng("mirror"), { spread: 5, layers: 6, grain: 0 });
      ctx.globalAlpha = 1;
    });
    hill(kit, "shore", L.nearTop, vgrad(L.near - 20, H, [pal.grade(l.near, 0.8), pal.grade(l.deep, 1)]), { dir: "left" });
    ripples(kit, L.horizon + 30, L.shore - 10, 80);
    const reeds = [];
    const rr = kit.rng("reeds");
    for (let i = 0; i < 90; i++) {
      const x = rr.chance(0.5) ? rr.range(-10, L.cx - 220) : rr.range(L.cx + 220, W + 10);
      const y = L.groundAt(x) + rr.range(4, 40);
      const h = rr.range(50, 130);
      const lean = rr.gauss() * 0.12 * h;
      const pts = [0, 0.4, 0.75, 1].map((k) => [x + lean * k * k, y - h * k]);
      const lens = lengths(pts);
      const color = pal.grade(l.reed, 0.9);
      const head = rr.chance(0.35);
      reeds.push(
        vector((ctx, p) => {
          kit.style.line(ctx, pts, 2.6, color, p, lens);
          if (head && p > 0.9) kit.style.line(ctx, [pts[2], [pts[2][0] + lean * 0.15, pts[2][1] - h * 0.16]], 6, pal.grade("#5a3d26", 0.9), (p - 0.9) * 10);
        }, rr() * 0.85, 0.15)
      );
    }
    kit.add("reeds", "details", kit.deps(), reeds.sort((a, b) => a.a - b.a), 0.8);
    grass(kit, l.grass, { count: 520 });
    if (has(kit, "flowers")) flowers(kit, ["#f4efe4", "#f2cc5f", "#f2b3c4"]);
  },

  city(kit) {
    const { L, pal, style } = kit;
    const l = pal.land;
    const r = kit.rng("city");
    const lightK = { night: 0.5, sunset: 0.3, sunrise: 0.12, golden: 0.08, day: 0 }[kit.scene.time];
    const glow = pal.finish(l.window);
    const skyline = (base, lo, hi, wlo, whi) => {
      const list = [];
      for (let x = -40; x < W + 40; ) {
        const w = r.range(wlo, whi);
        const center = 1 - Math.abs(x - W / 2) / W;
        list.push({ x, w, top: base - r.range(lo, hi) * (0.6 + center * 0.5), spire: r.chance(0.12) });
        x += w + r.range(-6, 4);
      }
      return list;
    };
    const shape = (b, base) => (b.spire ? [[b.x, base], [b.x, b.top], [b.x + b.w * 0.45, b.top], [b.x + b.w * 0.5, b.top - 40], [b.x + b.w * 0.55, b.top], [b.x + b.w, b.top], [b.x + b.w, base]] : [[b.x, base], [b.x, b.top], [b.x + b.w, b.top], [b.x + b.w, base]]);
    const windows = (b, base, size, chance, rand) => {
      const out = [];
      for (let y = b.top + size * 2; y < base - size * 2; y += size * 2.6)
        for (let x = b.x + size * 1.2; x < b.x + b.w - size * 1.2; x += size * 2.2) if (rand.chance(chance)) out.push([x, y, size, rand()]);
      return out;
    };
    const farBase = L.horizon + 18;
    const far = skyline(farBase, 90, 320, 34, 92);
    const farWindows = far.flatMap((b) => windows(b, farBase, 2.4, lightK * 0.8, r));
    const farPaint = (ctx) => {
      const rr = kit.rng("far-city");
      far.forEach((b) => style.area(ctx, shape(b, farBase + 4), pal.grade(l.far, 0.12), rr, { spread: 2, layers: 6, grain: 0.3 }));
      ctx.fillStyle = glow;
      farWindows.forEach(([x, y, s]) => ctx.fillRect(x, y, s, s * 1.3));
    };
    far.forEach((b) => kit.sketch.push([[b.x, farBase], [b.x, b.top], [b.x + b.w, b.top]]));
    kit.add("far-city", "shapes", kit.deps(), [sprite([-40, 200, W + 80, farBase - 160], farPaint, mask.sweep("right", 40, kit.seed("far-city")))], 1);
    fog(kit, L.horizon - 20);
    const midBase = L.horizon + 62;
    const mid = skyline(midBase, 70, 240, 50, 130);
    kit.add("mid-city", "shapes", kit.deps(), [sprite([-40, 300, W + 80, midBase - 260], (ctx) => mid.forEach((b) => style.area(ctx, shape(b, midBase + 4), pal.grade(l.mid, 0.45), kit.rng("mid-city"), { spread: 2, layers: 6, grain: 0.3 })), mask.sweep("left", 40, kit.seed("mid-city")))], 1);
    const roof = pal.grade(l.roof, 0.95);
    hill(kit, "rooftop", L.nearTop, vgrad(L.near, H, [roof, pal.grade(l.deep, 1)]), { weight: 1.1 });
    kit.add("ledge", "shapes", kit.deps(), [sprite([-30, L.near - 20, W + 60, 40], (ctx) => style.area(ctx, [[-60, L.near - 9], [W + 60, L.near - 9], [W + 60, L.near + 12], [-60, L.near + 12]], mix(roof, pal.light, 0.22), kit.rng("ledge"), { spread: 1.5, layers: 6, grain: 0.3 }), mask.sweep("right", 20, kit.seed("ledge")))], 0.4);
    const midWindows = mid.flatMap((b) => windows(b, midBase, 4.2, Math.max(0.08, lightK), r));
    const day = lightK < 0.05;
    const windowColor = day ? pal.finish(mix("#cfe2f2", pal.light, 0.3)) : glow;
    kit.add("windows", "details", kit.deps(), [sprite([-40, 300, W + 80, midBase - 260], (ctx) => {
      ctx.fillStyle = windowColor;
      ctx.globalAlpha = day ? 0.35 : 0.92;
      midWindows.forEach(([x, y, s]) => ctx.fillRect(x, y, s, s * 1.35));
      ctx.globalAlpha = 1;
    }, mask.dabs(midWindows.map(([x, y, s, t]) => [x + s / 2, y + s / 2, s * 1.6, t]), 0.04), { feather: 2 })], 0.9);
  },

  snow(kit) {
    const { L, pal } = kit;
    const l = pal.land;
    const mid = ridge(kit.noise("mid"), L.horizon + 64, 34, 0.0026);
    hill(kit, "far", ridge(kit.noise("far"), L.horizon - 10, 40, 0.002), pal.grade(l.far, 0.1));
    fog(kit, L.horizon + 10);
    hill(kit, "mid", mid, vgrad(L.horizon + 30, L.horizon + 200, [pal.grade(l.mid, 0.5), pal.grade(l.deep, 0.7)]), { dir: "left" });
    const r = kit.rng("pines");
    const list = [];
    for (let i = 0; i < 18; i++) {
      const x = r.chance(0.5) ? r.range(-20, L.cx - 240) : r.range(L.cx + 240, W + 20);
      list.push({ x, base: mid[clamp(Math.round((x + 60) / 12), 0, mid.length - 1)][1] + r.range(10, 50), h: r.range(70, 150), w: r.range(34, 52) });
    }
    pines(kit, "pines", list.sort((a, b) => a.base - b.base), pal.grade(l.pine, 0.75), { snow: pal.grade(mix(l.near, pal.light, 0.25), 0.8) });
    hill(kit, "near", L.nearTop, vgrad(L.near - 40, H, [pal.grade(l.near, 0.85), pal.grade(l.deep, 1)]), { weight: 1.2 });
    grass(kit, ["#8b7a5c", "#a08f6a", "#6e6248"], { count: 110, tall: 0.7, id: "tufts" });
  },
};

export function land(kit) {
  PLACES[kit.scene.place](kit);
}

export function groundWash(kit) {
  const { L, pal } = kit;
  const l = pal.land;
  const by = {
    meadow: [l.far, l.mid, l.near, l.deep],
    beach: [l.sea?.[0], l.sea?.[1], l.sand?.[0], l.sand?.[1]],
    mountains: [l.mid, l.near, l.deep],
    forest: [l.mid, l.near, l.deep],
    lake: [l.water?.[0], l.water?.[1], l.near, l.deep],
    city: [l.mid, l.near, l.roof, l.deep],
    snow: [l.far, l.mid, l.near, l.deep],
  }[kit.scene.place];
  const stops = by.map((c, i) => pal.grade(c, 0.3 + (0.7 * i) / (by.length - 1)));
  const poly = [[-60, L.horizon - 6], [W + 60, L.horizon - 6], [W + 60, H + 60], [-60, H + 60]];
  kit.add("ground", "wash", kit.deps(), [sprite([-30, L.horizon - 40, W + 60, H - L.horizon + 70], (ctx) => kit.style.area(ctx, poly, vgrad(L.horizon, H, stops), kit.rng("ground"), { layers: 10, alpha: 0.15 }), mask.bands(4, 0.01, kit.seed("ground")), { feather: 14, res: 0.6 })], 1.1);
}

export function mist(kit, id, y, height, strength = 0.5, phase = "shapes") {
  const { pal } = kit;
  const r = kit.rng(id);
  const color = mix(pal.haze, "#ffffff", 0.25);
  const blobs = Array.from({ length: 14 }, () => blob(r.range(-100, W + 100), y + r.gauss() * height * 0.25, r.range(160, 340), height * r.range(0.25, 0.5), r, 0.25, 14));
  const paint = (ctx) => blobs.forEach((b) => kit.style.area(ctx, b, color, kit.rng(id + "m"), { layers: 6, spread: 18, alpha: 0.09 * strength * 2, opacity: 0.3 * strength, grain: 0 }));
  kit.add(id, phase, kit.deps(), [sprite([-30, y - height * 1.5, W + 60, height * 3], paint, mask.sweep("right", 90, kit.seed(id)), { feather: 12, res: 0.5 })], 0.6);
}
