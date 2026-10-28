import { COMMON } from "./glsl";

const vertex = /* glsl */ `
${COMMON}
attribute float aT;
attribute vec3 aRoot;
attribute vec3 aNormal;
attribute vec3 aFlow;
attribute vec4 aInfo;
attribute vec3 aColor;
attribute vec3 aTip;
uniform float uGrow;
uniform float uLift;
uniform float uDroop;
uniform float uWind;
uniform float uKeep;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float g = clamp((uT - aInfo.x) / uGrow, 0.0, 1.0);
  if (g <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    return;
  }
  float L = aInfo.y * easeOut(g);
  float t = aT;
  vec3 P1 = aRoot + aNormal * L * uLift;
  vec3 bend = normalize(aFlow * 0.9 + aNormal * 0.28 + vec3(0.0, -1.0, 0.0) * uDroop);
  vec3 P2 = aRoot + bend * L;
  float sway = sin(uT * 1.6 + aInfo.z * 6.2831 + dot(aRoot, vec3(1.7, 2.3, 1.1)) * 4.0) + sin(uT * 0.7 + aInfo.z * 3.0);
  P2 += cross(aNormal, aFlow) * sway * uWind * L * g;
  float u = 1.0 - t;
  vec3 p = u * u * aRoot + 2.0 * u * t * P1 + t * t * P2;
  vec3 tangent = normalize(2.0 * u * (P1 - aRoot) + 2.0 * t * (P2 - P1) + 1e-5);
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  vec3 n = normalize(mat3(modelMatrix) * aNormal);
  vec3 T = normalize(mat3(modelMatrix) * tangent);
  vec3 base = mix(aColor, aTip, t);
  vec3 lit = mix(shade(base, world.xyz, normalize(n + T * 0.3), mix(aInfo.w, 1.0, t)), base * mix(0.55, 1.0, uLight), uKeep);
  vec3 view = normalize(cameraPosition - world.xyz);
  vec3 H = normalize(uKeyDir + view);
  float th = dot(T, H);
  float spec = pow(max(0.0, sqrt(max(0.0, 1.0 - th * th))), 48.0) * 0.18 * uLight;
  vec3 c = lit + uKey * spec;
  float facing = dot(n, view);
  vColor = fogged(c, -mv.z);
  vAlpha = smoothstep(0.0, 0.25, g) * mix(0.9, 0.55, t) * (1.0 - smoothstep(-0.1, -0.45, facing) * (1.0 - t));
}
`;

const fragment = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha * uOpacity);
}
`;

export function filaments(ctx, strands, opts = {}) {
  const { THREE, U, pal } = ctx;
  const { n, root, normal, flow, info, color, tip } = strands;
  const K = opts.segments ?? 6;
  const verts = n * K;
  const T = new Float32Array(verts);
  const rep = (src, k) => {
    const out = new Float32Array(verts * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < K; j++) for (let c = 0; c < k; c++) out[(i * K + j) * k + c] = src[i * k + c];
    return out;
  };
  for (let i = 0; i < n; i++) for (let j = 0; j < K; j++) T[i * K + j] = j / (K - 1);
  const index = new Uint32Array(n * (K - 1) * 2);
  let w = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < K - 1; j++) {
      index[w++] = i * K + j;
      index[w++] = i * K + j + 1;
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  geometry.setAttribute("aT", new THREE.BufferAttribute(T, 1));
  geometry.setAttribute("aRoot", new THREE.BufferAttribute(rep(root, 3), 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(rep(normal, 3), 3));
  geometry.setAttribute("aFlow", new THREE.BufferAttribute(rep(flow, 3), 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(rep(info, 4), 4));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(rep(color, 3), 3));
  geometry.setAttribute("aTip", new THREE.BufferAttribute(rep(tip, 3), 3));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...U,
      uGrow: { value: opts.grow ?? 1.8 },
      uLift: { value: opts.lift ?? 0.35 },
      uDroop: { value: opts.droop ?? 0.35 },
      uWind: { value: opts.wind ?? 0.06 },
      uKeep: { value: opts.keep ?? 0 },
      uOpacity: { value: opts.opacity ?? (pal.dark ? 0.6 : 0.8) },
    },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
  });
  const object = new THREE.LineSegments(geometry, material);
  object.frustumCulled = false;
  object.renderOrder = 2;
  return { object };
}
