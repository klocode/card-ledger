import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Headings and card names only — a serif at body size in a data-dense table
// would cost more legibility than it buys character.
const serifDisplay = Source_Serif_4({
  variable: "--font-serif-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Card Ledger",
  description: "Track TCG card prices over time and know when to buy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${serifDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
