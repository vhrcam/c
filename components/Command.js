"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";

const STOP = new Set(["a", "an", "the", "of", "in", "on", "at", "to", "and", "with", "my", "our", "your", "from", "into", "is", "are", "was", "for", "by", "it", "its", "this", "that"]);
const PEOPLE = "people person man men woman women girl boy guy lady me i im we us couple friend girlfriend boyfriend wife husband mom mum dad mother father grandma grandpa grandmother grandfather kid child baby sister brother figure".split(" ");
const norm = (w) => (w || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(?<=...)s$/, "");
const like = (a, b) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a)));

export function understand(words, plan) {
  const keys = words.map(norm);
  const find = (tokens) => {
    for (const t of tokens) {
      const i = keys.findIndex((k) => k && like(k, t));
      if (i >= 0) return i;
    }
    return -1;
  };
  const subjects = new Map();
  for (const s of plan.subjects) {
    const own = [...s.label.split(/\s+/).reverse(), ...s.id.split("-"), s.species === "other" ? "" : s.species].map(norm).filter((t) => t && !STOP.has(t) && !/^\d+$/.test(t));
    let at = find(own);
    if (at < 0 && (s.kind === "person" || s.form === "human")) at = find(PEOPLE);
    if (at >= 0) subjects.set(s.id, at);
  }
  const terms = [plan.world.time, plan.world.season, plan.world.weather, plan.world.setting, ...plan.lights.map((l) => l.kind), ...plan.particles.map((p) => p.kind)].map(norm);
  const extras = new Set(keys.map((k, i) => (terms.includes(k) ? i : -1)).filter((i) => i >= 0));
  const seen = new Set();
  const links = plan.relations
    .filter((r) => {
      const a = subjects.get(r.a);
      const b = subjects.get(r.b);
      const pair = `${Math.min(a, b)}:${Math.max(a, b)}`;
      if (a === undefined || b === undefined || a === b || seen.has(pair)) return false;
      seen.add(pair);
      return true;
    })
    .slice(0, 3);
  return { subjects, extras, links };
}

export default function Command({ text, plan }) {
  const [tick, setTick] = useState(0);
  const box = useRef(null);
  const spans = useRef([]);
  const arcs = useRef([]);
  const words = text.split(/\s+/).filter(Boolean);
  const read = plan ? understand(words, plan) : null;
  const named = read ? new Set(read.subjects.values()) : null;

  useEffect(() => {
    if (plan) return;
    const id = setInterval(() => setTick((t) => t + 1), 170);
    return () => clearInterval(id);
  }, [plan]);

  useLayoutEffect(() => {
    if (!plan) return;
    const { subjects, links } = understand(text.split(/\s+/).filter(Boolean), plan);
    const origin = box.current.getBoundingClientRect();
    links.forEach((r, i) => {
      const g = arcs.current[i];
      const a = spans.current[subjects.get(r.a)]?.getBoundingClientRect();
      const b = spans.current[subjects.get(r.b)]?.getBoundingClientRect();
      if (!g || !a || !b) return;
      const x1 = a.left + a.width / 2 - origin.left;
      const x2 = b.left + b.width / 2 - origin.left;
      const y1 = a.top - origin.top + 2;
      const y2 = b.top - origin.top + 2;
      const lift = 16 + Math.abs(x2 - x1) * 0.14 + i * 7;
      const mx = (x1 + x2) / 2;
      const my = Math.min(y1, y2) - lift;
      const path = g.firstChild;
      const label = g.lastChild;
      path.setAttribute("d", `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`);
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.getBoundingClientRect();
      path.style.transition = `stroke-dashoffset 800ms cubic-bezier(.3,.7,.2,1) ${250 + i * 280}ms`;
      path.style.strokeDashoffset = "0";
      label.setAttribute("x", mx);
      label.setAttribute("y", (y1 + 2 * my + y2) / 4 - 5);
      label.style.transition = `opacity 500ms ease ${750 + i * 280}ms`;
      label.style.opacity = "1";
    });
  }, [plan, text]);

  return (
    <p ref={box} className="relative max-w-[min(640px,86vw)] text-balance text-center font-mono text-[15px] leading-[2.2] sm:text-[18px]" style={{ viewTransitionName: "prompt" }}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span
            ref={(el) => {
              spans.current[i] = el;
            }}
            className={`transition-colors duration-500 ${
              named?.has(i) ? "text-fg underline decoration-fg/35 decoration-1 underline-offset-[7px]" : read?.extras.has(i) ? "text-fg/70" : named?.size ? "text-fg/25" : read ? "text-fg/40" : tick % (words.length + 6) === i ? "text-fg" : "text-fg/40"
            }`}
          >
            {w}
          </span>{" "}
        </Fragment>
      ))}
      <span aria-hidden data-state={read ? "on" : "think"} className="mark-cursor inline-block h-[1.05em] w-[0.55em] translate-y-[0.2em] bg-fg" style={{ viewTransitionName: "cursor" }} />
      {read && (
        <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
          {read.links.map((r, i) => (
            <g
              key={i}
              ref={(el) => {
                arcs.current[i] = el;
              }}
            >
              <path fill="none" stroke="currentColor" strokeWidth="1" className="text-fg/40" />
              <text textAnchor="middle" className="fill-fg/55 font-mono text-[10px]" style={{ opacity: 0 }}>
                {r.rel}
              </text>
            </g>
          ))}
        </svg>
      )}
    </p>
  );
}
