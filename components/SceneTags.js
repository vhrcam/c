import { sceneTags } from "@/lib/scene";

export default function SceneTags({ scene }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
      {sceneTags(scene).map((tag, i) => (
        <span key={`${tag.group}-${tag.value}-${tag.label}`} className="tag-in rounded-full border border-line px-3 py-[5px] text-[13px] text-muted" style={{ animationDelay: `${i * 110}ms` }}>
          {tag.label}
        </span>
      ))}
    </div>
  );
}
