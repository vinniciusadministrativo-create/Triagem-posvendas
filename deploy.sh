#!/bin/bash

# ==========================================
# Triagem Automática Pos-Vendas Marin
# ==========================================
# Script rápido de instalação e Inicialização
# Feito para Servidores Ubuntu/Debian 
# ==========================================

echo "🚀 Iniciando Setup de Produção..."

# Verifica dependências básicas
if ! command -v node &> /dev/null
then
    echo "❌ Node.js não encontrado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Instala Gerenciador de Processos
if ! command -v pm2 &> /dev/null
then
    echo "📦 Instalando PM2..."
    sudo npm install -g pm2
fi

# ==========================================
# 1. FRONTEND BUILD
# ==========================================
echo "🌐 Compilando Arquivos Visuais do Frontend..."
cd frontend
npm install
# Garante que VITE_API_URL esteja vazio na hora do build para usar rota relativa
VITE_API_URL="" npm run build
cd ..

# ==========================================
# 2. BACKEND SETUP
# ==========================================
echo "⚙️ Configurando Backend..."
cd backend
npm install
npm run migrate
npm run seed

# ==========================================
# 3. LIGANDO MOTOR DA NUVEM (PM2)
# ==========================================
echo "🔥 Colocando a aplicação no ar..."
# Se houver instância rodando, para e remove
pm2 delete marin-app 2> /dev/null || true
pm2 start src/index.js --name "marin-app"
pm2 save

echo ""
echo "✅=========================================="
echo "🎯 INSTALAÇÃO CONCLUÍDA NO SERVIDOR LINUX!"
echo "✅=========================================="
echo "- O Frontend foi injetado dentro do Backend"
echo "- O PM2 manterá o sistema no ar 24\7"
echo "- O sistema deve estar rodando agora na porta Local!"
echo ""
echo "Comandos úteis:"
echo " pm2 status       (Verifica se tá rodando)"
echo " pm2 logs         (Verifica tela preta do servidor)"
echo " pm2 restart all  (Reinicia após novidades)"
