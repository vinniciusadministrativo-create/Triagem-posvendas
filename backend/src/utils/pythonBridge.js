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
    
    // No Linux (Render/produção): usa python3. No Windows (dev local): usa python.
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

/**
 * Gera um PDF de espelho a partir de dados JSON.
 * @param {object} data Objeto JSON com os dados da NF.
 * @param {string} outputPath Caminho onde o PDF será salvo.
 */
async function generatePDFFromJSON(data, outputPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "../../scripts/nf_espelho_citel.py");
    const jsonPath = path.join(os.tmpdir(), `data_${Date.now()}.json`);
    
    fs.writeFileSync(jsonPath, JSON.stringify(data));

    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    const child = spawn(pythonCmd, [scriptPath, "--generate", jsonPath, outputPath]);

    let stderr = "";
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath);
      if (code !== 0) return reject(new Error(`Erro ao gerar PDF: ${stderr}`));
      resolve(outputPath);
    });
  });
}

module.exports = { extractNFDeterministic, generatePDFFromJSON };
