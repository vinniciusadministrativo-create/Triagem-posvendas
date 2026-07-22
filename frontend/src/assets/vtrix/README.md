# Vtrix — kit de marca

Símbolo: **V de duas chevrons empilhadas** (camadas/módulos), pontas retas (miter) —
ecoa o símbolo de picos da Marin. Vtrix é a marca da plataforma; a Marin assina como
empresa-mãe ("uma plataforma Marin").

## Arquivos

| Arquivo | Uso |
|---|---|
| `vtrix-symbol.svg` | Símbolo bordô, fundo transparente. Uso geral sobre fundo claro. |
| `vtrix-symbol-white.svg` | Símbolo branco. Uso sobre fundo bordô/escuro. |
| `vtrix-favicon.svg` | Quadrado bordô arredondado + símbolo branco. Favicon / ícone de app. |
| `vtrix-lockup.svg` | Símbolo + wordmark "Vtrix", fundo claro. |
| `vtrix-lockup-dark.svg` | Lockup para fundo escuro (bordô clareado + texto branco). |

## Cores

- **Bordô Marin (primária):** `#9B1B30`
- **Bordô claro (modo escuro):** `#e0566b`
- **Tinta (texto "trix"):** `#1a1a1a`
- **Branco:** `#FFFFFF`

## Regras rápidas

- **Área de respiro:** deixe ao redor da marca no mínimo a altura de uma chevron.
- **Tamanho mínimo do símbolo:** ~16px (favicon). Abaixo disso, use uma só chevron.
- **Não** distorça, gire, troque as cores fora da paleta, nem adicione sombra/gradiente.

## ⚠️ Wordmark é texto ao vivo

Os lockups usam `<text>` em **Arial 900**. Isso depende da fonte na máquina de quem
abrir. Para o asset **final de produção**, abra num editor vetorial (Figma / Illustrator /
Inkscape) e **converta o texto em contornos** (outlines / "create outlines"). Assim o
wordmark fica idêntico em qualquer lugar. O símbolo já é 100% vetor puro, sem dependência.

## Como plugar no app (quando quiser)

- **Sidebar** (`frontend/src/components/Sidebar.jsx`, ~linha 109): abaixo do
  `<img src={logoMarin}>`, adicionar `import vtrix from "../assets/vtrix/vtrix-lockup.svg"`
  e um `<img src={vtrix} alt="Vtrix" />`.
- **Favicon** (`frontend/index.html` / `frontend/public/`): apontar o
  `<link rel="icon">` para `vtrix-favicon.svg`.

Este kit foi entregue **sem** alterar Sidebar nem favicon, conforme combinado.
