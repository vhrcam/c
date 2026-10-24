"use client";

import { useEffect, useRef, useState } from "react";
import { flowArt } from "@/lib/lab/flow";
import { prepare } from "@/lib/lab/render";
import { SKY_GLSL } from "@/lib/lab/sky";
import { LOGO_BOX, drawC } from "@/lib/paint/logo";
import Logo from "./Logo";

const PROMPT = "a man and a girl in an anime and exaggerated style, man with medium length messy blonde hair and a girl with long beautiful brown hair, close to each other seemingly about to kiss but holding one hand romantically, the girl is slightly shorter than him";
const SIZE = [1500, 1000];
const PAPER = "#f2ebde";
const FRAME = { scale: 0.92, x: 60, y: 28 };
const SIGN = { x: SIZE[0] - FRAME.x - 78, y: SIZE[1] - 50, w: 76, dur: 1 };
const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export default function Lab() {
  const view = useRef(null);
  const overlay = useRef(null);
  const art = useRef(null);
  const drawn = useRef(null);
  const raf = useRef(0);
  const [status, setStatus] = useState({ ready: false, progress: 0, playing: false, note: "" });

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  const clear = () => {
    const ctx = view.current.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, view.current.width, view.current.height);
    drawn.current = new Int32Array(art.current.lines.length);
  };

  const paint = (t) => {
    const ctx = view.current.getContext("2d");
    const k = dpr();
    ctx.setTransform(k * FRAME.scale, 0, 0, k * FRAME.scale, k * FRAME.x, k * FRAME.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { lines } = art.current;
    const done = drawn.current;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.start >= t) break;
      const count = line.pts.length / 2;
      if (done[i] >= count) continue;
      const upto = Math.min(count, Math.floor(((t - line.start) / line.dur) * count) + 1);
      if (upto <= done[i] || upto < 2) continue;
      const from = Math.max(0, done[i] - 1);
      ctx.beginPath();
      ctx.moveTo(line.pts[from * 2], line.pts[from * 2 + 1]);
      for (let j = from + 1; j < upto; j++) ctx.lineTo(line.pts[j * 2], line.pts[j * 2 + 1]);
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      ctx.stroke();
      done[i] = upto;
    }
  };

  const sign = (t) => {
    const ctx = overlay.current.getContext("2d");
    const k = dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.current.width, overlay.current.height);
    const start = art.current.end + 0.4;
    if (t < start) return;
    const scale = (SIGN.w / LOGO_BOX.w) * k;
    ctx.translate(SIGN.x * k, SIGN.y * k);
    ctx.rotate(-0.03);
    ctx.scale(scale, scale);
    ctx.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    drawC(ctx, ease(Math.min(1, (t - start) / SIGN.dur)), { seed: 7, bristles: 16, rgb: "26,25,22", alpha: 0.92 });
  };

  const play = (from = 0) => {
    if (!art.current) return;
    cancelAnimationFrame(raf.current);
    clear();
    const end = art.current.end + 0.4 + SIGN.dur;
    const start = performance.now() - from * 1000;
    setStatus((s) => ({ ...s, playing: true }));
    const tick = (now) => {
      const t = Math.min(end, (now - start) / 1000);
      paint(t);
      sign(t);
      if (t < end) raf.current = requestAnimationFrame(tick);
      else setStatus((s) => ({ ...s, playing: false }));
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    let cancelled = false;
    const k = dpr();
    for (const c of [view.current, overlay.current]) {
      c.width = SIZE[0] * k;
      c.height = SIZE[1] * k;
    }
    const ctx = view.current.getContext("2d");
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, view.current.width, view.current.height);
    const gl = document.createElement("canvas");
    prepare(gl, { width: SIZE[0], height: SIZE[1], ss: 1.5, sky: SKY_GLSL, reference: true, onProgress: (progress) => !cancelled && setStatus((s) => ({ ...s, progress })) })
      .then((ref) => {
        if (cancelled) return;
        const t0 = performance.now();
        art.current = flowArt(ref.analyze(SIZE[0] / 2, SIZE[1] / 2), { width: SIZE[0], height: SIZE[1], seed: 7 });
        setStatus((s) => ({ ...s, ready: true, note: `${art.current.lines.length.toLocaleString()} lines · scene ${(ref.renderMs / 1000).toFixed(1)}s · lines ${Math.round(performance.now() - t0)}ms` }));
        play();
      })
      .catch((e) => !cancelled && setStatus((s) => ({ ...s, note: e.message })));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-dvh px-4 pb-16 pt-5 sm:px-7">
      <header className="mx-auto flex max-w-[1180px] items-center gap-3">
        <span className="block w-[58px]">
          <Logo className="w-full" />
        </span>
        <span className="font-serif text-[17px] italic text-muted">lab</span>
      </header>
      <div className="relative mx-auto mt-5" style={{ width: "min(100%, calc((100dvh - 210px) * 1.5))" }}>
        <canvas ref={view} className="block w-full rounded-[4px] shadow-[0_2px_18px_rgba(26,25,22,0.12)]" style={{ aspectRatio: "3 / 2" }} />
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
        {!status.ready && !status.note && <p className="absolute inset-0 grid place-items-center font-serif text-[19px] italic text-faint">setting up the scene… {Math.round(status.progress * 100)}%</p>}
      </div>
      <div className="mx-auto mt-3 flex justify-end" style={{ width: "min(100%, calc((100dvh - 210px) * 1.5))" }}>
        {status.ready && (
          <div className="flex gap-1 text-[13px] text-muted">
            <button type="button" onClick={() => play(0)} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
              draw again
            </button>
            {status.playing && (
              <button type="button" onClick={() => play(art.current.end + 0.4)} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
                skip
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mx-auto mt-5 max-w-[760px] text-balance text-center font-serif text-[18px] italic leading-snug text-muted">“{PROMPT}”</p>
      {status.note && <p className="mt-2 text-center text-[12px] text-faint">{status.note}</p>}
    </main>
  );
}
