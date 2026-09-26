import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Charles App",
  description: "Register, inventory, wholesale and retail ordering, and delivery routes",
};

// System fonts only: nothing to download, so the register still renders offline.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
