-- Novas colunas de anexo na tabela de mensagens diretas
ALTER TABLE chat_direto ADD COLUMN IF NOT EXISTS anexo_nome TEXT;
ALTER TABLE chat_direto ADD COLUMN IF NOT EXISTS anexo_tipo TEXT;

-- Tabela de controle de leitura de mensagens em grupos
CREATE TABLE IF NOT EXISTS chat_leituras_grupo (
  id          SERIAL PRIMARY KEY,
  mensagem_id INTEGER NOT NULL REFERENCES chat_direto(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lido_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mensagem_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_leituras_grupo ON chat_leituras_grupo(mensagem_id, user_id);
