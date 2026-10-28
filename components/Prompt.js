"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Mark from "./Mark";

const HINTS = [
  "describe anything",
  "a lighthouse in a storm, seen from the top",
  "a red vintage car on a coastal road",
  "a cabin in the mountains at dawn",
  "a steam train crossing a stone bridge in the fog",
  "a skyscraper at night in the rain",
  "a sailboat off a rocky coast at sunset",
  "an old windmill in a wheat field",
];

export const MODES = ["3d"];

const grow = (el) => {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
};

export default function Prompt({ intro, draft, works, onWorks, onGenerate, onWarm }) {
  const [text, setText] = useState(draft);
  const [mode, setMode] = useState("3d");
  const [hint, setHint] = useState(HINTS[0]);
  const input = useRef(null);
  const filled = useRef(Boolean(draft));
  const ready = text.trim().length > 0;

  useLayoutEffect(() => grow(input.current), []);

  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem("c.mode");
    } catch {}
    const timer = setTimeout(() => MODES.includes(saved) && setMode(saved));
    const focus = matchMedia("(pointer: fine)").matches && setTimeout(() => input.current?.focus({ preventScroll: true }), intro ? 1250 : 0);
    return () => {
      clearTimeout(timer);
      clearTimeout(focus);
    };
  }, [intro]);

  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let n = HINTS[0].length;
    let adding = false;
    let timer;
    const tick = () => {
      if (filled.current) return (timer = setTimeout(tick, 600));
      n += adding ? 1 : -1;
      setHint(HINTS[i].slice(0, n));
      if (adding && n < HINTS[i].length) return (timer = setTimeout(tick, 32 + Math.random() * 48));
      if (adding) {
        adding = false;
        return (timer = setTimeout(tick, i ? 2600 : 4200));
      }
      if (n > 0) return (timer = setTimeout(tick, 14));
      i = (i + 1) % HINTS.length;
      adding = true;
      timer = setTimeout(tick, 420);
    };
    timer = setTimeout(tick, intro ? 5200 : 4200);
    return () => clearTimeout(timer);
  }, [intro]);

  const submit = () => {
    if (!ready) return input.current?.focus();
    try {
      localStorage.setItem("c.mode", mode);
    } catch {}
    onGenerate({ text: text.trim(), mode });
  };

  const enter = intro ? "rise [animation-delay:1100ms]" : "";
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 pb-[14vh] pt-24">
      {works > 0 && (
        <button type="button" onClick={onWorks} className={`absolute right-5 top-[max(env(safe-area-inset-top),18px)] font-mono text-[12px] text-fg/45 transition-colors hover:text-fg sm:right-7 sm:top-6 ${enter}`}>
          gallery <span className="text-fg/25">{works}</span>
        </button>
      )}
      <span className="block w-[76px] sm:w-[96px]" style={{ viewTransitionName: "mark" }}>
        <Mark intro={intro} cursorName="cursor" />
      </span>
      <div className={`mt-14 w-full max-w-[600px] sm:mt-16 ${enter}`}>
        <div className="relative" style={{ viewTransitionName: "prompt" }}>
          <textarea
            ref={input}
            rows={1}
            value={text}
            maxLength={600}
            spellCheck={false}
            aria-label="Describe anything"
            onFocus={onWarm}
            onChange={(e) => {
              setText(e.target.value);
              filled.current = Boolean(e.target.value);
              grow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            className="block w-full resize-none bg-transparent pb-3 text-[20px] font-light leading-snug text-fg caret-fg outline-none sm:text-[24px]"
          />
          {!text && (
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 truncate text-[20px] font-light leading-snug text-fg/30 sm:text-[24px]">
              {hint}
            </span>
          )}
        </div>
        <div className="h-px bg-fg/15" />
        <div className="mt-4 flex items-center justify-end">
          {MODES.length > 1 && (
            <div role="radiogroup" aria-label="Mode" className="mr-auto flex rounded-full border border-fg/12 p-[3px] font-mono text-[11px]">
              {MODES.map((m) => (
                <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3 py-1 transition-colors ${mode === m ? "bg-fg text-bg" : "text-fg/45 hover:text-fg"}`}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={submit} aria-disabled={!ready} className={`flex items-center gap-2 font-mono text-[12px] transition-colors ${ready ? "text-fg" : "text-fg/25"}`}>
            generate <span className="text-fg/40">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}
