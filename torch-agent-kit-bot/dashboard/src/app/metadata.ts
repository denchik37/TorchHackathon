import type { Metadata } from "next";

const siteName = "Torch Bot";
const title = "Bot — Dashboard";
const description =
  "Monitor daily runs, forecasts, bet results, and on-chain account data for the Torch prediction bot. AI-driven HBAR price predictions on Hedera.";
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://torch-bot-dashboard.vercel.app";

export const siteMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: title,
    template: `%s | ${siteName}`,
  },
  description,
  keywords: [
    "Torch",
    "bot",
    "dashboard",
    "Hedera",
    "HBAR",
    "prediction",
    "AI",
    "automated betting",
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
        alt: "Torch Bot — Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
};
