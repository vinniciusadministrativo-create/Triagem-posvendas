-- Coluna JSONB com os dados de encerramento do chamado:
--   { resolucao: "atendido" | "indeferido", descricao, encerrado_por, encerrado_em }
-- Obrigatória ao mover um chamado para o status "encerrado".
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS encerramento_data JSONB;
