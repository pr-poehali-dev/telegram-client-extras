import { useState } from "react";
import Icon from "@/components/ui/icon";

const NAV_ITEMS = [
  { id: "chats",         label: "Чаты",          icon: "MessageCircle" },
  { id: "contacts",      label: "Контакты",       icon: "Users" },
  { id: "archive",       label: "Архив",          icon: "Archive" },
  { id: "gallery",       label: "Галерея",        icon: "Image" },
  { id: "notifications", label: "Уведомления",    icon: "Bell" },
  { id: "settings",      label: "Настройки",      icon: "Settings" },
];

const CHATS = [
  { id: 1, name: "Алекс Морозов",    avatar: "АМ", msg: "Хорошо, завтра в 10:00",           time: "22:14", unread: 2, online: true,  encrypted: true },
  { id: 2, name: "Дизайн-группа",   avatar: "ДГ", msg: "Файлы отправил",                     time: "21:55", unread: 0, online: false, encrypted: true },
  { id: 3, name: "Мария Соколова",  avatar: "МС", msg: "Посмотри документ, пожалуйста",      time: "20:30", unread: 5, online: true,  encrypted: true },
  { id: 4, name: "Иван Петров",     avatar: "ИП", msg: "Готово 👍",                           time: "18:02", unread: 0, online: false, encrypted: true },
  { id: 5, name: "Команда проекта", avatar: "КП", msg: "Встреча перенесена на пятницу",       time: "Вчера", unread: 0, online: false, encrypted: true },
  { id: 6, name: "Ольга Белова",    avatar: "ОБ", msg: "Спасибо за помощь!",                  time: "Вчера", unread: 0, online: true,  encrypted: true },
  { id: 7, name: "Сервис поддержки",avatar: "СП", msg: "Ваш запрос обработан",                time: "Пн",    unread: 0, online: false, encrypted: false },
];

const MESSAGES: Record<number, { id: number; from: "me" | "them"; text: string; time: string }[]> = {
  1: [
    { id: 1, from: "them", text: "Привет! Ты сможешь подъехать завтра?",  time: "22:10" },
    { id: 2, from: "me",   text: "Да, конечно. Во сколько?",              time: "22:12" },
    { id: 3, from: "them", text: "Хорошо, завтра в 10:00",                time: "22:14" },
  ],
  3: [
    { id: 1, from: "them", text: "Посмотри документ, пожалуйста. Нужна правка в разделе 3.", time: "20:28" },
    { id: 2, from: "them", text: "Там важные данные по проекту",           time: "20:29" },
    { id: 3, from: "me",   text: "Сейчас посмотрю",                        time: "20:30" },
  ],
};

const CONTACTS = [
  { id: 1, name: "Алекс Морозов",   phone: "+7 999 123-45-67", online: true  },
  { id: 2, name: "Иван Петров",     phone: "+7 915 234-56-78", online: false },
  { id: 3, name: "Мария Соколова",  phone: "+7 926 345-67-89", online: true  },
  { id: 4, name: "Ольга Белова",    phone: "+7 903 456-78-90", online: true  },
  { id: 5, name: "Дмитрий Козлов",  phone: "+7 968 567-89-01", online: false },
  { id: 6, name: "Светлана Новак",  phone: "+7 977 678-90-12", online: false },
];

const NOTIFICATIONS = [
  { id: 1, icon: "MessageCircle", text: "Новое сообщение от Алекс Морозов",     time: "22:14", color: "text-primary" },
  { id: 2, icon: "UserPlus",      text: "Мария Соколова добавила вас в контакты", time: "20:00", color: "text-safe"    },
  { id: 3, icon: "Bell",          text: "Напоминание: встреча в пятницу",        time: "Вчера", color: "text-yellow-400" },
  { id: 4, icon: "Shield",        text: "Ключи шифрования обновлены",            time: "Пн",    color: "text-safe"    },
];

const GALLERY_ITEMS = Array.from({ length: 9 }, (_, i) => ({
  id: i + 1,
  color: ["bg-zinc-700", "bg-zinc-600", "bg-zinc-800"][i % 3],
}));

function Avatar({ initials, size = "md", online }: { initials: string; size?: "sm" | "md" | "lg"; online?: boolean }) {
  const sz = size === "lg" ? "w-14 h-14 text-base" : size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
  return (
    <div className="relative flex-shrink-0">
      <div className={`${sz} rounded-full bg-zinc-700 flex items-center justify-center font-medium text-zinc-200 select-none`}>
        {initials}
      </div>
      {online !== undefined && (
        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[hsl(var(--background))] ${online ? "bg-[hsl(var(--safe-green))]" : "bg-zinc-600"}`} />
      )}
    </div>
  );
}

function EncryptedBadge() {
  return (
    <span className="encrypted-badge flex items-center gap-1">
      <Icon name="Lock" size={9} className="text-safe" />
      E2E
    </span>
  );
}

export default function Index() {
  const [section, setSection]         = useState("chats");
  const [activeChat, setActiveChat]   = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [msgInput, setMsgInput]       = useState("");
  const [messages, setMessages]       = useState(MESSAGES);

  const currentChat  = CHATS.find(c => c.id === activeChat);
  const chatMessages = activeChat ? (messages[activeChat] || []) : [];

  const filteredChats = CHATS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.msg.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendMessage = () => {
    if (!msgInput.trim() || !activeChat) return;
    const now  = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
    setMessages(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), { id: Date.now(), from: "me", text: msgInput.trim(), time }],
    }));
    setMsgInput("");
  };

  const goSection = (id: string) => {
    setSection(id);
    setActiveChat(null);
    setSearchQuery("");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[hsl(var(--background))]">

      {/* ── Sidebar ── */}
      <aside className="w-16 flex flex-col items-center py-4 border-r border-[hsl(var(--divider))] bg-[hsl(0,0%,8%)] gap-1 z-10">
        <div
          onClick={() => goSection("profile")}
          className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center mb-4 cursor-pointer hover:bg-primary/90 transition-colors"
        >
          <Icon name="Shield" size={18} className="text-white" />
        </div>

        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => goSection(item.id)}
            title={item.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 relative
              ${section === item.id
                ? "bg-[hsl(var(--surface-active))] text-primary"
                : "text-zinc-500 hover:text-zinc-200 hover:bg-[hsl(var(--surface-hover))]"}`}
          >
            <Icon name={item.icon} size={18} />
            {item.id === "notifications" && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
            )}
            {item.id === "chats" && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-medium text-white flex items-center justify-center">7</span>
            )}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={() => goSection("profile")}
          className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-200 hover:ring-2 ring-primary transition-all"
          title="Профиль"
        >
          ВЫ
        </button>
      </aside>

      {/* ── Middle panel ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-[hsl(var(--divider))] bg-[hsl(0,0%,9%)]">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between">
          <h2 className="font-semibold text-[hsl(var(--foreground))]">
            { { chats: "Чаты", contacts: "Контакты", archive: "Архив", gallery: "Галерея",
                notifications: "Уведомления", settings: "Настройки", profile: "Профиль" }[section] }
          </h2>
          {section === "chats" && (
            <button className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-primary hover:bg-[hsl(var(--surface-hover))] transition-all">
              <Icon name="Plus" size={16} />
            </button>
          )}
        </div>

        {(section === "chats" || section === "contacts") && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 bg-[hsl(var(--surface))] rounded-xl px-3 py-2">
              <Icon name="Search" size={14} className="text-zinc-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none w-full"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">

          {/* CHATS */}
          {section === "chats" && (
            <div className="animate-fade-in">
              {filteredChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => setActiveChat(chat.id)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 transition-all text-left
                    ${activeChat === chat.id ? "bg-[hsl(var(--surface-active))]" : "hover:bg-[hsl(var(--surface-hover))]"}`}
                >
                  <Avatar initials={chat.avatar} online={chat.online} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{chat.name}</span>
                      <span className="text-[11px] text-zinc-500 ml-2 flex-shrink-0">{chat.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 truncate">{chat.msg}</span>
                      {chat.unread > 0 && (
                        <span className="ml-2 bg-primary text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* CONTACTS */}
          {section === "contacts" && (
            <div className="animate-fade-in px-2">
              {CONTACTS.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(contact => (
                <div key={contact.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-all cursor-pointer">
                  <Avatar initials={contact.name.split(" ").map(n => n[0]).join("").slice(0, 2)} online={contact.online} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[hsl(var(--foreground))]">{contact.name}</div>
                    <div className="text-xs text-zinc-500 font-mono-app">{contact.phone}</div>
                  </div>
                  <button className="text-zinc-600 hover:text-primary transition-colors">
                    <Icon name="MessageCircle" size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ARCHIVE */}
          {section === "archive" && (
            <div className="animate-fade-in">
              {CHATS.slice(4).map(chat => (
                <div key={chat.id} className="px-3 py-2.5 flex items-center gap-3 opacity-60 hover:opacity-100 transition-all cursor-pointer hover:bg-[hsl(var(--surface-hover))]">
                  <Avatar initials={chat.avatar} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-medium text-[hsl(var(--foreground))] truncate">{chat.name}</span>
                      <span className="text-[11px] text-zinc-500">{chat.time}</span>
                    </div>
                    <span className="text-xs text-zinc-500 truncate block">{chat.msg}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* GALLERY */}
          {section === "gallery" && (
            <div className="animate-fade-in p-3 grid grid-cols-3 gap-1.5">
              {GALLERY_ITEMS.map(item => (
                <div key={item.id} className={`aspect-square rounded-lg ${item.color} flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity`}>
                  <Icon name="Image" size={20} className="text-zinc-500" />
                </div>
              ))}
            </div>
          )}

          {/* NOTIFICATIONS */}
          {section === "notifications" && (
            <div className="animate-fade-in px-2 pt-1">
              {NOTIFICATIONS.map(n => (
                <div key={n.id} className="flex items-start gap-3 px-2 py-3 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-all cursor-pointer">
                  <div className={`w-8 h-8 rounded-full bg-[hsl(var(--surface))] flex items-center justify-center flex-shrink-0 ${n.color}`}>
                    <Icon name={n.icon} size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[hsl(var(--foreground))] leading-snug">{n.text}</p>
                    <span className="text-xs text-zinc-600">{n.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SETTINGS */}
          {section === "settings" && (
            <div className="animate-fade-in px-2 pt-1 flex flex-col gap-1">
              {[
                { icon: "Lock",       label: "Конфиденциальность", sub: "Шифрование, пароль" },
                { icon: "Bell",       label: "Уведомления",        sub: "Звук, вибрация"     },
                { icon: "Palette",    label: "Внешний вид",        sub: "Тема, шрифт"        },
                { icon: "Wifi",       label: "Сеть и данные",      sub: "VPN, трафик"        },
                { icon: "HelpCircle", label: "Помощь",             sub: "FAQ, поддержка"     },
                { icon: "Info",       label: "О приложении",       sub: "Версия 1.0.0"       },
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
            </div>
          )}

          {/* PROFILE */}
          {section === "profile" && (
            <div className="animate-fade-in px-4 py-4 flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center text-2xl font-semibold text-zinc-200">
                ВЫ
              </div>
              <div className="text-center">
                <p className="font-semibold text-[hsl(var(--foreground))]">Ваш профиль</p>
                <p className="text-sm text-zinc-500 font-mono-app">@username</p>
              </div>
              <div className="w-full rounded-xl bg-[hsl(var(--surface))] p-3 flex items-center gap-2">
                <Icon name="Shield" size={14} className="text-safe" />
                <span className="text-xs text-safe font-mono-app">Аккаунт защищён E2E-шифрованием</span>
              </div>
              <div className="w-full space-y-1">
                {[
                  { icon: "User",     label: "Изменить профиль",   danger: false },
                  { icon: "Lock",     label: "Смена пароля",       danger: false },
                  { icon: "KeyRound", label: "Ключи шифрования",   danger: false },
                  { icon: "LogOut",   label: "Выйти",              danger: true  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[hsl(var(--surface-hover))] transition-all cursor-pointer">
                    <Icon name={item.icon} size={15} className={item.danger ? "text-red-500" : "text-zinc-400"} />
                    <span className={`text-sm ${item.danger ? "text-red-400" : "text-[hsl(var(--foreground))]"}`}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Chat / Main area ── */}
      <div className="flex-1 flex flex-col bg-[hsl(var(--background))]">
        {activeChat && currentChat ? (
          <>
            {/* Chat header */}
            <div className="px-5 py-3.5 border-b border-[hsl(var(--divider))] flex items-center gap-3 bg-[hsl(0,0%,9%)]">
              <Avatar initials={currentChat.avatar} online={currentChat.online} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[hsl(var(--foreground))]">{currentChat.name}</span>
                  {currentChat.encrypted && <EncryptedBadge />}
                </div>
                <p className="text-xs text-zinc-500">{currentChat.online ? "В сети" : "Был(а) недавно"}</p>
              </div>
              <div className="flex items-center gap-1">
                {["Phone", "Video", "Search", "MoreVertical"].map(icon => (
                  <button key={icon} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-500 hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-hover))] transition-all">
                    <Icon name={icon} size={16} />
                  </button>
                ))}
              </div>
            </div>

            {currentChat.encrypted && (
              <div className="flex items-center justify-center gap-2 py-2 border-b border-[hsl(var(--divider))]">
                <Icon name="Lock" size={10} className="text-safe" />
                <span className="text-[11px] text-safe/60 font-mono-app">Сообщения защищены сквозным шифрованием</span>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
              {chatMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
                  <Icon name="MessageCircle" size={32} className="opacity-30" />
                  <p className="text-sm">Нет сообщений. Напишите первым!</p>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} className={`flex animate-message-in ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[65%] rounded-2xl px-4 py-2.5 ${
                      msg.from === "me"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-[hsl(var(--surface))] text-[hsl(var(--foreground))] rounded-bl-sm"
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                      <div className={`flex items-center gap-1 mt-1 ${msg.from === "me" ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[10px] font-mono-app ${msg.from === "me" ? "text-white/60" : "text-zinc-600"}`}>{msg.time}</span>
                        {msg.from === "me" && <Icon name="CheckCheck" size={11} className="text-white/60" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-[hsl(var(--divider))] bg-[hsl(0,0%,9%)]">
              <div className="flex items-end gap-2 bg-[hsl(var(--surface))] rounded-2xl px-4 py-2.5">
                <button className="text-zinc-600 hover:text-zinc-400 transition-colors mb-0.5">
                  <Icon name="Paperclip" size={17} />
                </button>
                <textarea
                  value={msgInput}
                  onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Сообщение..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-[hsl(var(--foreground))] placeholder:text-zinc-600 outline-none resize-none leading-relaxed"
                  style={{ maxHeight: "120px" }}
                />
                <button className="text-zinc-600 hover:text-zinc-400 transition-colors mb-0.5">
                  <Icon name="Smile" size={17} />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!msgInput.trim()}
                  className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-white transition-all hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                >
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
              <p className="text-sm text-zinc-700">Выберите чат, чтобы начать общение</p>
            </div>
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
