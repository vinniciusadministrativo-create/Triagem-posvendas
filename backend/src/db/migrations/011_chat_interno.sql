-- Chat interno entre usuários
CREATE TABLE IF NOT EXISTS chat_direto (
  id              SERIAL PRIMARY KEY,
  remetente_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destinatario_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conteudo        TEXT NOT NULL,
  tipo            VARCHAR(20) DEFAULT 'texto',   -- 'texto' | 'imagem' | 'arquivo' | 'emoji'
  anexo_url       TEXT,                          -- URL para arquivos/imagens futuros
  lida            BOOLEAN DEFAULT FALSE,
  editada         BOOLEAN DEFAULT FALSE,
  deletada        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_direto_destinatario ON chat_direto(destinatario_id, lida);
CREATE INDEX IF NOT EXISTS idx_chat_direto_remetente    ON chat_direto(remetente_id);
CREATE INDEX IF NOT EXISTS idx_chat_direto_conversa     ON chat_direto(
  LEAST(remetente_id, destinatario_id),
  GREATEST(remetente_id, destinatario_id)
);

-- Reações a mensagens (para v2)
CREATE TABLE IF NOT EXISTS chat_reacoes (
  id          SERIAL PRIMARY KEY,
  mensagem_id INTEGER NOT NULL REFERENCES chat_direto(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji       VARCHAR(10) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mensagem_id, user_id)
);
