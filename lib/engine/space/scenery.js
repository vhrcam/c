import * as THREE from "three";
import { random } from "../../random";
import { noise3 } from "../noise";
import { mixColor, rgb } from "../palette";
import { LOOK, marching, terrain } from "./ground";
import { COMMON } from "./glsl";
import { lineSystem } from "./slices";
import { surfaceSystem } from "./surface";

const ROCK = rgb("#7d786f");
const SNOW = rgb("#eef1f4");
const SAND = rgb("#d8c39a");
const SOIL = rgb("#4a3a2c");

export function stageRadius(scene) {
  return Math.max(scene.radius * 2, scene.radius + 4);
}

export function shape(ctx, scene) {
  const { plan } = ctx;
  const setting = plan.world.setting;
  const text = plan.text.toLowerCase();
  const local = terrain(plan, (plan.seed + 3) >>> 0);
  const n = noise3((plan.seed + 41) >>> 0);
  const R = stageRadius(scene);
  const alpine = setting === "mountains" || /mountain|alps|peak|valley|cliff/.test(text);
  const open = setting === "ocean" && !/beach|coast|shore|island|cliff/.test(text);
  const coast = !open && (setting === "ocean" || /beach|coast|shore|sea|ocean|lake/.test(text));
  const bridge = plan.subjects.find((s) => s.form === "building" && s.building?.style === "bridge");
  const river = Boolean(bridge) && !coast && !open;
  const back = [-scene.view.x, -scene.view.z];
  const backLen = Math.hypot(...back) || 1;
  const flat = scene.radius * 1.15 + 1;
  const rolling = ["meadow", "ground", "forest"].includes(setting) && !/\b(city|street|downtown)\b/.test(text);
  const height = (x, z) => {
    const dx = x - scene.cx;
    const dz = z - scene.cz;
    if (open) return -0.6;
    let h = local(dx, dz, flat) * 0.6;
    if (rolling) {
      const d = Math.hypot(dx, dz);
      const keep = Math.min(1, Math.max(0, (d - flat) / (flat * 1.8)));
      h += (n(dx / (R * 0.38), 7.7, dz / (R * 0.38)) * 0.5 + 0.5) * R * 0.07 * keep;
    }
    const behind = (dx * back[0] + dz * back[1]) / backLen;
    if (alpine) {
      const ridge = 1 - Math.abs(n(dx / (R * 0.22), 3.3, dz / (R * 0.22), 4));
      h += (Math.max(0, behind - flat * 0.8) / Math.max(1, R - flat)) * R * 0.55 * ridge * ridge;
    }
    if (river) {
      const across = Math.abs(dz) / Math.max(3, scene.radius * 0.45);
      h = across < 1 ? -2.2 + across * across * 2 : Math.max(h, 0.8);
    }
    if (coast) {
      const shore = -flat * 0.2 + n(dx * 0.05, 9.1, dz * 0.05) * flat * 0.6;
      const toward = -behind;
      h = toward < shore ? Math.min(h, -0.6 - (shore - toward) * 0.15) : Math.max(h, 0.45);
    }
    return h;
  };
  return { height, R, alpine, coast: coast || river || open, open, flat };
}

function disc(R, rings, segments) {
  const g = new THREE.RingGeometry(0.001, R, segments, rings);
  g.rotateX(-Math.PI / 2);
  return g;
}

export function landscape(ctx, scene, terrainShape, tint) {
  const { plan, pal, W, quality } = ctx;
  const { height, R, coast } = terrainShape;
  const look = LOOK[plan.world.setting] || LOOK.ground;
  const base = (pal.night ? look.night : look.color).map(rgb);
  const geometry = disc(R, Math.round(70 + 50 * quality), Math.round(140 + 80 * quality));
  geometry.translate(scene.cx, 0, scene.cz);
  const pos = geometry.getAttribute("position");
  const n = noise3((plan.seed + 77) >>> 0);
  const rim = (x, z) => 1 - Math.min(1, Math.max(0, (Math.hypot(x - scene.cx, z - scene.cz) - R * 0.86) / (R * 0.14)));
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)) * rim(pos.getX(i), pos.getZ(i)));
  geometry.computeVertexNormals();
  const nrm = geometry.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const winter = plan.world.season === "winter" || plan.world.weather === "snow" || plan.world.setting === "snowfield";
  let top = 0;
  for (let i = 0; i < pos.count; i++) top = Math.max(top, pos.getY(i));
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    let c = mixColor(base[0], base[1], Math.min(1, Math.max(0, n(x * 0.12, 1, z * 0.12) * 0.8 + 0.5)));
    if (slope > 0.3) c = mixColor(c, ROCK, Math.min(1, (slope - 0.3) * 3));
    if ((top > 4 && y > top * 0.6) || (winter && slope < 0.4)) c = mixColor(c, SNOW, 0.9);
    if (tint) {
      const t = tint(x, z);
      if (t) c = mixColor(c, t.color, t.k);
    }
    if (coast && y < 0.7) c = mixColor(c, SAND, Math.min(1, (0.7 - y) * 1.4));
    if (pal.night) c = c.map((v) => v * 0.7);
    colors.set(c, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const depth = Math.max(0.4, R * 0.07);
  const skirt = new THREE.CylinderGeometry(R, R * 0.97, depth, 160, 6, true);
  skirt.translate(scene.cx, -depth / 2, scene.cz);
  const sp = skirt.getAttribute("position");
  const sc = new Float32Array(sp.count * 3);
  for (let i = 0; i < sp.count; i++) {
    const t = -sp.getY(i) / depth;
    sc.set(mixColor(mixColor(base[0], SOIL, 0.5), SOIL.map((v) => v * 0.55), t), i * 3);
  }
  skirt.setAttribute("color", new THREE.BufferAttribute(sc, 3));
  const bottom = new THREE.CircleGeometry(R * 0.97, 160);
  bottom.rotateX(Math.PI / 2);
  bottom.translate(scene.cx, -depth, scene.cz);
  bottom.setAttribute("color", new THREE.BufferAttribute(new Float32Array(bottom.getAttribute("position").count * 3).fill(SOIL[0] * 0.4), 3));
  const ground = surfaceSystem(ctx, geometry, { radial: R, from: new THREE.Vector3(scene.cx, 0, scene.cz), window: [W.structure[0] + 0.2, W.form[1] - 2], grain: 1 / Math.max(0.02, R * 0.004), texture: 0.12 });
  const side = surfaceSystem(ctx, skirt, { window: [W.form[1] - 2.5, W.form[1] - 1], grain: 1 / Math.max(0.02, R * 0.006), texture: 0.25 });
  const floor = surfaceSystem(ctx, bottom, { window: [W.form[1] - 2.5, W.form[1] - 1], texture: 0 });
  const G = 140;
  const step = (R * 2) / G;
  const field = new Float32Array(G * G);
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < G; k++)
    for (let i = 0; i < G; i++) {
      const x = scene.cx - R + i * step;
      const z = scene.cz - R + k * step;
      const v = Math.hypot(x - scene.cx, z - scene.cz) < R * 0.97 ? height(x, z) * rim(x, z) : -10;
      field[k * G + i] = v;
      if (v > -10) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  const segs = [];
  const levels = 16;
  for (let l = 1; l < levels; l++) marching(field, G, G, scene.cx - R, scene.cz - R, step, Math.max(0.05, lo) + ((hi - Math.max(0.05, lo)) * l) / levels, segs, (x, z) => height(x, z) * rim(x, z) + 0.03);
  const ink = pal.dark ? pal.ink.map((v) => v * 0.55) : pal.ink.map((v) => v + (1 - v) * 0.45);
  const lp = [];
  const lc = [];
  const ln = [];
  const li = [];
  segs.forEach((p, i) => {
    lp.push(...p);
    lc.push(...ink);
    ln.push(0, 1, 0);
    li.push(W.structure[0] + 0.5 + (Math.hypot(p[0] - scene.cx, p[2] - scene.cz) / R) * 3, i % 2, 0);
  });
  const lines = lineSystem(ctx, { pos: lp, col: lc, nrm: ln, info: li }, { alpha: 0.25, draw: 0.6 });
  const group = new THREE.Group();
  group.add(ground.object, side.object, floor.object, lines.object);
  return {
    object: group,
    update: (T) => {
      ground.update(T);
      side.update(T);
    },
  };
}

const waterVertex = /* glsl */ `
${COMMON}
uniform vec4 uWave[5];
uniform float uAmp;
uniform vec3 uCenter;
uniform float uR;
uniform float uSide;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
varying float vDepth;
varying float vSide;
void main() {
  vec2 xz = position.xz;
  vec3 p = position;
  float edge = 1.0 - smoothstep(uR * 0.82, uR, length(xz - uCenter.xz));
  vec3 dx = vec3(1.0, 0.0, 0.0);
  vec3 dz = vec3(0.0, 0.0, 1.0);
  float lift = 0.0;
  for (int i = 0; i < 5; i++) {
    vec2 d = normalize(uWave[i].xy);
    float k = uWave[i].z;
    float a = uWave[i].w * uAmp * edge;
    float f = k * (dot(d, xz) - sqrt(9.8 / k) * uT);
    if (uSide < 0.5) {
      p.x += d.x * a * 0.5 * cos(f);
      p.z += d.y * a * 0.5 * cos(f);
    }
    lift += a * sin(f);
    dx += vec3(-d.x * d.x * 0.5 * a * k * sin(f), d.x * a * k * cos(f), -d.x * d.y * 0.5 * a * k * sin(f));
    dz += vec3(-d.x * d.y * 0.5 * a * k * sin(f), d.y * a * k * cos(f), -d.y * d.y * 0.5 * a * k * sin(f));
  }
  if (uSide < 0.5 || position.y > -0.06) p.y += lift;
  vSide = uSide;
  vNormal = uSide > 0.5 ? normalize(vec3(position.x - uCenter.x, 0.0, position.z - uCenter.z)) : normalize(cross(dz, dx));
  vCrest = clamp(lift / max(0.001, uAmp), 0.0, 1.0);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vec4 mv = viewMatrix * world;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const waterFragment = /* glsl */ `
${COMMON}
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSun;
uniform float uDepthK;
uniform float uOn;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
varying float vDepth;
varying float vSide;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  if (uOn < h3(floor(vWorld * 2.0))) discard;
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 c;
  if (vSide > 0.5) {
    c = mix(uShallow, uDeep * 0.55, clamp(-vWorld.y * uDepthK, 0.0, 1.0));
    c = shade(c, vWorld, n, 1.0) * 1.1;
  } else {
    float fres = pow(1.0 - max(0.0, dot(n, v)), 4.0);
    c = mix(uDeep, uShallow, vCrest * 0.6);
    c = mix(c, uSky, fres * 0.6);
    vec3 h = normalize(uKeyDir + v);
    c += uSun * pow(max(0.0, dot(n, h)), 140.0) * 1.4 * uLight;
    c = mix(c, vec3(0.93), smoothstep(0.72, 1.0, vCrest) * 0.65);
  }
  c *= 0.92 + 0.16 * h3(floor(vWorld * 3.0));
  gl_FragColor = vec4(fogged(c, vDepth), 1.0);
}
`;

export function water(ctx, scene, R) {
  const { U, plan, pal, W, quality } = ctx;
  const rand = random((plan.seed ^ 0x2c1b3c6d) >>> 0);
  const energy = plan.world.weather === "storm" ? 1 : Math.max(0.15, plan.world.energy);
  const top = disc(R, Math.round(90 + 60 * quality), Math.round(160 + 80 * quality));
  top.translate(scene.cx, -0.05, scene.cz);
  const depth = Math.max(2, R * 0.12);
  const side = new THREE.CylinderGeometry(R, R * 0.97, depth, 180, 8, true);
  side.translate(scene.cx, -depth / 2 - 0.05, scene.cz);
  const scale = Math.max(0.6, scene.height / 10);
  const waves = [0, 1, 2, 3, 4].map((i) => {
    const a = rand() * Math.PI * 2;
    const len = (scale * (10 + rand() * 14)) / (1 + i * 0.6);
    return new THREE.Vector4(Math.cos(a) * 0.4 + 1, Math.sin(a), (Math.PI * 2) / len, (1 / (1 + i)) * (0.22 + rand() * 0.18));
  });
  const deep = rgb(pal.night ? "#14202c" : plan.world.weather === "storm" ? "#24323d" : "#1f4f6b");
  const uOn = { value: 0 };
  const make = (geometry, sideFlag) =>
    new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: {
          ...U,
          uWave: { value: waves },
          uAmp: { value: scale * (0.15 + energy * 0.85) },
          uCenter: { value: new THREE.Vector3(scene.cx, 0, scene.cz) },
          uR: { value: R },
          uSide: { value: sideFlag },
          uDeep: { value: new THREE.Vector3(...deep) },
          uShallow: { value: new THREE.Vector3(...mixColor(deep, rgb("#5fa5b5"), 0.55)) },
          uSky: { value: new THREE.Vector3(...mixColor(pal.bg, [1, 1, 1], pal.dark ? 0.12 : 0.3)) },
          uSun: { value: new THREE.Vector3(...(pal.night ? [0.6, 0.65, 0.8] : [1, 0.85, 0.6])) },
          uDepthK: { value: 1 / depth },
          uOn,
        },
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        side: THREE.DoubleSide,
      })
    );
  const group = new THREE.Group();
  const a = make(top, 0);
  const b = make(side, 1);
  const bottom = new THREE.CircleGeometry(R * 0.97, 160);
  bottom.rotateX(Math.PI / 2);
  bottom.translate(scene.cx, -depth - 0.05, scene.cz);
  const c = new THREE.Mesh(bottom, new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...deep.map((v) => v * 0.5), THREE.SRGBColorSpace) }));
  for (const m of [a, b, c]) m.frustumCulled = false;
  group.add(a, b, c);
  return {
    object: group,
    update: (T) => {
      uOn.value = Math.min(1, Math.max(0, (T - W.structure[0] - 0.5) / 4));
    },
  };
}

const sunVertex = /* glsl */ `
${COMMON}
attribute vec2 aCorner;
uniform float uSize;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  mv.xy += aCorner * uSize;
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99996;
  vAlpha = smoothstep(0.0, 1.0, uLight);
  vUv = aCorner * 0.5 + 0.5;
}
`;

const sunFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  float disc = smoothstep(0.24, 0.2, d);
  float glow = pow(max(0.0, 1.0 - d), 2.2) * 0.55;
  float a = max(disc, glow) * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(uColor * (disc > 0.5 ? 1.15 : 1.0), a);
}
`;

export function sun(ctx, scene) {
  const { U, plan, pal } = ctx;
  if (pal.night || plan.world.setting === "space" || plan.world.weather === "storm" || plan.world.weather === "fog") return null;
  const dir = U.uKeyDir.value.clone();
  if (dir.y < 0.05) dir.y = 0.05;
  dir.normalize();
  const geometry = new THREE.BufferGeometry();
  const at = dir.clone().multiplyScalar(scene.sky * 0.85).toArray();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...at, ...at, ...at, ...at]), 3));
  geometry.setAttribute("aCorner", new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const time = plan.world.time;
  const color = rgb(time === "golden" ? "#ffc66d" : time === "dusk" ? "#ff8a52" : time === "dawn" ? "#ffb08a" : "#fff4d6");
  const points = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: { ...U, uSize: { value: scene.sky * 0.07 }, uColor: { value: new THREE.Vector3(...color) } }, vertexShader: sunVertex, fragmentShader: sunFragment, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  points.renderOrder = -7;
  return {
    object: points,
    update: (T, dt, camera) => {
      if (camera) points.position.copy(camera.position);
    },
  };
}
