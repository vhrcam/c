export default function Strip({ label, items, current, onPick, wide = false }) {
  return (
    <div className="rise mx-auto mt-8 flex w-full max-w-[760px] items-start gap-3 sm:gap-4">
      <span className="w-[58px] shrink-0 pt-2 text-[11px] uppercase tracking-[0.16em] text-faint sm:w-[72px]">{label}</span>
      <div className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto pb-2">
        {items.map((item) => (
          <button key={item.key} type="button" onClick={() => onPick(item)} className="group shrink-0 text-center" aria-current={item.key === current}>
            <span className={`block overflow-hidden rounded-md ring-1 transition ${wide ? "w-[112px]" : "w-[84px]"} ${item.key === current ? "ring-2 ring-ink" : "ring-line group-hover:ring-ink/40"}`} style={{ aspectRatio: "3 / 2" }}>
              {item.image ? <span role="img" aria-label={item.title} className="block h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${item.image})` }} /> : <span className="block h-full w-full animate-pulse bg-paper-deep" />}
            </span>
            {item.title && <span className={`mt-1.5 block text-[12px] ${item.key === current ? "text-ink" : "text-muted"}`}>{item.title}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
