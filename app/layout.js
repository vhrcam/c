import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-geist", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";
const description = "Describe anything. c reads it, then a computational system builds it into a living artwork while you watch.";

export const metadata = {
  metadataBase: new URL(site),
  title: "c · describe anything",
  description,
  openGraph: { title: "c · describe anything", description, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport = {
  themeColor: "#11100e",
  colorScheme: "dark",
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
