"use client";

import { useEffect, useState } from "react";

const MEMORY = { text: "me and her watching the sunset" };
const ROWS = ["expressive", "geometric", "organic", "lines"];
const SEEDS = [11, 2024, 7];

async function render(row, seed, scale) {
  if (row === "lines") {
    const { still } = await import("@/lib/art");
    const c = await still(MEMORY, seed, scale);
    return { src: c.toDataURL("image/jpeg", 0.9), meta: c.picture.choice.shot.system };
  }
  const { paint } = await import("@/lib/art/directions");
  const c = await paint(row, seed, scale);
  return { src: c.toDataURL("image/jpeg", 0.9), meta: c.meta.shot };
}

export default function ArtLab() {
  const [thumbs, setThumbs] = useState({});
  const [open, setOpen] = useState(null);
  const [big, setBig] = useState(null);

  useEffect(() => {
    let gone = false;
    (async () => {
      for (const row of ROWS)
        for (const seed of SEEDS) {
          await new Promise((r) => setTimeout(r, 0));
          if (gone) return;
          const t = performance.now();
          const out = await render(row, seed, 0.5);
          setThumbs((s) => ({ ...s, [`${row}-${seed}`]: { ...out, ms: Math.round(performance.now() - t) } }));
        }
    })();
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let gone = false;
    render(open.row, open.seed, 1).then((out) => !gone && setBig(out.src));
    return () => {
      gone = true;
      setBig(null);
    };
  }, [open]);

  return (
    <main className="min-h-dvh px-5 pb-20 pt-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[12px] text-fg/60">
        <h1 className="text-fg/90">c art lab</h1>
        <span className="text-fg/40">“{MEMORY.text}”</span>
      </header>
      {ROWS.map((row) => (
        <section key={row} className="mt-7">
          <h2 className="font-mono text-[11px] text-fg/40">{row}</h2>
          <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SEEDS.map((seed) => {
              const t = thumbs[`${row}-${seed}`];
              return (
                <li key={seed}>
                  <button type="button" onClick={() => setOpen({ row, seed })} className="block w-full">
                    <span className="grid aspect-[3/2] place-items-center overflow-hidden rounded-[3px] bg-fg/5 font-mono text-[11px] text-fg/30">{t ? <img src={t.src} alt="" className="size-full object-cover" /> : "painting"}</span>
                  </button>
                  <span className="mt-1 block font-mono text-[11px] text-fg/35">
                    seed {seed} {t && `· ${t.meta} · ${t.ms} ms`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {open && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-40 grid place-items-center bg-bg p-4" onClick={() => setOpen(null)}>
          {big ? <img src={big} alt="" className="max-h-full max-w-full" /> : <span className="font-mono text-[12px] text-fg/40">painting</span>}
        </div>
      )}
    </main>
  );
}
