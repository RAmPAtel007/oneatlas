import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { CompareTray } from "@/components/compare/compare-store";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "OneAtlas — every AI model, compared", template: "%s · OneAtlas" },
  description:
    "Discover, compare and evaluate AI models across labs and providers: specs, pricing, capabilities and benchmarks in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
            <p>
              Catalog data from{" "}
              <a className="underline" href="https://models.dev" target="_blank" rel="noreferrer">models.dev</a>
              ; benchmarks from Artificial Analysis and Design Arena via the{" "}
              <a className="underline" href="https://openrouter.ai" target="_blank" rel="noreferrer">OpenRouter</a> API.
            </p>
            <nav className="flex gap-4">
              <Link href="/api-docs" className="hover:text-foreground">API</Link>
              <Link href="/rankings" className="hover:text-foreground">Rankings</Link>
            </nav>
          </div>
        </footer>
        <Suspense fallback={null}>
          <CompareTray />
        </Suspense>
      </body>
    </html>
  );
}
