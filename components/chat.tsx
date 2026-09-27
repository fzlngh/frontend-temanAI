"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import AuthScreen from "@/components/auth-screen";
import { getSupabase } from "@/lib/supabase";

type Role = "user" | "assistant";
type Message = { role: Role; content: string; id: string; sequence: number };
type Conversation = { id: string; title: string; updated_at: string };
type ServiceStatus = "checking" | "online" | "no-key" | "offline";

const API_URL = (process.env.NEXT_PUBLIC_CHAT_API_URL || "http://localhost:8080").replace(/\/+$/, "");

const suggestions = [
  { icon: "✳", title: "Bantu aku cari ide", prompt: "Bantu aku mencari ide kreatif untuk akhir pekan ini." },
  { icon: "⌘", title: "Jelaskan dengan sederhana", prompt: "Jelaskan apa itu kecerdasan buatan dengan bahasa yang sederhana." },
  { icon: "↗", title: "Susun rencana", prompt: "Bantu aku menyusun rencana belajar yang realistis selama seminggu." },
  { icon: "✎", title: "Tulis sesuatu", prompt: "Buatkan contoh pesan yang hangat untuk mengucapkan terima kasih." },
];

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<string, React.ReactNode> = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1 1-2.5Z" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  };
  return <svg {...shared}>{paths[name] || paths.spark}</svg>;
}

function renderInlineFormattedText(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[\s\S]+?\*\*|__[\s\S]+?__|\*[^*\n]+\*|(?<![\p{L}\p{N}])_[^_\n]+?_(?![\p{L}\p{N}]))/gu);

  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={index}>{renderInlineFormattedText(token.slice(2, -2))}</strong>;
    }
    if (token.startsWith("__") && token.endsWith("__")) {
      return <strong key={index}>{renderInlineFormattedText(token.slice(2, -2))}</strong>;
    }
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      return <em key={index}>{renderInlineFormattedText(token.slice(1, -1))}</em>;
    }
    return token;
  });
}

function renderFormattedText(text: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = [];
  const paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(<p key={`p-${blocks.length}`}>{paragraph.map((line, index) => (
      <span key={index}>{index > 0 && <br />}{renderInlineFormattedText(line)}</span>
    ))}</p>);
    paragraph.length = 0;
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((line, index) => (
      <li key={index}>{renderInlineFormattedText(line)}</li>
    ))}</ul>);
    bullets = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const bullet = line.match(/^\s*\* (.+)$/);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1]);
    } else if (line.trim() === "") {
      flushBullets();
      flushParagraph();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushBullets();
  flushParagraph();
  return blocks;
}

export default function Chat() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<ServiceStatus>("checking");
  const [copiedId, setCopiedId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [assistantName, setAssistantName] = useState("TemanAI");
  const [nameDraft, setNameDraft] = useState("TemanAI");
  const [userName, setUserName] = useState("");
  const [userNameDraft, setUserNameDraft] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const historyRequestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("temanai-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(storedTheme ? storedTheme === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("temanai-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    if (!session) {
      setAssistantName("TemanAI");
      setNameDraft("TemanAI");
      setUserName("");
      setUserNameDraft("");
      return;
    }
    const storedName = window.localStorage.getItem(`temanai-assistant-name:${session.user.id}`)?.trim();
    const name = storedName || "TemanAI";
    const storedUserName = window.localStorage.getItem(`temanai-user-name:${session.user.id}`)?.trim();
    const profileName = storedUserName || session.user.user_metadata.full_name?.trim() || session.user.email?.split("@")[0] || "Pengguna";
    setAssistantName(name);
    setNameDraft(name);
    setUserName(profileName);
    setUserNameDraft(profileName);
  }, [session]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/health`, { cache: "no-store" });
      if (!response.ok) throw new Error("Backend tidak tersedia");
      const data = await response.json();
      const providers = data.providers as Record<string, unknown> | undefined;
      const providerReady = Object.values(providers ?? {}).some((configured) => configured === true);
      setStatus(data.aiConfigured || data.geminiConfigured || providerReady ? "online" : "no-key");
    } catch {
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const timer = window.setInterval(() => void checkHealth(), 30_000);
    return () => window.clearInterval(timer);
  }, [checkHealth]);

  const loadConversations = useCallback(async () => {
    if (!supabase || !session) return;
    const requestId = ++historyRequestSequence.current;
    const { data, error: queryError } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (requestId !== historyRequestSequence.current) return;
    if (queryError) {
      setError(`Gagal memuat riwayat: ${queryError.message}`);
      return;
    }
    setConversations(data ?? []);
  }, [session, supabase]);

  useEffect(() => {
    if (!session) {
      historyRequestSequence.current += 1;
      setConversations([]);
      setMessages([]);
      setActiveConversationId("");
      return;
    }
    void loadConversations();
  }, [session, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [draft]);

  const askAssistant = async (history: Message[]) => {
    if (!session) throw new Error("Sesi masuk sudah berakhir. Silakan masuk kembali.");
    const recent = history.slice(-20).map(({ role, content }) => ({ role, content }));
    if (recent[0]?.role === "assistant") recent.shift();
    const controller = new AbortController();
    activeRequest.current = controller;
    const response = await fetch(`${API_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ messages: recent, assistantName }),
      signal: controller.signal,
    });
    const data: { reply?: string; error?: string } = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Maaf, pesanmu belum bisa diproses.");
    if (typeof data.reply !== "string" || !data.reply.trim()) {
      throw new Error("Asisten belum memberikan jawaban. Coba kirim ulang, ya.");
    }
    return data.reply;
  };

  const loadConversation = async (conversationId: string) => {
    if (!supabase) return;
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    setError("");
    const { data, error: queryError } = await supabase
      .from("messages")
      .select("id,role,content,sequence")
      .eq("conversation_id", conversationId)
      .order("sequence", { ascending: true });
    if (requestId !== requestSequence.current) return;
    if (queryError) {
      setError(`Gagal membuka percakapan: ${queryError.message}`);
      return;
    }
    setMessages((data ?? []) as Message[]);
    setActiveConversationId(conversationId);
    setDraft("");
    setEditingMessageId("");
    setSidebarOpen(false);
  };

  const sendMessage = async (text = draft) => {
    const content = text.trim();
    if (!content || loading || !supabase || !session) return;

    setDraft("");
    setError("");
    setLoading(true);
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    try {
      let conversationId = activeConversationId;
      if (!conversationId) {
        const { data: conversation, error: createError } = await supabase
          .from("conversations")
          .insert({ user_id: session.user.id, title: content.slice(0, 80) })
          .select("id,title,updated_at")
          .single();
        if (createError) throw createError;
        conversationId = conversation.id;
        setActiveConversationId(conversationId);
        setConversations((current) => [conversation, ...current]);
      }

      const sequence = messages.reduce((max, message) => Math.max(max, message.sequence), 0) + 1;
      const { data: savedUserMessage, error: saveUserError } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, user_id: session.user.id, role: "user", content, sequence })
        .select("id,role,content,sequence")
        .single();
      if (saveUserError) throw saveUserError;
      const updated = [...messages, savedUserMessage as Message];
      setMessages(updated);

      const reply = await askAssistant(updated);
      if (requestId !== requestSequence.current) return;
      const { data: savedAssistantMessage, error: saveAssistantError } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, user_id: session.user.id, role: "assistant", content: reply, sequence: sequence + 1 })
        .select("id,role,content,sequence")
        .single();
      if (saveAssistantError) throw saveAssistantError;
      setMessages((current) => [...current, savedAssistantMessage as Message]);
      await loadConversations();
      void checkHealth();
    } catch (sendError) {
      if (requestId === requestSequence.current) setError(sendError instanceof Error ? sendError.message : "Koneksi terputus. Coba lagi.");
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
        window.setTimeout(() => textareaRef.current?.focus(), 0);
      }
    }
  };

  const retryMessage = async (message: Message) => {
    if (!supabase || !session || !activeConversationId || loading) return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0 || message.role !== "user") return;
    const history = messages.slice(0, index + 1);
    setLoading(true);
    setError("");
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    try {
      const reply = await askAssistant(history);
      if (requestId !== requestSequence.current) return;
      const { error: deleteError } = await supabase.from("messages")
        .delete().eq("conversation_id", activeConversationId).gt("sequence", message.sequence);
      if (deleteError) throw deleteError;
      const { data: saved, error: insertError } = await supabase.from("messages")
        .insert({ conversation_id: activeConversationId, user_id: session.user.id, role: "assistant", content: reply, sequence: message.sequence + 1 })
        .select("id,role,content,sequence").single();
      if (insertError) throw insertError;
      setMessages([...history, saved as Message]);
      await loadConversations();
    } catch (retryError) {
      if (requestId === requestSequence.current) setError(retryError instanceof Error ? retryError.message : "Pesan belum berhasil dikirim ulang.");
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const saveEditedMessage = async (message: Message) => {
    if (!supabase || !session || !activeConversationId || loading) return;
    const content = editingDraft.trim();
    if (!content) return;
    const index = messages.findIndex((item) => item.id === message.id);
    if (index < 0) return;
    const history = [...messages.slice(0, index), { ...message, content }];
    setLoading(true);
    setError("");
    requestSequence.current += 1;
    const requestId = requestSequence.current;
    try {
      const reply = await askAssistant(history);
      if (requestId !== requestSequence.current) return;
      const { error: updateError } = await supabase.from("messages").update({ content })
        .eq("id", message.id).eq("conversation_id", activeConversationId);
      if (updateError) throw updateError;
      const { error: deleteError } = await supabase.from("messages").delete()
        .eq("conversation_id", activeConversationId).gt("sequence", message.sequence);
      if (deleteError) throw deleteError;
      const { data: saved, error: insertError } = await supabase.from("messages")
        .insert({ conversation_id: activeConversationId, user_id: session.user.id, role: "assistant", content: reply, sequence: message.sequence + 1 })
        .select("id,role,content,sequence").single();
      if (insertError) throw insertError;
      setMessages([...history, saved as Message]);
      setEditingMessageId("");
      await loadConversations();
    } catch (editError) {
      if (requestId === requestSequence.current) setError(editError instanceof Error ? editError.message : "Pesan belum berhasil diperbarui.");
    } finally {
      if (requestId === requestSequence.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  };

  const retryAssistant = async (message: Message) => {
    const index = messages.findIndex((item) => item.id === message.id);
    const previousUser = messages.slice(0, index).reverse().find((item) => item.role === "user");
    if (previousUser) await retryMessage(previousUser);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const clearChat = () => {
    requestSequence.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setMessages([]);
    setDraft("");
    setActiveConversationId("");
    setEditingMessageId("");
    setError("");
    setLoading(false);
    textareaRef.current?.focus();
  };

  const signOut = async () => {
    if (!supabase) return;
    requestSequence.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setLoading(false);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(`Gagal keluar: ${signOutError.message}`);
  };

  const saveAssistantName = () => {
    const name = nameDraft.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name || !/^[\p{L}\p{N} _.-]+$/u.test(name)) {
      setError("Gunakan huruf, angka, spasi, titik, tanda hubung, atau garis bawah untuk nama AI.");
      return;
    }
    setAssistantName(name);
    if (session) window.localStorage.setItem(`temanai-assistant-name:${session.user.id}`, name);
    setSettingsOpen(false);
  };

  const saveUserName = () => {
    const name = userNameDraft.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name || !/^[\p{L}\p{N} _.-]+$/u.test(name)) {
      setError("Gunakan huruf, angka, spasi, titik, tanda hubung, atau garis bawah untuk nama profil.");
      return;
    }
    setUserName(name);
    if (session) window.localStorage.setItem(`temanai-user-name:${session.user.id}`, name);
    setSettingsOpen(false);
  };

  const saveProfileSettings = () => {
    const profile = userNameDraft.trim().replace(/\s+/g, " ").slice(0, 40);
    const assistant = nameDraft.trim().replace(/\s+/g, " ").slice(0, 40);
    const validName = /^[\p{L}\p{N} _.-]+$/u;
    if (!profile || !validName.test(profile) || !assistant || !validName.test(assistant)) {
      setError("Nama profil dan nama AI wajib diisi dengan huruf, angka, spasi, titik, tanda hubung, atau garis bawah.");
      return;
    }
    setUserName(profile);
    setAssistantName(assistant);
    if (session) {
      window.localStorage.setItem(`temanai-user-name:${session.user.id}`, profile);
      window.localStorage.setItem(`temanai-assistant-name:${session.user.id}`, assistant);
    }
    setSettingsOpen(false);
  };

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setError("Pesan tidak dapat disalin di browser ini.");
    }
  };

  const statusLabels: Record<ServiceStatus, string> = {
    checking: "Menghubungkan",
    online: "Siap membantu",
    "no-key": "API belum diatur",
    offline: "Tidak terhubung",
  };

  if (!authReady) return <main className="auth-shell"><div className="auth-loading">Memuat sesi...</div></main>;
  if (!session) return <AuthScreen />;

  return (
    <main className="app-shell">
      {settingsOpen && (
        <div className="settings-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <button className="settings-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Tutup pengaturan">×</button>
            <p className="auth-eyebrow">PREFERENSI</p>
            <h2 id="settings-title">Pengaturan profil</h2>
            <label htmlFor="user-name">Nama profil</label>
            <input id="user-name" value={userNameDraft} maxLength={40} onChange={(event) => setUserNameDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") saveUserName();
            }} autoFocus />
            <p className="settings-help">Nama ini ditampilkan pada pesan dan profilmu, menggantikan label generik “Kamu”.</p>
            <label htmlFor="assistant-name">Nama tampilan AI</label>
            <input id="assistant-name" value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter") saveAssistantName();
            }} />
            <p className="settings-help">Nama ini ditampilkan di percakapan dan digunakan saat AI memperkenalkan diri. Hanya disimpan di browser akun ini.</p>
            <div className="settings-actions">
              <button type="button" onClick={() => setSettingsOpen(false)}>Batal</button>
              <button type="button" onClick={saveProfileSettings}>Simpan nama</button>
            </div>
          </section>
        </div>
      )}
      {sidebarOpen && <button className="sidebar-backdrop" type="button" aria-label="Tutup menu" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" href="/" aria-label="TemanAI beranda">
          <span className="brand-mark"><Icon name="spark" size={21} /></span>
          <span>teman<span className="brand-ai">ai</span></span>
        </Link>

        <button className="new-chat-button" type="button" onClick={() => { clearChat(); setSidebarOpen(false); }}>
          <Icon name="plus" size={18} />
          <span>Percakapan baru</span>
          <span className="shortcut">⌘ K</span>
        </button>

        <div className="sidebar-section">
          <p className="section-label">RIWAYAT OBROLAN</p>
          <div className="history-list">
            {conversations.length === 0 ? (
              <p className="history-hint">Percakapanmu akan tersimpan di sini.</p>
            ) : conversations.map((conversation) => (
              <button
                className={`history-item ${activeConversationId === conversation.id ? "active" : ""}`}
                key={conversation.id}
                type="button"
                onClick={() => void loadConversation(conversation.id)}
              >
                <Icon name="message" size={15} />
                <span>{conversation.title}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon"><Icon name="spark" size={16} /></span>
            <div>
              <strong>Ruang untuk ide.</strong>
              <p>{userName}</p>
            </div>
          </div>
          <div className={`connection ${status}`}>
            <span className="status-dot" />
            <span>{statusLabels[status]}</span>
            <button className="refresh-status" type="button" onClick={() => void checkHealth()} aria-label="Periksa koneksi">
              <span>↻</span>
            </button>
          </div>
          <button className="signout-button" type="button" onClick={() => { setNameDraft(assistantName); setUserNameDraft(userName); setSettingsOpen(true); }}>Pengaturan profil & nama AI</button>
          <button className="signout-button theme-toggle" type="button" onClick={() => setDarkMode((current) => !current)}>
            {darkMode ? "☀  Tema terang" : "☾  Tema gelap"}
          </button>
          <button className="signout-button" type="button" onClick={() => void signOut()}>Keluar dari akun</button>
        </div>
      </aside>

      <section className="chat-panel">
        <header className="topbar">
          <button className="mobile-menu-button" type="button" aria-label="Buka riwayat obrolan" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="mobile-brand">
            <span className="brand-mark"><Icon name="spark" size={18} /></span>
            <span>teman<span className="brand-ai">ai</span></span>
          </div>
          <div className="model-pill"><span className="model-indicator" /> {assistantName} <Icon name="chevron" size={14} /></div>
          <div className="topbar-actions">
            <button className="theme-toggle-icon" type="button" aria-label={darkMode ? "Aktifkan tema terang" : "Aktifkan tema gelap"} onClick={() => setDarkMode((current) => !current)}>
              {darkMode ? "☀" : "☾"}
            </button>
            <button className="settings-toggle-icon" type="button" aria-label="Pengaturan nama AI" onClick={() => { setNameDraft(assistantName); setSettingsOpen(true); }}>⚙</button>
            <button className="clear-button" type="button" onClick={clearChat}>
              <Icon name="plus" size={16} />
              <span>Obrolan baru</span>
            </button>
          </div>
        </header>

        <div className={`conversation ${messages.length === 0 ? "is-empty" : ""}`}>
          {messages.length === 0 ? (
            <div className="welcome">
              <div className="welcome-orb"><Icon name="spark" size={25} /></div>
              <div className="eyebrow"><span /> ASISTEN AI, DALAM BAHASAMU</div>
              <h1>Halo, senang<br className="mobile-break" /> bertemu <span>kamu.</span></h1>
              <p className="welcome-copy">Punya ide, pertanyaan, atau sekadar ingin ngobrol?<br className="desktop-break" /> Aku di sini untuk bantu kamu memulai.</p>

              <div className="suggestion-grid">
                {suggestions.map((item) => (
                  <button className="suggestion-card" key={item.title} type="button" onClick={() => void sendMessage(item.prompt)}>
                    <span className="suggestion-icon">{item.icon}</span>
                    <span className="suggestion-copy"><strong>{item.title}</strong><small>{item.prompt}</small></span>
                    <Icon name="arrow" size={15} />
                  </button>
                ))}
              </div>
              <span className="welcome-footnote"><span className="tiny-spark">✳</span> Dibuat untuk percakapan yang terasa lebih dekat.</span>
            </div>
          ) : (
            <div className="message-list" aria-live="polite">
              {messages.map((message) => (
                <article className={`message-row ${message.role}`} key={message.id}>
                  {message.role === "assistant" ? (
                    <div className="assistant-avatar"><Icon name="spark" size={15} /></div>
                  ) : <div className="user-avatar">{userName.charAt(0).toLocaleUpperCase("id")}</div>}
                  <div className="message-body">
                    <div className="message-meta">{message.role === "assistant" ? assistantName : userName}</div>
                    {editingMessageId === message.id ? (
                      <div className="edit-message">
                        <textarea aria-label="Edit pesan" value={editingDraft} onChange={(event) => setEditingDraft(event.target.value)} />
                        <div>
                          <button type="button" onClick={() => { setEditingMessageId(""); setEditingDraft(""); }}>Batal</button>
                          <button type="button" disabled={!editingDraft.trim() || loading} onClick={() => void saveEditedMessage(message)}>Simpan & kirim ulang</button>
                        </div>
                      </div>
                    ) : (
                      <div className="message-content">
                        {message.role === "assistant" ? renderFormattedText(message.content) : message.content}
                      </div>
                    )}
                    {message.role === "assistant" && (
                      <div className="message-actions">
                        <button className="copy-button" type="button" onClick={() => void copyMessage(message)}>
                          <Icon name="copy" size={13} /> {copiedId === message.id ? "Tersalin" : "Salin"}
                        </button>
                        <button className="copy-button" type="button" disabled={loading} onClick={() => void retryAssistant(message)}>Jawab ulang</button>
                      </div>
                    )}
                    {message.role === "user" && editingMessageId !== message.id && (
                      <div className="message-actions">
                        <button className="copy-button" type="button" disabled={loading} onClick={() => { setEditingMessageId(message.id); setEditingDraft(message.content); }}>Edit</button>
                        <button className="copy-button" type="button" disabled={loading} onClick={() => void retryMessage(message)}>Kirim ulang</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {loading && (
                <article className="message-row assistant">
                  <div className="assistant-avatar"><Icon name="spark" size={15} /></div>
                  <div className="message-body">
                    <div className="message-meta">{assistantName}</div>
                    <div className="typing-indicator" aria-label="TemanAI sedang mengetik"><i /><i /><i /></div>
                  </div>
                </article>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && (
            <div className="error-notice" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")} aria-label="Tutup pesan error">×</button>
            </div>
          )}
          {status === "no-key" && (
            <div className="setup-notice">Backend aktif, tetapi belum ada provider AI. Atur satu API key AI di <code>backend/.env</code>.</div>
          )}
          {status === "offline" && (
            <div className="setup-notice">Backend belum terhubung. Pastikan server Go berjalan di <code>localhost:8080</code>.</div>
          )}
          <form className="composer" onSubmit={submit}>
            <textarea
              ref={textareaRef}
              rows={1}
              aria-label="Tulis pesan"
              placeholder="Tulis apa pun yang ada di pikiranmu…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <div className="composer-footer">
              <span className="composer-tip"><span>↵</span> kirim <b>·</b> <span>⇧ ↵</span> baris baru</span>
              <button className="send-button" type="submit" disabled={!draft.trim() || loading} aria-label="Kirim pesan">
                <Icon name="send" size={17} />
              </button>
            </div>
          </form>
          <p className="disclaimer">TemanAI bisa membuat kekeliruan. Periksa kembali informasi penting.</p>
        </div>
      </section>
    </main>
  );
}
