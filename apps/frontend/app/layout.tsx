import type { Metadata } from "next";
import { Fraunces, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono-numeric",
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "APTISO - ISO 27001 Compliance Platform",
  description:
    "AI-powered ISO 27001 compliance management. Plan, assess, and certify your information security management system.",
  keywords: [
    "ISO 27001",
    "compliance",
    "information security",
    "ISMS",
    "risk management",
    "gap assessment",
  ],
  authors: [{ name: "APTISO" }],
  openGraph: {
    title: "APTISO - ISO 27001 Compliance Platform",
    description:
      "AI-powered ISO 27001 compliance management. Plan, assess, and certify your ISMS.",
    type: "website",
    locale: "en_US",
    siteName: "APTISO",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fraunces.variable} ${workSans.variable} ${ibmPlexMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
