const clean = (title) => (title || "").replace(/^File:/i, "").replace(/\.(jpe?g|png|gif|webp|tiff?|svg)$/i, "").replace(/_/g, " ").trim();

export const refName = (reference) => clean(reference?.credit?.title);

export default function Credit({ reference }) {
  const credit = reference?.credit;
  const name = refName(reference);
  if (!name) return null;
  const text = `reference: ${name}${credit.author ? ` by ${credit.author}` : ""}${credit.license ? `, ${credit.license}` : ""}`;
  if (!/^https:\/\//.test(credit.url || "")) return <span>{text}</span>;
  return (
    <a href={credit.url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto underline-offset-2 transition-colors hover:text-fg hover:underline">
      {text}
    </a>
  );
}
