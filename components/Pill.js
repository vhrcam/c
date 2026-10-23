export default function Pill({ on = false, className = "", children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`rounded-full px-3 py-[6px] text-[14px] leading-none transition-colors duration-200 ${on ? "bg-ink text-paper" : "text-muted hover:bg-ink/[0.06] hover:text-ink"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
