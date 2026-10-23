import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LOGO_BOX, svgPaths } from "@/lib/paint/logo";

export const alt = "c · picture your memories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const serif = await readFile(join(process.cwd(), "assets/fonts/InstrumentSerif-Italic.ttf"));

export default function OpenGraphImage() {
  const width = 520;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#e5e1d8" }}>
        <svg width={width} height={(width * LOGO_BOX.h) / LOGO_BOX.w} viewBox={`${LOGO_BOX.x} ${LOGO_BOX.y} ${LOGO_BOX.w} ${LOGO_BOX.h}`}>
          {svgPaths(1).map((p, i) => (
            <path key={i} d={p.d} fill="#1a1916" fillOpacity={p.opacity} />
          ))}
        </svg>
        <div style={{ marginTop: 34, fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 54, color: "#6c675f" }}>picture your memories</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Instrument Serif", data: serif, style: "italic", weight: 400 }] }
  );
}
