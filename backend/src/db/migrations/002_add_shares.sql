-- Migração: Criação da tabela de compartilhamento de chamados
CREATE TABLE IF NOT EXISTS chamado_shares (
    id SERIAL PRIMARY KEY,
    chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chamado_id, user_id)
);
