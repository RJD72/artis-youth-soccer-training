import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://artissocceracademy.ca"),

  title: {
    default: "ARTIS Soccer Academy",
    template: "%s | ARTIS Soccer Academy",
  },

  description:
    "Year-round soccer development for players ages 8–13 in Clinton, Ontario.",

  openGraph: {
    title: "ARTIS Soccer Academy",
    description:
      "Year-round soccer development for players ages 8–13 in Clinton, Ontario.",
    url: "https://artissocceracademy.ca",
    siteName: "ARTIS Soccer Academy",
    images: [
      {
        url: "/logo.png",
        alt: "ARTIS Soccer Academy",
      },
    ],
    locale: "en_CA",
    type: "website",
  },

  twitter: {
    card: "summary",
    title: "ARTIS Soccer Academy",
    description:
      "Year-round soccer development for players ages 8–13 in Clinton, Ontario.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className={`${manrope.className} min-h-full flex flex-col`}>
        {children}
      </body>
    </html>
  );
}
