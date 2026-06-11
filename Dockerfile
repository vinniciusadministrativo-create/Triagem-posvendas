FROM node:22-slim

# Instala Python e pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Instala dependências Python
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip3 install --break-system-packages pdfplumber reportlab

# Instala dependências do backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --production

# Instala dependências do frontend e faz o build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Copia o restante do backend
WORKDIR /app/backend
COPY backend/ ./

# Copia o build do frontend para onde o backend serve
RUN cp -r /app/frontend/build ./public 2>/dev/null || true

EXPOSE 8080

CMD ["node", "src/index.js"]