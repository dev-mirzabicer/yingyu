import type React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { AppProviders } from "./app-providers";
import { AppLayout } from "./app-layout";


const inter = localFont({
  src: [
    { path: "./fonts/inter/Inter-VariableFont_opsz,wght.ttf", style: "normal" },
    { path: "./fonts/inter/Inter-Italic-VariableFont_opsz,wght.ttf", style: "italic" },
  ],
  weight: "100 900",       // variable axis range
  display: "swap",          // avoid FOIT
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Yingyu English - Teaching Platform",
  description: "Advanced English teaching platform with FSRS-powered spaced repetition",
  generator: "Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AppProviders>
            <AppLayout>{children}</AppLayout>
            <Toaster />
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

