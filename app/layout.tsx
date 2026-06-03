import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "3Dflatter",
  description: "3D mesh viewer + unfolding PoC",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

