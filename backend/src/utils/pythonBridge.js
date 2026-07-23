const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

/**
 * Ponte para o script Python de NF (extração de PDF e geração de espelho).
 *
 * Protege o servidor de PDFs problemáticos e de picos de carga:
 *  - TIMEOUT: mata o processo que passar do limite (evita requisição pendurada).
 *  - CONCORRÊNCIA: teto de processos Python simultâneos (evita exaustão de CPU
 *    quando várias extrações/reprocessamentos chegam juntos).
 *  - CAP DE SAÍDA: aborta se o stdout crescer demais.
 *
 * Ajustável por env: PYTHON_TIMEOUT_MS (padrão 30000), PYTHON_MAX_CONCURRENCY
 * (padrão 4).
 */

const PYTHON_CMD = process.platform === "win32" ? "python" : "python3";
const SCRIPT_PATH = path.join(__dirname, "../../scripts/nf_espelho_citel.py");
const TIMEOUT_MS = parseInt(process.env.PYTHON_TIMEOUT_MS || "30000", 10);
const MAX_CONCURRENCY = Math.max(1, parseInt(process.env.PYTHON_MAX_CONCURRENCY || "4", 10));
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024; // guarda contra saída descontrolada

// ── Semáforo simples: limita processos Python simultâneos ──
let active = 0;
const queue = [];
function acquire() {
  if (active < MAX_CONCURRENCY) {
    active++;
    return Promise.resolve();
  }
  return new Promise((resolve) => queue.push(resolve));
}
function release() {
  active--;
  const next = queue.shift();
  if (next) {
    active++;
    next();
  }
}

/**
 * Executa o script Python com timeout, teto de concorrência e cap de saída.
 * Garante que o slot de concorrência seja liberado em TODOS os caminhos.
 * @param {string[]} args Argumentos após o caminho do script.
 * @returns {Promise<string>} stdout do processo (código de saída 0).
 */
function runPython(args, { timeoutMs = TIMEOUT_MS } = {}) {
  return acquire().then(
    () =>
      new Promise((resolve, reject) => {
        const child = spawn(PYTHON_CMD, [SCRIPT_PATH, ...args], {
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });

        let stdout = "";
        let stderr = "";
        let outBytes = 0;
        let settled = false;

        const finish = (fn, arg) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          release();
          fn(arg);
        };

        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          finish(reject, new Error(`Script Python excedeu o tempo limite (${timeoutMs} ms) e foi encerrado.`));
        }, timeoutMs);

        child.stdout.on("data", (d) => {
          outBytes += d.length;
          if (outBytes > MAX_OUTPUT_BYTES) {
            child.kill("SIGKILL");
            return finish(reject, new Error("Saída do script Python excedeu o limite permitido."));
          }
          stdout += d.toString();
        });
        child.stderr.on("data", (d) => {
          stderr += d.toString();
        });

        child.on("error", (err) => finish(reject, new Error(`Falha ao executar o Python: ${err.message}`)));

        child.on("close", (code) => {
          if (code !== 0) {
            console.error("Erro no script Python:", stderr);
            return finish(reject, new Error(`O script Python terminou com código ${code}: ${stderr}`));
          }
          finish(resolve, stdout);
        });
      })
  );
}

/**
 * Executa o script Python para extrair dados de uma NF-e (PDF).
 * @param {string} pdfPath Caminho para o arquivo PDF.
 * @returns {Promise<object>} Dados extraídos no formato JSON.
 */
async function extractNFDeterministic(pdfPath) {
  const stdout = await runPython([pdfPath, "--json"]);
  try {
    return JSON.parse(stdout);
  } catch (e) {
    throw new Error("Falha ao parsear saída do script Python: " + stdout);
  }
}

/**
 * Gera um PDF de espelho a partir de dados JSON.
 * @param {object} data Objeto JSON com os dados da NF.
 * @param {string} outputPath Caminho onde o PDF será salvo.
 * @returns {Promise<string>} O caminho do PDF gerado.
 */
async function generatePDFFromJSON(data, outputPath) {
  const jsonPath = path.join(os.tmpdir(), `data_${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data));
  try {
    await runPython(["--generate", jsonPath, outputPath]);
    return outputPath;
  } finally {
    if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
  }
}

module.exports = { extractNFDeterministic, generatePDFFromJSON };
