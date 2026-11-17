import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MARK } from "@/components/Mark";

export const alt = "c · describe anything";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mono = await readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf"));

export default function OpenGraphImage() {
  // the c alone, at the size it had beside the cursor, centered above the line
  const scale = 236 / MARK.w;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#11100e" }}>
        <svg width={MARK.cw * scale} height={MARK.h * scale} viewBox={`0 0 ${MARK.cw} ${MARK.h}`} fill="#ece7dd">
          <path d={MARK.c} />
        </svg>
        <div style={{ marginTop: 64, fontFamily: "Geist Mono", fontSize: 28, letterSpacing: 0.5, color: "#8a857b" }}>describe anything</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Geist Mono", data: mono, style: "normal", weight: 400 }] }
  );
}
