"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { LABELS, STYLES, TAG_GROUPS } from "@/lib/scene";
import Pill from "./Pill";

const EMPTY = { place: "", time: "", weather: "", extras: [] };

export default function Describe({ visible, tags, onPaint }) {
  const [text, setText] = useState("");
  const [picks, setPicks] = useState(EMPTY);
  const [style, setStyle] = useState("");
  const [more, setMore] = useState(false);
  const input = useRef(null);
  const ready = text.trim().length > 0 || Boolean(picks.place || picks.time || picks.weather || picks.extras.length);

  useEffect(() => {
    if (visible && matchMedia("(pointer: fine)").matches) input.current?.focus({ preventScroll: true });
  }, [visible]);

  const grow = (el) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  const submit = () => {
    if (ready) onPaint?.({ text: text.trim(), picks, style });
  };
  const toggle = (group, value) =>
    setPicks((p) =>
      group.multi
        ? { ...p, extras: p.extras.includes(value) ? p.extras.filter((x) => x !== value) : [...p.extras, value] }
        : { ...p, [group.key]: p[group.key] === value ? "" : value }
    );
  const row = (i) => ({
    className: `transition duration-700 ease-out ${tags ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`,
    style: { transitionDelay: tags ? `${i * 80}ms` : "0ms" },
  });

  return (
    <section className="mt-14 sm:mt-16">
      <textarea
        ref={input}
        rows={1}
        value={text}
        aria-label="Describe your moment"
        placeholder="describe a moment you wish you had a picture of"
        onChange={(e) => {
          setText(e.target.value);
          grow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        className={`block w-full resize-none bg-transparent pb-2 font-serif text-[19px] leading-snug outline-none placeholder:italic placeholder:text-faint sm:text-[25px] transition-opacity duration-700 delay-300 ${visible ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`h-px origin-left bg-ink/55 transition-transform duration-[850ms] ease-[cubic-bezier(.65,0,.25,1)] ${visible ? "scale-x-100" : "scale-x-0"}`} />
      <div className="mt-2 flex h-8 justify-end">
        <button
          type="button"
          onClick={submit}
          className={`flex items-center gap-1.5 rounded-full px-3 text-sm text-muted transition hover:text-ink ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          paint
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 3v5.5a2 2 0 0 1-2 2H3" />
            <path d="M6 7.5 3 10.5l3 3" />
          </svg>
        </button>
      </div>

      <div className="mt-5 grid grid-cols-[58px_1fr] items-start gap-x-3 gap-y-2.5 sm:grid-cols-[72px_1fr]">
        {TAG_GROUPS.map((group, i) => {
          const options = group.shown && !more ? group.options.slice(0, group.shown) : group.options;
          return (
            <Fragment key={group.key}>
              <span {...row(i)}>
                <span className="block pt-[7px] text-[11px] uppercase tracking-[0.16em] text-faint">{group.key}</span>
              </span>
              <div {...row(i)}>
                <div className="flex flex-wrap gap-1">
                  {options.map((value) => (
                    <Pill key={value} on={group.multi ? picks.extras.includes(value) : picks[group.key] === value} onClick={() => toggle(group, value)}>
                      {LABELS[group.key][value]}
                    </Pill>
                  ))}
                  {group.shown && (
                    <button type="button" onClick={() => setMore(!more)} className="px-2 text-[14px] italic text-faint transition-colors hover:text-ink">
                      {more ? "less" : "more…"}
                    </button>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
        <span {...row(TAG_GROUPS.length)}>
          <span className="block pt-[7px] text-[11px] uppercase tracking-[0.16em] text-faint">style</span>
        </span>
        <div {...row(TAG_GROUPS.length)}>
          <div className="flex flex-wrap gap-1">
            {STYLES.map((value) => (
              <Pill key={value} on={style === value} onClick={() => setStyle(style === value ? "" : value)}>
                {LABELS.style[value]}
              </Pill>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
