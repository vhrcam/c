import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MARK } from "@/components/Mark";

export const alt = "c · describe anything";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mono = await readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf"));

export default function OpenGraphImage() {
  const width = 236;
  const k = MARK.cursor;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#11100e" }}>
        <svg width={width} height={(width * MARK.h) / MARK.w} viewBox={`0 0 ${MARK.w} ${MARK.h}`} fill="#ece7dd">
          <path d={MARK.c} />
          <rect x={k.x} y={k.y} width={k.w} height={k.h} />
        </svg>
        <div style={{ marginTop: 64, fontFamily: "Geist Mono", fontSize: 28, letterSpacing: 0.5, color: "#8a857b" }}>describe anything</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist Mono", data: mono, style: "normal", weight: 400 }] }
  );
}
