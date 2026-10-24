"use client";

import { useEffect, useRef, useState } from "react";
import { STAGES, prepare } from "@/lib/lab/render";
import { SKY_GLSL } from "@/lib/lab/sky";
import { LOGO_BOX, drawC } from "@/lib/paint/logo";
import Logo from "./Logo";

const PROMPT = "a man and a girl in an anime and exaggerated style, man with medium length messy blonde hair and a girl with long beautiful brown hair, close to each other seemingly about to kiss but holding one hand romantically, the girl is slightly shorter than him";
const SIZE = [1500, 1000];
const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export default function Lab() {
  const canvas = useRef(null);
  const overlay = useRef(null);
  const player = useRef(null);
  const raf = useRef(0);
  const [status, setStatus] = useState({ ready: false, progress: 0, playing: false, note: "" });

  const ink = useRef("26,25,22");
  const sign = (t) => {
    const ctx = overlay.current.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, SIZE[0], SIZE[1]);
    const [s0, s1] = STAGES.sign;
    if (t < s0) return;
    const scale = 112 / LOGO_BOX.w;
    ctx.translate(SIZE[0] - 196, SIZE[1] - 136);
    ctx.rotate(-0.04);
    ctx.scale(scale, scale);
    ctx.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    drawC(ctx, ease(Math.min(1, (t - s0) / (s1 - s0))), { seed: 7, bristles: 16, rgb: ink.current, alpha: 0.92 });
  };

  const play = (from = 0) => {
    const p = player.current;
    if (!p) return;
    cancelAnimationFrame(raf.current);
    const start = performance.now() - from * 1000;
    setStatus((s) => ({ ...s, playing: true }));
    const tick = (now) => {
      const t = Math.min(p.end, (now - start) / 1000);
      p.draw(t);
      sign(t);
      if (t < p.end) raf.current = requestAnimationFrame(tick);
      else setStatus((s) => ({ ...s, playing: false }));
    };
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    let cancelled = false;
    overlay.current.width = SIZE[0];
    overlay.current.height = SIZE[1];
    prepare(canvas.current, { width: SIZE[0], height: SIZE[1], ss: 2, sky: SKY_GLSL, onProgress: (progress) => !cancelled && setStatus((s) => ({ ...s, progress })) })
      .then((p) => {
        if (cancelled) return;
        player.current = p;
        ink.current = p.light(SIZE[0] - 196, SIZE[1] - 136, 112, 70) > 0.45 ? "26,25,22" : "243,238,228";
        setStatus((s) => ({ ...s, ready: true, note: `rendered in ${(p.renderMs / 1000).toFixed(1)}s` }));
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
        <canvas ref={canvas} className="block w-full rounded-[6px] bg-paper-deep" style={{ aspectRatio: "3 / 2" }} />
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
        {!status.ready && !status.note && <p className="absolute inset-0 grid place-items-center font-serif text-[19px] italic text-faint">getting the scene ready… {Math.round(status.progress * 100)}%</p>}
      </div>
      <div className="mx-auto mt-3 flex justify-end" style={{ width: "min(100%, calc((100dvh - 210px) * 1.5))" }}>
        {status.ready && (
          <div className="flex gap-1 text-[13px] text-muted">
            <button type="button" onClick={() => play(0)} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
              paint again
            </button>
            {status.playing && (
              <button type="button" onClick={() => play(STAGES.sign[0] - 0.3)} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
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
