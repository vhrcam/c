import { COMMON } from "./glsl";

const vertex = /* glsl */ `
${COMMON}
attribute float aK;
uniform vec3 uFocus;
uniform float uSize;
varying float vA;
void main() {
  float blink = step(0.5, fract(uT * 0.94 + 0.25));
  float burst = clamp((uT - 1.15) / 1.6, 0.0, 1.0);
  vec3 dir = position;
  vec3 p = uFocus + dir * uSize * (0.02 + easeOut(burst) * 3.2) * step(0.5, aK);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float cursor = (1.0 - step(0.5, aK)) * blink * (1.0 - step(1.15, uT));
  float ring = step(0.5, aK) * step(0.001, burst) * (1.0 - burst) * (1.0 - burst);
  vA = max(cursor, ring * 0.9);
  gl_PointSize = mix(uSize * 0.06, uSize * 0.012, step(0.5, aK)) * uScale / -mv.z;
}
`;

const fragment = /* glsl */ `
uniform vec3 uInk;
varying float vA;
void main() {
  if (vA <= 0.001) discard;
  gl_FragColor = vec4(uInk, vA);
}
`;

export function seed(ctx, focus, size) {
  const { THREE, U, pal } = ctx;
  const n = 1 + 2400;
  const pos = new Float32Array(n * 3);
  const k = new Float32Array(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 1; i < n; i++) {
    const y = 1 - (2 * (i - 0.5)) / (n - 1);
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    k[i] = 1;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute("aK", new THREE.BufferAttribute(k, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { ...U, uFocus: { value: focus.clone() }, uSize: { value: size }, uInk: { value: new THREE.Vector3(...pal.ink) } },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  });
  const object = new THREE.Points(geometry, material);
  object.frustumCulled = false;
  return {
    object,
    update: (T) => {
      object.visible = T < 3;
    },
  };
}
