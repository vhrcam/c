import * as THREE from "three";
import { random } from "../../random";
import { mixColor } from "../palette";
import { COMMON } from "./glsl";

const cloudVertex = /* glsl */ `
${COMMON}
attribute vec4 aInfo;
attribute vec2 aCorner;
uniform vec3 uDrift;
uniform float uFlash;
varying float vAlpha;
varying float vLit;
varying vec2 vUv;
void main() {
  float on = smoothstep(aInfo.x, aInfo.x + 2.5, uT);
  vec3 p = position + uDrift * min(1.0, max(0.0, uT - aInfo.x) / 40.0);
  p += vec3(sin(uT * 0.15 + aInfo.z * 20.0), sin(uT * 0.11 + aInfo.z * 9.0) * 0.4, cos(uT * 0.13 + aInfo.z * 14.0)) * aInfo.y * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  mv.xy += aCorner * aInfo.y * 0.5 * on;
  gl_Position = projectionMatrix * mv;
  vAlpha = on * 0.7;
  vLit = aInfo.w + uFlash * 0.8;
  vUv = aCorner * 0.5 + 0.5;
}
`;

const cloudFragment = /* glsl */ `
uniform vec3 uCloudDark;
uniform vec3 uCloudLight;
varying float vAlpha;
varying float vLit;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.6) * vAlpha;
  vec3 col = mix(uCloudDark, uCloudLight, clamp(vLit - c.y * 0.6, 0.0, 1.0));
  gl_FragColor = vec4(col, a);
}
`;

const boltVertex = /* glsl */ `
${COMMON}
uniform float uFlash;
varying float vAlpha;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vAlpha = uFlash;
}
`;

const boltFragment = /* glsl */ `
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), vAlpha);
}
`;

function bolt(rand, from, to, spread) {
  let pts = [from, to];
  for (let level = 0; level < 6; level++) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const m = a.clone().lerp(b, 0.5);
      const off = spread / 2 ** level;
      m.x += (rand() - 0.5) * off;
      m.z += (rand() - 0.5) * off;
      next.push(a, m);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  const seg = [];
  for (let i = 0; i < pts.length - 1; i++) seg.push(...pts[i].toArray(), ...pts[i + 1].toArray());
  for (let k = 0; k < 2; k++) {
    let p = pts[Math.floor(pts.length * (0.2 + rand() * 0.4))].clone();
    for (let j = 0; j < 10; j++) {
      const q = p.clone().add(new THREE.Vector3((rand() - 0.5) * spread * 0.12, -spread * 0.06, (rand() - 0.5) * spread * 0.12));
      seg.push(...p.toArray(), ...q.toArray());
      p = q;
    }
  }
  return new Float32Array(seg);
}

export function cloudBank(ctx, scene, opts = {}) {
  const { U, plan, pal, W } = ctx;
  const rand = random((plan.seed ^ (opts.salt ?? 0x51ed270b)) >>> 0);
  const R = scene.stage;
  const back = new THREE.Vector3(-scene.view.x, 0, -scene.view.z).normalize();
  const center = new THREE.Vector3(scene.cx, 0, scene.cz).addScaledVector(back, R * (opts.back ?? 0.7));
  const height = opts.height ?? Math.max(scene.height * 1.05, R * 0.34);
  const clusters = opts.clusters ?? 1;
  const n = Math.round((opts.count ?? 260) * Math.max(0.5, ctx.quality));
  const pos = new Float32Array(n * 3);
  const info = new Float32Array(n * 4);
  const heads = Array.from({ length: clusters }, () => [center.x + (rand() - 0.5) * R * (clusters > 1 ? 1.6 : 0), center.z + (rand() - 0.5) * R * (clusters > 1 ? 0.8 : 0), height * (0.85 + rand() * 0.3)]);
  for (let i = 0; i < n; i++) {
    const h = heads[i % clusters];
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand());
    const spread = clusters > 1 ? 0.22 : 0.95;
    const x = h[0] + Math.cos(a) * r * R * spread;
    const z = h[1] + Math.sin(a) * r * R * spread * 0.62;
    const y = h[2] + (rand() - 0.3) * R * 0.12 * (1 - r * 0.5);
    pos.set([x, y, z], i * 3);
    info.set([(opts.start ?? W.form[1] - 2) + rand() * 4, R * (opts.size ?? 0.22 + rand() * 0.26) * (clusters > 1 ? 0.55 : 1), rand(), (y - h[2]) / (R * 0.12) + 0.3], i * 4);
  }
  const g = new THREE.BufferGeometry();
  const qp = new Float32Array(n * 12);
  const qi = new Float32Array(n * 16);
  const qc = new Float32Array(n * 8);
  const idx = [];
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 4; c++) {
      qp.set(pos.subarray(i * 3, i * 3 + 3), (i * 4 + c) * 3);
      qi.set(info.subarray(i * 4, i * 4 + 4), (i * 4 + c) * 4);
      qc.set(corners[c], (i * 4 + c) * 2);
    }
    idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  }
  g.setAttribute("position", new THREE.BufferAttribute(qp, 3));
  g.setAttribute("aInfo", new THREE.BufferAttribute(qi, 4));
  g.setAttribute("aCorner", new THREE.BufferAttribute(qc, 2));
  g.setIndex(idx);
  const uFlash = { value: 0 };
  const dark = opts.dark || mixColor(pal.bg, pal.dark ? [0.3, 0.33, 0.38] : [0.22, 0.24, 0.28], 0.55);
  const light = opts.light || mixColor(pal.bg, [0.78, 0.8, 0.85], pal.dark ? 0.5 : 0.35);
  const mesh = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      uniforms: { ...U, uDrift: { value: back.clone().multiplyScalar(-R * (opts.drift ?? 0.35)) }, uFlash, uCloudDark: { value: new THREE.Vector3(...dark) }, uCloudLight: { value: new THREE.Vector3(...light) } },
      vertexShader: cloudVertex,
      fragmentShader: cloudFragment,
      transparent: true,
      depthWrite: false,
    })
  );
  mesh.frustumCulled = false;
  return { object: mesh, uFlash, center, height };
}

export function storm(ctx, scene) {
  const { U, plan, W } = ctx;
  const rand = random((plan.seed ^ 0x2f6b1d73) >>> 0);
  const R = scene.stage;
  const bank = cloudBank(ctx, scene);
  const { center, height, uFlash } = bank;
  const group = new THREE.Group();
  group.add(bank.object);
  const strikes = [0, 1, 2].map((k) => {
    const top = center.clone().add(new THREE.Vector3((rand() - 0.5) * R * 0.9, height - R * 0.05, (rand() - 0.5) * R * 0.4));
    const bottom = top.clone().setY(0).add(new THREE.Vector3((rand() - 0.5) * R * 0.3, 0, (rand() - 0.5) * R * 0.3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(bolt(rand, top, bottom, R * 0.35), 3));
    const flash = { value: 0 };
    const lines = new THREE.LineSegments(geometry, new THREE.ShaderMaterial({ uniforms: { ...U, uFlash: flash }, vertexShader: boltVertex, fragmentShader: boltFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    lines.frustumCulled = false;
    group.add(lines);
    return { flash, at: W.world[0] + 2.2 + k * 2.1, period: 5.5 + k * 1.7, top };
  });
  return {
    object: group,
    update: (T) => {
      let peak = 0;
      for (const s of strikes) {
        if (T < s.at) {
          s.flash.value = 0;
          continue;
        }
        const t = (T - s.at) % s.period;
        const f = t < 0.08 ? 1 : t < 0.14 ? 0.2 : t < 0.22 ? 0.85 : Math.max(0, 1 - (t - 0.22) / 0.25) * 0.3;
        s.flash.value = f;
        if (f > peak) peak = f;
      }
      uFlash.value = peak;
      U.uLamp.value[3].set(center.x, height * 0.8, center.z, peak * 2.5);
      U.uLampColor.value[3].set(0.85, 0.9, 1);
      U.uLampRange.value[3] = R * 1.2;
    },
  };
}
