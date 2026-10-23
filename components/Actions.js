const ICONS = {
  save: <path d="M4.5 2.5h7v11L8 11l-3.5 2.5Z" />,
  download: <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />,
  share: <path d="M8 10V2.5M5 5.5 8 2.5l3 3M3.5 9v4.5h9V9" />,
  again: <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" />,
};

export default function Actions({ items }) {
  return (
    <div className="rise mt-6 flex flex-wrap items-center justify-center gap-1">
      {items.map((item) => (
        <button key={item.label} type="button" onClick={item.onClick} className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[item.icon]}
          </svg>
          {item.label}
        </button>
      ))}
    </div>
  );
}
