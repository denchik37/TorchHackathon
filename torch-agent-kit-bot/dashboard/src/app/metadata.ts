import type { Metadata } from "next";

const siteName = "Torch Bot";
const title = "Torch Bot — Dashboard";
const description =
  "Monitor daily runs, forecasts, bet results, and on-chain account data for the Torch prediction bot. AI-driven HBAR price predictions on Hedera.";
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (typeof process.env.VERCEL_URL === "string"
    ? `https://${process.env.VERCEL_URL}`
    : "https://torch-agent.vercel.app");

export const siteMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: [
    "Torch",
    "Torch Bot",
    "prediction market",
    "crypto",
    "HBAR",
    "Hedera",
    "price prediction",
    "bot",
    "dashboard",
    "AI",
    "automated betting",
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
        alt: title,
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
