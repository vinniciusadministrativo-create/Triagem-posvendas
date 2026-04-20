CREATE TABLE IF NOT EXISTS chamado_mensagens (
  id SERIAL PRIMARY KEY,
  chamado_id INTEGER REFERENCES chamados(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  mensagem TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chamado_mensagens_chamadoc ON chamado_mensagens(chamado_id);
