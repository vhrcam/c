import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata = {
  title: "c · picture your memories",
  description: "Describe a moment no one photographed, and watch c paint it stroke by stroke.",
};

export const viewport = {
  themeColor: "#e5e1d8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
