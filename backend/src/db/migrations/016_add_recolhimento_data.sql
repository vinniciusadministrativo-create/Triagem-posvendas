-- Coluna JSONB com os dados de recolhimento (frete, transportadora, despesas).
-- Antes era criada no boot do servidor (db/index.js); movida para migration.
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS recolhimento_data JSONB;
