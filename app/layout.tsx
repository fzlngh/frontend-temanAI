import type { Metadata, Viewport } from "next";
import PWAInstallButton from "@/components/pwa-install-button";
import PWARegister from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "TemanAI Teman ngobrol, teman berpikir",
  description: "Asisten AI berbahasa Indonesia untuk menemani ide dan keseharianmu.",
  applicationName: "TemanAI",
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
        <PWARegister />
        {children}
        <PWAInstallButton />
      </body>
    </html>
  );
}
