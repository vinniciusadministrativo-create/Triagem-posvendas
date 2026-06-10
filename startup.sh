#!/bin/bash
echo "Instalando dependências Python..."
pip3 install -r /home/site/wwwroot/backend/requirements.txt --quiet 2>/dev/null || echo "Python não disponível, pulando..."

echo "Iniciando servidor Node.js..."
cd /home/site/wwwroot/backend
node src/index.js