"use client";

import { useEffect, useRef, useState } from "react";
import Describe from "./Describe";
import Logo from "./Logo";

const STEPS = [
  [1900, 2],
  [3000, 3],
  [3550, 4],
];

export default function Studio() {
  const [step, setStep] = useState(1);
  const [skipped, setSkipped] = useState(false);
  const [lift, setLift] = useState(0);
  const hero = useRef(null);

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

  return (
    <main className={`min-h-dvh ${skipped ? "[&_*]:duration-300!" : ""}`}>
      <div className="mx-auto w-full max-w-[680px] px-4 pb-24 pt-[13vh]">
        <div
          ref={hero}
          className={`flex flex-col items-center ${step >= 3 ? "transition-transform duration-[950ms] ease-[cubic-bezier(.2,.7,.2,1)]" : ""}`}
          style={{ transform: `translateY(${step < 3 ? lift : 0}px)` }}
        >
          <Logo draw={!skipped} delay={350} duration={1800} className="w-[190px] sm:w-[250px]" />
          <p className={`mt-4 font-serif text-[22px] italic text-muted transition-all duration-[900ms] sm:text-[26px] ${step >= 2 ? "translate-y-0 opacity-100 blur-none" : "translate-y-1.5 opacity-0 blur-[6px]"}`}>
            picture your memories
          </p>
        </div>
        <Describe visible={step >= 3} tags={step >= 4} />
      </div>
    </main>
  );
}
