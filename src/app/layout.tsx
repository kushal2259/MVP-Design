import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArchCopilot — AI Architectural Design Platform",
  description: "The GitHub Copilot for Architects. Convert requirements into complete architectural design packages in minutes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
