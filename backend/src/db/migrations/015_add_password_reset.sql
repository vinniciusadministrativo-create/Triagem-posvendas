-- Redefinição de senha via código numérico enviado por e-mail.
-- O código é guardado hasheado (SHA-256), com expiração curta e limite de tentativas.
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash    TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_attempts       INTEGER DEFAULT 0;

-- Busca pelo hash do código na etapa de redefinição.
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash);
