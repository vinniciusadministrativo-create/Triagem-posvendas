-- Criando tabela de histórico de movimentação
CREATE TABLE IF NOT EXISTS chamado_historico (
    id SERIAL PRIMARY KEY,
    chamado_id INTEGER REFERENCES chamados(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status_anterior VARCHAR(40),
    status_novo VARCHAR(40),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index para performance nas consultas de histórico
CREATE INDEX IF NOT EXISTS idx_historico_chamado_id ON chamado_historico(chamado_id);
