import * as THREE from "three";
import { random } from "../../random";
import { Kit } from "../form/building";
import { noise3 } from "../noise";
import { mixColor, rgb } from "../palette";
import { filaments } from "./filaments";
import { COMMON } from "./glsl";
import { lineSystem } from "./slices";
import { cloudBank } from "./storm";
import { surfaceSystem } from "./surface";
import { growTree, trees } from "./trees";

const CROPS = {
  wheat: { ground: "#c9a557", strand: ["#e8c877", "#b88c3c"] },
  lavender: { ground: "#5f6a46", row: ["#a28bd8", "#7f68bd"] },
  plowed: { ground: "#7a5a3c", row: ["#5a3f28", "#94704c"] },
  greens: { ground: "#4f7a3a", row: ["#86bd55", "#5c923f"] },
  sunflower: { ground: "#556f38", row: ["#f2c230", "#7a5524"] },
  meadow: { ground: "#6f9a4a", strand: ["#4f7f37", "#a9c45f"] },
  pasture: { ground: "#8bb15a", strand: ["#6d9a43", "#b7cf6d"] },
  yard: { ground: "#7fae52", strand: ["#5f8f3e", "#a3c765"] },
};
const BLOOMS = ["#d83b2b", "#f4f1e8", "#f2c230", "#8d6cc9", "#4f74c9", "#e58bb0", "#f08a3c"];

export function natural(plan, urban) {
  const s = plan.world.setting;
  return !urban && ["meadow", "ground", "forest", "mountains", "snowfield"].includes(s);
}

export function planFields(ctx, scene, placed) {
  const { plan } = ctx;
  const rand = random((plan.seed ^ 0x6c8e9cf5) >>> 0);
  const n = noise3((plan.seed + 91) >>> 0);
  const R = scene.stage;
  const setting = plan.world.setting;
  const season = plan.world.season;
  const winter = season === "winter" || setting === "snowfield" || plan.world.weather === "snow";
  const forest = setting === "forest";
  const alpine = setting === "mountains" || setting === "snowfield";
  const hero = placed[0];
  const heroR = hero ? Math.max(Math.abs(hero.box.max[0] - hero.box.min[0]), Math.abs(hero.box.max[2] - hero.box.min[2])) * 0.62 + 2 : 3;
  const pool = forest || alpine ? ["meadow", "meadow", "pasture"] : winter ? ["pasture", "plowed", "pasture"] : season === "fall" ? ["wheat", "wheat", "plowed", "pasture", "meadow", "greens"] : season === "spring" ? ["meadow", "meadow", "greens", "pasture", "lavender"] : ["wheat", "lavender", "meadow", "greens", "pasture", "plowed", "sunflower", "meadow"];
  const count = 6 + Math.floor(rand() * 5);
  const seeds = [];
  for (let i = 0, tries = 0; i < count && tries < 200; tries++) {
    const a = rand() * Math.PI * 2;
    const r = heroR + rand() * (R - heroR);
    const x = scene.cx + Math.cos(a) * r;
    const z = scene.cz + Math.sin(a) * r;
    if (seeds.some((q) => Math.hypot(q.x - x, q.z - z) < R * 0.28)) continue;
    seeds.push({ x, z, kind: pool[Math.floor(rand() * pool.length)], dir: rand() * Math.PI });
    i++;
  }
  const front = hero ? new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), hero.spot.yaw) : new THREE.Vector3(1, 0, 0);
  const path = [];
  const driven = hero?.subject.form === "vehicle" && !["galleon", "boat", "sailboat"].includes(hero.form.extra?.style);
  if (hero && !forest) {
    const start = driven ? -R * 1.05 : Math.max(Math.abs(hero.box.max[0]), Math.abs(hero.box.min[0])) + 1;
    let x = hero.spot.x + front.x * start;
    let z = hero.spot.z + front.z * start;
    let dir = Math.atan2(front.z, front.x);
    for (let d = 0; d < R * 2.4 && (driven ? d < R * 2.15 : Math.hypot(x - scene.cx, z - scene.cz) < R * 0.98); d += 1.2) {
      if (Math.hypot(x - scene.cx, z - scene.cz) < R * 0.98) path.push([x, z]);
      dir += n(d * 0.05, 4.4, 0) * (driven && Math.abs(d - R * 1.05) < heroR * 2 ? 0 : 0.1);
      x += Math.cos(dir) * 1.2;
      z += Math.sin(dir) * 1.2;
    }
  }
  const pathW = driven ? Math.max(1.6, Math.abs(hero.box.max[2] - hero.box.min[2]) * 0.95) : Math.max(1.1, heroR * 0.12);
  const onPath = (x, z) => {
    for (let i = 0; i < path.length; i += 1) if (Math.hypot(path[i][0] - x, path[i][1] - z) < pathW) return true;
    return false;
  };
  const near = (x, z) => {
    let a = -1;
    let b = -1;
    let da = Infinity;
    let db = Infinity;
    seeds.forEach((q, i) => {
      const d = Math.hypot(q.x - x, q.z - z) * (1 + n(x * 0.04, i, z * 0.04) * 0.25);
      if (d < da) [b, db, a, da] = [a, da, i, d];
      else if (d < db) [b, db] = [i, d];
    });
    return { a, b, da, db };
  };
  const yard = (x, z) => (hero && !driven ? Math.hypot(x - hero.spot.x, z - hero.spot.z) < heroR * 1.25 : false);
  const kind = (x, z) => {
    if (yard(x, z)) return "yard";
    if (!seeds.length) return "meadow";
    return seeds[near(x, z).a].kind;
  };
  const tint = (x, z) => {
    if (onPath(x, z)) return { color: rgb(winter ? "#d8dadc" : driven ? "#8f826f" : "#b8a07c"), k: 0.95 };
    const k = kind(x, z);
    const base = rgb(CROPS[k].ground);
    return { color: winter && k !== "plowed" ? mixColor(base, [0.94, 0.95, 0.97], 0.85) : base, k: 0.85 };
  };
  return { seeds, path, pathW, onPath, kind, near, yard, tint, front, heroR, winter, forest, alpine, n, rand, driven };
}

const flowerVertex = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec2 aInfo;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = clamp((uT - aInfo.x) / 1.2, 0.0, 1.0);
  vec3 p = position + vec3(sin(uT * 1.3 + aInfo.y * 30.0), 0.0, cos(uT * 1.1 + aInfo.y * 20.0)) * 0.04 * g;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  vColor = fogged(shade(aColor, world.xyz, vec3(0.0, 1.0, 0.0), 1.0) * 1.15, -mv.z);
  vAlpha = easeOut(g);
  gl_PointSize = clamp(uPx * uScale / -mv.z * easeOut(g), 0.0, 6.0);
}
`;

const flowerFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = atan(c.y, c.x);
  float r = length(c) * 2.0;
  float petal = 0.72 + 0.28 * cos(a * 5.0);
  if (r > petal || vAlpha < 0.01) discard;
  vec3 col = r < 0.32 ? mix(vColor, vec3(0.95, 0.75, 0.2), 0.7) : vColor;
  gl_FragColor = vec4(col, vAlpha);
}
`;

export function nature(ctx, scene, terrainShape, placed, fields) {
  const { plan, W, quality } = ctx;
  const { rand, n } = fields;
  const R = scene.stage;
  const height = (x, z) => (terrainShape ? terrainShape.height(x, z) : 0);
  const rim = (x, z) => (terrainShape?.coast ? 1 - Math.min(1, Math.max(0, (Math.hypot(x - scene.cx, z - scene.cz) - R * 0.86) / (R * 0.14))) : 1);
  const thin = (x, z) => {
    const t = Math.min(1, Math.max(0, (Math.hypot(x - scene.cx, z - scene.cz) / R - 0.5) / 0.45));
    return rand() < t * t * (3 - 2 * t);
  };
  const ground = (x, z) => height(x, z) * rim(x, z);
  const inside = (x, z, pad = 0) => Math.hypot(x - scene.cx, z - scene.cz) < R * 0.95 - pad;
  const heroH = Math.max(3, scene.height);
  const scale = Math.min(2.2, Math.max(0.6, heroH / 9));
  const occupied = placed.map((p) => ({ x: p.spot.x, z: p.spot.z, r: Math.max(Math.abs(p.box.max[0] - p.box.min[0]), Math.abs(p.box.max[2] - p.box.min[2])) * 0.55 + 0.8 }));
  const clear = (x, z, r = 0) => occupied.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
  const reveal = (x, z) => W.structure[0] + 1 + (Math.hypot(x - scene.cx, z - scene.cz) / R) * 3.5;
  const systems = [];

  const budget = Math.round((fields.forest ? 30000 : 64000) * quality);
  const st = { root: [], normal: [], flow: [], info: [], color: [], tip: [], order: [] };
  const wind = [Math.cos(plan.seed), 0, Math.sin(plan.seed)];
  for (let i = 0, tries = 0; i < budget && tries < budget * 3; tries++) {
    const a = rand() * Math.PI * 2;
    const r = rand() ** 0.8 * R * 0.96;
    const x = scene.cx + Math.cos(a) * r;
    const z = scene.cz + Math.sin(a) * r;
    const k = fields.kind(x, z);
    const spec = CROPS[k];
    if (!spec.strand || fields.onPath(x, z) || !clear(x, z) || thin(x, z)) continue;
    if (fields.winter && rand() < 0.75) continue;
    i++;
    const tall = k === "wheat" ? 1.05 : k === "meadow" ? 0.75 : k === "pasture" ? 0.5 : 0.3;
    const len = tall * scale * (0.6 + rand() * 0.7) * (fields.forest ? 0.6 : 1);
    const y = ground(x, z);
    const flow = [wind[0] * 0.35 + (rand() - 0.5) * 0.4, 1, wind[2] * 0.35 + (rand() - 0.5) * 0.4];
    const fl = Math.hypot(...flow);
    const c0 = rgb(spec.strand[0]);
    const c1 = rgb(spec.strand[1]);
    const t = rand();
    const hue = (n(x * 0.15, 2, z * 0.15) + 1) * 0.5;
    st.root.push(x, y, z);
    st.normal.push(0, 1, 0);
    st.flow.push(flow[0] / fl, flow[1] / fl, flow[2] / fl);
    st.info.push(reveal(x, z) + 1 + rand() * 0.8, len, rand(), 1);
    st.color.push(...mixColor(c0, c1, t * 0.3 + hue * 0.2).map((v) => v * 0.7));
    st.tip.push(...mixColor(c0, c1, 0.5 + t * 0.5 + hue * 0.2));
    st.order.push(r / R);
  }
  const ns = st.order.length;
  if (ns) {
    const strands = { n: ns, root: new Float32Array(st.root), normal: new Float32Array(st.normal), flow: new Float32Array(st.flow), info: new Float32Array(st.info), color: new Float32Array(st.color), tip: new Float32Array(st.tip), order: new Float32Array(st.order) };
    systems.push(filaments(ctx, strands, { segments: 4, lift: 0.55, droop: 0, wind: 0.12, opacity: 0.95, grow: 1.4 }));
  }

  const lp = [];
  const lc = [];
  const ln = [];
  const li = [];
  const spacing = Math.min(2.2, Math.max(0.7, R / 48));
  for (const seed of fields.seeds) {
    const spec = CROPS[seed.kind];
    if (!spec.row) continue;
    const dir = [Math.cos(seed.dir), Math.sin(seed.dir)];
    const across = [-dir[1], dir[0]];
    const c0 = rgb(spec.row[0]);
    const c1 = rgb(spec.row[1]);
    for (let o = -R; o <= R; o += spacing) {
      for (let t = -R; t <= R; t += 0.9) {
        const x0 = seed.x + across[0] * o + dir[0] * t;
        const z0 = seed.z + across[1] * o + dir[1] * t;
        const x1 = x0 + dir[0] * 0.9;
        const z1 = z0 + dir[1] * 0.9;
        if (!inside(x0, z0, 0.5) || !inside(x1, z1, 0.5)) continue;
        if (fields.kind(x0, z0) !== seed.kind || fields.kind(x1, z1) !== seed.kind) continue;
        if (fields.onPath(x0, z0) || !clear(x0, z0) || thin(x0, z0)) continue;
        const col = Math.round(o / spacing) % 2 ? c0 : c1;
        lp.push(x0, ground(x0, z0) + 0.06, z0, x1, ground(x1, z1) + 0.06, z1);
        lc.push(...col, ...col);
        ln.push(0, 1, 0, 0, 1, 0);
        const b = reveal(x0, z0) + 0.6;
        li.push(b, 0, 0, b, 1, 0);
      }
    }
  }
  if (lp.length) systems.push(lineSystem(ctx, { pos: lp, col: lc, nrm: ln, info: li }, { alpha: 0.95, draw: 0.5, gain: 1.15, bias: 0.0004 }));

  if (!fields.winter) {
    const fp = [];
    const fc = [];
    const fi = [];
    const clusters = Math.round((fields.forest ? 10 : 34) * Math.max(0.6, quality));
    for (let c = 0; c < clusters; c++) {
      const a = rand() * Math.PI * 2;
      const r = rand() ** 0.8 * R * 0.92;
      const cx = scene.cx + Math.cos(a) * r;
      const cz = scene.cz + Math.sin(a) * r;
      const k = fields.kind(cx, cz);
      if (k !== "meadow" && k !== "pasture" && k !== "yard") continue;
      const bloom = rgb(BLOOMS[Math.floor(rand() * BLOOMS.length)]);
      const many = Math.round((k === "meadow" ? 90 : 40) * (0.5 + rand()));
      const spread = (1.5 + rand() * 3) * scale;
      for (let f = 0; f < many; f++) {
        const x = cx + (rand() + rand() - 1) * spread;
        const z = cz + (rand() + rand() - 1) * spread;
        if (!inside(x, z, 0.5) || fields.onPath(x, z) || !clear(x, z)) continue;
        fp.push(x, ground(x, z) + (0.35 + rand() * 0.45) * scale, z);
        fc.push(...bloom.map((v) => Math.min(1, v * (0.85 + rand() * 0.3))));
        fi.push(reveal(x, z) + 2.5 + rand(), rand());
      }
    }
    if (fp.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(fp), 3));
      g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(fc), 3));
      g.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(fi), 2));
      const pts = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { ...ctx.U, uPx: { value: 0.22 * scale } }, vertexShader: flowerVertex, fragmentShader: flowerFragment, transparent: true }));
      pts.frustumCulled = false;
      systems.push({ object: pts });
    }
  }

  const list = [];
  const conifer = fields.alpine || fields.winter;
  const want = fields.forest ? 26 : fields.alpine ? 16 : 14;
  for (let i = 0, tries = 0; list.length < want && tries < 4000; tries++) {
    const a = rand() * Math.PI * 2;
    const r = rand() ** 0.8 * R * 0.9;
    const x = scene.cx + Math.cos(a) * r;
    const z = scene.cz + Math.sin(a) * r;
    if (!inside(x, z, 2) || fields.onPath(x, z) || !clear(x, z, 2.5)) continue;
    const toward = Math.cos(a) * scene.view.x + Math.sin(a) * scene.view.z;
    if (toward > 0.5 && r < R * 0.85) continue;
    const near = fields.near(x, z);
    const border = fields.seeds.length < 2 || Math.abs(near.db - near.da) < R * 0.05;
    if (!fields.forest && !border && rand() < 0.85) continue;
    if (list.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2 * scale)) continue;
    const h = heroH * (0.65 + rand() * 0.55) * (conifer ? 1.15 : 1);
    const tree = growTree(rand, conifer && rand() < 0.85 ? "conifer" : "broad", h);
    list.push({ rand, x, z, scale: 1, delay: (r / R) * 2.2, tree, y: ground(x, z) });
    i++;
  }
  if (list.length) {
    const sys = trees(ctx, list, { leafSize: 0.32 * scale, window: [W.form[0] + 0.5, W.detail[1] - 1], dense: 2 });
    systems.push(sys);
  }

  const k = new Kit();
  if (!fields.forest && fields.path.length > 6 && !fields.driven) {
    for (let i = 4; i < fields.path.length - 2; i += 2) {
      const [x, z] = fields.path[i];
      const [x2, z2] = fields.path[i + 2];
      const d = [x2 - x, z2 - z];
      const L = Math.hypot(...d) || 1;
      const side = [-d[1] / L, d[0] / L];
      for (const s of [-1, 1]) {
        const px = x + side[0] * s * (fields.pathW + 0.6);
        const pz = z + side[1] * s * (fields.pathW + 0.6);
        if (!inside(px, pz, 1)) continue;
        k.delay = (Math.hypot(px - scene.cx, pz - scene.cz) / R) * 2;
        const y = ground(px, pz);
        k.box(0.16 * scale, 1.2 * scale, 0.16 * scale, px, y, pz, rgb("#8a6a48"));
        k.box(L + 0.1, 0.09 * scale, 0.07 * scale, px + d[0] / 2, y + 0.75 * scale, pz + d[1] / 2, rgb("#9a7a55"), 0, -Math.atan2(d[1], d[0]));
        k.box(L + 0.1, 0.09 * scale, 0.07 * scale, px + d[0] / 2, y + 0.4 * scale, pz + d[1] / 2, rgb("#9a7a55"), 0, -Math.atan2(d[1], d[0]));
      }
    }
  }
  for (const seed of fields.seeds) {
    if (seed.kind !== "wheat") continue;
    const bales = 2 + Math.floor(rand() * 4);
    for (let b = 0; b < bales; b++) {
      const x = seed.x + (rand() - 0.5) * R * 0.25;
      const z = seed.z + (rand() - 0.5) * R * 0.25;
      if (!inside(x, z, 2) || fields.kind(x, z) !== "wheat" || !clear(x, z, 1.5)) continue;
      const rr = 0.75 * scale;
      const g = new THREE.CylinderGeometry(rr, rr, 1.3 * scale, 18);
      g.rotateZ(Math.PI / 2);
      g.rotateY(rand() * Math.PI);
      g.translate(x, ground(x, z) + rr, z);
      k.delay = reveal(x, z) - W.structure[0];
      k.add(g, rgb("#d9b25e").map((v) => v * (0.9 + rand() * 0.15)));
    }
  }
  for (let i = 0; i < (fields.alpine ? 14 : 6); i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() ** 0.8 * R * 0.9;
    const x = scene.cx + Math.cos(a) * r;
    const z = scene.cz + Math.sin(a) * r;
    if (!inside(x, z, 1) || fields.onPath(x, z) || !clear(x, z, 1)) continue;
    const g = new THREE.DodecahedronGeometry((0.4 + rand() * 0.8) * scale, 0);
    g.scale(1, 0.6, 1.2);
    g.rotateY(rand() * 6);
    g.translate(x, ground(x, z) + 0.1, z);
    k.delay = reveal(x, z) - W.structure[0];
    k.add(g, rgb("#8a857b").map((v) => v * (0.85 + rand() * 0.3)));
  }
  if (k.parts.length) systems.push(surfaceSystem(ctx, k.geometry(), { window: [W.form[0], W.form[0] + 2], grain: 200 / Math.max(1, R), texture: 0.18 }));

  if (!ctx.pal.night && plan.world.weather !== "storm" && plan.world.weather !== "fog") {
    const bank = cloudBank(ctx, scene, { salt: 0x1234, clusters: 4 + Math.floor(rand() * 3), count: 150, height: Math.max(heroH * 2.4, R * 0.5), back: 0.35, drift: 0.12, light: [0.99, 0.99, 0.99], dark: mixColor(ctx.pal.bg, [0.86, 0.88, 0.92], 0.6), start: W.world[0] - 1 });
    systems.push({ object: bank.object });
  }
  return systems;
}
