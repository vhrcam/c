"use client";

import { useEffect, useRef, useState } from "react";

export default function Describe({ visible, onPaint }) {
  const [text, setText] = useState("");
  const input = useRef(null);
  const ready = text.trim().length > 0;

  useEffect(() => {
    if (visible && matchMedia("(pointer: fine)").matches) input.current?.focus({ preventScroll: true });
  }, [visible]);

  const grow = (el) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const submit = () => {
    if (ready) onPaint?.({ text: text.trim() });
  };

  return (
    <section className="mt-14 sm:mt-16">
      <textarea
        ref={input}
        rows={1}
        value={text}
        aria-label="Describe your moment"
        placeholder="describe a moment you wish you had a picture of"
        onChange={(e) => {
          setText(e.target.value);
          grow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className={`block w-full resize-none bg-transparent pb-2 font-serif text-[22px] leading-snug outline-none placeholder:italic placeholder:text-faint sm:text-[25px] transition-opacity duration-700 delay-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`h-px origin-left bg-ink/55 transition-transform duration-[850ms] ease-[cubic-bezier(.65,0,.25,1)] ${visible ? "scale-x-100" : "scale-x-0"}`} />
      <div className="mt-2 flex h-8 justify-end">
        <button
          type="button"
          onClick={submit}
          className={`flex items-center gap-1.5 rounded-full px-3 text-sm text-muted transition hover:text-ink ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          paint
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 3v5.5a2 2 0 0 1-2 2H3" />
            <path d="M6 7.5 3 10.5l3 3" />
          </svg>
        </button>
      </div>
    </section>
  );
}
