const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
 * Executa o script Python para extrair dados de uma NF-e (PDF).
 * @param {string} pdfPath Caminho para o arquivo PDF.
 * @returns {Promise<object>} Dados extraídos no formato JSON.
 */
async function extractNFDeterministic(pdfPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../../scripts/nf_espelho_citel.py");
    
    // Tenta usar 'python' ou 'python3' ou 'py'
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    
    const child = spawn(pythonCmd, [scriptPath, pdfPath, "--json"]);
    
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("Erro no script Python:", stderr);
        return reject(new Error(`O script Python terminou com código ${code}: ${stderr}`));
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (e) {
        reject(new Error("Falha ao parsear saída do script Python: " + stdout));
      }
    });
  });
}

module.exports = { extractNFDeterministic };
