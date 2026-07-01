<div align="center">

#  Triagem Pós-Vendas — Marin

**Sistema interno de triagem e gestão de chamados de pós-vendas (devoluções/reclamações)**


</div>

---

## 📑 Sumário

- [O que é](#-o-que-é)
- [Como funciona (fluxo)](#-como-funciona-o-fluxo)
- [Arquitetura](#-arquitetura)
- [Tecnologias](#-tecnologias)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Como rodar localmente](#-como-rodar-localmente)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Perfis de usuário](#-perfis-de-usuário)
- [Estágios do chamado (kanban)](#-estágios-do-chamado-kanban)
- [Tipos de solicitação e regras](#-tipos-de-solicitação-e-regras-de-devolução)
- [Banco de dados](#-banco-de-dados)
- [API REST](#-api-rest-principais-rotas)
- [Contratos e tipos (payloads)](#-contratos-e-tipos-payloads)
- [Principais funções](#-principais-funções)
- [Deploy](#-deploy)
- [Troubleshooting](#-troubleshooting-casos-comuns)
- [Glossário](#-glossário)

---

## 🧩 O que é

Plataforma web onde **vendedores abrem chamados** de devolução/reclamação (anexando a Nota Fiscal e fotos), o sistema **classifica automaticamente** o caso por regras de negócio (política de devoluções), **extrai os dados da NF** para montar um **espelho DANFE de devolução**, e a equipe de **pós-vendas/operacional gerencia** todo o ciclo em um **kanban** até o encerramento.

| | |
|---|---|
| **Para quem** | Vendedores, pós-vendas, operacional e administradores |
| **Idioma** | Português (BR) em toda a aplicação |
| **Formato** | Web app (SPA) — monolito: o backend serve o frontend já compilado |

> ℹ️ **Importante:** apesar de a interface citar "Agentes de IA", **a IA está desligada no backend**. A triagem é **determinística (por regras)** e a leitura de NF é feita por um **script Python** (`pdfplumber`/`reportlab`) — não há chamada a LLM no fluxo de produção.

---

## 🔄 Como funciona (o fluxo)

```
1. VENDEDOR abre o chamado
   ├─ Preenche dados do cliente, tipo de solicitação, descrição
   ├─ Anexa a Nota Fiscal (PDF ou imagem)  ── obrigatório
   └─ Anexa fotos/vídeos de evidência       ── opcional (até 6)
          │
          ▼
2. TRIAGEM AUTOMÁTICA (regras)
   ├─ Classifica → define o estágio de destino
   ├─ Decide se é elegível para devolução
   ├─ Decide se precisa de espelho NFD / recolhimento
   └─ Sinaliza se precisa de escalação humana
          │
          ▼
3. EXTRAÇÃO DA NF (se precisar de espelho)
   ├─ PDF  → script Python lê os dados
   ├─ Imagem → tenta ler o QR Code da NF-e
   └─ Falhou → transcrição manual pelo pós-vendas
          │
          ▼
4. PÓS-VENDAS / OPERACIONAL gerencia no KANBAN
   ├─ Move o chamado entre estágios
   ├─ Emite/ajusta o espelho DANFE (e baixa em PDF)
   ├─ Registra dados de recolhimento (frete, transportadora)
   └─ A cada mudança de status → e-mail automático ao vendedor
          │
          ▼
5. ENCERRAMENTO + RELATÓRIOS (KPIs, SLA, exportação CSV)
```

---

## 🏗 Arquitetura

Aplicação **monolítica**. Em produção, o **backend Express serve a SPA React** já compilada (`frontend/dist`) — tudo na mesma origem.

```
┌──────────────────────── Backend (Node + Express 5) ────────────────────────┐
│  /api/*   → rotas REST (auth, chamados, users, ai, relatorios, chat)        │
│  /*       → serve o frontend/dist (SPA fallback)                            │
│                                                                             │
│   PostgreSQL        Cloudinary         Python                SMTP           │
│   (dados)           (arquivos)         (NF: ler/gerar PDF)   (e-mails)      │
└─────────────────────────────────────────────────────────────────────────────┘
                ▲  HTTP + JWT (Bearer)
                │
┌──────────────────────── Frontend (React 19 + Vite) ─────────────────────────┐
│  React Router · estado em localStorage (token + user)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Dependências externas que o sistema precisa para funcionar:**
- **PostgreSQL** — banco de dados (obrigatório).
- **Cloudinary** — armazena NF, evidências e anexos. **Obrigatório**: sem as credenciais, o servidor **não sobe** (`process.exit(1)`).
- **Python 3** + `pdfplumber` + `reportlab` — leitura de PDF da NF e geração do espelho em PDF.
- **SMTP** — notificações por e-mail (opcional; silencioso se ausente).

---

## 🛠 Tecnologias

**Backend:** Node ≥ 20 · Express 5 · PostgreSQL (`pg`) · JWT · bcryptjs · Multer + Cloudinary · Nodemailer · express-rate-limit · sharp + jsqr (QR Code) · Python (pdfplumber, reportlab)

**Frontend:** React 19 · React Router 7 · Vite 8 · estilização **inline** (sem framework de CSS)

---

## 📁 Estrutura do projeto

```
trabalho/
├── Dockerfile              # Imagem de produção (Node 22 + Python)
├── startup.sh              # Boot no Azure App Service
├── README.md               # Este arquivo
│
├── backend/
│   ├── requirements.txt    # Python: pdfplumber, reportlab
│   ├── railway.toml        # Config Railway
│   ├── scripts/
│   │   └── nf_espelho_citel.py   # Extrai NF (PDF) e gera espelho PDF
│   └── src/
│       ├── index.js        # Bootstrap do servidor
│       ├── db/             # Pool, migrate, seed, migrations/*.sql
│       ├── middleware/auth.js     # Validação de JWT por role
│       ├── routes/         # auth, chamados, users, ai, relatorios, chat
│       └── utils/          # pythonBridge, qrDecoder, mailer
│
└── frontend/
    ├── dist/               # Build servido em produção (versionado!)
    └── src/
        ├── main.jsx        # Rotas + proteção por role
        ├── api.js          # Cliente HTTP central (fetch + JWT)
        ├── Layout.jsx
        ├── pages/          # Login, Vendedor, PosVendas, Historico, Admin, Relatorios, Chat
        └── components/     # Sidebar, ChamadoDetail, DanfeMirror, ShareChamado, Toast...
```

> ⚠️ **Legado (não usado em produção):** `frontend/src/App.jsx` (demo que chamava a Anthropic direto do browser), `mod.js`, `mod2.js`, `triagem-pos-vendas_5.jsx` (raiz) e `backend/src/db/test-conn.js`. O app real entra por `main.jsx` → `src/pages/`.

---

## ▶ Como rodar localmente

**Pré-requisitos:** Node ≥ 20 · Python 3 · PostgreSQL acessível · conta Cloudinary.

```bash
# 1) Instalar Python deps (necessário para extração/geração de NF)
pip install -r backend/requirements.txt    # pdfplumber, reportlab

# 2) Backend
cd backend
npm install
# crie o arquivo .env (ver seção abaixo) antes de continuar
npm run migrate     # cria/atualiza o schema do banco
npm run seed        # cria usuários iniciais (admin + pos_vendas)
npm run dev         # sobe a API em http://localhost:3001 (node --watch)

# 3) Frontend (em outro terminal)
cd frontend
npm install
npm run dev         # Vite dev server
```

**Simular o monolito de produção localmente:**
```bash
cd frontend && npm run build   # gera frontend/dist
cd ../backend && npm start     # backend passa a servir o dist
```

> No Windows o backend chama `python`; em Linux/produção, `python3`.

---

## 🔐 Variáveis de ambiente

Crie `backend/.env` (não versionado):

```bash
# Ambiente
NODE_ENV=production                       # em prod, oculta detalhes de erro no response

# Banco
DATABASE_URL=postgres://user:senha@host:5432/banco
# SSL do banco (opcional):
#   DATABASE_CA=<cert PEM>   → valida a cadeia (recomendado em produção)
#   DATABASE_SSL=disable     → desliga SSL (apenas local)
# Sem nenhuma das duas, usa SSL permissivo (rejectUnauthorized:false)

# Autenticação
JWT_SECRET=um-segredo-bem-forte

# Servidor
PORT=3001
FRONTEND_URL=http://localhost:5173        # CORS; aceita várias origens separadas por vírgula

# Cloudinary — OBRIGATÓRIO (sem isto o servidor encerra)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# SMTP — opcional (notificações de status)
SMTP_HOST=smtp.exemplo.com
SMTP_PORT=587                              # 465 ativa modo seguro
SMTP_USER=posvendas@marinlog.com.br
SMTP_PASS=...
SMTP_FROM="Pós-Vendas Marin <posvendas@marinlog.com.br>"

# Seed (opcional) — fixa as senhas iniciais; se ausentes, são geradas aleatoriamente
SEED_ADMIN_EMAIL=admin@marinlog.com.br
SEED_ADMIN_PASSWORD=...
SEED_POSVENDAS_EMAIL=posvendas@marinlog.com.br
SEED_POSVENDAS_PASSWORD=...
```

Frontend (build): `VITE_API_URL` — deixe **vazio** em produção (mesma origem); aponte para `http://localhost:3001` em dev se necessário.

---

## 👥 Perfis de usuário

| Perfil (`role`) | O que pode fazer |
|-----------------|------------------|
| **vendedor** | Abrir chamados; ver/acompanhar **apenas os próprios** (ou compartilhados com ele); chat |
| **operacional** | Ver e movimentar o **kanban**; sem acesso a histórico/relatórios/usuários |
| **pos_vendas** | Tudo do operacional + **histórico, relatórios, CSV, editar dados da NF, gerar espelho PDF** |
| **admin** | Tudo + **gestão de usuários** e **exclusão** de chamados |

**Regras de visibilidade**
- Vendedor só enxerga chamados próprios ou **compartilhados** (via "compartilhar chamado").
- O acesso é validado em **dois lugares**: no frontend (`ProtectedRoute`) e no backend (`authMiddleware(roles)`) — a segurança real está no backend.

**Usuários iniciais (seed)** — `npm run seed` cria um `admin` e um `pos_vendas`.
As senhas vêm de `SEED_ADMIN_PASSWORD` / `SEED_POSVENDAS_PASSWORD`; se não definidas,
o script **gera senhas aleatórias e as imprime uma única vez** no console (anote-as).
Usuários já existentes não são alterados. ⚠️ Troque as senhas após o primeiro acesso.

---

## 📊 Estágios do chamado (kanban)

```
novo → avaliacao → avaliado → espelho → aguardando_nfd
     → aguardando_recolhimento → (recolhido) → aguardando_financeiro → encerrado
```

| Status | Significado |
|--------|-------------|
| `novo` | Chamado recém-aberto |
| `avaliacao` | Em avaliação pela equipe |
| `avaliado` | Avaliação concluída |
| `espelho` | Emitir espelho NFD (devolução) |
| `aguardando_nfd` | Aguardando a NFD do cliente |
| `aguardando_recolhimento` | Aguardando coleta do produto |
| `recolhido` | Produto recolhido (estado dinâmico) |
| `aguardando_financeiro` | Aguardando crédito/financeiro |
| `encerrado` | Finalizado |

> Chamados `encerrado` há mais de **3 dias** são ocultados das listas por padrão.
> Toda mudança de status é registrada no **histórico** e dispara **e-mail** ao vendedor.

---

## 📋 Tipos de solicitação e regras de devolução

**Tipos:** `preco_errado` · `produto_avariado` · `erro_pigmentacao` · `produto_defeito` · `qtd_errada` · `arrependimento` · `recusa_entrega`

**Resumo das regras embutidas na triagem:**
- **Produto personalizado** ("tinta na máquina") → **não elegível**, exceto erro interno.
- **Uso indevido / má utilização** → **não elegível**.
- **Preço errado (interno)** → vai para `aguardando_financeiro` (gerar crédito).
- **Avariado por transportadora** → avaliação (tratativa com a transportadora).
- **Avariado responsabilidade Marin** → emitir espelho NFD.
- **Pigmentação**: erro Marin → espelho; erro do cliente → encerrado.
- **Defeito Suvinil** → avaliação via processo **BASF** (7–15 dias úteis).
- **Arrependimento** → prazo **7 dias**, produto **lacrado**, **frete por conta do cliente** → espelho.

---

## 🗄 Banco de dados

PostgreSQL. Schema versionado em `backend/src/db/migrations/*.sql` (aplicado em ordem por `npm run migrate`).

| Tabela | Função |
|--------|--------|
| `users` | Usuários e perfis (`vendedor`/`pos_vendas`/`admin`/`operacional`) |
| `chamados` | Chamado e todo seu estado (dados, NF, status, recolhimento) |
| `chamado_shares` | Compartilhamento de chamado com outro usuário |
| `chamado_mensagens` | **Chat do chamado** (comentários + anexos) |
| `chamado_historico` | Trilha de auditoria de mudanças de status |
| `chat_direto` | **Chat interno** — mensagens diretas e de grupo |
| `chat_grupos` / `chat_grupo_membros` | Grupos de conversa e membros |
| `chat_reacoes` / `chat_leituras_grupo` | Reações e controle de leitura |

> ⚠️ A coluna `chamados.recolhimento_data` (JSONB) é criada **no boot** (`db/index.js`), fora das migrations.

### Schema detalhado — `users`

| Coluna | Tipo SQL | Tipo lógico | Restrições |
|--------|----------|-------------|-----------|
| `id` | `SERIAL` | int | PK |
| `name` | `VARCHAR(80)` | string | NOT NULL |
| `email` | `VARCHAR(120)` | string | UNIQUE, NOT NULL, lowercase |
| `password_hash` | `TEXT` | string | NOT NULL (bcrypt, 12 rounds) |
| `role` | `VARCHAR(20)` | enum | `vendedor` \| `pos_vendas` \| `operacional` \| `admin` |
| `active` | `BOOLEAN` | bool | default `true` (login exige `true`) |
| `telefone` | `VARCHAR(20)` | string | opcional |
| `created_at` | `TIMESTAMPTZ` | datetime | default `now()` |

### Schema detalhado — `chamados`

| Coluna | Tipo SQL | Tipo lógico | Observação |
|--------|----------|-------------|-----------|
| `id` | `SERIAL` | int | PK |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | datetime | |
| `vendedor_id` | `INTEGER` | int (FK) | → `users.id` |
| `codigo_cliente` | `VARCHAR(20)` | string | só dígitos |
| `razao_social` | `VARCHAR(120)` | string | |
| `cnpj` | `VARCHAR(14)` | string | só dígitos (11=CPF, 14=CNPJ) |
| `nome_vendedor` | `VARCHAR(80)` | string | |
| `telefone` | `VARCHAR(20)` | string | |
| `email_vendedor` | `VARCHAR(120)` | string | destino das notificações |
| `tipo_solicitacao` | `VARCHAR(40)` | enum | um dos 7 tipos |
| `descricao` | `TEXT` | string | mín. 20 caracteres |
| `nf_original` | `VARCHAR(20)` | string | nº da NF de venda |
| `responsavel` | `VARCHAR(40)` | string | |
| `triage_result` | `JSONB` | object | resultado da triagem (ver abaixo) |
| `nf_data` | `JSONB` | object | dados da NF / espelho (ver abaixo) |
| `evidence_result` | `JSONB` | object | análise de evidências |
| `status` / `etapa_destino` | `VARCHAR(40)` | enum | estágio do kanban (default `novo`) |
| `nf_file_path` | `TEXT` | string (URL) | Cloudinary |
| `evidence_paths` | `TEXT[]` | string[] | URLs Cloudinary |
| `ressalva_vendedor` | `TEXT` | string | observação do vendedor |
| `ressalva_arquivos` | `TEXT[]` | string[] | anexos da ressalva |
| `recolhimento_data` | `JSONB` | object | frete/transportadora/despesas |
| `data_previsao_recolhimento` | `DATE` | date | usado no SLA |
| `data_real_recolhimento` | `DATE` | date | usado no SLA |

### Estruturas JSON (JSONB)

**`triage_result`** — saída da triagem:
```jsonc
{
  "etapa_destino": "espelho",          // string (status de destino)
  "resumo": "...",                      // string
  "acoes_automaticas": ["..."],         // string[]
  "proximas_etapas": ["aguardando_nfd"],// string[]
  "precisa_espelho_nfd": true,          // boolean
  "precisa_recolhimento": true,         // boolean
  "escalacao_humana": false,            // boolean
  "motivo_escalacao": "",               // string
  "elegivel_devolucao": true,           // boolean
  "motivo_inelegibilidade": "",         // string
  "observacoes": ""                     // string
}
```

**`nf_data`** — dados da NF para o espelho (campos monetários são **strings** no formato BR `"1.234,56"`):
```jsonc
{
  "numero_nf": "46665",                 // string
  "data_emissao": "01/06/2026",         // string
  "natureza_operacao": "5202 - ...",    // string
  "valor_total_nota": "1.234,56",       // string (R$ BR)
  "valor_total_produtos": "1.000,00",   // string
  "base_icms": "0,00", "valor_icms": "0,00",
  "razao_social_dest": "...", "cnpj_dest": "...",
  "endereco_dest": "...", "municipio_dest": "...", "uf_dest": "SC",
  "produtos": [                          // object[]
    {
      "codigo": "PROD-01",              // string
      "descricao": "...",               // string
      "ncm": "3209.10.10",              // string
      "cfop": "5202",                   // string
      "unidade": "GL",                  // string
      "quantidade": "10",               // string
      "valor_unitario": "100,00",       // string
      "valor_total": "1.000,00"         // string
    }
  ],
  "manual_required": false,             // boolean (true = digitar à mão)
  "isDeterministic": true               // boolean (extraído via Python)
}
```

**`recolhimento_data`** — dados de coleta:
```jsonc
{
  "tipo_frete": "proprio",   // string: "proprio" | "transportadora"
  "nome_transportadora": "", // string
  "valor_frete": "0,00",     // string (R$ BR)
  "despesas": "0,00",        // string (R$ BR)
  "observacoes": ""          // string
}
```

---

## 🌐 API REST (principais rotas)

Base `/api`. Exceto login e health, **todas exigem** `Authorization: Bearer <JWT>` (expira em 8h).

### Autenticação
| Método | Rota | Acesso |
|--------|------|--------|
| POST | `/auth/login` | público |
| GET | `/auth/me` | autenticado |

### Chamados
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/chamados/meus` | vendedor, pos_vendas, admin | Próprios + compartilhados |
| GET | `/chamados` | pos_vendas, admin, operacional | Lista com filtros |
| GET | `/chamados/:id` | autenticado | Detalhe (vendedor só os próprios) |
| POST | `/chamados` | vendedor, pos_vendas, admin | Criar (NF + até 6 evidências) |
| PATCH | `/chamados/:id/status` | pos_vendas, admin, operacional | Mudar status (+histórico +e-mail) |
| POST | `/chamados/:id/share` | dono / admin | Compartilhar |
| POST | `/chamados/:id/reprocess-pdf` | pos_vendas, admin | Reprocessar PDF da NF |
| PATCH | `/chamados/:id/nf_data` | pos_vendas, admin | Editar dados da NF |
| GET | `/chamados/:id/danfe-pdf` | pos_vendas, admin | Baixar espelho em PDF |
| GET/POST | `/chamados/:id/messages` | autenticado | Chat do chamado |
| DELETE | `/chamados/:id` | admin | Excluir |
| POST | `/chamados/batch-delete` | admin | Excluir em massa |

### Usuários
| Método | Rota | Acesso |
|--------|------|--------|
| GET / POST | `/users` | admin |
| GET | `/users/contacts` | autenticado |
| PATCH | `/users/:id` | admin |
| PATCH | `/users/:id/password` | próprio / admin |
| DELETE | `/users/:id` | admin |

### Triagem / NF
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/ai/triage` | Triagem determinística |
| POST | `/ai/extract-nf` | Extrai NF (PDF Python / QR Code / manual) |
| POST | `/ai/analyze-evidence` | Stub — análise manual |

### Relatórios
| Método | Rota | Acesso | Descrição |
|--------|------|--------|-----------|
| GET | `/relatorios/resumo` | pos_vendas, admin | KPIs e SLA |
| GET | `/relatorios/chamados?formato=csv` | pos_vendas, admin | Exporta chamados |
| GET | `/relatorios/historico?formato=csv` | pos_vendas, admin | Exporta histórico |

### Infra / diagnóstico
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/health` | Status do servidor |
| GET | `/diag-smtp` | Testa SMTP (**admin**; envia ao e-mail do próprio admin) |
| GET | `/chamados/diag-cloudinary` | Testa Cloudinary (admin) |

**Padrões da API**
- Respostas de erro: `{ "error": "mensagem" }`.
- **401** → token ausente/expirado (frontend faz logout automático).
- **403** → role sem permissão.
- **429** → rate limit (`/api/auth`: 20/15min; demais `/api`: 100/min).
- Uploads via **multipart/form-data** (limite 20 MB/arquivo; NF até 10 MB no front).

---

## 📨 Contratos e tipos (payloads)

Tipos lógicos: `string`, `int`, `boolean`, `file`, `string[]`. Campos monetários trafegam como **string** no formato BR (`"1.234,56"`).

### `POST /api/auth/login`
```jsonc
// Request (application/json)
{ "email": "string", "password": "string" }

// Response 200
{
  "token": "string (JWT, expira em 8h)",
  "user": { "id": int, "name": "string", "email": "string", "role": "string" }
}
// 400 campos faltando · 401 credenciais inválidas
```

### `POST /api/chamados` — criar chamado
`multipart/form-data`. Campos de texto + arquivos:

| Campo | Tipo | Obrigatório | Validação (frontend) |
|-------|------|:---:|-----------|
| `codigo` | string | ✅ | não vazio |
| `razaoSocial` | string | ✅ | mín. 3 caracteres |
| `cnpj` | string | ✅ | 11 (CPF) ou 14 (CNPJ) dígitos |
| `nomeVendedor` | string | ✅ | preenchido com o usuário logado |
| `telefone` | string | ✅ | dígitos |
| `emailVendedor` | string | ✅ | formato de e-mail |
| `tipoSolicitacao` | string (enum) | ✅ | um dos 7 tipos |
| `nfOriginal` | string | ✅ | não vazio |
| `descricao` | string | ✅ | mín. 20 caracteres |
| `responsavel` | string | — | |
| `triage_result` | string (JSON) | — | serializado |
| `nf_data` | string (JSON) | — | serializado |
| `evidence_result` | string (JSON) | — | serializado |
| `ressalva_vendedor` | string | — | |
| `nf_file` | file | ✅ | JPG/PNG/WEBP/PDF · ≤ 10 MB |
| `evidence_files` | file[] | — | até 6 (backend) · imagens/vídeos · ≤ 20 MB cada |

```jsonc
// Response 201
{ "chamado": { /* registro completo de chamados */ } }
```

> Observação: o backend aceita os campos tanto em **camelCase** (`razaoSocial`) quanto em **snake_case** (`razao_social`). O CNPJ é normalizado para só dígitos antes de gravar.

### `PATCH /api/chamados/:id/status` — mudar estágio
```jsonc
// Request (application/json)
{
  "status": "string (enum de estágio)",       // obrigatório
  "recolhimento_data": { /* object */ },        // opcional
  "data_previsao_recolhimento": "YYYY-MM-DD",   // opcional (date | null)
  "data_real_recolhimento": "YYYY-MM-DD"        // opcional (date | null)
}
// Efeitos colaterais: grava em chamado_historico + dispara e-mail ao vendedor
```

### `POST /api/users` — criar usuário (admin)
```jsonc
// Request
{
  "name": "string",      // obrigatório
  "email": "string",     // obrigatório, único
  "password": "string",  // obrigatório
  "role": "string",      // vendedor|pos_vendas|operacional|admin
  "telefone": "string"   // opcional
}
// 201 ok · 400 role inválido / campos faltando · 409 e-mail já cadastrado
```

### `POST /api/ai/extract-nf` — extrair dados da NF
```jsonc
// Request
{
  "fileB64": "string (base64)",   // conteúdo do arquivo
  "mime": "string",               // ex.: "application/pdf" | "image/jpeg"
  "formData": { /* form */ }      // fallback p/ campos não extraídos
}
// Response: objeto nf_data (ver Estruturas JSON). manual_required=true se falhar.
```

---

## 🧠 Principais funções

### Backend — middleware e utilitários

| Função | Arquivo | Assinatura | O que faz |
|--------|---------|-----------|-----------|
| `authMiddleware(roles)` | `middleware/auth.js` | `(roles: string[] = []) → (req,res,next)` | Valida o JWT (`Bearer`), injeta `req.user`; bloqueia 403 se `role` ∉ `roles`. Lista vazia = qualquer autenticado |
| `extractNFDeterministic(pdfPath)` | `utils/pythonBridge.js` | `(pdfPath: string) → Promise<object>` | Faz `spawn` do Python e devolve o JSON extraído do PDF |
| `generatePDFFromJSON(data, outputPath)` | `utils/pythonBridge.js` | `(data: object, outputPath: string) → Promise<string>` | Gera o espelho PDF a partir de `nf_data` |
| `processarQrCodeImagem(base64Image)` | `utils/qrDecoder.js` | `(base64Image: string) → Promise<object\|null>` | Lê o QR Code de NF-e e decodifica a chave de 44 dígitos |
| `decodificarChave(chave)` | `utils/qrDecoder.js` | `(chave: string) → object\|null` | Quebra a chave de acesso (UF, CNPJ, modelo, série, número) |
| `sendStatusUpdateEmail(payload)` | `utils/mailer.js` | `({toEmail,toName,chamadoId,razaoSocial,oldStatus,newStatus}) → Promise` | Envia e-mail HTML de mudança de status (silencioso sem SMTP) |
| `testSmtp(toEmail)` | `utils/mailer.js` | `(toEmail: string) → Promise<object>` | Testa conexão SMTP e envia e-mail de diagnóstico |

### Backend — lógica de domínio (rotas)

| Função | Arquivo | O que faz |
|--------|---------|-----------|
| `triageDeterministic(formData)` | `routes/ai.js` | Classifica o chamado por regras → `triage_result` |
| `repairJSON(str)` | `routes/ai.js` | Tenta consertar/parsear JSON truncado |
| `uploadToCloudinary(buffer, options, mimetype)` | `routes/chamados.js` | Sobe arquivo ao Cloudinary; `resource_type` por mimetype |
| `cleanAndFormatNfData(det)` | `routes/chamados.js` | Normaliza a saída do Python para o formato `nf_data` (filtra "lixo" de cabeçalho, calcula totais) |

### Frontend — cliente HTTP (`src/api.js`)

Objeto `api` com wrapper único sobre `fetch` (injeta JWT, trata 401/429). Principais métodos:

| Método | Chama |
|--------|-------|
| `api.login(email, password)` | `POST /auth/login` |
| `api.getMeusChamados(params)` / `api.getChamados(params)` | listas de chamados |
| `api.getChamado(id)` | detalhe |
| `api.createChamado(formData)` | `POST /chamados` (FormData) |
| `api.updateStatus(id, status, extra)` | muda estágio |
| `api.triage(form)` / `api.extractNF(b64, mime, isTest, form)` / `api.analyzeEvidence(imgs)` | triagem e NF |
| `api.reprocessPDF(id, formData)` | reprocessa PDF |
| `api.shareChamado(id, userId)` | compartilha |
| `api.getMessages(id)` / `api.sendMessage(id, data)` | chat do chamado |
| `api.getUsers()` / `api.createUser(data)` / `api.updateUser(id, data)` / `api.changePassword(...)` | usuários |

---

## 🚀 Deploy

Há configuração para três alvos (a imagem Docker é a referência):

| Alvo | Arquivo | Observação |
|------|---------|-----------|
| **Docker** | `Dockerfile` | `node:22-slim` + Python + deps; builda o front e roda `node src/index.js`. `EXPOSE 8080` (defina `PORT=8080`). |
| **Railway** | `backend/railway.toml` | Nixpacks; `npm start`; healthcheck `/api/health`. |
| **Azure App Service** | `startup.sh` | Instala Python e inicia o Node. |

**Checklist de deploy**
1. Configurar todas as variáveis de ambiente (especialmente **Cloudinary**).
2. Rodar `npm run migrate` contra o banco de produção.
3. Na primeira vez, rodar `npm run seed` e **trocar as senhas**.
4. Garantir **Python + pdfplumber + reportlab** no ambiente.
5. **Rebuildar `frontend/dist`** após qualquer mudança no frontend (é servido diretamente).

---

## 🔧 Troubleshooting (casos comuns)

| Sintoma | Causa provável | O que verificar |
|---------|----------------|-----------------|
| **Servidor não sobe / encerra no boot** | Credenciais Cloudinary ausentes | `CLOUDINARY_*` no `.env` (faz `process.exit(1)`) |
| **Erro ao conectar no banco** | `DATABASE_URL` errada ou sem SSL | A conexão usa SSL (`rejectUnauthorized:false`); confira host/porta/credenciais |
| **Login sempre "Credenciais inválidas"** | Usuário inexistente, inativo ou senha errada | Rode `npm run seed`; confira `active=true` no banco |
| **Foi deslogado sozinho** | JWT expirou (8h) ou veio 401 | Faça login de novo; verifique o relógio do servidor |
| **"Muitas tentativas" (429)** | Rate limit | Aguarde alguns minutos (`/api/auth`: 20/15min) |
| **Upload da NF falha** | Cloudinary, tipo ou tamanho do arquivo | Tipos: JPG/PNG/WEBP/PDF; NF ≤ 10 MB, evidências ≤ 20 MB |
| **Espelho/PDF não gera** | Python ou libs ausentes | `python --version`; `pip install pdfplumber reportlab` |
| **Extração da NF vem vazia / manual** | PDF não-padrão, protegido ou imagem sem QR | Use PDF de DANFE padrão; ou transcreva manualmente (pos_vendas) |
| **Vendedor não enxerga um chamado** | Não é dono nem foi compartilhado | Compartilhe o chamado com o usuário |
| **E-mail de status não chega** | SMTP não configurado/credencial errada | Logado como admin, acesse `/api/diag-smtp`; confira `SMTP_*` |
| **Mudanças no front não aparecem em produção** | `frontend/dist` desatualizado | `npm run build` e redeploy |
| **403 em rota que deveria funcionar** | Role sem permissão | Confira a matriz de perfis e o `role` do usuário no token |
| **App não acha o Python no Windows** | Comando difere por SO | Front/back: Windows usa `python`, Linux usa `python3` |

---

## 📖 Glossário

| Termo | Significado |
|-------|-------------|
| **Chamado** | Solicitação de devolução/reclamação aberta por um vendedor |
| **Triagem** | Classificação automática (por regras) que define o destino do chamado |
| **Espelho NFD / DANFE** | Rascunho da nota de devolução (**marca d'água "NÃO TEM VALOR FISCAL"**) |
| **NF original** | Nota fiscal de venda que originou a devolução |
| **Recolhimento** | Coleta do produto devolvido (com frete/transportadora) |
| **Ressalva** | Observação (com anexos) que o vendedor adiciona ao chamado |
| **Escalação humana** | Sinalização de que o caso precisa de análise manual |
| **SLA de recolhimento** | Indicador previsão × data real de coleta (nos relatórios) |

---

<div align="center">

**Marin Logística e Comércio LTDA** — Sistema de Triagem Automática Pós-Vendas

</div>
