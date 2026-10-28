import { ImageResponse } from "next/og";
import { MARK } from "@/components/Mark";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const width = 112;
  const k = MARK.cursor;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#11100e" }}>
        <svg width={width} height={(width * MARK.h) / MARK.w} viewBox={`0 0 ${MARK.w} ${MARK.h}`} fill="#ece7dd">
          <path d={MARK.c} />
          <rect x={k.x} y={k.y} width={k.w} height={k.h} />
        </svg>
      </div>
    ),
    size
  );
}
