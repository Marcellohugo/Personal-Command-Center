import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Command Center",
  description: "Dashboard pribadi untuk jadwal, pengeluaran, habit, dan ringkasan harian."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
