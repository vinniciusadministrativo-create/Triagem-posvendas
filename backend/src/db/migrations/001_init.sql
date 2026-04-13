-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(80) NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('vendedor', 'pos_vendas', 'admin')),
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Chamados table
CREATE TABLE IF NOT EXISTS chamados (
  id                SERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  vendedor_id       INTEGER REFERENCES users(id),

  -- Form data
  codigo_cliente    VARCHAR(20),
  razao_social      VARCHAR(120),
  cnpj              VARCHAR(14),
  nome_vendedor     VARCHAR(80),
  telefone          VARCHAR(20),
  email_vendedor    VARCHAR(120),
  tipo_solicitacao  VARCHAR(40),
  descricao         TEXT,
  nf_original       VARCHAR(20),
  responsavel       VARCHAR(40),

  -- AI results (stored as JSON)
  triage_result     JSONB,
  nf_data           JSONB,
  evidence_result   JSONB,

  -- Pipeline status
  status            VARCHAR(40) DEFAULT 'novo',
  etapa_destino     VARCHAR(40),

  -- File paths
  nf_file_path      TEXT,
  evidence_paths    TEXT[],
  ressalva_vendedor TEXT
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_chamados_vendedor ON chamados(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_created ON chamados(created_at DESC);
