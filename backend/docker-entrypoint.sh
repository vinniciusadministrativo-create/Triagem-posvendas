#!/bin/sh
# Entrypoint do container: aplica as migrations antes de subir o servidor.
# As migrations são idempotentes (ADD COLUMN IF NOT EXISTS, etc.), então
# reexecutar a cada boot é seguro. Se a migração falhar (ex.: banco
# inacessível), o processo sai com código != 0 e o Azure reinicia o
# container — fail-fast, para nunca subir a aplicação com schema defasado.
set -e

echo "⏳ Aplicando migrations..."
npm run migrate

echo "🚀 Iniciando servidor..."
exec node src/index.js
