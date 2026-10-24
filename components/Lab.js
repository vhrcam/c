"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_BOX, drawC } from "@/lib/paint/logo";
import { compose } from "@/lib/plot/compose";
import { plotter } from "@/lib/plot/plotter";
import Logo from "./Logo";

const PROMPT = "a man and a girl in an anime and exaggerated style, man with medium length messy blonde hair and a girl with long beautiful brown hair, close to each other seemingly about to kiss but holding one hand romantically, the girl is slightly shorter than him";
const TALL = 1000;
const SIGN = { w: 60, dur: 1 };
const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

const screen = () => {
  const aspect = Math.min(2.4, Math.max(0.45, window.innerWidth / window.innerHeight));
  return { w: Math.round(TALL * aspect), h: TALL };
};

export default function Lab() {
  const base = useRef(null);
  const live = useRef(null);
  const pencil = useRef(null);
  const sig = useRef(null);
  const run = useRef(null);
  const raf = useRef(0);
  const job = useRef(0);
  const [state, setState] = useState({ busy: true, playing: false, seed: 0, meta: null, error: "" });

  const sign = (t, p) => {
    const ctx = sig.current.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sig.current.width, sig.current.height);
    const start = p.end + 0.2;
    if (t < start) return;
    const k = (SIGN.w / LOGO_BOX.w) * p.scale;
    ctx.translate((p.size.w - 44 - SIGN.w) * p.scale, (p.size.h - 34) * p.scale);
    ctx.rotate(-0.03);
    ctx.scale(k, k);
    ctx.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    drawC(ctx, ease(Math.min(1, (t - start) / SIGN.dur)), { seed: 7, bristles: 16, rgb: p.ink, alpha: 0.92 });
  };

  const play = (fast = false) => {
    const p = run.current;
    if (!p) return;
    cancelAnimationFrame(raf.current);
    p.player.reset();
    const stop = p.end + 0.2 + SIGN.dur;
    let t = 0;
    let last = performance.now();
    setState((s) => ({ ...s, playing: true }));
    const tick = (now) => {
      const dt = Math.min(1 / 20, (now - last) / 1000);
      last = now;
      t += dt * (p.fast ? 6 : 1);
      p.player.draw(t);
      pencil.current.style.opacity = String(Math.max(0.16, 1 - Math.max(0, t - 7) / 6));
      sign(t, p);
      if (t < stop) raf.current = requestAnimationFrame(tick);
      else setState((s) => ({ ...s, playing: false }));
    };
    p.fast = fast;
    raf.current = requestAnimationFrame(tick);
  };

  const generate = async (seed) => {
    const id = ++job.current;
    cancelAnimationFrame(raf.current);
    setState((s) => ({ ...s, busy: true, seed, error: "" }));
    try {
      const size = screen();
      const shot = new URLSearchParams(window.location.search).get("shot") || undefined;
      const picture = await compose(seed, { width: size.w, height: size.h, shot });
      if (id !== job.current) return;
      const k = (window.innerHeight / size.h) * Math.min(2, window.devicePixelRatio || 1);
      for (const c of [base.current, live.current, pencil.current, sig.current]) {
        c.width = Math.round(size.w * k);
        c.height = Math.round(size.h * k);
      }
      const hex = picture.pal.ink.slice(1);
      const ink = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
      const player = plotter(base.current, live.current, pencil.current, picture, { dpr: k, width: size.w, height: size.h, margin: [0, 0] });
      run.current = { player, end: picture.end, ink, fast: false, size, scale: k, seed };
      document.body.style.background = picture.pal.paper;
      setState({ busy: false, playing: true, seed, meta: picture.meta, error: "" });
      play(false);
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e.message }));
    }
  };

  const again = () => generate(1 + Math.floor(Math.random() * 99999));

  useEffect(() => {
    const seed = Number(new URLSearchParams(window.location.search).get("seed")) || 1 + Math.floor(Math.random() * 99999);
    generate(seed);
    let timer = 0;
    const resized = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const p = run.current;
        if (p && Math.abs(screen().w / p.size.w - 1) > 0.04) generate(p.seed);
      }, 400);
    };
    window.addEventListener("resize", resized);
    return () => {
      cancelAnimationFrame(raf.current);
      clearTimeout(timer);
      window.removeEventListener("resize", resized);
      document.body.style.background = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layer = "pointer-events-none fixed inset-0 h-dvh w-screen";
  const pill = "rounded-full bg-[#f4ede2]/70 px-3 py-1.5 backdrop-blur-sm hover:bg-ink/[0.07] hover:text-ink";
  return (
    <main className="fixed inset-0 overflow-hidden bg-[#f4ede2]">
      <canvas ref={base} className="fixed inset-0 block h-dvh w-screen" />
      <canvas ref={pencil} className={`${layer} mix-blend-multiply`} />
      <canvas ref={live} className={`${layer} mix-blend-multiply`} />
      <canvas ref={sig} className={layer} />
      {state.busy && (
        <div className="fixed inset-0 grid place-items-center px-6">
          <div className="max-w-[640px] text-center">
            <p className="font-serif text-[19px] italic text-faint">composing…</p>
            <p className="mt-3 text-balance font-serif text-[15px] italic leading-snug text-muted/70">“{PROMPT}”</p>
          </div>
        </div>
      )}
      <header className="fixed left-4 top-4 flex items-center gap-3 sm:left-6 sm:top-5">
        <span className="block w-[46px]">
          <Logo className="w-full" />
        </span>
        <span className="font-serif text-[16px] italic text-muted">lab</span>
      </header>
      <div className="fixed right-3 top-4 flex gap-1 text-[13px] text-muted sm:right-5 sm:top-5">
        {state.playing && !state.busy && (
          <button type="button" onClick={() => run.current && (run.current.fast = true)} className={pill}>
            fast-forward
          </button>
        )}
        <button type="button" disabled={state.busy} onClick={again} className={`${pill} disabled:opacity-40`}>
          generate again
        </button>
      </div>
      <div className="fixed bottom-3 left-4 sm:bottom-4 sm:left-6">
        <p className="text-[11px] tabular-nums text-faint" title={PROMPT}>{state.meta && `№ ${state.seed} · ${state.meta.palette} · ${state.meta.shot} · ${state.meta.lines.toLocaleString()} lines`}</p>
        {state.error && <p className="mt-1 text-[12px] text-red-700">{state.error}</p>}
      </div>
    </main>
  );
}
