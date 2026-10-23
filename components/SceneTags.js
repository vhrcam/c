"use client";

import { useEffect, useRef, useState } from "react";
import { sceneTags, swapOptions } from "@/lib/scene";

export default function SceneTags({ scene, onSwap }) {
  const [open, setOpen] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!box.current?.contains(e.target)) setOpen(null);
    };
    const esc = (e) => {
      if (e.key === "Escape") setOpen(null);
    };
    addEventListener("pointerdown", close);
    addEventListener("keydown", esc);
    return () => {
      removeEventListener("pointerdown", close);
      removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={box} className="mt-3 flex flex-wrap justify-center gap-1.5">
      {sceneTags(scene).map((tag, i) => {
        const key = `${tag.group}-${tag.value}-${tag.label}`;
        const active = open === key;
        return (
          <span key={key} className="tag-in relative" style={{ animationDelay: `${i * 110}ms` }}>
            <button
              type="button"
              disabled={!onSwap}
              aria-expanded={active}
              onClick={() => setOpen(active ? null : key)}
              className={`rounded-full border px-3 py-[5px] text-[13px] transition-colors ${active ? "border-ink bg-ink text-paper" : "border-line text-muted enabled:hover:border-ink/40 enabled:hover:text-ink"}`}
            >
              {tag.label}
            </button>
            {active && (
              <div role="dialog" aria-label={`Change ${tag.label}`} className="absolute left-1/2 top-full z-30 mt-2 w-max max-w-[min(320px,90vw)] -translate-x-1/2 rounded-2xl bg-paper p-1.5 shadow-[0_12px_32px_rgba(26,25,22,0.18)] ring-1 ring-line">
                <div className="flex flex-wrap justify-center gap-0.5">
                  {swapOptions(tag, scene).map((o) => (
                    <button
                      key={`${o.value}-${o.label}`}
                      type="button"
                      onClick={() => {
                        setOpen(null);
                        onSwap(tag, o.value);
                      }}
                      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] transition-colors hover:bg-ink/[0.06] hover:text-ink ${o.value === tag.value ? "text-ink" : "text-muted"}`}
                    >
                      {o.swatch && <span className="size-3 rounded-full ring-1 ring-ink/15" style={{ background: o.swatch }} />}
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </span>
        );
      })}
    </div>
  );
}
