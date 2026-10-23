"use client";

import { useState } from "react";

export default function Refine({ busy, onSubmit }) {
  const [text, setText] = useState("");
  const submit = () => {
    if (!text.trim() || busy) return;
    onSubmit(text.trim());
    setText("");
  };
  return (
    <form
      className="rise mx-auto mt-10 w-full max-w-[560px]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-3">
        <input
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          aria-label="Change anything in the painting"
          placeholder={busy ? "changing it…" : "change anything… “make the sky pinker”"}
          className="w-full bg-transparent pb-2 font-serif text-[19px] outline-none placeholder:italic placeholder:text-faint disabled:opacity-60 sm:text-[21px]"
        />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Change it" className="mb-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink disabled:opacity-30">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </div>
      <div className={`h-px bg-ink/40 ${busy ? "animate-pulse" : ""}`} />
    </form>
  );
}
