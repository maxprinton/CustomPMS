import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { getDict } from "@/lib/i18n";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Custom PMS",
  description: "Custom PMS (CPMS): clients, projects, templates and backlog in one place",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { lang } = await getDict();
  return (
    <html lang={lang} className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
