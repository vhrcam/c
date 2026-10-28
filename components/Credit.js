const clean = (title) => (title || "").replace(/^File:/i, "").replace(/\.(jpe?g|png|gif|webp|tiff?|svg)$/i, "").replace(/_/g, " ").trim();

export default function Credit({ reference }) {
  const credit = reference?.credit;
  const name = clean(credit?.title);
  if (!name || /public domain|\bpd\b|pdm|cc0/i.test(credit.license || "")) return null;
  const text = `reference: ${name}${credit.author ? ` by ${credit.author}` : ""}${credit.license ? `, ${credit.license}` : ""}`;
  return (
    <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-fg/35">
      {/^https:\/\//.test(credit.url || "") ? (
        <a href={credit.url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto underline-offset-2 transition-colors hover:text-fg hover:underline">
          {text}
        </a>
      ) : (
        text
      )}
    </p>
  );
}
