import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Nudge — your work, handled. Gently.";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A0F25 0%, #1A2250 100%)",
          color: "#EEF0FF",
          fontFamily: "sans-serif",
        }}
      >
        {/* owl */}
        <div
          style={{
            display: "flex",
            width: 150,
            height: 150,
            borderRadius: 40,
            background: "linear-gradient(160deg, #A79BFF, #6D5BF6 55%, #4C5BD4)",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", width: 44, height: 44, borderRadius: 44, background: "#EEF0FF", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 20, background: "#FBBF24" }} />
          </div>
          <div style={{ display: "flex", width: 44, height: 44, borderRadius: 44, background: "#EEF0FF", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 20, height: 20, borderRadius: 20, background: "#FBBF24" }} />
          </div>
        </div>

        <div style={{ fontSize: 88, fontWeight: 800, letterSpacing: -2 }}>Nudge</div>
        <div style={{ fontSize: 34, color: "#A79BFF", marginTop: 8 }}>Your work, handled. Gently.</div>
        <div style={{ fontSize: 22, color: "#8E96C9", marginTop: 28 }}>
          Private AI office buddy · NVIDIA Nemotron on Nebius Token Factory
        </div>
      </div>
    ),
    { ...size }
  );
}
