import { MARK } from "@/lib/mark";

export { MARK };

const pct = (v, of) => `${(v / of) * 100}%`;

export default function Mark({ cursor = "blink", cursorName, intro = false, className = "" }) {
  const k = MARK.cursor;
  return (
    <span role="img" aria-label="c" data-intro={intro || undefined} className={`mark relative block ${className}`} style={{ aspectRatio: `${MARK.w} / ${MARK.h}` }}>
      <svg viewBox={`0 0 ${MARK.w} ${MARK.h}`} fill="currentColor" aria-hidden className="absolute inset-0 size-full overflow-visible">
        <path d={MARK.c} />
      </svg>
      <span
        aria-hidden
        data-state={cursor}
        className="mark-cursor absolute bg-current"
        style={{ left: pct(k.x, MARK.w), top: pct(k.y, MARK.h), width: pct(k.w, MARK.w), height: pct(k.h, MARK.h), viewTransitionName: cursorName }}
      />
    </span>
  );
}
