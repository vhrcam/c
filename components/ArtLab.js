"use client";

import { useEffect, useRef, useState } from "react";

const MEMORY = "watching the sunset with her from the end of the pier last summer";
const PIECES = ["flow", "growth", "hybrid"];
const SEEDS = [11, 2024, 90210];

export default function ArtLab() {
  const [thumbs, setThumbs] = useState({});
  const [palette, setPalette] = useState("editorial");
  const [open, setOpen] = useState(null);
  const stage = useRef(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      const { still } = await import("@/lib/art");
      for (const piece of PIECES)
        for (const seed of SEEDS) {
          await new Promise((r) => setTimeout(r, 0));
          if (gone) return;
          const t = performance.now();
          const src = still({ piece, palette }, seed).toDataURL("image/jpeg", 0.9);
          setThumbs((s) => ({ ...s, [`${piece}-${seed}`]: { src, ms: Math.round(performance.now() - t) } }));
        }
    })();
    return () => {
      gone = true;
    };
  }, [palette]);

  useEffect(() => {
    if (!open) return;
    let stop;
    import("@/lib/art").then(({ mount }) => (stop = mount(stage.current, { piece: open.piece, palette }, open.seed)));
    return () => stop?.();
  }, [open, palette]);

  return (
    <main className="min-h-dvh px-5 pb-20 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-fg/60">
        <h1 className="text-fg/90">c art lab</h1>
        <span className="text-fg/40">“{MEMORY}”</span>
        {["editorial", "ember", "riso", "dusk", "night"].map((p) => (
          <button key={p} type="button" onClick={() => setPalette(p)} className={p === palette ? "text-fg" : "hover:text-fg"}>
            {p}
          </button>
        ))}
      </header>
      {PIECES.map((piece) => (
        <section key={piece} className="mt-8">
          <h2 className="font-mono text-[11px] text-fg/40">{piece}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SEEDS.map((seed) => {
              const t = thumbs[`${piece}-${seed}`];
              return (
                <li key={seed}>
                  <button type="button" onClick={() => setOpen({ piece, seed })} className="block w-full">
                    <span className="grid aspect-[3/2] place-items-center overflow-hidden rounded-[3px] bg-fg/5 font-mono text-[11px] text-fg/30">{t ? <img src={t.src} alt="" className="size-full object-cover" /> : "drawing"}</span>
                  </button>
                  <span className="mt-1 block font-mono text-[11px] text-fg/35">
                    seed {seed} {t && `· ${t.ms} ms`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-bg p-4" onClick={() => setOpen(null)}>
          <div ref={stage} className="relative aspect-[3/2] w-full max-w-[1500px]" />
        </div>
      )}
    </main>
  );
}
