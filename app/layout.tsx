import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roamly — Singapore, planned around you",
  description: "A map-first, AI-assisted Singapore travel companion.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
