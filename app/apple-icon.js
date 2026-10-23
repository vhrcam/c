import { ImageResponse } from "next/og";
import { fitPath } from "@/lib/paint/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#e5e1d8" }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          <path d={fitPath(1.6, 180, 128, 4)} fill="#1a1916" />
        </svg>
      </div>
    ),
    size
  );
}
