import { mix } from "./color.js";
import { inner, rooted } from "./ground.js";
import { MATERIAL, micro } from "./materials.js";
import { clamp, lerp, smooth } from "./noise.js";

const CLOUDS = { clear: 0.22, wind: 0.35, fog: 0.5, cloud: 0.65, snow: 0.7, rain: 0.82, storm: 0.96 };
const FOG = { fog: 0.8, snow: 0.3, rain: 0.25, storm: 0.3 };
const UPRIGHT = new Set(["stone", "foliage", "brick", "concrete", "cloud", "smoke", "ice", "wood", "bark"]);
const WIDTHS = [
  [0.05, 0.17],
  [0.06, 0.3],
  [0.08, 0.44],
  [0.1, 0.56],
];
export const PATTERN = 1;
export const SHADOW = 2;
export const GLOW = 12;
export const MIRROR = 16;

function blur(a, w, h, r) {
  const t = new Float32Array(a.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0;
        let c = 0;
        for (let q = Math.max(0, i - r); q <= Math.min(w - 1, i + r); q++) {
          sum += a[j * w + q];
          c++;
        }
        t[j * w + i] = sum / c;
      }
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        let sum = 0;
        let c = 0;
        for (let q = Math.max(0, j - r); q <= Math.min(h - 1, j + r); q++) {
          sum += t[q * w + i];
          c++;
        }
        a[j * w + i] = sum / c;
      }
  }
}

const seedOf = (style) => style.kappa * 31 + style.cap * 7;

const reachOf = (s) => {
  if (s.type === "blob") return [s.x, s.y, Math.max(s.rx, s.ry)];
  const pts = s.type === "tube" ? s.line : s.outline;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2, Math.max(0.4, Math.max(x1 - x0, y1 - y0) / 2)];
};

// The picture as one bas-relief. Z is its height at every node: clouds swell the sky, waves and terrain ripple the bands,
// and each body is a pillow over its whole silhouette with every part standing a little prouder than the one behind.
// F is the family of planes that cuts it, A is how much ink each place wants, sub marks places that take another ink.
export function relief(scene, G, well, n, rand, style) {
  const { W, H } = scene;
  const { nw, nh, RES, rid, gid } = G;
  const size = nw * nh;
  const Z = new Float32Array(size);
  const B = new Float32Array(size);
  const F = new Float32Array(size);
  const A = new Float32Array(size);
  const sub = new Uint8Array(size);
  const regions = [];
  const nx = -Math.sin(style.tilt);
  const ny = Math.cos(style.tilt);
  const at = (x, y) => clamp(Math.round(y * RES), 0, nh - 1) * nw + clamp(Math.round(x * RES), 0, nw - 1);
  const byId = [null, ...G.shapes];

  // lights in the picture: each one tints and feeds the lines around it
  const sources = [];
  for (const s of G.shapes) {
    const mat = MATERIAL[s.material] || MATERIAL.cloth;
    if (s.type === "band" || !(mat.sys === "glow" || mat.kind === "flame")) continue;
    if (!s.thin && !s.seen) continue;
    const [x, y, r] = reachOf(s);
    sources.push({ x, y, r, s, fall: clamp(r * 2.4 + 4, 5, 34) });
  }
  sources.sort((a, b) => b.r - a.r);
  sources.length = Math.min(sources.length, 8);
  const glow = sources.length ? new Float32Array(size) : null;
  const glowBy = sources.length ? new Uint8Array(size) : null;

  // backdrop
  const horizon = G.bands.length ? clamp(G.bands[0].edge.reduce((a, v) => a + v, 0) / nw, H * 0.2, H) : H;
  const STEPS = 14;
  const skyCut = scene.backdrop === "void" ? null : Array.from({ length: STEPS }, (_, q) => well.cut(well.behind(q / (STEPS - 1)), 0));
  const open = scene.backdrop === "sky";
  const cloudy = open ? (style.sky === "calm" ? 0 : (CLOUDS[scene.weather] ?? 0.3)) : scene.backdrop === "room" ? 0 : 0.3;
  const cloudAt = (x, y) => {
    if (!cloudy) return 0;
    const v = n.fbm(x * 0.016 + 3.1, y * 0.042 - 7.7, 4) * 0.5 + 0.5;
    const th = 0.74 - 0.36 * cloudy;
    return smooth(th, th + 0.2, v) * (0.75 + 0.25 * n.domes(x * 0.09, y * 0.16));
  };
  // the sky can also drift in long swells, or swell into a dome around the light
  const swell = open && style.sky === "drift" ? lerp(4, 8, rand()) : 0;
  const halo = open && style.sky === "halo" ? Math.max(W, H) * lerp(0.16, 0.3, rand()) : 0;
  const skyAt = (x, y) => {
    let z = cloudy ? cloudAt(x, y) * (3 + 6 * cloudy) : 0;
    if (swell) z += n.fbm(x * 0.011 + 21, y * 0.024 - 5, 2) * swell;
    if (halo) z += 9 * Math.exp(-((x - scene.light.x) ** 2 + (y - scene.light.y) ** 2) / (halo * halo));
    return z;
  };
  const lit = (inkFn, power) => (lv, x, y, r, sb) => {
    if (sb & GLOW && r() < ((sb >> 2) & 3) * power) return sources[glowBy[at(x, y)]].s.cut.body;
    return inkFn(lv, x, y, r, sb);
  };
  regions[0] = {
    on: Boolean(skyCut),
    j0: 2,
    wlo: 0.09 * style.weight,
    whi: 0.46 * style.weight,
    run: style.sky === "calm" ? 40 : 22,
    rest: 0.5,
    min: 1.2,
    ink: lit((lv, x, y, r) => skyCut[clamp(Math.round((y / horizon) * (STEPS - 1) + (r() - 0.5) * 2.4), 0, STEPS - 1)].body, 0.2),
  };

  // bodies: a compressed pillow over each silhouette
  const cap = style.cap;
  for (const g of G.groups) {
    if (g.band || !g.d) continue;
    const pill = new Float32Array(g.d.length);
    for (let m = 0; m < pill.length; m++) {
      if (!g.mask[m]) continue;
      const t = 1 - Math.min(1, g.d[m] / Math.max(g.R[m], 1e-4));
      pill[m] = cap * (1 - Math.exp((-g.R[m] * (1 - t * t)) / cap));
    }
    g.pill = pill;
  }

  const mirror = new Uint16Array(size);
  for (const s of G.shapes) {
    const mat = MATERIAL[s.material] || MATERIAL.cloth;
    s.mat = mat;
    if (s.type === "band") {
      s.cut = well.cut(s.color, 0.3 * (1 - s.far));
      let top = 0;
      let depth = 0;
      let rough = 0;
      for (let i = 0; i < nw; i++) {
        top += s.edge[i];
        depth += s.floor[i] - s.edge[i];
      }
      top /= nw;
      for (let i = 0; i < nw; i++) rough += Math.abs(s.edge[i] - top);
      s.top = top;
      s.depth = Math.max(1, depth / nw);
      s.upright = UPRIGHT.has(s.material) && (rough / nw > H * 0.02 || s.far < 0.99);
      const water = s.material === "water" || s.material === "ice";
      const wet = new Map();
      regions[s.k] = {
        on: true,
        j0: 1,
        wlo: 0.07 * style.weight,
        whi: 0.4 * style.weight,
        run: water ? 5 : 20,
        rest: water ? 1 : 0.5,
        min: 0.7,
        ink: lit((lv, x, y, r, sb) => {
          if (sb & MIRROR && r() < 0.82) {
            const q = byId[mirror[at(x, y)]];
            if (q) {
              let ink = wet.get(q.k);
              if (ink === undefined) wet.set(q.k, (ink = well.ink(mix(well.inks[q.cut.body], well.inks[s.cut.body], 0.3))));
              return ink;
            }
          }
          if (sb & SHADOW) return r() < 0.7 ? s.cut.deep : s.cut.body;
          return r() < 0.16 ? s.cut.deep : s.cut.body;
        }, water ? 0.24 : 0.02),
      };
      continue;
    }
    const keep = s.role === "focus" || mat.sys === "glow" || mat.kind === "flame";
    s.cut = well.cut(s.color, s.role === "setting" ? 0.12 : 0, keep);
    if (s.pattern && s.color2) s.cut2 = well.cut(s.color2, s.role === "setting" ? 0.12 : 0, keep);
    if (s.thin) continue;
    const count = s.g.members.length;
    s.lift = mat.lift * (0.4 + (0.8 * s.order) / Math.max(1, count - 1)) * style.lift;
    let rmax = 0;
    for (let m = 0; m < s.R.length; m++) if (s.d[m] > 0 && s.R[m] > rmax) rmax = s.R[m];
    s.rmax = rmax;
    s.plate = Boolean(mat.flat) && s.type === "poly";
    s.tau = s.plate ? 0.16 : clamp(0.4 * rmax, 0.22, 1.1);
    const j0 = Math.min(3, (s.role === "setting" ? 1 : 0) + (mat.step || 0));
    const strand = mat.sys === "strand";
    regions[s.k] = {
      on: true,
      j0: strand ? Math.min(3, j0 + 1) : j0,
      wlo: WIDTHS[j0][0] * style.weight,
      whi: WIDTHS[j0][1] * style.weight,
      run: mat.run || 0,
      rest: mat.rest || 0,
      min: 0.3,
      ink: lit((lv, x, y, r, sb) => {
        if (sb & PATTERN && s.cut2) return r() < 0.12 ? s.cut2.deep : s.cut2.body;
        return r() < 0.12 ? s.cut.deep : s.cut.body;
      }, mat.sys === "glow" || mat.kind === "flame" || s.cut.polar < 0 ? 0 : 0.08),
    };
  }

  // pass 1: height and the uncut base everywhere
  for (let j = 0; j < nh; j++) {
    const y = j / RES;
    for (let i = 0; i < nw; i++) {
      const x = i / RES;
      const k = j * nw + i;
      const r = rid[k];
      if (glow) {
        let best = 0;
        for (let q = 0; q < sources.length; q++) {
          const src = sources[q];
          const v = Math.exp(-Math.max(0, Math.hypot(x - src.x, y - src.y) - src.r) / src.fall);
          if (v > best) {
            best = v;
            glowBy[k] = q;
          }
        }
        glow[k] = best;
      }
      if (!r) {
        B[k] = x * nx + y * ny;
        Z[k] = skyAt(x, y);
        continue;
      }
      const s = byId[r];
      if (s.type === "band") {
        const q = Math.max(0, y - s.edge[i]);
        const t = clamp(q / Math.max(0.5, s.floor[i] - s.edge[i]));
        let rel;
        if (s.material === "water") rel = n.fbm((x * 0.085) / (0.3 + t) + s.k, q * (1.5 - 0.9 * t) + s.k, 3) * (0.25 + 1.1 * t);
        else if (s.material === "stone") rel = (n.ridge(x * 0.028 + s.k, y * 0.05, 3) - 0.45) * 4.2 + n.fbm(x * 0.09, y * 0.2 + s.k, 2) * 0.5;
        else if (s.material === "foliage") rel = n.domes(x * 0.22 + s.k, y * 0.3) * 2.4 + n.domes(x * 0.6, y * 0.7 + s.k) * 0.7;
        else if (s.material === "sand" || s.material === "snow") rel = n.fbm(x * 0.035 + s.k * 3, y * 0.11, 3) * 2.2;
        else rel = n.fbm(x * 0.05 + s.k * 3, y * 0.09, 3) * 1.5;
        B[k] = s.upright ? s.top + q : s.top + s.depth * (Math.pow(t + 0.03, 0.62) - 0.11) * 1.25;
        Z[k] = rel * (s.upright ? 1 : 0.55);
        if (s.material === "water" || s.material === "ice") {
          // still water holds a broken image of whatever stands above its far edge
          const my = s.edge[i] - q * 0.92;
          if (my > 0 && q > 0.2) {
            const mx = x + n(x * 0.5, y * 1.7 + s.k) * (0.25 + 1.6 * t);
            const mr = rid[at(mx, my)];
            if (mr && byId[mr].type !== "band" && n(x * 0.9 + 5, y * 2.3) > -0.55 + t * 0.9) mirror[k] = mr;
          }
        }
        continue;
      }
      const g = s.g;
      const b = s.box;
      const m = (j - b.j0) * b.w + (i - b.i0);
      const gm = (j - g.box.j0) * g.box.w + (i - g.box.i0);
      let u;
      let v;
      if (s.type === "tube") {
        u = s.u[m] * s.line.length * 0.35;
        v = s.side[m] * s.R[m];
      } else {
        const px = x - s.axis.cx;
        const py = y - s.axis.cy;
        u = px * s.axis.x + py * s.axis.y;
        v = -px * s.axis.y + py * s.axis.x;
      }
      if (s.cut2) {
        const size2 = Math.max(0.9, s.rmax * 0.62);
        const on = s.pattern === "stripes" ? Math.floor(u / size2 + 100) % 2 === 0 : s.pattern === "checks" ? (Math.floor(u / size2 + 100) + Math.floor(v / size2 + 100)) % 2 === 0 : n.cell(x / (size2 * 1.25) + s.form * 9.7, y / (size2 * 1.25) - s.form * 4.1) < 0.36;
        if (on) sub[k] |= PATTERN;
      }
      const fine = s.mat.micro && s.mat.micro !== "none" ? micro(s.mat.micro, n, s, x, y, u, v) * smooth(0, 0.9, g.d[gm]) * style.micro : 0;
      B[k] = x * nx + y * ny;
      const body = s.plate ? cap * 0.42 * smooth(0, 0.34, g.d[gm]) : g.pill[gm];
      let proud = s.lift * (1 - Math.exp(-Math.max(0, s.d[m]) / s.tau));
      if (s.roots)
        for (const root of s.roots) {
          const share = rooted(s, root, s.u[m], i, j);
          if (!share) continue;
          const p = root.parent;
          proud += (p.lift * (1 - Math.exp(-Math.max(0, inner(p, i, j)) / p.tau)) - proud) * share;
        }
      Z[k] = s.mat.sys === "glow" ? 0 : body + proud + fine;
    }
  }

  // shadows: every body throws its silhouette along the ground, away from the light
  const shade = new Float32Array(size);
  const low = scene.time === "day" ? 0.4 : scene.time === "night" ? 0.7 : 0.95;
  for (const g of G.groups) {
    if (g.band || !g.d) continue;
    const cx = (g.x0 + g.x1) / 2;
    const base = g.y1;
    const under = rid[at(cx, Math.min(H, base + 0.6))];
    if (!under || byId[under].type !== "band") continue;
    let ux = cx - scene.light.x;
    let uy = (base - scene.light.y) * 2.2;
    const ul = Math.hypot(ux, uy) || 1;
    ux /= ul;
    uy /= ul;
    const kx = ux * low;
    const ky = uy * low * 0.45;
    const tall = Math.max(1, g.y1 - g.y0);
    for (let j = 0; j < g.box.h; j++)
      for (let i = 0; i < g.box.w; i++) {
        if (!g.mask[j * g.box.w + i]) continue;
        const x = (i + g.box.i0) / RES;
        const y = (j + g.box.j0) / RES;
        const a = base - y;
        const k = at(x + a * kx, base + a * ky + 0.1);
        const v = 0.95 - 0.5 * (a / tall);
        if (v > shade[k]) shade[k] = v;
      }
  }
  blur(shade, nw, nh, 2);

  // the cutting planes themselves can sway: long swells across the sheet, or the tight wander of a wood grain
  const wx = n(seedOf(style) + 3.7, 9.1) * 40;
  const sway =
    style.sway === "swell"
      ? (x, y) => n.fbm(x * 0.013 + wx, y * 0.017 - wx, 2) * 3.4 * style.surge
      : style.sway === "grain"
        ? (x, y) => n.fbm((x * nx + y * ny) * 0.05 + wx, (x * ny - y * nx) * 0.009 - wx, 3) * 2.1 * style.surge
        : null;

  // pass 2: cut field, light and ink
  const lz = Math.max(W, H) * 0.3;
  const kap = style.bow * style.kappa;
  const fog = FOG[scene.weather] || 0;
  const worn = style.frame === "worn";
  for (let j = 0; j < nh; j++) {
    const y = j / RES;
    for (let i = 0; i < nw; i++) {
      const x = i / RES;
      const k = j * nw + i;
      const r = rid[k];
      const g = gid[r];
      F[k] = B[k] + kap * Z[k] + (sway ? sway(x, y) : 0);
      const z = Z[k];
      const zl = i > 0 && gid[rid[k - 1]] === g ? Z[k - 1] : z;
      const zr = i < nw - 1 && gid[rid[k + 1]] === g ? Z[k + 1] : z;
      const zu = j > 0 && gid[rid[k - nw]] === g ? Z[k - nw] : z;
      const zd = j < nh - 1 && gid[rid[k + nw]] === g ? Z[k + nw] : z;
      const hx = (zr - zl) * RES * 0.5;
      const hy = (zd - zu) * RES * 0.5;
      const dx = scene.light.x - x;
      const dy = scene.light.y - y;
      const dl = Math.hypot(dx, dy, lz);
      const sun = clamp(((-hx * dx - hy * dy + lz) / (dl * Math.hypot(hx, hy, 1))) * 1.12);
      const gl = glow ? glow[k] : 0;
      const edge = Math.min(x, W - x, y, H - y);
      const wear = worn ? smooth(0, 1, (edge + n.fbm(x * 0.07, y * 0.07, 3) * 4.5 + n(x * 0.7, y * 0.7) * 0.5 - 0.4) / 5) : 1;
      const mist = fog ? fog * (0.35 + 0.65 * smooth(-0.3, 0.5, n.fbm(x * 0.012, y * 0.07 + 40, 3))) : 0;
      let a;
      if (!r) {
        if (!skyCut) continue;
        const cut = skyCut[Math.min(STEPS - 1, Math.round(clamp(y / horizon) * (STEPS - 1)))];
        const c = cloudy ? clamp(cloudAt(x, y)) : 0;
        if (cut.polar > 0) a = cut.cover * (scene.backdrop === "sky" ? 0.4 : 0.7) * (0.75 + c * sun * 1.1) + gl * 0.42;
        else a = cut.cover * (1 - c * (0.9 - cloudy * 0.75) + c * (1 - sun) * 1.5 * cloudy) * (1 - gl * 0.3);
        a *= wear * (1 - mist * 0.8);
      } else {
        const s = byId[r];
        const up = s.cut.polar > 0;
        if (s.type === "band") {
          a = s.cut.cover * s.mat.cover * (up ? 0.5 + 0.8 * sun : 0.72 + 0.5 * (1 - sun));
          const sh = shade[k];
          if (up) a = a * (1 - sh * 0.7) + gl * 0.38 * (1 - sh);
          else a = (a + sh * 0.5 * (1 - a)) * (1 - gl * 0.22);
          if (sh > 0.42) sub[k] |= SHADOW;
          if (mirror[k]) {
            sub[k] |= MIRROR;
            a = Math.max(a * 0.8, byId[mirror[k]].cut.cover * 0.8);
          }
          a *= wear * (1 - mist * (0.25 + 0.6 * (1 - s.far)));
        } else {
          const mat = s.mat;
          a = s.cut.cover * (mat.cover || 1) * (mat.sys === "strand" ? 0.42 : 1);
          if (sub[k] & PATTERN) a = Math.max(a, s.cut2.cover * (mat.cover || 1));
          if (up) {
            a *= 0.3 + 1.1 * sun;
            if (mat.gloss) a = Math.min(1, a * (1 + mat.gloss * smooth(0.8, 0.95, sun)));
            a += gl * 0.3 * (1 - a);
          } else {
            a = a * (0.62 + 0.62 * Math.pow(1 - sun, 1.2)) + 0.2 * Math.pow(1 - sun, 1.6) * (1 - a);
            if (mat.gloss) a *= 1 - mat.gloss * smooth(0.78, 0.94, sun);
          }
          if (mat.sys === "glow") a = up ? 0.92 : 0.42;
          if (s.role === "focus") a *= 1.08;
          else a *= lerp(wear, 1, s.role === "support" ? 1 : 0.5) * (1 - mist * (s.role === "support" ? 0.25 : 0.6));
        }
      }
      A[k] = clamp(a);
      if (gl > 0.12) sub[k] |= Math.min(3, Math.floor(gl * 4)) << 2;
    }
  }

  return { F, A, Z, sub, regions, horizon, sources, shade, glow };
}
