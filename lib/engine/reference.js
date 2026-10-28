const UA = { "user-agent": "c-art/0.1 (https://github.com/vhrcam/c)" };
const BLOCK = /\b(sex|sexual|semen|sperm|nude|naked|porn|erotic|genital|penis|vagina|breast|nipple|corpse|dead|death|blood|gore|kill|killed|slaughter|autopsy|surgery|disease|tumou?r|wound|injur|anatomy|skeleton|skull|x-?ray|diagram|map|logo|chart|graph|coat of arms|flag|stamp|coin|seal|icon|svg|drawing|sketch|text|poster|cover|screenshot|collage|comparison|chart|patent|plan|elevation|blueprint)\b/i;

async function json(url, ms = 7000) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

const clean = (html) => String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 120);

async function commonsInfo(file) {
  const d = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(file)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1024`);
  const page = Object.values(d.query?.pages || {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) return null;
  const meta = ii.extmetadata || {};
  return {
    url: ii.thumburl || ii.url,
    width: ii.thumbwidth || ii.width,
    height: ii.thumbheight || ii.height,
    mime: ii.mime,
    credit: {
      title: clean(meta.ObjectName?.value) || page.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
      author: clean(meta.Artist?.value) || "Wikimedia Commons",
      license: clean(meta.LicenseShortName?.value) || "see source",
      url: ii.descriptionurl,
    },
  };
}

const shareAlike = (info) => /\bSA\b|share/i.test(info.credit.license);

function usable(info, strict) {
  if (!info || !/jpe?g|png|webp/.test(info.mime || "")) return false;
  if (!/\/wikipedia\/commons\//.test(info.url)) return false;
  if (strict && shareAlike(info)) return false;
  const aspect = info.width / info.height;
  return info.width >= 360 && info.height >= 280 && aspect > 0.45 && aspect < 2.4 && !BLOCK.test(info.credit.title);
}

async function fromWikipedia(title) {
  if (!title) return null;
  const d = await json(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (d.type === "disambiguation" || !d.originalimage?.source) return null;
  const file = decodeURIComponent(d.originalimage.source.split("/").pop());
  if (!/\/wikipedia\/commons\//.test(d.originalimage.source)) return null;
  const info = await commonsInfo(`File:${file}`).catch(() => null);
  return usable(info, false) ? { ...info, via: "wikipedia" } : null;
}

async function fromCommons(query, must) {
  if (!query) return null;
  const d = await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${query} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1024`);
  const pages = Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index);
  const words = must.map((w) => w.toLowerCase()).filter((w) => w.length > 2);
  const fits = pages.filter((page) => {
    const title = page.title.toLowerCase();
    return !BLOCK.test(title) && (!words.length || words.some((w) => title.includes(w.replace(/s$/, ""))));
  });
  let fallback = null;
  for (const page of fits.slice(0, 6)) {
    const info = await commonsInfo(page.title).catch(() => null);
    if (usable(info, true)) return { ...info, via: "commons" };
    if (!fallback && usable(info, false)) fallback = { ...info, via: "commons" };
  }
  return fallback;
}

export async function findReference(plan, hints = {}) {
  const hero = plan.subjects[0];
  const nouns = plan.subjects.map((s) => s.label.replace(/^(my|the|a|an)\s+/i, "")).filter((l) => !/^(me|i|person|people)$/i.test(l));
  const scene = hints.search || [nouns.join(" "), plan.world.setting !== "void" && plan.world.setting !== "ground" ? plan.world.setting : ""].filter(Boolean).join(" ");
  const tries = [];
  if (plan.subjects.length > 1 || hints.search) tries.push(() => fromCommons(scene, nouns.length ? nouns : [hero?.label || ""]));
  if (hero && hero.form !== "human") tries.push(() => fromWikipedia(hints.wiki || hero.label.replace(/^(my|the|a|an)\s+/i, "")));
  if (hero) tries.push(() => fromCommons(nouns[0] || hero.label, [nouns[0] || hero.label]));
  for (const run of tries) {
    try {
      const found = await run();
      if (found) return { src: `/api/image?u=${encodeURIComponent(found.url)}`, width: found.width, height: found.height, credit: found.credit, via: found.via };
    } catch {}
  }
  return null;
}
