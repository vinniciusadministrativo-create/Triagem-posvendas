-- Grupos de chat
CREATE TABLE IF NOT EXISTS chat_grupos (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  descricao   TEXT,
  criado_por  INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Membros dos grupos
CREATE TABLE IF NOT EXISTS chat_grupo_membros (
  grupo_id  INTEGER NOT NULL REFERENCES chat_grupos(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin     BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (grupo_id, user_id)
);

-- Mensagens de grupo (reutiliza a tabela de direto mas com grupo_id no lugar de destinatario)
-- Abordagem: adicionar coluna grupo_id + tornar destinatario_id opcional
ALTER TABLE chat_direto ADD COLUMN IF NOT EXISTS grupo_id INTEGER REFERENCES chat_grupos(id) ON DELETE CASCADE;
ALTER TABLE chat_direto ALTER COLUMN destinatario_id DROP NOT NULL;

-- Índice para mensagens de grupo
CREATE INDEX IF NOT EXISTS idx_chat_direto_grupo ON chat_direto(grupo_id);
