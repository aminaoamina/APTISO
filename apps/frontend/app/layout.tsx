import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
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
