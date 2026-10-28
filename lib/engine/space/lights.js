import { random } from "../../random";
import { rgb } from "../palette";
import { COMMON } from "./glsl";

const MOOD = {
  night: { key: [0.42, 0.47, 0.6], ambient: [0.09, 0.1, 0.14], dir: [-0.4, 0.75, -0.3] },
  dusk: { key: [0.85, 0.55, 0.38], ambient: [0.3, 0.27, 0.34], dir: [-0.7, 0.3, -0.4] },
  golden: { key: [1.0, 0.78, 0.5], ambient: [0.42, 0.37, 0.36], dir: [-0.6, 0.35, 0.5] },
  day: { key: [0.95, 0.93, 0.88], ambient: [0.42, 0.43, 0.46], dir: [0.4, 0.85, 0.35] },
  dawn: { key: [0.95, 0.74, 0.62], ambient: [0.3, 0.27, 0.3], dir: [0.7, 0.3, -0.3] },
  space: { key: [1.15, 1.1, 1.02], ambient: [0.025, 0.028, 0.035], dir: [0.8, 0.25, 0.45] },
};

const glowVertex = /* glsl */ `
${COMMON}
attribute vec3 aInfo;
uniform float uGlow;
varying float vAlpha;
varying float vKind;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vKind = aInfo.z;
  float on = smoothstep(0.0, 1.0, uGlow);
  if (aInfo.z < 0.5) {
    vAlpha = on;
    gl_PointSize = aInfo.x * uScale / -mv.z;
  } else {
    float drift = sin(uT * 0.4 + aInfo.y * 30.0);
    vAlpha = on * (0.35 + 0.65 * aInfo.y) * (0.6 + 0.4 * drift);
    gl_PointSize = clamp(aInfo.x * uScale / -mv.z, 1.0, 3.0);
  }
}
`;

const glowFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vKind;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float a = vKind < 0.5 ? pow(1.0 - d, 2.4) * 0.9 : smoothstep(1.0, 0.2, d);
  gl_FragColor = vec4(uColor, a * vAlpha);
}
`;

const MOTES = /* glsl */ `
${COMMON}
attribute vec3 aInfo;
uniform vec3 uLampPos;
uniform float uGlow;
uniform float uHeight;
varying float vAlpha;
varying float vKind;
void main() {
  vKind = 1.0;
  vec3 p = position;
  float t = uT * 0.05 * (0.5 + aInfo.y);
  p.y = mod(p.y - t * uHeight - uLampPos.y + uHeight, uHeight) + uLampPos.y - uHeight;
  p.x += sin(uT * 0.3 + aInfo.y * 20.0) * 0.08 * uHeight;
  p.z += cos(uT * 0.25 + aInfo.y * 13.0) * 0.08 * uHeight;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 d = p - uLampPos;
  float r = length(d.xz) / max(0.01, -d.y);
  float cone = smoothstep(0.85, 0.35, r) * smoothstep(0.0, 0.1 * uHeight, -d.y);
  vAlpha = smoothstep(0.0, 1.0, uGlow) * cone * (0.25 + aInfo.y * 0.75) * smoothstep(0.0, 0.25 * uHeight, p.y);
  gl_PointSize = clamp(aInfo.x * uScale / -mv.z, 1.0, 2.5);
}
`;

const BEAM = /* glsl */ `
${COMMON}
attribute vec4 aInfo;
uniform float uGlow;
uniform float uLen;
varying float vAlpha;
void main() {
  float spin = uT * 0.55;
  vec3 d = normalize(vec3(cos(spin + aInfo.x), aInfo.y, sin(spin + aInfo.x)));
  vec3 p = position + d * aInfo.z;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float k = aInfo.z / uLen;
  vAlpha = uGlow * 0.05 * (1.0 - k) * (0.5 + aInfo.w);
}
`;

export function keyLight(ctx, scene) {
  const { THREE, U, plan } = ctx;
  const mood = plan.world.setting === "space" ? MOOD.space : MOOD[plan.world.time] || MOOD.night;
  const turn = plan.world.setting === "space" ? 1.75 : 0.9;
  const side = new THREE.Vector3(scene.view.x, 0, scene.view.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), plan.seed % 2 ? turn : -turn);
  const low = ["golden", "dusk", "dawn"].includes(plan.world.time) && plan.world.setting !== "space";
  if (low) {
    const back = new THREE.Vector3(-scene.view.x, 0, -scene.view.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), plan.seed % 2 ? 1.05 : -1.05);
    U.uKeyDir.value.set(back.x, 0.2, back.z).normalize();
  } else U.uKeyDir.value.set(side.x, plan.world.setting === "space" ? 0.25 : 0.85, side.z).normalize();
  U.uKey.value.set(...mood.key);
  U.uAmbient.value.set(...mood.ambient);
  const l = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  U.uExposure.value = Math.min(plan.world.time === "night" ? 1.6 : 2.2, Math.max(0.85, 0.82 / (l(mood.key) * 0.62 + l(mood.ambient))));
  return mood;
}

export function lighting(ctx, scene, spots, opts = {}) {
  const { THREE, U, plan, pal, W } = ctx;
  keyLight(ctx, scene);
  const group = new THREE.Group();
  const lamps = [];
  plan.lights
    .filter((l) => !["sun", "moon"].includes(l.kind))
    .slice(0, 4)
    .forEach((light) => {
      const owner = spots.find((s) => s.subject.id === light.at) || spots.find((s) => s.subject.form === "parts" && s.prims.some((p) => /lamp|bulb|light|lantern|flame|fire/.test(p.name || "")));
      let pos;
      if (owner) {
        const lit = owner.prims.filter((p) => /lamp|bulb|light|lantern|flame|fire|glass|window/.test(p.name || ""));
        const src = lit.length ? lit[lit.length - 1] : null;
        const local = src ? src.c || src.a : [0, owner.box.max[1] * 0.95, 0];
        pos = new THREE.Vector3(...local).applyMatrix4(owner.matrix);
      } else pos = new THREE.Vector3(scene.cx, scene.height * 1.4, scene.cz);
      const strength = light.kind === "streetlight" || light.kind === "lamp" ? 1.6 : light.kind === "fire" ? 1.4 : light.kind === "beam" ? 1.0 : 1.1;
      lamps.push({ pos, color: rgb(light.color || "#f2c879"), strength, range: Math.max(0.6, pos.y * 0.75), kind: light.kind, owner });
    });

  lamps.forEach((lamp, i) => {
    U.uLampColor.value[i].set(...lamp.color);
    U.uLampRange.value[i] = lamp.range;
    const rand = random((plan.seed + i * 104729) >>> 0);
    const glow = new THREE.BufferGeometry();
    const H = Math.max(1.5, lamp.pos.y);
    const motes = Math.round(1800 * ctx.quality);
    const pos = [lamp.pos.x, lamp.pos.y, lamp.pos.z];
    const info = [H * 0.5, 0, 0];
    glow.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    glow.setAttribute("aInfo", new THREE.BufferAttribute(new Float32Array(info), 3));
    const uGlow = { value: 0 };
    const sprite = new THREE.Points(glow, new THREE.ShaderMaterial({ uniforms: { ...U, uGlow, uColor: { value: new THREE.Vector3(...lamp.color) } }, vertexShader: glowVertex, fragmentShader: glowFragment, transparent: true, depthWrite: false, blending: pal.dark ? THREE.AdditiveBlending : THREE.NormalBlending }));
    sprite.frustumCulled = false;
    group.add(sprite);
    if (pal.dark && opts.motes) {
      const mp = new Float32Array(motes * 3);
      const mi = new Float32Array(motes * 3);
      for (let k = 0; k < motes; k++) {
        const y = lamp.pos.y - rand() * H;
        const spread = (lamp.pos.y - y) * 0.75;
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * spread;
        mp.set([lamp.pos.x + Math.cos(a) * r, y, lamp.pos.z + Math.sin(a) * r], k * 3);
        mi.set([0.012 * H, rand(), 1], k * 3);
      }
      const mg = new THREE.BufferGeometry();
      mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
      mg.setAttribute("aInfo", new THREE.BufferAttribute(mi, 3));
      const dust = new THREE.Points(
        mg,
        new THREE.ShaderMaterial({ uniforms: { ...U, uGlow, uColor: { value: new THREE.Vector3(...lamp.color) }, uLampPos: { value: lamp.pos }, uHeight: { value: H } }, vertexShader: MOTES, fragmentShader: glowFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      dust.frustumCulled = false;
      group.add(dust);
    }
    lamp.uGlow = uGlow;
  });

  const beams = lamps.filter((l) => l.kind === "beam").map((lamp) => {
    const rays = Math.round(900 * ctx.quality);
    const length = Math.max(scene.reach * 0.9, 40);
    const p = new Float32Array(rays * 6);
    for (let k = 0; k < rays * 2; k++) p.set([lamp.pos.x, lamp.pos.y, lamp.pos.z], k * 3);
    const g = new THREE.BufferGeometry();
    const ends = new Float32Array(rays * 2 * 4);
    const r2 = random((plan.seed + 91) >>> 0);
    for (let k = 0; k < rays; k++) {
      const a = (r2() - 0.5) * 0.12;
      const b = (r2() - 0.5) * 0.05 - 0.035;
      const L = length * (0.55 + r2() * 0.45);
      ends.set([a, b, 0, r2()], k * 8);
      ends.set([a, b, L, r2()], k * 8 + 4);
    }
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("aInfo", new THREE.BufferAttribute(ends, 4));
    const uGlow = { value: 0 };
    const mesh = new THREE.LineSegments(
      g,
      new THREE.ShaderMaterial({
        uniforms: { ...U, uGlow, uColor: { value: new THREE.Vector3(...lamp.color) }, uLen: { value: length } },
        vertexShader: BEAM,
        fragmentShader: "uniform vec3 uColor; varying float vAlpha; void main() { if (vAlpha < 0.003) discard; gl_FragColor = vec4(uColor, vAlpha); }",
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    mesh.frustumCulled = false;
    group.add(mesh);
    return uGlow;
  });

  return {
    object: group,
    lamps,
    update: (T) => {
      lamps.forEach((lamp, i) => {
        const on = Math.min(1, Math.max(0, (T - W.light[0] - i * 0.4) / 2.2));
        const flicker = on > 0 && on < 1 ? (Math.sin(T * 37) > 0.2 ? 1 : 0.35) : 1;
        const k = on * flicker;
        lamp.uGlow.value = k;
        beams.forEach((b) => (b.value = k));
        U.uLamp.value[i].set(lamp.pos.x, lamp.pos.y, lamp.pos.z, lamp.strength * k);
      });
    },
  };
}
