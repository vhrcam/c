"use client";

import { useEffect, useRef, useState } from "react";
import { scene } from "@/lib/lab/flow";
import { particles } from "@/lib/lab/particles";
import { prepare } from "@/lib/lab/render";
import { SKY_GLSL } from "@/lib/lab/sky";
import { LOGO_BOX, drawC } from "@/lib/paint/logo";
import Logo from "./Logo";

const PROMPT = "a man and a girl in an anime and exaggerated style, man with medium length messy blonde hair and a girl with long beautiful brown hair, close to each other seemingly about to kiss but holding one hand romantically, the girl is slightly shorter than him";
const SIZE = [1500, 1000];
const SIGN = { x: SIZE[0] - 60 - 78, y: SIZE[1] - 50, w: 76, dur: 1 };
const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export default function Lab() {
  const view = useRef(null);
  const overlay = useRef(null);
  const sim = useRef(null);
  const raf = useRef(0);
  const [status, setStatus] = useState({ ready: false, progress: 0, playing: false, note: "" });

  const dpr = () => Math.min(2, window.devicePixelRatio || 1);

  const sign = (t) => {
    const ctx = overlay.current.getContext("2d");
    const k = dpr();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.current.width, overlay.current.height);
    const start = sim.current.end + 0.2;
    if (t < start) return;
    const scale = (SIGN.w / LOGO_BOX.w) * k;
    ctx.translate(SIGN.x * k, SIGN.y * k);
    ctx.rotate(-0.03);
    ctx.scale(scale, scale);
    ctx.translate(-LOGO_BOX.x, -LOGO_BOX.y);
    drawC(ctx, ease(Math.min(1, (t - start) / SIGN.dur)), { seed: 7, bristles: 16, rgb: "26,25,22", alpha: 0.92 });
  };

  const play = (fast = false) => {
    const s = sim.current;
    if (!s) return;
    cancelAnimationFrame(raf.current);
    s.reset();
    const end = s.end + 0.2 + SIGN.dur;
    let t = 0;
    let last = performance.now();
    setStatus((st) => ({ ...st, playing: true }));
    const tick = (now) => {
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;
      const steps = fast ? 24 : 1;
      for (let i = 0; i < steps && t < s.end; i++) {
        t += fast ? 1 / 60 : dt;
        s.step(t, fast ? 1 / 60 : dt);
      }
      if (t >= s.end) t += dt;
      s.draw(t);
      sign(t);
      if (t < end) raf.current = requestAnimationFrame(tick);
      else setStatus((st) => ({ ...st, playing: false }));
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
    const gl = document.createElement("canvas");
    prepare(gl, { width: SIZE[0], height: SIZE[1], ss: 1.5, sky: SKY_GLSL, reference: true, onProgress: (progress) => !cancelled && setStatus((s) => ({ ...s, progress })) })
      .then((ref) => {
        if (cancelled) return;
        const sc = scene(ref.analyze(SIZE[0] / 2, SIZE[1] / 2), 7);
        sim.current = particles(view.current, sc, { count: 384 });
        setStatus((s) => ({ ...s, ready: true, note: `147,456 particles · scene ready in ${(ref.renderMs / 1000).toFixed(1)}s` }));
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
        <canvas ref={view} className="block w-full rounded-[4px] bg-[#f2ebde] shadow-[0_2px_18px_rgba(26,25,22,0.12)]" style={{ aspectRatio: "3 / 2" }} />
        <canvas ref={overlay} className="pointer-events-none absolute inset-0 h-full w-full" />
        {!status.ready && !status.note && <p className="absolute inset-0 grid place-items-center font-serif text-[19px] italic text-faint">setting up the scene… {Math.round(status.progress * 100)}%</p>}
      </div>
      <div className="mx-auto mt-3 flex justify-end" style={{ width: "min(100%, calc((100dvh - 210px) * 1.5))" }}>
        {status.ready && (
          <div className="flex gap-1 text-[13px] text-muted">
            <button type="button" onClick={() => play()} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
              generate again
            </button>
            {status.playing && (
              <button type="button" onClick={() => play(true)} className="rounded-full px-3 py-1.5 hover:bg-ink/[0.07] hover:text-ink">
                fast-forward
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
