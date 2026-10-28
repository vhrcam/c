import { random } from "../random";
import { paint } from "./directions";
import { withView } from "./plan";
import { H, W } from "./world";

export const PHASES = [
  { id: "structure", label: "sky" },
  { id: "form", label: "world" },
  { id: "detail", label: "figures" },
  { id: "light", label: "finish" },
];
const STEPS = [
  { at: 0.4, dur: 3.2, key: "sky", from: "light" },
  { at: 3.2, dur: 3.6, key: "world", from: "horizon" },
  { at: 6.4, dur: 3.4, key: "subject", from: "focus" },
  { at: 9.4, dur: 2.2, key: "final", from: "all" },
];
const END = 11.8;
const CELL = 10;

export function createArt(canvas, plan, { onPhase, onDone } = {}) {
  const ctx = canvas.getContext("2d");
  const bg = "#11100e";
  const frames = {};
  let meta = null;
  let T = 0;
  let speed = 1;
  let playing = true;
  let done = false;
  let phase = -1;
  let last = performance.now();
  let frame = 0;
  let ready = false;
  const shown = STEPS.map(() => new Uint8Array(Math.ceil(W / CELL) * Math.ceil(H / CELL)));
  const order = [];
  const view = { scale: 1, x: 0, y: 0 };

  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const s = Math.min(canvas.width / W, canvas.height / H) * 0.94;
    view.scale = s;
    view.x = (canvas.width - W * s) / 2;
    view.y = (canvas.height - H * s) / 2;
    shown.forEach((m) => m.fill(0));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const quality = Math.min(2, Math.max(0.6, ((canvas.clientHeight || 800) * Math.min(2, window.devicePixelRatio || 1)) / H));
  paint(plan, plan.seed, {
    scale: quality,
    mark: (key, src) => {
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      c.getContext("2d").drawImage(src, 0, 0);
      frames[key] = c;
    },
  }).then((art) => {
    frames.final = art;
    meta = art.meta;
    const rand = random(plan.seed ^ 0x1234);
    const gw = Math.ceil(W / CELL);
    const gh = Math.ceil(H / CELL);
    const origin = { light: meta.light, horizon: null, focus: meta.focus, all: null };
    STEPS.forEach((s, k) => {
      const o = origin[s.from];
      const t = new Float32Array(gw * gh);
      let max = 0;
      for (let j = 0; j < gh; j++)
        for (let i = 0; i < gw; i++) {
          const x = (i + 0.5) * CELL;
          const y = (j + 0.5) * CELL;
          const d = o ? Math.hypot(x - o[0], y - o[1]) : s.from === "horizon" ? Math.abs(y - meta.horizon) * 1.6 + Math.abs(x - meta.focus[0]) * 0.3 : 0;
          t[j * gw + i] = d + rand() * 120;
          max = Math.max(max, t[j * gw + i]);
        }
      for (let q = 0; q < t.length; q++) t[q] /= max || 1;
      order[k] = t;
    });
    ready = true;
  }, () => {});

  const draw = () => {
    if (!ready) return;
    const gw = Math.ceil(W / CELL);
    STEPS.forEach((s, k) => {
      const src = frames[s.key] || frames.final;
      const p = Math.min(1, Math.max(0, (T - s.at) / s.dur));
      if (!p) return;
      const t = order[k];
      const m = shown[k];
      const q = src.width / W;
      for (let i = 0; i < t.length; i++) {
        if (m[i] || t[i] > p) continue;
        m[i] = 1;
        if (shown.some((later, j) => j > k && later[i])) continue;
        const x = (i % gw) * CELL;
        const y = Math.floor(i / gw) * CELL;
        ctx.drawImage(src, x * q, y * q, CELL * q, CELL * q, view.x + x * view.scale, view.y + y * view.scale, CELL * view.scale + 0.6, CELL * view.scale + 0.6);
      }
    });
  };

  const step = () => {
    let next = -1;
    for (let i = 0; i < STEPS.length; i++) if (T >= STEPS[i].at) next = i;
    if (next !== phase) {
      phase = next;
      if (next >= 0) onPhase?.(PHASES[next].id, PHASES[next].label);
    }
    if (!done && T >= END) {
      done = true;
      onDone?.();
    }
  };

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ready && playing) T += dt * speed;
    draw();
    step();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  fit();
  frame = requestAnimationFrame(tick);

  return {
    plan,
    phases: PHASES,
    background: bg,
    duration: END,
    time: () => T,
    seek: (t) => (T = t),
    play: () => (playing = true),
    pause: () => (playing = false),
    toggle: () => (playing = !playing),
    setSpeed: (s) => (speed = s),
    skip: () => {
      T = Math.max(T, END);
      playing = true;
    },
    replay: () => {
      T = 0;
      done = false;
      phase = -1;
      fit();
    },
    resize: fit,
    snapshot: () => new Promise((resolve) => (frames.final ? frames.final.toBlob(resolve, "image/png") : resolve(null))),
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}

export { withView };
