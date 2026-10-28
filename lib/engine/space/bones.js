import { COMMON } from "./glsl";
import { add, len, mul, sub } from "../math";

const vertex = /* glsl */ `
${COMMON}
attribute vec3 aA;
attribute vec3 aB;
attribute vec3 aInfo;
uniform float uGrow;
uniform vec2 uFade;
varying float vAlpha;
void main() {
  float g = easeOut((uT - aInfo.x) / uGrow);
  vec3 p = mix(aA, aB, min(aInfo.y, g));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float fade = 1.0 - smoothstep(uFade.x, uFade.y, uT);
  vAlpha = step(0.0001, g) * fade * aInfo.z;
}
`;

const fragment = /* glsl */ `
uniform vec3 uInk;
varying float vAlpha;
void main() {
  if (vAlpha < 0.005) discard;
  gl_FragColor = vec4(uInk, vAlpha);
}
`;

function edges(p) {
  if (p.shape === "rcone" || p.shape === "cyl" || p.shape === "cone") return [[p.a, p.b]];
  if (p.shape === "ell" || p.shape === "box") {
    const m = p.m.r;
    const r = p.radii || p.size;
    return [0, 1, 2].map((k) => {
      const axis = [m[k], m[3 + k], m[6 + k]];
      return [add(p.c, mul(axis, -r[k])), add(p.c, mul(axis, r[k]))];
    });
  }
  if (p.shape === "torus") {
    const { x, z } = p.frame;
    const out = [];
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2;
      const a1 = ((i + 1) / 24) * Math.PI * 2;
      const at = (a) => add(p.c, add(mul(x, Math.cos(a) * p.R), mul(z, Math.sin(a) * p.R)));
      out.push([at(a0), at(a1)]);
    }
    return out;
  }
  if (p.shape === "lathe") {
    const { x, y, z } = p.frame;
    const out = [];
    const ring = (r, h) => {
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2;
        const a1 = ((i + 1) / 16) * Math.PI * 2;
        const at = (a) => add(add(p.c, mul(y, h)), add(mul(x, Math.cos(a) * r), mul(z, Math.sin(a) * r)));
        out.push([at(a0), at(a1)]);
      }
    };
    p.profile.forEach(([r, h]) => ring(r, h));
    const h0 = p.profile[0][1];
    const h1 = p.profile[p.profile.length - 1][1];
    out.push([add(p.c, mul(y, h0)), add(p.c, mul(y, h1))]);
    return out;
  }
  return [];
}

export function bones(ctx, form, opts = {}) {
  const { THREE, U, pal, W } = ctx;
  const K = 6;
  const lines = [];
  const reach = Math.max(1e-3, ...form.prims.map((p) => len(sub(p.c || p.a, form.heart))));
  for (const p of form.prims) {
    if (p.cut) continue;
    const d = len(sub(p.c || p.a, form.heart)) / reach;
    for (const [a, b] of edges(p)) lines.push({ a, b, d });
  }
  const n = lines.length;
  const A = new Float32Array(n * K * 2 * 3);
  const B = new Float32Array(n * K * 2 * 3);
  const info = new Float32Array(n * K * 2 * 3);
  const [s0, s1] = opts.window || [W.structure[0], W.structure[1] - 1.6];
  let w = 0;
  lines.forEach(({ a, b, d }) => {
    const birth = s0 + d * (s1 - s0);
    for (let j = 0; j < K; j++)
      for (const u of [j / K, (j + 1) / K]) {
        A.set(a, w * 3);
        B.set(b, w * 3);
        info.set([birth, u, opts.alpha ?? 0.55], w * 3);
        w++;
      }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(w * 3), 3));
  geometry.setAttribute("aA", new THREE.BufferAttribute(A, 3));
  geometry.setAttribute("aB", new THREE.BufferAttribute(B, 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 3));
  const object = new THREE.LineSegments(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: { ...U, uGrow: { value: 1.2 }, uFade: { value: new THREE.Vector2(...(opts.fade || [W.form[1] - 2, W.detail[1]])) }, uInk: { value: new THREE.Vector3(...pal.ink) } },
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
    })
  );
  object.frustumCulled = false;
  return { object };
}
