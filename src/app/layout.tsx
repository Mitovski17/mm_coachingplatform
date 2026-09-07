import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { ThemeProvider } from "./ThemeProvider";
import { ServiceWorkerRegistrar } from "./ServiceWorkerRegistrar";

// Variable axes (no `weight` array) — one file per subset covers 100-900, so
// 700/800 headings render as real cut weights instead of browser-synthesised
// fake bold. Cyrillic is listed because the UI ships bg translations.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

// Display face for headings and figures in the client view — geometric with a
// tall x-height, which is what gives Klarna-style headers their weight.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const themeInitScript = "try{var t=localStorage.getItem('theme');if(t==='light')document.documentElement.classList.add('light');}catch(e){}";

export const metadata: Metadata = {
  title: "Mitovski Coaching",
  description: "Mitovski Coaching Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mitovski Coaching",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        <Toaster position="top-right" theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
