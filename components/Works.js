"use client";

import { useEffect, useEffectEvent, useRef } from "react";

const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export default function Works({ open, items, onClose, onOpen, onRemove }) {
  const close = useRef(null);
  const esc = useEffectEvent((e) => {
    if (e.key === "Escape") onClose();
  });

  useEffect(() => {
    if (!open) return;
    close.current?.focus({ preventScroll: true });
    const onKey = (e) => esc(e);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gallery"
      inert={!open}
      className={`fixed inset-0 z-40 overflow-y-auto bg-bg transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <header className="sticky top-0 z-10 flex items-center justify-between bg-bg/85 px-5 pb-4 pt-[max(env(safe-area-inset-top),18px)] backdrop-blur sm:px-8 sm:pt-6">
        <h2 className="font-mono text-[12px] text-fg/70">
          gallery <span className="text-fg/30">{items.length}</span>
        </h2>
        <button ref={close} type="button" onClick={onClose} className="font-mono text-[12px] text-fg/50 transition-colors hover:text-fg">
          close
        </button>
      </header>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-7 px-5 pb-16 pt-2 sm:grid-cols-3 sm:gap-x-5 sm:px-8 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="group relative">
              <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
                <span className="block aspect-[4/3] overflow-hidden rounded-[3px] bg-fg/5 ring-1 ring-fg/10 transition group-hover:ring-fg/30">
                  <span role="img" aria-label={item.plan.title} className="block size-full bg-cover bg-center transition duration-500 group-hover:scale-[1.02]" style={{ backgroundImage: `url(${item.image})` }} />
                </span>
                <span className="mt-2.5 block truncate text-[14px] text-fg/85">{item.plan.title}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-fg/35">
                  {item.plan.mode} · {day.format(item.at)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Delete ${item.plan.title}`}
                className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-bg/70 text-fg/70 opacity-0 backdrop-blur transition hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="max-w-[420px] px-5 pt-4 font-mono text-[12px] leading-relaxed text-fg/45 sm:px-8">Works you save show up here. They stay in this browser, no account needed.</p>
      )}
    </div>
  );
}
