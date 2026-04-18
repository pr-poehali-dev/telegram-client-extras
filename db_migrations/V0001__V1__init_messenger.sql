
CREATE TABLE IF NOT EXISTS t_p25604669_telegram_client_extr.users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  online_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p25604669_telegram_client_extr.auth_codes (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p25604669_telegram_client_extr.sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES t_p25604669_telegram_client_extr.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS t_p25604669_telegram_client_extr.conversations (
  id SERIAL PRIMARY KEY,
  user_a INTEGER REFERENCES t_p25604669_telegram_client_extr.users(id),
  user_b INTEGER REFERENCES t_p25604669_telegram_client_extr.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a, user_b)
);

CREATE TABLE IF NOT EXISTS t_p25604669_telegram_client_extr.messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES t_p25604669_telegram_client_extr.conversations(id),
  sender_id INTEGER REFERENCES t_p25604669_telegram_client_extr.users(id),
  text TEXT,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON t_p25604669_telegram_client_extr.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON t_p25604669_telegram_client_extr.sessions(user_id);
