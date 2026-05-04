const sharp = require("sharp");
const jsQR = require("jsqr");

async function lerQRCode(imageBuffer) {
  try {
    const { data, info } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let qr = jsQR(new Uint8ClampedArray(data), info.width, info.height);

    if (!qr) {
      const processed = await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .sharpen()
        .resize({ width: 1500, withoutEnlargement: false })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      qr = jsQR(
        new Uint8ClampedArray(processed.data),
        processed.info.width,
        processed.info.height
      );
    }

    if (!qr) {
      const inverted = await sharp(imageBuffer)
        .grayscale()
        .negate()
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      qr = jsQR(
        new Uint8ClampedArray(inverted.data),
        inverted.info.width,
        inverted.info.height
      );
    }

    if (!qr) return null;
    return qr.data;
  } catch (e) {
    console.error("Erro na leitura do QR Code:", e);
    return null;
  }
}

function extrairChaveAcesso(qrData) {
  if (!qrData) return null;
  const matchParam = qrData.match(/chNFe=(\d{44})/i);
  if (matchParam) return matchParam[1];
  const matchP = qrData.match(/[?&]p=\|(\d{44})\|/);
  if (matchP) return matchP[1];
  const matchPath = qrData.match(/\/(\d{44})/);
  if (matchPath) return matchPath[1];
  const match44 = qrData.match(/(\d{44})/);
  if (match44) return match44[1];
  return null;
}

const UF_CODES = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
  21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL",
  28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR",
  42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
};

const MODELOS = {
  "55": "NF-e",
  "65": "NFC-e",
  "57": "CT-e",
  "67": "CT-e OS",
};

function formatCNPJ(cnpj) {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

function decodificarChave(chave) {
  if (!chave || chave.length !== 44) return null;

  const ufCode = chave.substring(0, 2);
  const aamm = chave.substring(2, 6);
  const cnpj = chave.substring(6, 20);
  const modelo = chave.substring(20, 22);
  const serie = chave.substring(22, 25);
  const numero = chave.substring(25, 34);

  const ano = 2000 + parseInt(aamm.substring(0, 2));
  const mes = parseInt(aamm.substring(2, 4));

  return {
    chave_acesso: chave,
    uf: UF_CODES[ufCode] || ufCode,
    data_emissao: `01/${mes.toString().padStart(2, "0")}/${ano}`, 
    cnpj_emitente: formatCNPJ(cnpj),
    modelo: MODELOS[modelo] || modelo,
    serie: parseInt(serie).toString(),
    numero: parseInt(numero).toString(),
  };
}

async function processarQrCodeImagem(base64Image) {
  try {
    const buffer = Buffer.from(base64Image, 'base64');
    const qrData = await lerQRCode(buffer);
    const chave = extrairChaveAcesso(qrData);
    if (!chave) return null;
    return decodificarChave(chave);
  } catch (e) {
    console.error("Falha ao processar QR image:", e);
    return null;
  }
}

module.exports = {
  processarQrCodeImagem
};
