const solid = { width: 16, height: 16, viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true };
const line = { ...solid, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  play: (
    <svg {...solid}>
      <path d="M5 3.3v9.4a.5.5 0 0 0 .8.4l7-4.7a.5.5 0 0 0 0-.8l-7-4.7a.5.5 0 0 0-.8.4Z" />
    </svg>
  ),
  pause: (
    <svg {...solid}>
      <rect x="4" y="3" width="2.6" height="10" rx=".6" />
      <rect x="9.4" y="3" width="2.6" height="10" rx=".6" />
    </svg>
  ),
  skip: (
    <svg {...solid}>
      <path d="M3 3.3v9.4a.5.5 0 0 0 .8.4L10 8.4a.5.5 0 0 0 0-.8L3.8 2.9a.5.5 0 0 0-.8.4Z" />
      <rect x="11.2" y="3" width="2.3" height="10" rx=".6" />
    </svg>
  ),
  full: (
    <svg {...line}>
      <path d="M2.5 6V2.5H6M13.5 6V2.5H10M2.5 10v3.5H6M13.5 10v3.5H10" />
    </svg>
  ),
  exit: (
    <svg {...line}>
      <path d="M6 2.5V6H2.5M10 2.5V6h3.5M6 13.5V10H2.5M10 13.5V10h3.5" />
    </svg>
  ),
  save: (
    <svg {...line}>
      <path d="M4.5 2.5h7v11L8 11l-3.5 2.5Z" />
    </svg>
  ),
  download: (
    <svg {...line}>
      <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" />
    </svg>
  ),
  share: (
    <svg {...line}>
      <path d="M6.8 9.2l2.4-2.4M7.3 4.8l1-1a2.6 2.6 0 0 1 3.7 3.7l-1 1M8.7 11.2l-1 1A2.6 2.6 0 0 1 4 8.5l1-1" />
    </svg>
  ),
  again: (
    <svg {...line}>
      <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" />
    </svg>
  ),
  plus: (
    <svg {...line}>
      <path d="M8 3v10M3 8h10" />
    </svg>
  ),
};

function Button({ label, text, icon, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex h-9 min-w-9 items-center justify-center gap-2 rounded-full px-2.5 text-fg/70 transition-colors hover:bg-fg/[0.08] hover:text-fg">
      {icon && ICONS[icon]}
      {text && <span className={`font-mono text-[11px] ${icon ? "hidden lg:inline" : ""}`}>{text}</span>}
    </button>
  );
}

export default function Dock({ done, playing, full, mode, onToggle, onSkip, onFull, onSave, onDownload, onShare, onRegenerate, onSwitch, onNew }) {
  const other = mode === "3d" ? "2d" : "3d";
  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-fg/10 bg-bg/55 p-1 backdrop-blur-md">
      {done ? (
        <>
          <Button label="Save to your gallery" text="save" icon="save" onClick={onSave} />
          <Button label="Download PNG" text="png" icon="download" onClick={onDownload} />
          <Button label="Copy a share link" text="share" icon="share" onClick={onShare} />
          <Button label="Regenerate with a new seed" text="regenerate" icon="again" onClick={onRegenerate} />
          <Button label={`Build it in ${other}`} text={other} onClick={onSwitch} />
          <Button label="New artwork" text="new" icon="plus" onClick={onNew} />
        </>
      ) : (
        <>
          <Button label={playing ? "Pause" : "Play"} icon={playing ? "pause" : "play"} onClick={onToggle} />
          <Button label="Skip to the finished piece" icon="skip" onClick={onSkip} />
        </>
      )}
      {onFull && (
        <>
          <span aria-hidden className="mx-1 h-4 w-px bg-fg/12" />
          <Button label={full ? "Exit fullscreen" : "Fullscreen"} icon={full ? "exit" : "full"} onClick={onFull} />
        </>
      )}
    </div>
  );
}
