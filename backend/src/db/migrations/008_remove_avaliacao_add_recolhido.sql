-- Migrando chamados da etapa removida para a etapa inicial
UPDATE chamados SET status = 'novo' WHERE status = 'avaliacao';
-- Nota: O status 'recolhido' será tratado dinamicamente pelo frontend e backend
