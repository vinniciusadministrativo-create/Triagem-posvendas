-- [NEUTRALIZADA] Migração histórica, aplicada uma única vez no passado.
-- O UPDATE original movia chamados de 'avaliacao' -> 'novo' quando essa etapa
-- havia sido removida. Porém 'avaliacao' VOLTOU a ser um estágio ATIVO do fluxo,
-- e como o migrate.js re-executa TODOS os .sql a cada rodada, re-rodar o UPDATE
-- corromperia chamados legítimos que estão em avaliação. Mantido como no-op
-- para preservar a numeração/histórico das migrations.
SELECT 1;
-- Nota: O status 'recolhido' é tratado dinamicamente pelo frontend e backend.
