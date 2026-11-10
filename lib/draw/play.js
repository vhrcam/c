import { MARK } from "../mark.js";
import { compose } from "./compose.js";
import { ribbon } from "./svg.js";

const MARGIN = 5;

// lay one stroke, or the first part of it, onto a canvas whose transform is already in artwork units
function ink(ctx, s, color, thin, part = 1) {
  const p = s.p;
  ctx.globalAlpha = s.a ?? 1;
  if (p.length === 2) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p[0], p[1], Math.max(s.w, thin) * 0.5 * Math.min(1, part * 1.5), 0, 6.2832);
    ctx.fill();
    return;
  }
  const n = p.length / 2;
  const upto = part >= 1 ? n : Math.max(2, Math.ceil(part * (n - 1)) + 1);
  if (typeof s.w === "number") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(s.w, thin);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 1; i < upto; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
    ctx.stroke();
    return;
  }
  const r = ribbon(p, s.w, 0, upto - 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r[0], r[1]);
  for (let i = 2; i < r.length; i += 2) ctx.lineTo(r[i], r[i + 1]);
  ctx.closePath();
  ctx.fill();
  if (upto === n || part >= 1) return;
  // hairline ribbons would vanish at one pixel, so the leading edge gets a faint spine
  ctx.strokeStyle = color;
  ctx.lineWidth = thin;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  for (let i = 1; i < upto; i++) ctx.lineTo(p[i * 2], p[i * 2 + 1]);
  ctx.stroke();
}

function sign(ctx, art, color, alpha = 1) {
  const h = 2.3;
  const k = h / MARK.h;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(art.W - MARK.w * k, art.H + 1.5);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(MARK.c));
  ctx.fillRect(MARK.cursor.x, MARK.cursor.y, MARK.cursor.w, MARK.cursor.h);
  ctx.restore();
}

// the whole finished piece on a canvas of its own, for saving
export function render(art, width = 2400, caption = "") {
  const scale = width / (art.W + MARGIN * 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round((art.H + MARGIN * 2) * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = art.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale, 0, 0, scale, MARGIN * scale, MARGIN * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const thin = 0.7 / scale;
  for (const s of art.strokes) if (s.kind !== "block") ink(ctx, s, art.inks[s.ink], thin);
  sign(ctx, art, art.inks[art.key]);
  if (caption) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = art.inks[art.key];
    ctx.font = `1.5px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = "top";
    ctx.fillText(caption, 0, art.H + 1.9);
  }
  return canvas;
}

// Build a score into an artwork on a canvas, stroke by stroke, in real time.
export function createPlayer(canvas, score, { onPhase, onDone } = {}) {
  const art = compose(score, score.seed);
  const { strokes, inks, duration, phases } = art;
  const ctx = canvas.getContext("2d");
  const base = document.createElement("canvas");
  const sketch = document.createElement("canvas");
  const bx = base.getContext("2d");
  const sx = sketch.getContext("2d");
  const view = { scale: 1, x: 0, y: 0, thin: 0.1 };
  const fadeFrom = phases.find((p) => p.id === "forms").at;
  const fadeTo = phases.find((p) => p.id === "air").at;
  let T = 0;
  let speed = 1;
  let playing = true;
  let done = false;
  let phase = -1;
  let next = 0;
  let active = [];
  let last = performance.now();
  let frame = 0;
  let dirty = true;

  const prime = (c) => {
    c.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    c.lineCap = "round";
    c.lineJoin = "round";
  };

  const commit = (s) => ink(s.kind === "block" ? sx : bx, s, inks[s.ink], view.thin);

  // everything that has finished by now goes onto the sheet; what is mid-stroke waits in `active`
  const advance = (budget = Infinity) => {
    let n = 0;
    while (next < strokes.length && strokes[next].at <= T && n < budget) {
      active.push(strokes[next++]);
      n++;
    }
    if (!active.length) return;
    const still = [];
    for (const s of active) {
      if (s.at + s.dur <= T) commit(s);
      else still.push(s);
    }
    active = still;
  };

  const fit = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round((canvas.clientWidth || 1) * dpr));
    const h = Math.max(1, Math.round((canvas.clientHeight || 1) * dpr));
    if (canvas.width === w && canvas.height === h && view.ready) return;
    for (const c of [canvas, base, sketch]) {
      c.width = w;
      c.height = h;
    }
    const narrow = w < h;
    const scale = Math.min((w * (narrow ? 0.94 : 0.86)) / art.W, (h * (narrow ? 0.7 : 0.8)) / (art.H + 4));
    view.scale = scale;
    view.x = (w - art.W * scale) / 2;
    view.y = (h - (art.H + 4) * scale) / 2 - (narrow ? h * 0.04 : 0);
    view.thin = 0.75 / scale;
    view.ready = true;
    prime(bx);
    prime(sx);
    // redraw what has already been laid
    next = 0;
    active = [];
    advance();
    dirty = true;
  };

  const draw = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = art.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const ghost = T < fadeFrom ? 1 : Math.max(0, 1 - (T - fadeFrom) / (fadeTo - fadeFrom));
    if (ghost > 0) {
      ctx.globalAlpha = ghost;
      ctx.drawImage(sketch, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(base, 0, 0);
    prime(ctx);
    for (const s of active) {
      if (s.kind === "block") ctx.globalAlpha = ghost;
      ink(ctx, s, inks[s.ink], view.thin, Math.min(1, (T - s.at) / s.dur));
    }
    const signed = (T - (duration - 0.9)) / 0.6;
    if (signed > 0) sign(ctx, art, inks[art.key], Math.min(1, signed));
  };

  const step = () => {
    let at = -1;
    for (let i = 0; i < phases.length; i++) if (T >= phases[i].at) at = i;
    if (at !== phase) {
      phase = at;
      if (at >= 0) onPhase?.(phases[at].id, phases[at].label);
    }
    if (!done && T >= duration) {
      done = true;
      onDone?.();
    }
  };

  const tick = (now) => {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const before = T;
    if (playing && T < duration) T = Math.min(duration, T + dt * speed);
    if (T !== before || dirty || next < strokes.length || active.length) {
      // a skip lands thousands of strokes at once; spread them over a few frames
      advance(T >= duration ? 9000 : Infinity);
      draw();
      dirty = next < strokes.length && T >= duration;
    }
    step();
  };

  const observer = new ResizeObserver(fit);
  observer.observe(canvas);
  fit();
  frame = requestAnimationFrame(tick);

  const restart = (t) => {
    T = t;
    next = 0;
    active = [];
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.clearRect(0, 0, base.width, base.height);
    sx.setTransform(1, 0, 0, 1, 0, 0);
    sx.clearRect(0, 0, sketch.width, sketch.height);
    prime(bx);
    prime(sx);
    dirty = true;
  };

  return {
    plan: score,
    art,
    phases,
    background: art.paper,
    duration,
    meta: art.meta,
    time: () => T,
    seek: (t) => (t < T ? restart(t) : (T = t)),
    play: () => (playing = true),
    pause: () => (playing = false),
    toggle: () => (playing = !playing),
    setSpeed: (s) => (speed = s),
    skip: () => {
      T = duration;
      playing = true;
    },
    replay: () => {
      done = false;
      phase = -1;
      restart(0);
    },
    resize: fit,
    snapshot: () => new Promise((resolve) => render(art, 2400, score.title).toBlob(resolve, "image/png")),
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}
