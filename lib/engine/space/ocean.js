import { random } from "../../random";
import { mixColor, rgb } from "../palette";
import { COMMON } from "./glsl";

const vertex = /* glsl */ `
${COMMON}
attribute float aRow;
uniform vec4 uWave[5];
uniform float uAmp;
uniform vec3 uCenter;
uniform float uFront;
uniform vec3 uDeep;
uniform vec3 uFoam;
uniform float uSize;
varying vec3 vColor;
varying float vAlpha;
vec3 gerstner(vec2 xz, float t, out vec3 n) {
  vec3 p = vec3(xz.x, 0.0, xz.y);
  vec3 dx = vec3(1.0, 0.0, 0.0);
  vec3 dz = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < 5; i++) {
    vec2 d = normalize(uWave[i].xy);
    float k = uWave[i].z;
    float a = uWave[i].w * uAmp;
    float c = sqrt(9.8 / k);
    float f = k * (dot(d, xz) - c * t);
    float q = 0.55;
    p.x += d.x * a * q * cos(f);
    p.z += d.y * a * q * cos(f);
    p.y += a * sin(f);
    dx += vec3(-d.x * d.x * q * a * k * sin(f), d.x * a * k * cos(f), -d.x * d.y * q * a * k * sin(f));
    dz += vec3(-d.x * d.y * q * a * k * sin(f), d.y * a * k * cos(f), -d.y * d.y * q * a * k * sin(f));
  }
  n = normalize(cross(dz, dx));
  return p;
}
void main() {
  vec2 xz = position.xz;
  float r = length(xz - uCenter.xz);
  float front = uFront;
  float on = smoothstep(front, front - uSize * 0.06, r);
  vec3 n;
  vec3 p = gerstner(xz, uT, n);
  p.y *= on;
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float crest = smoothstep(0.35, 1.0, p.y / max(0.001, uAmp));
  vec3 base = mix(uDeep, uFoam, crest * 0.85);
  vec3 lit = shade(base, p, n, 1.0) * 1.25 + uFoam * crest * 0.25 * uLight;
  vColor = fogged(lit, -mv.z * 0.8);
  vAlpha = on * (0.55 + crest * 0.45) * (0.6 + 0.4 * fract(aRow * 0.618));
}
`;

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

export function ocean(ctx, scene, center) {
  const { THREE, U, plan, pal, W } = ctx;
  const rand = random((plan.seed ^ 0x68e31da4) >>> 0);
  const energy = plan.world.weather === "storm" ? 1 : Math.max(0.15, plan.world.energy);
  const S = scene.reach * 1.4;
  const rows = Math.round(240 * Math.max(0.6, ctx.quality));
  const cols = Math.round(420 * Math.max(0.6, ctx.quality));
  const pos = new Float32Array(rows * cols * 3);
  const row = new Float32Array(rows * cols);
  const index = [];
  for (let j = 0; j < rows; j++) {
    const z = center.z - S / 2 + (j / (rows - 1)) * S;
    for (let i = 0; i < cols; i++) {
      const x = center.x - S / 2 + (i / (cols - 1)) * S;
      pos.set([x, 0, z + (rand() - 0.5) * (S / rows) * 0.2], (j * cols + i) * 3);
      row[j * cols + i] = j;
      if (i) index.push(j * cols + i - 1, j * cols + i);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aRow", new THREE.BufferAttribute(row, 1));
  geometry.setIndex(index);
  const scale = Math.max(1, scene.height / 6);
  const waves = [0, 1, 2, 3, 4].map((i) => {
    const a = rand() * Math.PI * 2;
    const len = scale * (8 + rand() * 18) / (1 + i * 0.6);
    return new THREE.Vector4(Math.cos(a) * 0.4 + 1, Math.sin(a), (Math.PI * 2) / len, (1 / (1 + i)) * (0.25 + rand() * 0.2));
  });
  const deep = rgb(pal.night || plan.world.weather === "storm" ? "#6f8aa0" : "#3f7898");
  const uFront = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uWave: { value: waves },
      uAmp: { value: scale * (0.15 + energy * 0.75) },
      uCenter: { value: center.clone() },
      uFront,
      uDeep: { value: new THREE.Vector3(...mixColor(deep, pal.bg, 0.1)) },
      uFoam: { value: new THREE.Vector3(...rgb("#dfe6ea")) },
      uSize: { value: S },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geometry, material);
  object.frustumCulled = false;
  return {
    object,
    update: (T) => {
      const t = Math.max(0, (T - W.structure[0] - 0.3) / (W.form[1] - W.structure[0]));
      uFront.value = Math.min(1, t) ** 0.8 * S * 0.75 + (t > 1 ? S : 0);
    },
  };
}
