"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LABELS, PLACES, STYLES, TIMES, applySwap, newSeed, normalize } from "@/lib/scene";
import { list, remove, save } from "@/lib/gallery";
import { decode, encode } from "@/lib/share";
import { download, thumb } from "@/lib/thumbs";
import { caption, edit, read } from "@/lib/words";
import Actions from "./Actions";
import Describe from "./Describe";
import Gallery from "./Gallery";
import Logo from "./Logo";
import Painting from "./Painting";
import Pill from "./Pill";
import Refine from "./Refine";
import SceneTags from "./SceneTags";
import Strip from "./Strip";
import Toast from "./Toast";

const STEPS = [
  [1900, 2],
  [3000, 3],
  [3550, 4],
];

async function ask(body) {
  const res = await fetch("/api/scene", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(16000) });
  if (!res.ok) throw new Error(`Scene request failed: ${res.status}`);
  return res.json();
}

function morph(update) {
  if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return update();
  document.startViewTransition(() => flushSync(update));
}

export default function Studio() {
  const [step, setStep] = useState(1);
  const [skipped, setSkipped] = useState(false);
  const [lift, setLift] = useState(0);
  const [view, setView] = useState("home");
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("idle");
  const [draft, setDraft] = useState(null);
  const [question, setQuestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [versions, setVersions] = useState([]);
  const [previews, setPreviews] = useState({ key: "", images: {} });
  const [shelf, setShelf] = useState({ open: false, items: [] });
  const hero = useRef(null);
  const canvas = useRef(null);
  const ticket = useRef(0);
  const toastTimer = useRef(0);
  const previewKey = useRef("");
  const shared = useRef(null);
  const scene = job?.scene || draft;

  const start = (next, how = "play") => {
    setQuestion(null);
    setDraft(next);
    setStatus("painting");
    setJob({ scene: next, how });
  };

  const showShared = useEffectEvent(() => {
    const next = shared.current;
    if (!next) return;
    shared.current = null;
    setSkipped(true);
    morph(() => {
      setView("studio");
      start(next);
    });
  });

  useEffect(() => {
    const quick = matchMedia("(prefers-reduced-motion: reduce)").matches;
    shared.current = location.hash.startsWith("#p=") ? decode(location.hash.slice(3)) : null;
    const frame = requestAnimationFrame(() => {
      const box = hero.current.getBoundingClientRect();
      setLift(innerHeight / 2 - (box.top + box.height / 2));
      if (quick) {
        setSkipped(true);
        setStep(4);
      }
    });
    const timers = quick ? [] : STEPS.map(([ms, s]) => setTimeout(() => setStep(s), ms));
    if (shared.current) timers.push(setTimeout(showShared, quick ? 0 : 2900));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (status !== "done" || !job) return;
    const base = job.scene;
    const key = JSON.stringify({ ...base, style: "" });
    if (previewKey.current === key) return;
    previewKey.current = key;
    const images = {};
    let i = 0;
    let timer;
    const next = () => {
      const style = STYLES[i++];
      if (!style) return;
      images[style] = thumb({ ...base, style }, 240);
      setPreviews({ key, images: { ...images } });
      timer = setTimeout(next, 120);
    };
    timer = setTimeout(next, 1300);
    return () => {
      clearTimeout(timer);
      if (i <= STYLES.length) previewKey.current = "";
    };
  }, [status, job]);

  useEffect(() => {
    if (step >= 4) return;
    const skip = () => {
      setSkipped(true);
      setStep(4);
      showShared();
    };
    addEventListener("pointerdown", skip);
    addEventListener("keydown", skip);
    return () => {
      removeEventListener("pointerdown", skip);
      removeEventListener("keydown", skip);
    };
  }, [step]);

  const finish = (done) => {
    setStatus("done");
    const key = JSON.stringify(done);
    if (versions.some((v) => v.key === key)) return;
    setTimeout(() => {
      const image = thumb(done, 260);
      setVersions((list) => (list.some((v) => v.key === key) ? list : [...list, { key, scene: done, image }]));
    }, 900);
  };

  const share = async () => {
    const url = `${location.origin}/#p=${encode(job.scene)}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) return await navigator.share({ title: "c", text: job.scene.caption, url });
      await navigator.clipboard.writeText(url);
      say("Link copied. Whoever opens it watches it paint itself");
    } catch {}
  };

  const exportImage = () => {
    const current = job.scene;
    say("Getting your painting ready…");
    setTimeout(async () => {
      await download(current);
      say("Downloaded");
    }, 60);
  };

  const openGallery = () => setShelf({ open: true, items: list() });
  const closeGallery = () => setShelf((s) => ({ ...s, open: false }));

  const keep = () => {
    const current = job.scene;
    const image = versions.find((v) => v.key === JSON.stringify(current))?.image || thumb(current, 260);
    say(save(current, image) ? "Saved to your gallery" : "Your browser is out of space for paintings");
  };

  const open = (saved) => {
    ticket.current++;
    setShelf((s) => ({ ...s, open: false }));
    setSkipped(true);
    setVersions([]);
    morph(() => {
      setView("studio");
      start(saved, "show");
    });
  };

  const say = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const refine = async (text) => {
    const current = job.scene;
    const mine = ++ticket.current;
    setBusy(true);
    let next = null;
    try {
      const out = await ask({ mode: "edit", text, scene: current });
      if (out.changed !== false) next = normalize({ ...out.scene, seed: current.seed, caption: current.caption });
    } catch {}
    if (!next) {
      const local = edit(text, current);
      if (local.changed) next = local.scene;
    }
    if (mine !== ticket.current) return;
    setBusy(false);
    if (!next || JSON.stringify(next) === JSON.stringify(current)) return say("Try naming what to change, like “make it night”");
    start(next, next.style !== current.style ? "play" : "auto");
  };

  const swap = (tag, value) => {
    const next = applySwap(job.scene, tag, value);
    if (job.scene.caption === caption(job.scene)) next.caption = caption(next);
    start(next, "auto");
  };

  const paint = async ({ text, picks, style }) => {
    const seed = newSeed();
    const local = read(text, picks, style, seed);
    const mine = ++ticket.current;
    setSkipped(true);
    setVersions([]);
    morph(() => {
      setView("studio");
      if (!text) return start(local);
      setJob(null);
      setDraft(local);
      setStatus("reading");
    });
    if (!text) return;
    let next = local;
    let asked = null;
    try {
      const out = await ask({ text, picks, style });
      next = normalize({ ...out.scene, seed, style, caption: text });
      asked = out.question;
    } catch {}
    if (mine !== ticket.current) return;
    if (!asked) return start(next);
    setDraft(next);
    setQuestion(asked);
    setStatus("asking");
  };

  const home = () => {
    ticket.current++;
    if (location.hash) history.replaceState(null, "", location.pathname);
    setBusy(false);
    morph(() => {
      setView("home");
      setJob(null);
      setDraft(null);
      setQuestion(null);
      setStatus("idle");
    });
  };

  const gallery = (
    <Gallery
      open={shelf.open}
      items={shelf.items}
      onClose={closeGallery}
      onOpen={open}
      onRemove={(id) => {
        remove(id);
        setShelf({ open: true, items: list() });
      }}
    />
  );

  if (view === "studio")
    return (
      <main className="min-h-dvh">
        <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 pt-4 sm:px-7 sm:pt-5">
          <button type="button" onClick={home} aria-label="Start a new painting" className="flex items-center gap-3">
            <span className="block w-[58px] sm:w-[66px]" style={{ viewTransitionName: "logo" }}>
              <Logo className="w-full" />
            </span>
            <span className="hidden font-serif text-[17px] italic text-muted sm:block" style={{ viewTransitionName: "slogan" }}>
              picture your memories
            </span>
          </button>
          <nav className="flex items-center gap-1 text-sm text-muted">
            <button type="button" onClick={home} className="rounded-full px-3 py-1.5 transition-colors hover:bg-ink/[0.06] hover:text-ink">
              new
            </button>
            <button type="button" onClick={openGallery} className="rounded-full px-3 py-1.5 transition-colors hover:bg-ink/[0.06] hover:text-ink">
              gallery
            </button>
          </nav>
        </header>
        <section className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-5 sm:px-7">
          <div className="relative mx-auto" style={{ width: "min(100%, calc((100dvh - 230px) * 1.5))" }}>
            <Painting ref={canvas} job={job} label={scene?.caption} onDone={finish} />
            {status === "reading" && <p className="absolute inset-0 grid animate-pulse place-items-center font-serif text-[19px] italic text-faint">reading your words…</p>}
            {status === "asking" && question && (
              <div className="rise absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
                <p className="text-balance font-serif text-[24px] italic leading-snug text-ink sm:text-[28px]">{question.text}</p>
                <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-1">
                  {(question.field === "time" ? TIMES : PLACES).map((value) => (
                    <Pill key={value} onClick={() => start(normalize({ ...draft, [question.field]: value }))}>
                      {LABELS[question.field][value]}
                    </Pill>
                  ))}
                </div>
                <button type="button" onClick={() => start(draft)} className="mt-4 text-[14px] italic text-faint transition-colors hover:text-ink">
                  just paint it
                </button>
              </div>
            )}
          </div>
          {scene && (
            <div className="rise">
              <p className="mt-6 text-balance text-center font-serif text-[20px] italic leading-snug text-muted sm:text-[23px]">{scene.caption}</p>
              <SceneTags scene={scene} onSwap={job ? swap : null} />
            </div>
          )}
          {status === "done" && (
            <Actions
              items={[
                { label: "Save", icon: "save", onClick: keep },
                { label: "Download", icon: "download", onClick: exportImage },
                { label: "Share", icon: "share", onClick: share },
                { label: "Paint again", icon: "again", onClick: () => canvas.current.replay() },
              ]}
            />
          )}
          {status === "done" && <Refine busy={busy} onSubmit={refine} />}
          {status === "done" && (
            <Strip
              label="styles"
              wide
              items={STYLES.map((s) => ({ key: s, title: LABELS.style[s], image: previews.key === JSON.stringify({ ...job.scene, style: "" }) ? previews.images[s] : null }))}
              current={job.scene.style}
              onPick={(item) => item.key !== job.scene.style && start({ ...job.scene, style: item.key }, "play")}
            />
          )}
          {status === "done" && versions.length > 1 && (
            <Strip
              label="versions"
              items={versions.map((v, i) => ({ ...v, title: i ? `change ${i}` : "first" }))}
              current={JSON.stringify(job.scene)}
              onPick={(v) => {
                setJob({ scene: v.scene, how: "show" });
              }}
            />
          )}
        </section>
        <Toast message={toast} />
        {gallery}
      </main>
    );

  return (
    <main className={`min-h-dvh ${skipped ? "[&_*]:duration-300!" : ""}`}>
      <nav className={`fixed right-4 top-4 z-10 transition-opacity duration-700 sm:right-7 sm:top-5 ${step >= 4 ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <button type="button" onClick={openGallery} className="rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink">
          gallery
        </button>
      </nav>
      {gallery}
      <div className="mx-auto w-full max-w-[680px] px-4 pb-24 pt-[13vh]">
        <div
          ref={hero}
          className={`flex flex-col items-center ${step >= 3 ? "transition-transform duration-[950ms] ease-[cubic-bezier(.2,.7,.2,1)]" : ""}`}
          style={{ transform: `translateY(${step < 3 ? lift : 0}px)` }}
        >
          <span className="block w-[190px] sm:w-[250px]" style={{ viewTransitionName: "logo" }}>
            <Logo draw={!skipped} delay={350} duration={1800} className="w-full" />
          </span>
          <p
            className={`mt-4 font-serif text-[22px] italic text-muted transition-all duration-[900ms] sm:text-[26px] ${step >= 2 ? "translate-y-0 opacity-100 blur-none" : "translate-y-1.5 opacity-0 blur-[6px]"}`}
            style={{ viewTransitionName: "slogan" }}
          >
            picture your memories
          </p>
        </div>
        <Describe visible={step >= 3} tags={step >= 4} onPaint={paint} />
      </div>
    </main>
  );
}
