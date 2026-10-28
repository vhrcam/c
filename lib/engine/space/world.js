import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { palette } from "../palette";
import { compose } from "./compose";

export const W = {
  seed: [0, 1.6],
  structure: [1.2, 6],
  form: [2.6, 10.5],
  detail: [6.5, 13.5],
  light: [8, 14],
  world: [9.5, 16],
  end: 16.5,
};

export const PHASES = [
  { id: "seed", label: "seed", at: W.seed[0] },
  { id: "structure", label: "structure", at: W.structure[0] },
  { id: "form", label: "form", at: W.form[0] },
  { id: "detail", label: "detail", at: W.detail[0] },
  { id: "light", label: "light", at: W.light[0] },
  { id: "world", label: "world", at: W.world[0] },
  { id: "alive", label: "alive", at: W.end },
];

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
const inOut = (t) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
};

function quality() {
  const small = Math.min(screen.width, screen.height) < 600;
  const cores = navigator.hardwareConcurrency || 4;
  return small || cores <= 4 ? 0.45 : 1;
}

export function createSpace(canvas, plan, { onPhase, onDone } = {}) {
  const pal = palette(plan);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(new THREE.Color().setRGB(...pal.bg, THREE.SRGBColorSpace), 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 4000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.rotateSpeed = 0.6;
  controls.zoomSpeed = 0.8;

  const U = {
    uT: { value: 0 },
    uScale: { value: 600 },
    uLight: { value: 0 },
    uBg: { value: new THREE.Vector3(...pal.bg) },
    uDark: { value: pal.dark ? 1 : 0 },
    uFogNear: { value: 10 },
    uFogFar: { value: 60 },
    uKeyDir: { value: new THREE.Vector3(0.5, 0.8, 0.35).normalize() },
    uKey: { value: new THREE.Vector3(0.8, 0.78, 0.74) },
    uAmbient: { value: new THREE.Vector3(0.35, 0.36, 0.4) },
    uExposure: { value: 1 },
    uLamp: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
    uLampColor: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(1, 0.8, 0.5)) },
  };

  const ctx = { THREE, U, plan, pal, W, renderer, camera, scene, quality: quality() };
  const built = compose(ctx);
  for (const s of built.systems) if (s.object) scene.add(s.object);

  const rig = built.rig;
  camera.fov = rig.fov;
  U.uFogNear.value = rig.fog[0];
  U.uFogFar.value = rig.fog[1];
  controls.target.copy(rig.end.target);
  controls.minDistance = rig.zoom[0];
  controls.maxDistance = rig.zoom[1];

  let T = 0;
  let speed = 1;
  let playing = true;
  let user = false;
  let phase = -1;
  let done = false;
  let frame = 0;
  let last = performance.now();
  let drift = 0;

  controls.addEventListener("start", () => {
    user = true;
  });

  const fit = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    U.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  };

  const place = (dt) => {
    if (user) return;
    const k = inOut((T - 0.2) / (W.world[1] - 1.2));
    const from = rig.start.pos.clone().lerp(rig.end.pos, k);
    const target = rig.start.target.clone().lerp(rig.end.target, k);
    const swing = (1 - k) * rig.swing;
    if (T >= W.end) drift += dt * rig.drift;
    const turn = swing + drift;
    if (turn) from.sub(target).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn).add(target);
    camera.position.copy(from);
    controls.target.copy(target);
  };

  const step = (dt) => {
    U.uT.value = T;
    U.uLight.value = smooth((T - W.light[0]) / (W.light[1] - W.light[0]));
    for (const s of built.systems) s.update?.(T, dt, camera);
    let next = -1;
    for (let i = 0; i < PHASES.length; i++) if (T >= PHASES[i].at) next = i;
    if (next !== phase) {
      phase = next;
      if (next >= 0) onPhase?.(PHASES[next].id, PHASES[next].label);
    }
    if (!done && T >= W.end) {
      done = true;
      onDone?.();
    }
  };

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (playing) T += dt * speed;
    place(playing ? dt : 0);
    step(dt);
    controls.update();
    renderer.render(scene, camera);
  };

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  fit();
  frame = requestAnimationFrame(tick);

  return {
    plan,
    phases: PHASES.map(({ id, label }) => ({ id, label })),
    background: pal.bgHex,
    duration: W.end,
    time: () => T,
    seek: (t) => {
      T = Math.max(0, t);
      if (T < W.end) done = false;
    },
    play: () => {
      playing = true;
    },
    pause: () => {
      playing = false;
    },
    toggle: () => {
      playing = !playing;
    },
    setSpeed: (s) => {
      speed = s;
    },
    skip: () => {
      T = Math.max(T, W.end);
      playing = true;
    },
    replay: () => {
      T = 0;
      done = false;
      phase = -1;
      user = false;
      drift = 0;
      playing = true;
    },
    resize: fit,
    snapshot: () =>
      new Promise((resolve) => {
        renderer.render(scene, camera);
        canvas.toBlob(resolve, "image/png");
      }),
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      for (const s of built.systems) s.dispose?.();
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose?.();
      });
      renderer.dispose();
    },
  };
}
