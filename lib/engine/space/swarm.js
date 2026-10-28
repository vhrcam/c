import { COMMON } from "./glsl";

const PATH = /* glsl */ `
attribute vec3 aNormal;
attribute vec3 aColor;
attribute vec4 aInfo;
attribute vec3 aFrom;
attribute vec3 aCtrl;
uniform float uSize;
uniform float uBreath;
uniform float uWave;
uniform vec3 uFlight;
vec3 along(float e) {
  float u = 1.0 - e;
  return u * u * aFrom + 2.0 * u * e * aCtrl + e * e * position;
}
`;

const pointsVertex = /* glsl */ `
${COMMON}
${PATH}
varying vec3 vColor;
varying float vAlpha;
void main() {
  float s = (uT - aInfo.x) / aInfo.y;
  if (s <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vAlpha = 0.0;
    return;
  }
  float e = easeInOut(min(s, 1.0));
  float settled = smoothstep(0.85, 1.0, s);
  vec3 p = along(e);
  float wave = sin(uT * 1.1 - dot(position, vec3(1.0, 0.6, 0.8)) * uWave + aInfo.z * 0.8);
  p += aNormal * wave * uBreath * settled;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * aNormal);
  vec4 mv = viewMatrix * world;
  gl_Position = projectionMatrix * mv;
  float facing = dot(n, normalize(cameraPosition - world.xyz));
  vec3 lit = shade(aColor * (0.92 + aInfo.z * 0.16), world.xyz, n, aInfo.w);
  vColor = fogged(mix(uFlight, lit, smoothstep(0.55, 1.0, s)), -mv.z);
  vAlpha = smoothstep(0.0, 0.06, s) * (1.0 - settled * smoothstep(-0.05, -0.25, facing));
  gl_PointSize = clamp(uSize * uScale / -mv.z * mix(0.6, 1.0, settled), 1.0, 16.0);
}
`;

const pointsFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25 || vAlpha < 0.02) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

const trailVertex = /* glsl */ `
${COMMON}
${PATH}
attribute float aEnd;
uniform float uTrail;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float s = (uT - aInfo.x) / aInfo.y;
  float e = easeInOut(clamp(s - aEnd * uTrail, 0.0, 1.0));
  vec4 mv = viewMatrix * modelMatrix * vec4(along(e), 1.0);
  gl_Position = projectionMatrix * mv;
  float live = step(0.0, s) * (1.0 - smoothstep(0.7, 1.0, s));
  vColor = mix(uFlight, aColor, 0.35);
  vAlpha = live * (1.0 - aEnd) * 0.55;
}
`;

const trailFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;

export function swarm(ctx, form, opts = {}) {
  const { THREE, U, pal } = ctx;
  const { samples, colors, order, from, ctrl } = form;
  const [b0, b1] = opts.birth || [ctx.W.form[0], ctx.W.form[1]];
  const flight = opts.flight ?? 1.6;
  const n = samples.n;
  const info = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = form.rand[i];
    info[i * 4] = b0 + order[i] * Math.max(0.1, b1 - b0 - flight);
    info[i * 4 + 1] = flight * (0.75 + r * 0.5);
    info[i * 4 + 2] = r;
    info[i * 4 + 3] = samples.ao[i];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(samples.pos, 3));
  geometry.setAttribute("aNormal", new THREE.BufferAttribute(samples.nrm, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  geometry.setAttribute("aFrom", new THREE.BufferAttribute(from, 3));
  geometry.setAttribute("aCtrl", new THREE.BufferAttribute(ctrl, 3));
  const uniforms = {
    ...U,
    uSize: { value: opts.size ?? samples.diag * 0.0045 },
    uBreath: { value: opts.breath ?? samples.diag * 0.002 },
    uWave: { value: 6 / samples.diag },
    uFlight: { value: new THREE.Vector3(...(opts.flightColor || pal.ink)) },
    uTrail: { value: 0.22 },
  };
  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({ uniforms, vertexShader: pointsVertex, fragmentShader: pointsFragment, transparent: true }));
  points.frustumCulled = false;

  const group = new THREE.Group();
  group.add(points);

  const every = Math.max(1, Math.round(n / (opts.trails ?? 16000)));
  const m = Math.floor(n / every);
  if (m > 0) {
    const pick = (src, k) => {
      const out = new Float32Array(m * 2 * k);
      for (let j = 0; j < m; j++) {
        const i = j * every;
        for (let c = 0; c < k; c++) {
          out[j * 2 * k + c] = src[i * k + c];
          out[j * 2 * k + k + c] = src[i * k + c];
        }
      }
      return out;
    };
    const end = new Float32Array(m * 2);
    for (let j = 0; j < m; j++) end[j * 2 + 1] = 1;
    const lines = new THREE.BufferGeometry();
    lines.setAttribute("position", new THREE.BufferAttribute(pick(samples.pos, 3), 3));
    lines.setAttribute("aNormal", new THREE.BufferAttribute(pick(samples.nrm, 3), 3));
    lines.setAttribute("aColor", new THREE.BufferAttribute(pick(colors, 3), 3));
    lines.setAttribute("aInfo", new THREE.BufferAttribute(pick(info, 4), 4));
    lines.setAttribute("aFrom", new THREE.BufferAttribute(pick(from, 3), 3));
    lines.setAttribute("aCtrl", new THREE.BufferAttribute(pick(ctrl, 3), 3));
    lines.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
    const trails = new THREE.LineSegments(
      lines,
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: trailVertex,
        fragmentShader: trailFragment,
        transparent: true,
        depthWrite: false,
        blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
    );
    trails.frustumCulled = false;
    group.add(trails);
  }
  return {
    object: group,
    update: (T) => {
      group.children[1] && (group.children[1].visible = T > b0 && T < b1 + flight * 1.5);
    },
  };
}
