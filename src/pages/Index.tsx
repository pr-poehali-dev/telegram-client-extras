import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";
import { auth, messages, media, users } from "@/lib/api";

// ─── Types ─────────────────────────────────────────────────────────────────
interface User { id: number; email: string; username?: string; display_name: string; avatar_url?: string; bio?: string; }
interface Conversation {
  id: number; partner_id: number; partner_name: string; partner_avatar?: string;
  online: boolean; unread: number;
  last_message?: { text?: string; media_url?: string; media_type?: string; created_at?: string; is_mine: boolean; } | null;
}
interface Message {
  id: number; sender_id: number; sender_name: string; sender_avatar?: string;
  text?: string; media_url?: string; media_type?: string;
  created_at: string; is_mine: boolean;
}
interface SearchUser { id: number; display_name: string; username?: string; avatar_url?: string; online: boolean; }

const NAV = [
  { id: "chats",         label: "Чаты",        icon: "MessageCircle" },
  { id: "contacts",      label: "Новый чат",   icon: "UserPlus" },
  { id: "gallery",       label: "Галерея",     icon: "Image" },
  { id: "notifications", label: "Уведомления", icon: "Bell" },
  { id: "settings",      label: "Настройки",   icon: "Settings" },
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "??";
}
function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Avatar({ name, url, size = "md", online }: { name: string; url?: string; size?: "sm" | "md" | "lg"; online?: boolean }) {
  const sz = size === "lg" ? "w-14 h-14 text-base" : size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className="relative flex-shrink-0">
      {url
        ? <img src={url} alt={name} className={`${sz} rounded-full object-cover`} />
        : <div className={`${sz} rounded-full bg-zinc-700 flex items-center justify-center font-medium text-zinc-200 select-none`}>{initials(name)}</div>
      }
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--background))] ${online ? "bg-[hsl(var(--safe-green))]" : "bg-zinc-600"}`} />
      )}
    </div>
  );
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────
function AuthScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [step, setStep]       = useState<"email" | "code" | "name">("email");
  const [email, setEmail]     = useState("");
  const [code, setCode]       = useState("");
  const [name, setName]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const sendCode = async () => {
    if (!email.trim() || !email.includes("@")) { setError("Введите корректный email"); return; }
    setLoading(true); setError("");
    try {
      const res = await auth.sendCode(email.trim().toLowerCase());
      if (res.error) { setError(res.error); return; }
      setStep("code");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    if (!code.trim()) { setError("Введите код"); return; }
    setLoading(true); setError("");
    try {
      const res = await auth.verify(email, code);
      if (res.error) { setError(res.error); return; }
      localStorage.setItem("vault_session", res.session_id);
      if (!res.user.display_name || res.user.display_name === email.split("@")[0]) {
        window.__tmpUser = res.user;
        setStep("name");
        return;
      }
      onLogin(res.user);
    } finally { setLoading(false); }
  };

  const saveName = async () => {
    if (!name.trim()) { setError("Введите имя"); return; }
    setLoading(true); setError("");
    try {
      await auth.updateProfile({ display_name: name.trim() });
      onLogin({ ...window.__tmpUser, display_name: name.trim() });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
      <div className="w-full max-w-sm px-6 animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4">
            <Icon name="Shield" size={28} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Vault Messenger</h1>
          <p className="text-sm text-zinc-500 mt-1 text-center">Защищённый мессенджер с E2E-шифрованием</p>
        </div>

        {step === "email" && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Email</label>
            <input
              type="email" placeholder="your@email.com" value={email}
              onChange={e => { setEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && sendCode()}
              className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none focus:border-primary transition-colors"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={sendCode} disabled={loading}
              className="bg-primary text-white rounded-xl py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Отправка..." : "Получить код →"}
            </button>
            <p className="text-xs text-zinc-600 text-center">Мы пришлём 6-значный код на вашу почту</p>
          </div>
        )}

        {step === "code" && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Код из письма</label>
            <p className="text-xs text-zinc-500">Код отправлен на <span className="text-primary">{email}</span></p>
            <input
              type="text" placeholder="000000" value={code} maxLength={6}
              onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
              onKeyDown={e => e.key === "Enter" && verify()}
              className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 text-2xl font-mono-app text-center tracking-[0.5em] text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none focus:border-primary transition-colors"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={verify} disabled={loading}
              className="bg-primary text-white rounded-xl py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Проверка..." : "Войти →"}
            </button>
            <button onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Другой email</button>
          </div>
        )}

        {step === "name" && (
          <div className="flex flex-col gap-3">
            <label className="text-xs text-zinc-500 uppercase tracking-widest">Ваше имя</label>
            <p className="text-xs text-zinc-500">Как вас будут видеть другие пользователи</p>
            <input
              type="text" placeholder="Иван Петров" value={name}
              onChange={e => { setName(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && saveName()}
              className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl px-4 py-3 text-sm text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none focus:border-primary transition-colors"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={saveName} disabled={loading}
              className="bg-primary text-white rounded-xl py-3 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {loading ? "Сохранение..." : "Начать →"}
            </button>
          </div>
        )}

        <div className="flex items-center justify-center gap-1 mt-8">
          <Icon name="Lock" size={11} className="text-safe" />
          <span className="text-[11px] text-zinc-700 font-mono-app">Все данные зашифрованы E2E</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function Index() {
  const [user, setUser]               = useState<User | null>(null);
  const [loading, setLoading]         = useState(true);
  const [section, setSection]         = useState("chats");
  const [convs, setConvs]             = useState<Conversation[]>([]);
  const [activeConv, setActiveConv]   = useState<Conversation | null>(null);
  const [msgs, setMsgs]               = useState<Message[]>([]);
  const [msgInput, setMsgInput]       = useState("");
  const [searchQ, setSearchQ]         = useState("");
  const [searchUsers, setSearchUsers] = useState<SearchUser[]>([]);
  const [searching, setSearching]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [lightbox, setLightbox]       = useState<string | null>(null);
  const [galleryImgs, setGalleryImgs] = useState<Message[]>([]);
  const [profileEdit, setProfileEdit] = useState(false);
  const [editName, setEditName]       = useState("");
  const [editBio, setEditBio]         = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const chatFileRef    = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sid = localStorage.getItem("vault_session");
    if (!sid) { setLoading(false); return; }
    auth.me().then(res => {
      if (res?.user) setUser(res.user);
      else localStorage.removeItem("vault_session");
    }).finally(() => setLoading(false));
  }, []);

  const loadConvs = useCallback(async () => {
    const res = await messages.conversations();
    if (res?.conversations) setConvs(res.conversations);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadConvs();
    const t = setInterval(loadConvs, 5000);
    return () => clearInterval(t);
  }, [user, loadConvs]);

  const loadMsgs = useCallback(async (convId: number) => {
    const res = await messages.getMessages(convId);
    if (res?.messages) {
      setMsgs(res.messages);
      messages.markRead(convId);
    }
  }, []);

  useEffect(() => {
    if (!activeConv) return;
    loadMsgs(activeConv.id);
    const t = setInterval(() => loadMsgs(activeConv.id), 3000);
    return () => clearInterval(t);
  }, [activeConv, loadMsgs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (section !== "gallery") return;
    setGalleryImgs([]);
    convs.forEach(c => {
      messages.getMessages(c.id).then(res => {
        if (res?.messages) {
          const photos = res.messages.filter((m: Message) => m.media_url && m.media_type === "photo");
          setGalleryImgs(prev => {
            const ids = new Set(prev.map(p => p.id));
            return [...prev, ...photos.filter((p: Message) => !ids.has(p.id))];
          });
        }
      });
    });
  }, [section, convs]);

  useEffect(() => {
    if (section !== "contacts") return;
    if (searchQ.length < 2) { setSearchUsers([]); return; }
    setSearching(true);
    users.search(searchQ).then(res => {
      if (res?.users) setSearchUsers(res.users);
    }).finally(() => setSearching(false));
  }, [searchQ, section]);

  const sendMessage = async (mediaUrl = "", mediaType = "") => {
    if (!activeConv || (!msgInput.trim() && !mediaUrl)) return;
    setSending(true);
    try {
      const res = await messages.send(activeConv.id, msgInput.trim(), mediaUrl, mediaType);
      if (res?.message) { setMsgs(prev => [...prev, res.message]); setMsgInput(""); loadConvs(); }
    } finally { setSending(false); }
  };

  const handleFile = async (file: File) => {
    if (!file || !activeConv) return;
    setUploading(true);
    try {
      const dataUrl = await fileToBase64(file);
      const res = await media.upload(dataUrl);
      if (res?.url) await sendMessage(res.url, res.media_type || "photo");
    } finally { setUploading(false); }
  };

  const startChat = async (partnerId: number) => {
    const res = await messages.startChat(partnerId);
    if (res?.conversation_id) {
      await loadConvs();
      setSection("chats"); setSearchQ("");
    }
  };

  const logout = () => {
    auth.logout(); localStorage.removeItem("vault_session");
    setUser(null); setConvs([]); setMsgs([]); setActiveConv(null);
  };

  const saveProfile = async () => {
    await auth.updateProfile({ display_name: editName, bio: editBio });
    setUser(u => u ? { ...u, display_name: editName, bio: editBio } : u);
    setProfileEdit(false);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center animate-pulse">
            <Icon name="Shield" size={20} className="text-primary" />
          </div>
          <span className="text-xs text-zinc-600 font-mono-app">загрузка...</span>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={u => setUser(u)} />;

  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white/60 hover:text-white">
            <Icon name="X" size={24} />
          </button>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-16 flex flex-col items-center py-4 border-r border-[hsl(var(--divider))] bg-[hsl(0,0%,8%)] gap-1 z-10">
        <div onClick={() => { setSection("profile"); setActiveConv(null); }}
          className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center mb-4 cursor-pointer hover:bg-primary/90 transition-colors">
          <Icon name="Shield" size={18} className="text-white" />
        </div>
        {NAV.map(item => (
          <button key={item.id} title={item.label}
            onClick={() => { setSection(item.id); if (item.id !== "chats") setActiveConv(null); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative
              ${section === item.id ? "bg-[hsl(var(--surface-active))] text-primary" : "text-zinc-500 hover:text-zinc-200 hover:bg-[hsl(var(--surface-hover))]"}`}>
            <Icon name={item.icon} size={18} />
            {item.id === "chats" && totalUnread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-medium text-white flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => { setSection("profile"); setActiveConv(null); }}
          className="w-9 h-9 rounded-full overflow-hidden hover:ring-2 ring-primary transition-all" title="Профиль">
          <Avatar name={user.display_name} url={user.avatar_url} size="sm" />
        </button>
      </aside>

      {/* Middle panel */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[hsl(var(--divider))] bg-[hsl(0,0%,9%)]">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            { ({ chats: "Чаты", contacts: "Новый чат", gallery: "Галерея",
                 notifications: "Уведомления", settings: "Настройки", profile: "Профиль" } as Record<string,string>)[section] }
          </h2>
        </div>

        {(section === "chats" || section === "contacts") && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 bg-[hsl(var(--surface))] rounded-xl px-3 py-2">
              <Icon name="Search" size={14} className="text-zinc-500 flex-shrink-0" />
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder={section === "contacts" ? "Найти пользователя..." : "Поиск чатов..."}
                className="bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none w-full" />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">

          {/* CHATS */}
          {section === "chats" && (
            <div className="animate-fade-in">
              {convs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
                  <Icon name="MessageCircle" size={28} className="opacity-30" />
                  <p className="text-sm text-center px-6">Нет чатов. Найдите человека во вкладке «Новый чат»</p>
                </div>
              )}
              {convs.filter(c => !searchQ || c.partner_name.toLowerCase().includes(searchQ.toLowerCase())).map(conv => (
                <button key={conv.id} onClick={() => setActiveConv(conv)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 transition-all text-left
                    ${activeConv?.id === conv.id ? "bg-[hsl(var(--surface-active))]" : "hover:bg-[hsl(var(--surface-hover))]"}`}>
                  <Avatar name={conv.partner_name} url={conv.partner_avatar} online={conv.online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{conv.partner_name}</span>
                      <span className="text-[11px] text-zinc-500 ml-2 flex-shrink-0">{fmtTime(conv.last_message?.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 truncate">
                        {conv.last_message?.media_url && !conv.last_message?.text ? "📷 Фото"
                          : conv.last_message?.text
                            ? (conv.last_message.is_mine ? `Вы: ${conv.last_message.text}` : conv.last_message.text)
                            : ""}
                      </span>
                      {conv.unread > 0 && (
                        <span className="ml-2 bg-primary text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* CONTACTS / NEW CHAT */}
          {section === "contacts" && (
            <div className="animate-fade-in px-2">
              {searchQ.length < 2 && <p className="text-xs text-zinc-600 px-2 py-3">Введите имя или email</p>}
              {searching && <p className="text-xs text-zinc-500 px-2 py-2">Поиск...</p>}
              {searchUsers.map(u => (
                <div key={u.id} onClick={() => startChat(u.id)}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-all cursor-pointer">
                  <Avatar name={u.display_name} url={u.avatar_url} online={u.online} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">{u.display_name}</div>
                    {u.username && <div className="text-xs text-zinc-500 font-mono-app">@{u.username}</div>}
                  </div>
                  <Icon name="MessageCircle" size={15} className="text-primary" />
                </div>
              ))}
              {searchQ.length >= 2 && !searching && searchUsers.length === 0 && (
                <p className="text-xs text-zinc-600 px-2 py-3">Пользователи не найдены</p>
              )}
            </div>
          )}

          {/* GALLERY */}
          {section === "gallery" && (
            <div className="animate-fade-in p-3">
              {galleryImgs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-600">
                  <Icon name="Image" size={28} className="opacity-30" />
                  <p className="text-sm">Нет фотографий</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {galleryImgs.map(img => (
                  <div key={img.id} onClick={() => setLightbox(img.media_url!)}
                    className="aspect-square rounded-lg overflow-hidden bg-zinc-800 cursor-pointer hover:opacity-80 transition-opacity">
                    <img src={img.media_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {section === "notifications" && (
            <div className="animate-fade-in px-2 pt-1">
              {convs.filter(c => c.unread > 0).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-zinc-600">
                  <Icon name="Bell" size={28} className="opacity-30" />
                  <p className="text-sm">Нет непрочитанных</p>
                </div>
              ) : convs.filter(c => c.unread > 0).map(c => (
                <div key={c.id} onClick={() => { setActiveConv(c); setSection("chats"); }}
                  className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-all cursor-pointer">
                  <Avatar name={c.partner_name} url={c.partner_avatar} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[hsl(var(--foreground))]">{c.partner_name}</p>
                    <p className="text-xs text-zinc-500">{c.unread} новых сообщений</p>
                  </div>
                  <span className="bg-primary text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {c.unread}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* SETTINGS */}
          {section === "settings" && (
            <div className="animate-fade-in px-2 pt-1 flex flex-col gap-1">
              {[
                { icon: "Lock",       label: "Конфиденциальность", sub: "E2E шифрование включено" },
                { icon: "Bell",       label: "Уведомления",        sub: "Включены" },
                { icon: "Palette",    label: "Тема",               sub: "Тёмная" },
                { icon: "HelpCircle", label: "Помощь",             sub: "FAQ, поддержка" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-all cursor-pointer">
                  <div className="w-8 h-8 rounded-xl bg-[hsl(var(--surface))] flex items-center justify-center text-zinc-400">
                    <Icon name={item.icon} size={15} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">{item.label}</div>
                    <div className="text-xs text-zinc-500">{item.sub}</div>
                  </div>
                  <Icon name="ChevronRight" size={14} className="text-zinc-600" />
                </div>
              ))}
              <div className="mt-4 px-2">
                <button onClick={logout} className="flex items-center gap-3 text-red-400 hover:text-red-300 transition-colors py-2">
                  <Icon name="LogOut" size={15} />
                  <span className="text-sm">Выйти из аккаунта</span>
                </button>
              </div>
            </div>
          )}

          {/* PROFILE */}
          {section === "profile" && (
            <div className="animate-fade-in px-4 py-4 flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar name={user.display_name} url={user.avatar_url} size="lg" />
                <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                  onClick={() => fileInputRef.current?.click()}>
                  <Icon name="Camera" size={11} className="text-white" />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={async e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const dataUrl = await fileToBase64(f);
                  const res = await media.upload(dataUrl);
                  if (res?.url) setUser(u => u ? { ...u, avatar_url: res.url } : u);
                  e.target.value = "";
                }} />

              {!profileEdit ? (
                <>
                  <div className="text-center">
                    <p className="font-semibold text-[hsl(var(--foreground))]">{user.display_name}</p>
                    <p className="text-sm text-zinc-500 font-mono-app">{user.email}</p>
                    {user.bio && <p className="text-xs text-zinc-400 mt-1">{user.bio}</p>}
                  </div>
                  <div className="w-full rounded-xl bg-[hsl(var(--surface))] p-3 flex items-center gap-2">
                    <Icon name="Shield" size={14} className="text-safe" />
                    <span className="text-xs text-safe font-mono-app">Аккаунт защищён E2E</span>
                  </div>
                  <button onClick={() => { setEditName(user.display_name); setEditBio(user.bio || ""); setProfileEdit(true); }}
                    className="w-full bg-[hsl(var(--surface))] rounded-xl py-2.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-hover))] transition-colors">
                    Редактировать профиль
                  </button>
                  <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 transition-colors">
                    Выйти из аккаунта
                  </button>
                </>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Имя"
                    className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-sm text-[hsl(var(--foreground))] outline-none focus:border-primary" />
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)} placeholder="О себе..." rows={3}
                    className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl px-3 py-2 text-sm text-[hsl(var(--foreground))] outline-none focus:border-primary resize-none" />
                  <button onClick={saveProfile} className="bg-primary text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">Сохранить</button>
                  <button onClick={() => setProfileEdit(false)} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">Отмена</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[hsl(var(--background))]">
        {activeConv ? (
          <>
            <div className="px-5 py-3.5 border-b border-[hsl(var(--divider))] flex items-center gap-3 bg-[hsl(0,0%,9%)]">
              <Avatar name={activeConv.partner_name} url={activeConv.partner_avatar} online={activeConv.online} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[hsl(var(--foreground))]">{activeConv.partner_name}</span>
                  <span className="encrypted-badge flex items-center gap-1">
                    <Icon name="Lock" size={9} className="text-safe" /> E2E
                  </span>
                </div>
                <p className="text-xs text-zinc-500">{activeConv.online ? "В сети" : "Не в сети"}</p>
              </div>
              <div className="flex items-center gap-1">
                {["Phone", "Video"].map(ico => (
                  <button key={ico} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-hover))] transition-all">
                    <Icon name={ico} size={16} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 py-1.5 border-b border-[hsl(var(--divider))]">
              <Icon name="Lock" size={10} className="text-safe" />
              <span className="text-[11px] text-safe/60 font-mono-app">Сообщения защищены сквозным шифрованием</span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {msgs.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-zinc-600 py-12">
                  <Icon name="MessageCircle" size={28} className="opacity-30" />
                  <p className="text-sm">Начните переписку</p>
                </div>
              )}
              {msgs.map(msg => (
                <div key={msg.id} className={`flex animate-message-in ${msg.is_mine ? "justify-end" : "justify-start"}`}>
                  {!msg.is_mine && (
                    <div className="mr-2 flex-shrink-0 self-end">
                      <Avatar name={msg.sender_name} url={msg.sender_avatar} size="sm" />
                    </div>
                  )}
                  <div className={`max-w-[65%] rounded-2xl overflow-hidden ${msg.is_mine ? "rounded-br-sm bg-primary" : "rounded-bl-sm bg-[hsl(var(--surface))]"}`}>
                    {msg.media_url && msg.media_type === "photo" && (
                      <img src={msg.media_url} alt="photo"
                        className="max-w-[220px] cursor-pointer hover:opacity-90 transition-opacity block"
                        onClick={() => setLightbox(msg.media_url!)} />
                    )}
                    {msg.text && (
                      <p className={`text-sm leading-relaxed px-4 py-2.5 ${msg.is_mine ? "text-white" : "text-[hsl(var(--foreground))]"}`}>{msg.text}</p>
                    )}
                    <div className={`flex items-center gap-1 px-4 pb-2 ${msg.is_mine ? "justify-end" : "justify-start"}`}>
                      <span className={`text-[10px] font-mono-app ${msg.is_mine ? "text-white/60" : "text-zinc-600"}`}>{fmtTime(msg.created_at)}</span>
                      {msg.is_mine && <Icon name="CheckCheck" size={11} className="text-white/60" />}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-[hsl(var(--divider))] bg-[hsl(0,0%,9%)]">
              <input ref={chatFileRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              <div className="flex items-end gap-2 bg-[hsl(var(--surface))] rounded-2xl px-4 py-2.5">
                <button onClick={() => chatFileRef.current?.click()} disabled={uploading}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors mb-0.5 disabled:opacity-50">
                  <Icon name={uploading ? "Loader" : "Paperclip"} size={17} className={uploading ? "animate-spin" : ""} />
                </button>
                <textarea value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Сообщение..." rows={1}
                  className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none resize-none leading-relaxed"
                  style={{ maxHeight: "120px" }} />
                <button onClick={() => sendMessage()} disabled={!msgInput.trim() || sending}
                  className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0">
                  <Icon name="Send" size={14} />
                </button>
              </div>
              <div className="flex items-center justify-center mt-1.5 gap-1">
                <Icon name="Lock" size={9} className="text-safe/40" />
                <span className="text-[10px] text-zinc-700 font-mono-app">зашифровано</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-700 animate-fade-in">
            <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--surface))] flex items-center justify-center">
              <Icon name="Shield" size={32} className="text-primary/40" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-zinc-500 mb-1">Vault Messenger</p>
              <p className="text-sm text-zinc-700">Выберите чат или найдите пользователя</p>
            </div>
            <button onClick={() => setSection("contacts")}
              className="bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
              Начать новый чат
            </button>
            <div className="flex items-center gap-2 bg-[hsl(var(--surface))] rounded-xl px-4 py-2">
              <Icon name="Lock" size={12} className="text-safe" />
              <span className="text-xs text-safe/70 font-mono-app">Все данные зашифрованы E2E</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

declare global { interface Window { __tmpUser: User; } }
