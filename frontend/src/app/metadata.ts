import type { Metadata } from "next";

const siteName = "Torch";
const title = "Torch — Crypto Prediction Market";
const description =
  "Predict cryptocurrency token prices on Hedera and earn rewards. Place bets on HBAR price ranges, powered by on-chain resolution and AI-driven forecasts.";
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://torch-hackathon.vercel.app";

export const siteMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: [
    "Torch",
    "prediction market",
    "crypto",
    "HBAR",
    "Hedera",
    "price prediction",
    "betting",
    "DeFi",
  ],
  authors: [{ name: siteName, url: baseUrl }],
  creator: siteName,
  publisher: siteName,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName,
    title,
    description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Torch — Crypto Prediction Market",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
    creator: "@torch",
  },
  robots: {
    index: true,
    follow: true,
  },
};
