export const MARK = {
  w: 139,
  h: 104,
  c: "M89.3 27C84 6.2 65.9 -4.3 45.2 1.6C24.4 7.5 6.4 28.3 1.4 52C-3.7 75.7 5.5 96.5 23.7 102.4C42 108.3 64.5 97.8 78.6 77L61.1 77C50.9 88.9 37.7 93.1 28 87.6C18.2 82 14 67.8 17.4 52C20.7 36.2 31 22 43.1 16.4C55.2 10.9 66.6 15.1 71.8 27Z",
  cursor: { x: 104.3, y: 2, w: 34, h: 100 },
};

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
