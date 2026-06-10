#!/bin/bash
# =======================================================
# Azure App Service — Startup Script
# Instala dependências Python antes de iniciar o Node.js.
# Configure em: App Service → Configuration → General Settings → Startup Command
# Valor: bash /home/site/wwwroot/startup.sh
# =======================================================

set -e

echo "🐍 Instalando dependências Python..."
pip3 install -r /home/site/wwwroot/backend/requirements.txt --quiet

echo "🚀 Iniciando servidor Node.js..."
cd /home/site/wwwroot/backend
node src/index.js
