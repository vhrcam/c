"use client";

import { useEffect, useRef, useState } from "react";

const MEMORY = { text: "me and her watching the sunset" };
const SEEDS = [11, 2024, 90210, 7, 314, 5150, 808, 4242, 1999];

export default function ArtLab() {
  const [thumbs, setThumbs] = useState({});
  const [open, setOpen] = useState(null);
  const stage = useRef(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      const { still } = await import("@/lib/art");
      for (const seed of SEEDS) {
        await new Promise((r) => setTimeout(r, 0));
        if (gone) return;
        const t = performance.now();
        const canvas = await still(MEMORY, seed);
        const { choice } = canvas.picture;
        const label = ["shot", "sun", "sky", "water", "land"].filter((k) => choice[k]).map((k) => `${k} ${choice[k].system}`).join(" · ");
        setThumbs((s) => ({ ...s, [seed]: { src: canvas.toDataURL("image/jpeg", 0.9), ms: Math.round(performance.now() - t), label } }));
      }
    })();
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (open == null) return;
    let stop;
    let gone = false;
    import("@/lib/art")
      .then(({ mount }) => mount(stage.current, MEMORY, open))
      .then((s) => (gone ? s() : (stop = s)));
    return () => {
      gone = true;
      stop?.();
    };
  }, [open]);

  return (
    <main className="min-h-dvh px-5 pb-20 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-fg/60">
        <h1 className="text-fg/90">c art lab</h1>
        <span className="text-fg/40">“{MEMORY.text}”</span>
      </header>
      <ul className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
        {SEEDS.map((seed) => {
          const t = thumbs[seed];
          return (
            <li key={seed}>
              <button type="button" onClick={() => setOpen(seed)} className="block w-full">
                <span className="grid aspect-[3/2] place-items-center overflow-hidden rounded-[3px] bg-fg/5 font-mono text-[11px] text-fg/30">{t ? <img src={t.src} alt="" className="size-full object-cover" /> : "drawing"}</span>
              </button>
              <span className="mt-1 block font-mono text-[11px] text-fg/35">
                seed {seed} {t && `· ${t.ms} ms · ${t.label}`}
              </span>
            </li>
          );
        })}
      </ul>
      {open != null && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-bg p-4" onClick={() => setOpen(null)}>
          <div ref={stage} className="relative aspect-[3/2] w-full max-w-[1500px]" />
        </div>
      )}
    </main>
  );
}
