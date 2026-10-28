import * as THREE from "three";
import { palette } from "../palette";
import { arrange } from "../space/compose";
import { keyLight } from "../space/lights";
import { PHASES, W } from "../space/world";
import { gbuffer } from "./gbuffer";
import { flowLines } from "./lines";
import { pixelArt } from "./pixel";

export function createFlat(canvas, plan, { onPhase, onDone } = {}) {
  const pal = palette(plan);
  const offscreen = document.createElement("canvas");
  offscreen.width = 4;
  offscreen.height = 4;
  const renderer = new THREE.WebGLRenderer({ canvas: offscreen });
  const U = {
    uKeyDir: { value: new THREE.Vector3(0.5, 0.8, 0.35).normalize() },
    uKey: { value: new THREE.Vector3(1, 1, 1) },
    uAmbient: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
    uExposure: { value: 1 },
  };
  const ctx = { THREE, U, plan, pal, W, renderer, quality: 1 };
  const g2 = canvas.getContext("2d");
  const pixel = plan.style === "pixel";
  let art = null;
  let size = { w: 0, h: 0 };

  const build = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(2, Math.round((canvas.clientWidth || 800) * dpr));
    const ch = Math.max(2, Math.round((canvas.clientHeight || 500) * dpr));
    canvas.width = cw;
    canvas.height = ch;
    size = { w: cw, h: ch };
    const arranged = arrange({ ...ctx, aspect: cw / ch, flat: true }, false);
    keyLight(ctx, arranged.scene);
    if (pixel) {
      const cell = Math.max(3, Math.round(Math.min(cw, ch) / 96));
      const g = gbuffer(ctx, arranged, Math.ceil(cw / cell), Math.ceil(ch / cell));
      const p = pixelArt(g, ctx, arranged);
      const small = document.createElement("canvas");
      small.width = p.w;
      small.height = p.h;
      const s2 = small.getContext("2d");
      const data = s2.createImageData(p.w, p.h);
      art = {
        draw: (T) => {
          data.data.set(p.draw(T));
          s2.putImageData(data, 0, 0);
          g2.imageSmoothingEnabled = false;
          g2.drawImage(small, 0, 0, p.w * cell, p.h * cell);
        },
      };
    } else {
      const scale = Math.min(1, 900 / cw);
      const g = gbuffer(ctx, arranged, Math.round(cw * scale * 0.5), Math.round(ch * scale * 0.5));
      const f = flowLines(g, ctx, arranged, { w: cw, h: ch, dpr });
      art = { draw: (T) => f.draw(g2, T) };
    }
  };

  let T = 0;
  let speed = 1;
  let playing = true;
  let phase = -1;
  let done = false;
  let frame = 0;
  let last = performance.now();
  let timer = 0;

  const step = () => {
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
    step();
    art?.draw(T);
  };

  build();
  const observer = new ResizeObserver(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (Math.abs(w - size.w) < 4 && Math.abs(h - size.h) < 4) return;
    clearTimeout(timer);
    timer = setTimeout(build, 250);
  });
  observer.observe(canvas);
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
      art?.draw(T);
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
      playing = true;
    },
    resize: () => build(),
    snapshot: () =>
      new Promise((resolve) => {
        art?.draw(T);
        canvas.toBlob(resolve, "image/png");
      }),
    dispose: () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      observer.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
