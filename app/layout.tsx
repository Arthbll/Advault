import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "ProfitDash — Campaign Decision Engine",
  description: "ProfitDash detects leaking campaigns, reads real profit, and helps you kill, watch, or scale before more budget disappears.",
  openGraph: {
    title: "ProfitDash — Campaign Decision Engine",
    description: "Stop losing budget to campaigns that look fine but aren't. ProfitDash reads the signal across all your networks and acts before it compounds.",
    url: "https://profitdash.io",
    siteName: "ProfitDash",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "ProfitDash — Campaign Decision Engine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ProfitDash — Campaign Decision Engine",
    description: "Stop losing budget to campaigns that look fine but aren't.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={geist.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
        />
      </head>
      <body className="antialiased" style={{ background: "#0d0d10", color: "rgba(255,255,255,0.9)" }}>
        {children}
      </body>
    </html>
  );
}
