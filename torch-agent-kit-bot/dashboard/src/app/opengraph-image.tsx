import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Torch Bot — Dashboard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #0b0b0b 0%, #111 50%, #0d0d0d 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 16,
              background: "rgba(94, 45, 227, 0.2)",
              border: "2px solid rgba(94, 45, 227, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 48 }}>🤖</span>
          </div>
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "#f5f5f5",
              letterSpacing: "-0.02em",
            }}
          >
            Torch Bot
          </span>
        </div>
        <p
          style={{
            fontSize: 28,
            color: "#8e8e93",
            margin: 0,
            maxWidth: 720,
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          Monitor daily runs, forecasts, bet results, and on-chain account data.
          AI-driven HBAR price predictions on Hedera.
        </p>
        <div
          style={{
            marginTop: 48,
            padding: "12px 24px",
            borderRadius: 999,
            background: "rgba(94, 45, 227, 0.25)",
            border: "1px solid rgba(94, 45, 227, 0.4)",
            color: "#bdb5fd",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          torch-agent.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
