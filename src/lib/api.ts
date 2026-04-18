const URLS = {
  auth:     "https://functions.poehali.dev/40455e18-7b58-4df1-8612-915561e3b688",
  messages: "https://functions.poehali.dev/99641ced-4460-4043-9848-18c4c62d7476",
  media:    "https://functions.poehali.dev/abc52631-3739-4dcc-a8cc-6bff1e3b003f",
  users:    "",
};

function getSession(): string {
  return localStorage.getItem("vault_session") || "";
}

function headers(): Record<string, string> {
  return { "Content-Type": "application/json", "X-Session-Id": getSession() };
}

async function req(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// AUTH
export const auth = {
  sendCode: (email: string) =>
    req(`${URLS.auth}/send-code`, "POST", { email }),

  verify: (email: string, code: string, display_name?: string) =>
    req(`${URLS.auth}/verify`, "POST", { email, code, display_name }),

  me: () => req(`${URLS.auth}/me`),

  logout: () => req(`${URLS.auth}/logout`, "POST"),

  updateProfile: (data: { display_name?: string; bio?: string; username?: string }) =>
    req(`${URLS.auth}/update-profile`, "POST", data),
};

// MESSAGES
export const messages = {
  conversations: () => req(`${URLS.messages}/conversations`),

  startChat: (user_id: number) =>
    req(`${URLS.messages}/conversations`, "POST", { user_id }),

  getMessages: (conv_id: number) =>
    req(`${URLS.messages}/conversations/${conv_id}/messages`),

  send: (conversation_id: number, text: string, media_url = "", media_type = "") =>
    req(`${URLS.messages}/messages`, "POST", { conversation_id, text, media_url, media_type }),

  markRead: (conversation_id: number) =>
    req(`${URLS.messages}/messages/read`, "POST", { conversation_id }),
};

// MEDIA
export const media = {
  upload: (dataUrl: string) =>
    req(`${URLS.media}/`, "POST", { data: dataUrl }),
};

// USERS (через auth функцию, поиск)
export const users = {
  search: async (q: string) => {
    const res = await fetch(`${URLS.auth}/search?q=${encodeURIComponent(q)}`, {
      headers: headers(),
    });
    return res.json();
  },
};
