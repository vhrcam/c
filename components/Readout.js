"use client";

import { useEffect, useState } from "react";

const DRIFT = { fall: "falling", drift: "drifting", swirl: "swirling", rise: "rising" };

function Line({ label, text, delay = 0, wide = false }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    const quick = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now() + (quick ? 0 : delay);
    const id = setInterval(() => {
      const k = quick ? text.length : Math.floor(((performance.now() - start) / 1000) * 80);
      if (k <= 0) return;
      setN(Math.min(text.length, k));
      if (k >= text.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [text, delay]);

  if (!n || !text) return null;
  return (
    <div className={`${wide ? "hidden sm:grid" : "grid"} grid-cols-[50px_1fr] gap-x-3 sm:grid-cols-[58px_1fr]`}>
      <span className="text-fg/30">{label}</span>
      <span>
        <span aria-hidden>
          {text.slice(0, n)}
          {n < text.length && <span className="ml-px inline-block h-[0.9em] w-[0.5em] translate-y-[0.1em] bg-fg/70" />}
        </span>
        <span className="sr-only">{text}</span>
      </span>
    </div>
  );
}

function Clock({ since }) {
  const [now, setNow] = useState(since);

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums text-fg/25">{(Math.max(0, now - since) / 1000).toFixed(1)}s</span>;
}

const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default function Readout({ run, phases, step, ready, done, error, onRetry, onEdit }) {
  const plan = run.plan;

  if (done && plan)
    return (
      <div className="rise max-w-[460px]">
        <p className="text-[15px] leading-snug text-fg">{plan.title}</p>
        {plan.read && <p className="mt-1 font-mono text-[11px] leading-relaxed text-fg/50 sm:text-[11.5px]">{plan.read}</p>}
      </div>
    );

  if (!error && !ready)
    return (
      <p className="font-mono text-[11px] text-fg/40 sm:text-[12px]">
        {plan ? (
          <>
            read in <span className="tabular-nums text-fg/60">{(run.took / 1000).toFixed(1)}s</span>
            <span className="text-fg/25">
              {" "}
              · {count(plan.subjects.length, "subject")} · {count(plan.relations.length, "relation")}
              {run.source === "words" && " · offline"}
            </span>
          </>
        ) : (
          <>
            reading <Clock since={run.start} />
          </>
        )}
      </p>
    );

  const name = (id) => plan?.subjects.find((s) => s.id === id)?.label || id;
  const past = (id, fallback) => {
    const i = phases.findIndex((p) => p.id === id);
    return step >= (i < 0 ? fallback : i);
  };
  const world = plan?.world;
  const place = world ? [world.setting !== "void" && world.setting, world.time, world.season !== "none" && world.season, world.weather !== "clear" && world.weather, ...plan.particles.map((p) => `${p.kind} ${DRIFT[p.motion] || ""}`)].filter(Boolean).join(" · ") : "";
  return (
    <div className="max-w-[560px] font-mono text-[11px] leading-[1.75] text-fg/75 sm:text-[12px]">
      {run.text && (
        <p className="mb-1.5 line-clamp-2 text-fg/45" style={{ viewTransitionName: "prompt" }}>
          <span className="text-fg/25">› </span>
          {run.text}
          {run.source === "words" && <span className="text-fg/25"> · read offline</span>}
        </p>
      )}
      {error ? (
        <div>
          <p className="text-fg/70">{error}</p>
          <div className="pointer-events-auto mt-1.5 flex gap-4">
            {onRetry && (
              <button type="button" onClick={onRetry} className="text-fg underline-offset-4 hover:underline">
                try again
              </button>
            )}
            <button type="button" onClick={onEdit} className="text-fg/50 transition-colors hover:text-fg">
              edit
            </button>
          </div>
        </div>
      ) : (
        <>
          <Line label="reads" text={plan.read || plan.title} />
          {past("structure", 1) && plan.relations.slice(0, 4).map((r, i) => <Line key={`r${i}`} label={i ? "" : "sees"} text={`${name(r.a)} → ${r.rel} → ${name(r.b)}`} delay={i * 280} wide={i > 1} />)}
          {past("form", 2) && plan.systems.slice(0, 4).map((s, i) => <Line key={`s${i}`} label={i ? "" : "builds"} text={s.why} delay={i * 450} wide={i > 2} />)}
          {past("light", 4) && <Line label="light" text={plan.lights.map((l) => l.kind).join(", ")} />}
          {past("world", 5) && <Line label="world" text={place} />}
        </>
      )}
    </div>
  );
}
