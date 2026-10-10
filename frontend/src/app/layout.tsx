import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { FooterProof } from "@/components/FooterProof";
import { Providers } from "@/components/Providers";
import { PRODUCT } from "@/lib/product";

export const metadata: Metadata = {
  title: `${PRODUCT.name} - invoices on BOT Chain`,
  description: PRODUCT.heroBody,
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-32.png",
    apple: "/favicon-128.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Providers>
          <Header />
          <main className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6">
            {children}
          </main>
          <FooterProof />
        </Providers>
      </body>
    </html>
  );
}