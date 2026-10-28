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

export function shape(ctx, scene) {
  const { plan } = ctx;
  const setting = plan.world.setting;
  const text = plan.text.toLowerCase();
  const local = terrain(plan, (plan.seed + 3) >>> 0);
  const n = noise3((plan.seed + 41) >>> 0);
  const R = Math.max(scene.reach * 1.6, 60);
  const alpine = setting === "mountains" || setting === "snowfield" || /mountain|alps|peak|valley|cliff/.test(text);
  const M = alpine ? Math.max(scene.height * 3.2, 60) : Math.max(scene.height * 1.4, 18);
  const start = alpine ? R * 0.18 : R * 0.32;
  const bridge = plan.subjects.find((s) => s.form === "building" && s.building?.style === "bridge");
  const coast = setting === "ocean" || /beach|coast|shore|sea|ocean|lake/.test(text);
  const river = Boolean(bridge) && !coast;
  const shoreDir = [scene.view.x, scene.view.z];
  const shoreLen = Math.hypot(...shoreDir) || 1;
  const flat = scene.radius * 1.2 + 2;
  const height = (x, z) => {
    const dx = x - scene.cx;
    const dz = z - scene.cz;
    const d = Math.hypot(dx, dz);
    let h = local(dx, dz, flat);
    if (setting !== "city" && setting !== "space" && setting !== "void") {
      const ridge = 1 - Math.abs(n(dx / (R * 0.11), 3.3, dz / (R * 0.11), 4));
      const env = Math.min(1, Math.max(0, (d - start) / (R * 0.35)));
      h += M * ridge * ridge * env * env * (alpine ? 1 : 0.6);
    }
    if (river) {
      const across = Math.abs(dz) / Math.max(4, scene.radius * 0.5);
      h = across < 1 ? -2.5 + across * across * 2.2 : Math.max(h, 0.9) + (across - 1) * 0.8;
    }
    if (coast) {
      const toward = -(dx * shoreDir[0] + dz * shoreDir[1]) / shoreLen;
      const shore = flat * 1.4 + n(dx * 0.02, 9.1, dz * 0.02) * flat;
      if (toward > shore) h = Math.min(h, -(toward - shore) * 0.12);
      else h = Math.max(h, 0.5);
    }
    return h;
  };
  return { height, R, M, alpine, coast: coast || river, flat };
}

export function landscape(ctx, scene, terrainShape) {
  const { plan, pal, W, quality } = ctx;
  const { height, R, M, coast } = terrainShape;
  const look = LOOK[plan.world.setting] || LOOK.ground;
  const base = (pal.night ? look.night : look.color).map(rgb);
  const N = Math.round(150 + 90 * quality);
  const geometry = new THREE.PlaneGeometry(R * 2, R * 2, N, N);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(scene.cx, 0, scene.cz);
  const pos = geometry.getAttribute("position");
  const n = noise3((plan.seed + 77) >>> 0);
  for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
  geometry.computeVertexNormals();
  const nrm = geometry.getAttribute("normal");
  const colors = new Float32Array(pos.count * 3);
  const snowLine = M * 0.55;
  const winter = plan.world.season === "winter" || plan.world.weather === "snow" || plan.world.setting === "snowfield";
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - nrm.getY(i);
    const t = Math.min(1, Math.max(0, n(x * 0.05, 1, z * 0.05) * 0.8 + 0.5));
    let c = mixColor(base[0], base[1], t);
    if (slope > 0.28) c = mixColor(c, ROCK, Math.min(1, (slope - 0.28) * 3));
    if (y > snowLine + n(x * 0.03, 2, z * 0.03) * M * 0.12 || (winter && slope < 0.35)) c = mixColor(c, SNOW, 0.92);
    if (coast && y < 0.6) c = mixColor(c, SAND, Math.min(1, (0.6 - y) * 1.6));
    if (pal.night) c = c.map((v) => v * 0.7);
    colors.set(c, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const ground = surfaceSystem(ctx, geometry, { radial: R * 0.85, from: new THREE.Vector3(scene.cx, 0, scene.cz), window: [W.structure[0] + 0.2, W.form[1]], grain: 1 / Math.max(0.02, scene.radius * 0.004), texture: 0.12 });
  const G = 160;
  const step = (R * 2) / G;
  const field = new Float32Array(G * G);
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < G; k++)
    for (let i = 0; i < G; i++) {
      const v = height(scene.cx - R + i * step, scene.cz - R + k * step);
      field[k * G + i] = v;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  const segs = [];
  const levels = 22;
  for (let l = 1; l < levels; l++) marching(field, G, G, scene.cx - R, scene.cz - R, step, Math.max(0.05, lo) + ((hi - Math.max(0.05, lo)) * l) / levels, segs, (x, z) => height(x, z) + 0.04);
  const ink = pal.dark ? pal.ink.map((v) => v * 0.55) : pal.ink.map((v) => v + (1 - v) * 0.45);
  const lp = [];
  const lc = [];
  const ln = [];
  const li = [];
  segs.forEach((p, i) => {
    lp.push(...p);
    lc.push(...ink);
    ln.push(0, 1, 0);
    li.push(W.structure[0] + 0.5 + (Math.hypot(p[0] - scene.cx, p[2] - scene.cz) / R) * 4, i % 2, 0);
  });
  const lines = lineSystem(ctx, { pos: lp, col: lc, nrm: ln, info: li }, { alpha: 0.28, draw: 0.6 });
  const group = new THREE.Group();
  group.add(ground.object, lines.object);
  return { object: group, update: ground.update };
}

const waterVertex = /* glsl */ `
${COMMON}
uniform vec4 uWave[5];
uniform float uAmp;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
varying float vDepth;
void main() {
  vec2 xz = position.xz;
  vec3 p = vec3(xz.x, 0.0, xz.y);
  vec3 dx = vec3(1.0, 0.0, 0.0);
  vec3 dz = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < 5; i++) {
    vec2 d = normalize(uWave[i].xy);
    float k = uWave[i].z;
    float a = uWave[i].w * uAmp;
    float f = k * (dot(d, xz) - sqrt(9.8 / k) * uT);
    p.x += d.x * a * 0.5 * cos(f);
    p.z += d.y * a * 0.5 * cos(f);
    p.y += a * sin(f);
    dx += vec3(-d.x * d.x * 0.5 * a * k * sin(f), d.x * a * k * cos(f), -d.x * d.y * 0.5 * a * k * sin(f));
    dz += vec3(-d.x * d.y * 0.5 * a * k * sin(f), d.y * a * k * cos(f), -d.y * d.y * 0.5 * a * k * sin(f));
  }
  vNormal = normalize(cross(dz, dx));
  vCrest = clamp(p.y / max(0.001, uAmp), 0.0, 1.0);
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
uniform vec3 uCenter;
uniform float uFront;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;
varying float vDepth;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  float r = length(vWorld.xz - uCenter.xz);
  if (r > uFront) discard;
  vec3 n = normalize(vNormal);
  vec3 v = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(0.0, dot(n, v)), 4.0);
  vec3 c = mix(uDeep, uShallow, vCrest * 0.6);
  c = mix(c, uSky, fres * 0.65);
  vec3 h = normalize(uKeyDir + v);
  float spec = pow(max(0.0, dot(n, h)), 140.0);
  c += uSun * spec * 1.4 * uLight;
  c = mix(c, vec3(0.93), smoothstep(0.78, 1.0, vCrest) * 0.6);
  c *= 0.9 + 0.2 * h3(floor(vWorld * 3.0));
  gl_FragColor = vec4(fogged(c, vDepth), 1.0);
}
`;

export function water(ctx, scene, R) {
  const { U, plan, pal, W } = ctx;
  const rand = random((plan.seed ^ 0x2c1b3c6d) >>> 0);
  const energy = plan.world.weather === "storm" ? 1 : Math.max(0.15, plan.world.energy);
  const geometry = new THREE.PlaneGeometry(R * 2, R * 2, 260, 260);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(scene.cx, -0.05, scene.cz);
  const scale = Math.max(1, scene.height / 8);
  const waves = [0, 1, 2, 3, 4].map((i) => {
    const a = rand() * Math.PI * 2;
    const len = (scale * (8 + rand() * 16)) / (1 + i * 0.6);
    return new THREE.Vector4(Math.cos(a) * 0.4 + 1, Math.sin(a), (Math.PI * 2) / len, (1 / (1 + i)) * (0.22 + rand() * 0.18));
  });
  const deep = rgb(pal.night ? "#14202c" : plan.world.weather === "storm" ? "#2b3a46" : "#1f4f6b");
  const uFront = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uWave: { value: waves },
      uAmp: { value: scale * (0.12 + energy * 0.6) },
      uDeep: { value: new THREE.Vector3(...deep) },
      uShallow: { value: new THREE.Vector3(...mixColor(deep, rgb("#5fa5b5"), 0.6)) },
      uSky: { value: new THREE.Vector3(...mixColor(pal.bg, [1, 1, 1], pal.dark ? 0.12 : 0.3)) },
      uSun: { value: new THREE.Vector3(...(pal.night ? [0.6, 0.65, 0.8] : [1, 0.85, 0.6])) },
      uCenter: { value: new THREE.Vector3(scene.cx, 0, scene.cz) },
      uFront,
    },
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    object: mesh,
    update: (T) => {
      const t = Math.max(0, (T - W.structure[0]) / (W.form[1] - W.structure[0]));
      uFront.value = Math.min(1, t) * R * 1.5 + (t > 1 ? R : 0);
    },
  };
}

const sunVertex = /* glsl */ `
${COMMON}
uniform float uSize;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99996;
  vAlpha = smoothstep(0.0, 1.0, uLight);
  gl_PointSize = uSize;
}
`;

const sunFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
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
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dir.clone().multiplyScalar(scene.sky * 0.85).toArray()), 3));
  const time = plan.world.time;
  const color = rgb(time === "golden" ? "#ffc66d" : time === "dusk" ? "#ff8a52" : time === "dawn" ? "#ffb08a" : "#fff4d6");
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({ uniforms: { ...U, uSize: { value: 260 * ctx.renderer.getPixelRatio() }, uColor: { value: new THREE.Vector3(...color) } }, vertexShader: sunVertex, fragmentShader: sunFragment, transparent: true, depthWrite: false }));
  points.frustumCulled = false;
  points.renderOrder = -7;
  return {
    object: points,
    update: (T, dt, camera) => {
      if (camera) points.position.copy(camera.position);
    },
  };
}
