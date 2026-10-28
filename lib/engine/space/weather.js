import { random } from "../../random";
import { mixColor, rgb } from "../palette";
import { COMMON } from "./glsl";

const KINDS = {
  leaves: { count: 2600, size: 0.05, fall: 0.55, drift: 0.5, spin: 1, shape: 1, streak: 0 },
  petals: { count: 2200, size: 0.03, fall: 0.35, drift: 0.6, spin: 1, shape: 1, streak: 0 },
  snow: { count: 14000, size: 0.018, fall: 0.6, drift: 0.25, spin: 0, shape: 0, streak: 0 },
  rain: { count: 9000, size: 0.006, fall: 9, drift: 0.05, spin: 0, shape: 0, streak: 1 },
  dust: { count: 3500, size: 0.008, fall: -0.02, drift: 0.12, spin: 0, shape: 0, streak: 0 },
  fireflies: { count: 260, size: 0.03, fall: -0.03, drift: 0.35, spin: 0, shape: 2, streak: 0 },
  embers: { count: 900, size: 0.016, fall: -0.7, drift: 0.3, spin: 0, shape: 2, streak: 0 },
  sparks: { count: 700, size: 0.012, fall: -1.4, drift: 0.5, spin: 0, shape: 2, streak: 0 },
  spray: { count: 5000, size: 0.025, fall: 0.2, drift: 1.4, spin: 0, shape: 0, streak: 0 },
  bubbles: { count: 600, size: 0.03, fall: -0.4, drift: 0.2, spin: 0, shape: 3, streak: 0 },
};

const HEAD = /* glsl */ `
${COMMON}
attribute vec3 aColor;
attribute vec4 aInfo;
uniform vec3 uMin;
uniform vec3 uSize;
uniform float uFall;
uniform float uDrift;
uniform float uWind;
uniform float uScaleK;
vec3 at(float t) {
  vec3 p = position;
  float k = aInfo.y;
  p.y -= uFall * t * (0.7 + k * 0.6);
  p.x += uWind * t + sin(t * (0.6 + k) + k * 30.0) * uDrift + sin(t * 0.23 + p.z) * uDrift * 1.5;
  p.z += cos(t * (0.5 + k * 0.8) + k * 17.0) * uDrift;
  return uMin + mod(p - uMin, uSize);
}
`;

const pointVertex = /* glsl */ `
${HEAD}
uniform float uPx;
uniform float uShape;
uniform float uNear;
varying vec3 vColor;
varying float vAlpha;
varying float vSpin;
void main() {
  float t = uT - aInfo.x;
  if (t <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  vec3 p = at(t + aInfo.y * 40.0);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float flick = uShape > 1.5 && uShape < 2.5 ? 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uT * (1.4 + aInfo.y * 2.0) + aInfo.y * 50.0), 3.0) : 1.0;
  vec3 c = uShape > 1.5 && uShape < 2.5 ? aColor * (1.2 + flick) : shade(aColor, p, normalize(vec3(sin(aInfo.y * 9.0), 1.0, cos(aInfo.y * 7.0))), 1.0);
  vColor = fogged(c, -mv.z);
  vec3 lo = uMin + uSize * 0.04;
  vec3 hi = uMin + uSize * 0.96;
  float edge = smoothstep(uMin.y, lo.y, p.y) * (1.0 - smoothstep(hi.y, uMin.y + uSize.y, p.y));
  vAlpha = smoothstep(0.0, 1.5, t) * edge * flick * smoothstep(uNear * 0.5, uNear * 1.5, -mv.z);
  vSpin = uT * (0.8 + aInfo.y * 2.0) * aInfo.z + aInfo.y * 6.28;
  gl_PointSize = clamp(uPx * (0.6 + aInfo.w * 0.8) * uScale / -mv.z, 1.0, 9.0);
}
`;

const pointFragment = /* glsl */ `
uniform float uShape;
varying vec3 vColor;
varying float vAlpha;
varying float vSpin;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float a = vAlpha;
  if (uShape > 0.5 && uShape < 1.5) {
    float s = sin(vSpin);
    float k = cos(vSpin);
    vec2 q = vec2(k * c.x - s * c.y, s * c.x + k * c.y);
    float flip = 0.35 + 0.65 * abs(sin(vSpin * 0.7));
    q.x /= flip;
    float leaf = length(vec2(q.x * 2.1, q.y * (1.0 + abs(q.x) * 2.5)));
    if (leaf > 0.5) discard;
    a *= 0.95;
  } else if (uShape > 1.5 && uShape < 2.5) {
    float d = length(c);
    if (d > 0.5) discard;
    a *= smoothstep(0.5, 0.0, d);
  } else if (uShape > 2.5) {
    float d = length(c);
    if (d > 0.5 || d < 0.38) discard;
  } else {
    if (dot(c, c) > 0.25) discard;
  }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

const rainVertex = /* glsl */ `
${HEAD}
attribute float aEnd;
uniform float uLen;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float t = uT - aInfo.x;
  vec3 p = at(max(t, 0.0) + aInfo.y * 40.0);
  p += vec3(-uWind, uFall, 0.0) * uLen * aEnd / max(1.0, uFall);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vColor = fogged(aColor, -mv.z);
  vAlpha = step(0.0, t) * (1.0 - aEnd * 0.8) * 0.55;
}
`;

const rainFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

export function weather(ctx, scene) {
  const { THREE, U, plan, pal, W } = ctx;
  const list = [...plan.particles];
  const has = (k) => list.some((p) => p.kind === k);
  if (plan.world.weather === "snow" && !has("snow")) list.push({ kind: "snow", color: "#f2f1ee", amount: 0.6, motion: "fall" });
  if ((plan.world.weather === "rain" || plan.world.weather === "storm") && !has("rain")) list.push({ kind: "rain", color: "#b9c4cf", amount: plan.world.weather === "storm" ? 0.9 : 0.5, motion: "fall" });
  if (!list.length && plan.world.setting !== "void" && plan.world.setting !== "space") list.push({ kind: "dust", color: pal.dark ? "#d8d2c4" : "#6d675d", amount: 0.4, motion: "drift" });
  const group = new THREE.Group();
  const extent = scene.radius * 3.2 + 2;
  const tall = Math.max(scene.height * 1.8, 5);
  const min = new THREE.Vector3(scene.cx - extent, -0.05, scene.cz - extent);
  const size = new THREE.Vector3(extent * 2, tall, extent * 2);
  const wind = plan.world.weather === "storm" ? 2.6 : plan.world.weather === "wind" ? 1.4 : 0.25 + plan.world.energy * 0.6;
  const k = Math.max(0.3, scene.radius / 1.2);
  list.slice(0, 3).forEach((spec, idx) => {
    const kind = KINDS[spec.kind] || KINDS.dust;
    const rand = random((plan.seed + idx * 7919) >>> 0);
    const count = Math.round(kind.count * (0.35 + spec.amount) * ctx.quality * Math.min(2.5, Math.max(0.6, extent / 4)));
    const base = rgb(spec.color || "#d8d2c4");
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const info = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos.set([min.x + rand() * size.x, min.y + rand() * size.y, min.z + rand() * size.z], i * 3);
      const v = (rand() - 0.5) * (spec.kind === "leaves" ? 0.5 : 0.12);
      const c = spec.kind === "leaves" ? mixColor(base, rand() < 0.5 ? rgb("#8c2f1c") : rgb("#e3a83b"), Math.abs(v) * 1.6) : base.map((x) => Math.min(1, x * (1 + v)));
      col.set(c, i * 3);
      info.set([W.world[0] - 1.5 + rand() * (W.world[1] - W.world[0]), rand(), rand() < 0.5 ? -1 : 1, rand()], i * 4);
    }
    const uniforms = {
      ...U,
      uMin: { value: min },
      uSize: { value: size },
      uFall: { value: kind.fall * (spec.motion === "rise" ? -0.6 : spec.motion === "drift" ? 0.4 : spec.motion === "swirl" ? 0.5 : 1) * (kind.streak ? 1 : k) },
      uDrift: { value: kind.drift * k * (spec.motion === "swirl" ? 2 : 1) },
      uWind: { value: wind * (kind.streak ? 1 : 0.5) },
      uPx: { value: kind.size * Math.max(1, k * 0.8) },
      uShape: { value: kind.shape },
      uLen: { value: 0.35 },
      uNear: { value: scene.radius * 0.8 },
    };
    if (kind.streak) {
      const lp = new Float32Array(count * 6);
      const lc = new Float32Array(count * 6);
      const li = new Float32Array(count * 8);
      const end = new Float32Array(count * 2);
      for (let i = 0; i < count; i++)
        for (let e = 0; e < 2; e++) {
          lp.set(pos.subarray(i * 3, i * 3 + 3), (i * 2 + e) * 3);
          lc.set(col.subarray(i * 3, i * 3 + 3), (i * 2 + e) * 3);
          li.set(info.subarray(i * 4, i * 4 + 4), (i * 2 + e) * 4);
          end[i * 2 + e] = e;
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(lp, 3));
      g.setAttribute("aColor", new THREE.BufferAttribute(lc, 3));
      g.setAttribute("aInfo", new THREE.BufferAttribute(li, 4));
      g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
      const lines = new THREE.LineSegments(g, new THREE.ShaderMaterial({ uniforms, vertexShader: rainVertex, fragmentShader: rainFragment, transparent: true, depthWrite: false }));
      lines.frustumCulled = false;
      group.add(lines);
      return;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
    const points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({ uniforms, vertexShader: pointVertex, fragmentShader: pointFragment, transparent: true, depthWrite: false, blending: kind.shape === 2 && pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending })
    );
    points.frustumCulled = false;
    group.add(points);
  });
  return { object: group };
}
