"use client";

import { FormEvent, useState } from "react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export default function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    setError("");
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase belum dikonfigurasi. Isi URL dan anon key di frontend/.env.local.");
      return;
    }
    setBusy(true);
    try {
      const result = mode === "signup"
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "signup" && !result.data.session) {
        setNotice("Akun dibuat. Periksa email untuk mengonfirmasi akun, lalu masuk.");
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Autentikasi gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">✳</span>
          <span>teman<span className="brand-ai">ai</span></span>
        </div>
        <p className="auth-eyebrow">RUANG PRIBADIMU</p>
        <h1>{mode === "signin" ? "Senang bertemu lagi." : "Mulai percakapanmu."}</h1>
        <p className="auth-copy">Masuk untuk menyimpan obrolan dan melanjutkannya kapan saja.</p>

        {!isSupabaseConfigured && (
          <div className="auth-notice" role="alert">
            Supabase belum dikonfigurasi. Atur <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di <code>frontend/.env.local</code>.
          </div>
        )}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" />
          <label htmlFor="auth-password">Kata sandi</label>
          <input id="auth-password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 8 karakter" />
          <button className="auth-submit" type="submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Memproses..." : mode === "signin" ? "Masuk" : "Buat akun"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
          <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}>
            {mode === "signin" ? "Daftar" : "Masuk"}
          </button>
        </p>
      </section>
    </main>
  );
}
