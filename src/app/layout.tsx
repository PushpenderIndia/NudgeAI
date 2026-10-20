import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Nudge — Your work, handled. Gently.",
  description:
    "Nudge is a private, always-on AI office buddy. It tracks meetings, drafts replies, builds your to-do list and weekly update — and never sends or changes anything without your OK.",
  icons: {
    icon: "/owl-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" className={`${jakarta.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
