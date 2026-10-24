"use client";

import { useEffect, useRef, useState } from "react";
import { LOGO_BOX, drawC } from "@/lib/paint/logo";
import { compose } from "@/lib/plot/compose";
import { plotter } from "@/lib/plot/plotter";
import Logo from "./Logo";

const PROMPT = "a man and a girl in an anime and exaggerated style, man with medium length messy blonde hair and a girl with long beautiful brown hair, close to each other seemingly about to kiss but holding one hand romantically, the girl is slightly shorter than him";
const SIZE = [1500, 1000];
const SIGN = { x: SIZE[0] - 56 - 66, y: SIZE[1] - 34, w: 60, dur: 1 };
const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export default function Lab() {
  const base = useRef(null);
  const live = useRef(null);
  const pencil = useRef(null);
  const sig = useRef(null);
  const run = useRef(null);
  const raf = useRef(0);
  const job = useRef(0);
  const [state, setState] = useState({ busy: true, playing: false, seed: 0, meta: null, error: "" });

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  const sign = (t, end, ink) => {
    const ctx = sig.current.getContext("2d");
    const k = dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sig.current.width, sig.current.height);
    const start = end + 0.2;
    if (t < start) return;
    const scale = (SIGN.w / LOGO_BOX.w) * k;
    ctx.translate(SIGN.x * k, SIGN.y * k);
    ctx.rotate(-0.03);
    ctx.scale(scale, scale);
    ctx.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    drawC(ctx, ease(Math.min(1, (t - start) / SIGN.dur)), { seed: 7, bristles: 16, rgb: ink, alpha: 0.92 });
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
      sign(t, p.end, p.ink);
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
      const picture = await compose(seed);
      if (id !== job.current) return;
      const k = dpr();
      for (const c of [base.current, live.current, pencil.current, sig.current]) {
        c.width = SIZE[0] * k;
        c.height = SIZE[1] * k;
      }
      const hex = picture.pal.ink.slice(1);
      const ink = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");
      run.current = { player: plotter(base.current, live.current, pencil.current, picture, { dpr: k }), end: picture.end, ink, fast: false };
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
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const width = "min(100%, calc((100dvh - 210px) * 1.5))";
  return (
    <main className="min-h-dvh px-4 pb-16 pt-5 sm:px-7">
      <header className="mx-auto flex max-w-[1180px] items-center gap-3">
        <span className="block w-[58px]">
          <Logo className="w-full" />
        </span>
        <span className="font-serif text-[17px] italic text-muted">lab</span>
      </header>
      <div className="relative mx-auto mt-5" style={{ width }}>
        <canvas ref={base} className="block w-full rounded-[4px] bg-[#f4ede2] shadow-[0_2px_18px_rgba(26,25,22,0.12)]" style={{ aspectRatio: "3 / 2" }} />
        <canvas ref={pencil} className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply" />
        <canvas ref={live} className="pointer-events-none absolute inset-0 h-full w-full mix-blend-multiply" />
        <canvas ref={sig} className="pointer-events-none absolute inset-0 h-full w-full" />
        {state.busy && <p className="absolute inset-0 grid place-items-center font-serif text-[19px] italic text-faint">composing…</p>}
      </div>
      <div className="mx-auto mt-3 flex items-center justify-between gap-3" style={{ width }}>
        <p className="text-[12px] tabular-nums text-faint">{state.meta && `№ ${state.seed} · ${state.meta.palette} · ${state.meta.shot} · ${state.meta.lines.toLocaleString()} lines`}</p>
        <div className="flex gap-1 text-[13px] text-muted">
          {state.playing && !state.busy && (
            <button type="button" onClick={() => run.current && (run.current.fast = true)} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
              fast-forward
            </button>
          )}
          <button type="button" disabled={state.busy} onClick={again} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink disabled:opacity-40">
            generate again
          </button>
        </div>
      </div>
      <p className="mx-auto mt-5 max-w-[760px] text-balance text-center font-serif text-[18px] italic leading-snug text-muted">“{PROMPT}”</p>
      {state.error && <p className="mt-2 text-center text-[12px] text-red-700">{state.error}</p>}
    </main>
  );
}
