import { ImageResponse } from "next/og";
import { MARK } from "@/components/Mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  // the c alone, at the size it had beside the cursor, centered on the tile
  const scale = 112 / MARK.w;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#11100e" }}>
        <svg width={MARK.cw * scale} height={MARK.h * scale} viewBox={`0 0 ${MARK.cw} ${MARK.h}`} fill="#ece7dd">
          <path d={MARK.c} />
        </svg>
      </div>
    ),
    size
  );
}
