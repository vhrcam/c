"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { newSeed, normalize } from "@/lib/scene";
import { read } from "@/lib/words";
import Describe from "./Describe";
import Logo from "./Logo";
import Painting from "./Painting";
import SceneTags from "./SceneTags";

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
  const hero = useRef(null);
  const canvas = useRef(null);
  const ticket = useRef(0);
  const scene = job?.scene || draft;

  useEffect(() => {
    const quick = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() => {
      const box = hero.current.getBoundingClientRect();
      setLift(innerHeight / 2 - (box.top + box.height / 2));
      if (quick) {
        setSkipped(true);
        setStep(4);
      }
    });
    const timers = quick ? [] : STEPS.map(([ms, s]) => setTimeout(() => setStep(s), ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (step >= 4) return;
    const skip = () => {
      setSkipped(true);
      setStep(4);
    };
    addEventListener("pointerdown", skip);
    addEventListener("keydown", skip);
    return () => {
      removeEventListener("pointerdown", skip);
      removeEventListener("keydown", skip);
    };
  }, [step]);

  const start = (next, how = "play") => {
    setDraft(next);
    setStatus("painting");
    setJob({ scene: next, how, id: Date.now() });
  };

  const paint = async ({ text, picks, style }) => {
    const seed = newSeed();
    const local = read(text, picks, style, seed);
    const mine = ++ticket.current;
    setSkipped(true);
    morph(() => {
      setView("studio");
      if (!text) return start(local);
      setJob(null);
      setDraft(local);
      setStatus("reading");
    });
    if (!text) return;
    let next = local;
    try {
      const out = await ask({ text, picks, style });
      next = normalize({ ...out.scene, seed, style, caption: text });
    } catch {}
    if (mine === ticket.current) start(next);
  };

  const home = () => {
    ticket.current++;
    morph(() => {
      setView("home");
      setJob(null);
      setDraft(null);
      setStatus("idle");
    });
  };

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
          </nav>
        </header>
        <section className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-5 sm:px-7">
          <div className="mx-auto" style={{ width: "min(100%, calc((100dvh - 230px) * 1.5))" }}>
            <Painting ref={canvas} job={job} label={scene?.caption} onDone={() => setStatus("done")} />
          </div>
          {scene && (
            <div className="rise">
              <p className="mt-6 text-balance text-center font-serif text-[20px] italic leading-snug text-muted sm:text-[23px]">{scene.caption}</p>
              <SceneTags scene={scene} />
            </div>
          )}
          {status === "reading" && <p className="mt-6 animate-pulse text-center font-serif text-[17px] italic text-faint">reading your words…</p>}
          {status === "done" && <p className="sr-only">Finished painting</p>}
        </section>
      </main>
    );

  return (
    <main className={`min-h-dvh ${skipped ? "[&_*]:duration-300!" : ""}`}>
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
