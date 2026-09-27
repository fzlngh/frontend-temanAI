import type { Metadata, Viewport } from "next";
import PWAInstallButton from "@/components/pwa-install-button";
import PWARegister from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://temanai-five.vercel.app"),
  title: "Chatbot AI Bahasa Indonesia | TemanAI",
  description:
    "Ngobrol dengan TemanAI, asisten AI berbahasa Indonesia untuk mencari ide, memahami topik, menyusun rencana, dan menulis.",
  applicationName: "TemanAI",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    siteName: "TemanAI",
    title: "Chatbot AI Bahasa Indonesia | TemanAI",
    description:
      "Ngobrol dengan TemanAI, asisten AI berbahasa Indonesia untuk mencari ide, memahami topik, menyusun rencana, dan menulis.",
  },
  twitter: {
    card: "summary",
    title: "Chatbot AI Bahasa Indonesia | TemanAI",
    description:
      "Ngobrol dengan TemanAI, asisten AI berbahasa Indonesia untuk mencari ide, memahami topik, menyusun rencana, dan menulis.",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "TemanAI" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3c765e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "TemanAI",
              url: "https://temanai-five.vercel.app/",
              description:
                "Asisten AI berbahasa Indonesia untuk mencari ide, memahami topik, menyusun rencana, dan menulis.",
              applicationCategory: "UtilitiesApplication",
              operatingSystem: "Web",
              inLanguage: "id",
            }).replace(/</g, "\\u003c"),
          }}
        />
        <PWARegister />
        {children}
        <PWAInstallButton />
      </body>
    </html>
  );
}
