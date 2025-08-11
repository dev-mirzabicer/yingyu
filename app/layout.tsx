import type React from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";


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
          <SidebarProvider>
            <div className="flex min-h-screen w-full">
              <AppSidebar />
              <main className="flex-1 overflow-auto">
                <div className="container mx-auto p-6">{children}</div>
              </main>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

