-- Adicionando 'operacional' à restrição de papéis de usuário
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('vendedor', 'pos_vendas', 'admin', 'operacional'));
