"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWAInstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent;
    const appleMobile = /iPhone|iPad|iPod/i.test(userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIOS(appleMobile);
    setIsMobile(appleMobile || /Android/i.test(userAgent));
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled || (!prompt && !isMobile)) return null;

  return (
    <>
      <button className="install-button" type="button" onClick={async () => {
        if (!prompt) {
          setShowInstructions(true);
          return;
        }
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") setIsInstalled(true);
        setPrompt(null);
      }}>
        {prompt ? "Pasang aplikasi" : "Cara pasang aplikasi"}
      </button>
      {showInstructions && (
        <div className="install-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowInstructions(false);
        }}>
          <section className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="install-title">
            <button className="settings-close" type="button" onClick={() => setShowInstructions(false)} aria-label="Tutup panduan">×</button>
            <p className="auth-eyebrow">TEMANAI DI PONSELMU</p>
            <h2 id="install-title">Pasang sebagai aplikasi</h2>
            {isIOS ? (
              <ol>
                <li>Buka halaman ini di <strong>Safari</strong>.</li>
                <li>Ketuk tombol <strong>Bagikan</strong> <span aria-label="ikon bagikan">□↑</span> pada toolbar.</li>
                <li>Pilih <strong>Tambahkan ke Layar Utama</strong>, lalu ketuk <strong>Tambah</strong>.</li>
              </ol>
            ) : (
              <ol>
                <li>Buka menu browser <strong>⋮</strong> di pojok kanan atas.</li>
                <li>Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.</li>
                <li>Konfirmasi pemasangan pada dialog browser.</li>
              </ol>
            )}
            <p className="settings-help">Jika pilihan pasang belum muncul, pastikan situs dibuka lewat HTTPS dan muat ulang halaman.</p>
            <div className="settings-actions">
              <button type="button" onClick={() => setShowInstructions(false)}>Mengerti</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
