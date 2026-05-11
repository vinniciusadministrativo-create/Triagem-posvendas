-- Garante que a chave estrangeira em chat_direto referenciando chat_grupos tenha ON DELETE CASCADE
-- Isso previne erros ao excluir grupos que já possuem mensagens enviadas.

ALTER TABLE chat_direto DROP CONSTRAINT IF EXISTS chat_direto_grupo_id_fkey;

ALTER TABLE chat_direto
  ADD CONSTRAINT chat_direto_grupo_id_fkey
  FOREIGN KEY (grupo_id)
  REFERENCES chat_grupos(id)
  ON DELETE CASCADE;
