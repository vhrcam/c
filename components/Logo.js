"use client";

import { useEffect, useRef } from "react";
import { LOGO_BOX, drawC } from "@/lib/paint/logo";

const ease = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export default function Logo({ draw = false, delay = 0, duration = 1800, className = "" }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    let progress = draw ? 0 : 1;
    let frame;
    let start;

    const paint = () => {
      const scale = canvas.width / LOGO_BOX.w;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -LOGO_BOX.x * scale, -LOGO_BOX.y * scale);
      drawC(ctx, progress);
    };
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(((canvas.clientWidth * LOGO_BOX.h) / LOGO_BOX.w) * dpr);
      paint();
    };
    const tick = (now) => {
      start ??= now;
      const t = Math.min(1, Math.max(0, (now - start - delay) / duration));
      progress = ease(t);
      paint();
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    fit();
    if (draw) frame = requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [draw, delay, duration]);

  return <canvas ref={ref} role="img" aria-label="c" className={className} style={{ aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}` }} />;
}
