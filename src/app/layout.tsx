import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghana Digital Twin — Geospatial World Model",
  description:
    "GDT: a continuously updating, AI-native geospatial world model of the Republic of Ghana. Entities, observations, change detection, and a temporal knowledge graph across the nation.",
  keywords: [
    "Ghana",
    "Digital Twin",
    "Geospatial",
    "Earth Observation",
    "Sentinel",
    "Change Detection",
    "World Model",
  ],
  authors: [{ name: "Ghana Digital Twin" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground overflow-hidden`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors={false} closeButton />
      </body>
    </html>
  );
}
