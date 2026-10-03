import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charles App",
  description: "Register, inventory, wholesale and retail ordering, and delivery routes",
};

// next/font self-hosts these at build time, so the register still renders offline.
const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body-face" });
const heading = Barlow_Condensed({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-heading-face" });

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
