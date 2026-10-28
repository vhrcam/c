import { random } from "../../random";
import { mixColor, rgb } from "../palette";
import { COMMON } from "./glsl";

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99999;
}
`;

const domeFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uGlowDir;
uniform float uReveal;
uniform vec3 uBg;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 c = mix(uHorizon, uZenith, smoothstep(-0.02, 0.55, h));
  float g = pow(max(0.0, dot(normalize(vDir), uGlowDir)), 6.0) * smoothstep(-0.2, 0.15, h);
  c += uGlow * g;
  c = mix(c, uZenith * 0.85, smoothstep(0.0, -0.25, h));
  gl_FragColor = vec4(mix(uBg, c, uReveal), 1.0);
}
`;

const starVertex = /* glsl */ `
${COMMON}
attribute vec3 aInfo;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99998;
  float on = smoothstep(aInfo.x, aInfo.x + 1.2, uT);
  float tw = 0.75 + 0.25 * sin(uT * (1.0 + aInfo.z * 3.0) + aInfo.z * 40.0);
  vAlpha = on * tw * (0.35 + aInfo.y * 0.65) * smoothstep(-0.02, 0.15, normalize(position).y);
  gl_PointSize = 1.0 + aInfo.y * 1.6;
}
`;

const starFragment = /* glsl */ `
uniform vec3 uInk;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5 || vAlpha < 0.01) discard;
  gl_FragColor = vec4(uInk, vAlpha * smoothstep(0.5, 0.1, d));
}
`;

const moonVertex = /* glsl */ `
${COMMON}
attribute vec2 aInfo;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w * 0.99997;
  float g = smoothstep(aInfo.x, aInfo.x + 0.9, uT);
  vAlpha = g * aInfo.y;
  gl_PointSize = 1.6;
}
`;

const moonFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(uColor, vAlpha);
}
`;

export function sky(ctx, scene) {
  const { THREE, U, plan, pal, W } = ctx;
  const { time, weather, setting } = plan.world;
  const R = scene.sky;
  const group = new THREE.Group();
  const bg = pal.bg;
  const warm = rgb(time === "golden" ? "#e8a656" : time === "dawn" ? "#e7a38a" : "#d9774a");
  const horizon = setting === "space" ? bg : pal.night ? mixColor(bg, [bg[0] * 2.2 + 0.03, bg[1] * 2.2 + 0.035, bg[2] * 2.2 + 0.05], 0.8) : mixColor(bg, [1, 1, 1], 0.25);
  const glow = time === "dusk" || time === "golden" || time === "dawn" ? warm.map((v) => v * (pal.dark ? 0.35 : 0.25)) : [0, 0, 0];
  const glowDir = new THREE.Vector3(-scene.view.x, 0.06, -scene.view.z).normalize();
  const reveal = { value: 0 };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: { uZenith: { value: new THREE.Vector3(...bg) }, uHorizon: { value: new THREE.Vector3(...horizon) }, uGlow: { value: new THREE.Vector3(...glow) }, uGlowDir: { value: glowDir }, uReveal: reveal, uBg: U.uBg },
      vertexShader: domeVertex,
      fragmentShader: domeFragment,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  const clearSky = weather !== "storm" && weather !== "fog" && weather !== "rain";
  if (pal.night && clearSky) {
    const rand = random((plan.seed ^ 0x2545f491) >>> 0);
    const n = setting === "space" ? 7000 : setting === "city" ? 900 : 3200;
    const pos = new Float32Array(n * 3);
    const info = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const y = setting === "space" ? u : Math.abs(u) * 0.95 + 0.02;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * R * 0.95, y * R * 0.95, Math.sin(a) * r * R * 0.95], i * 3);
      info.set([W.world[0] + rand() * 5, Math.pow(rand(), 3), rand()], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aInfo", new THREE.BufferAttribute(info, 3));
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { ...U, uInk: { value: new THREE.Vector3(...pal.ink) } }, vertexShader: starVertex, fragmentShader: starFragment, transparent: true, depthWrite: false }));
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    group.add(stars);
  }

  const moon = plan.lights.find((l) => l.kind === "moon") || (pal.night && clearSky && setting !== "space" ? { kind: "moon", color: "" } : null);
  if (moon) {
    const dir = new THREE.Vector3(-scene.view.x, 0.42, -scene.view.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35);
    const c = dir.clone().multiplyScalar(R * 0.9);
    const size = R * 0.035;
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const pts = [];
    const info = [];
    const rings = 34;
    for (let k = 1; k <= rings; k++) {
      const rr = (k / rings) * size;
      const m = Math.round(12 + k * 7);
      for (let j = 0; j < m; j++) {
        const a = (j / m) * Math.PI * 2;
        const lx = Math.cos(a);
        const lit = Math.min(1, Math.max(0, lx * 0.8 + 0.55));
        pts.push(c.x + (right.x * lx + up.x * Math.sin(a)) * rr, c.y + (right.y * lx + up.y * Math.sin(a)) * rr, c.z + (right.z * lx + up.z * Math.sin(a)) * rr);
        info.push(W.light[0] + (k / rings) * 2.2, 0.25 + lit * 0.7);
      }
    }
    for (const halo of [1.6, 2.5, 3.9]) {
      const m = 220;
      for (let j = 0; j < m; j++) {
        const a = (j / m) * Math.PI * 2;
        pts.push(c.x + (right.x * Math.cos(a) + up.x * Math.sin(a)) * size * halo, c.y + (right.y * Math.cos(a) + up.y * Math.sin(a)) * size * halo, c.z + (right.z * Math.cos(a) + up.z * Math.sin(a)) * size * halo);
        info.push(W.light[0] + 1.6 + halo * 0.3, 0.16 / halo);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
    g.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(info), 2));
    const disc = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: { ...U, uColor: { value: new THREE.Vector3(...rgb(moon.color || "#dfe4ee")) } }, vertexShader: moonVertex, fragmentShader: moonFragment, transparent: true, depthWrite: false }));
    disc.frustumCulled = false;
    disc.renderOrder = -8;
    group.add(disc);
    scene.moonDir = dir;
  }
  return {
    object: group,
    update: (T, dt, camera) => {
      reveal.value = Math.min(1, Math.max(0, (T - W.structure[0]) / 4));
      if (camera) group.position.copy(camera.position);
    },
  };
}
