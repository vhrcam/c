"use client";

import { useEffect } from "react";

const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

export default function Gallery({ open, items, onClose, onOpen, onRemove }) {
  useEffect(() => {
    if (!open) return;
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-ink/20 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <aside
        role="dialog"
        aria-label="Your gallery"
        className={`absolute inset-y-0 right-0 flex w-[380px] max-w-[92vw] flex-col bg-paper transition-[translate,box-shadow] duration-500 ease-[cubic-bezier(.2,.75,.15,1)] ${open ? "translate-x-0 shadow-[-12px_0_40px_rgba(26,25,22,0.18)]" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="font-serif text-[26px] italic">your gallery</h2>
          <button type="button" onClick={onClose} aria-label="Close the gallery" className="grid size-8 place-items-center rounded-full text-muted hover:bg-ink/[0.06] hover:text-ink">
            <svg width="14" height="14" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>
        {items.length ? (
          <div className="grid flex-1 grid-cols-2 content-start gap-x-3 gap-y-5 overflow-y-auto px-5 pb-8">
            {items.map((item) => (
              <div key={item.id} className="group relative">
                <button type="button" onClick={() => onOpen(item.scene)} className="block w-full text-left">
                  <span className="block overflow-hidden rounded-md bg-cover bg-center ring-1 ring-line transition group-hover:ring-ink/40" style={{ aspectRatio: "3 / 2", backgroundImage: `url(${item.image})` }} />
                  <span className="mt-1.5 line-clamp-2 block font-serif text-[15px] italic leading-snug text-ink">{item.scene.caption}</span>
                  <span className="block text-[11px] text-faint">{day.format(item.at)}</span>
                </button>
                <button type="button" onClick={() => onRemove(item.id)} aria-label="Delete this painting" className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-paper/90 text-muted opacity-0 transition hover:text-ink group-hover:opacity-100">
                  <svg width="10" height="10" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 pt-6 font-serif text-[18px] italic leading-snug text-muted">Paintings you save show up here. They stay in this browser, no account needed.</p>
        )}
      </aside>
    </div>
  );
}
