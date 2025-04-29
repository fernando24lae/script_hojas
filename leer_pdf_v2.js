require("dotenv").config();
const { BlobServiceClient } = require("@azure/storage-blob");
const pdfParse = require("pdf-parse");

// NIFs que deseas analizar
// const nifs = ["H25520222", "H25483231", "H25520222"];
const nifs = ["H25763103"];

// Lista de nombres de archivos a verificar
const pdfFiles = [
  "hoja-visita.pdf",       // obligatorio
  "hoja-visita_2023.pdf",
  "hoja-visita_2024.pdf",
  "hoja-visita_2025.pdf"
];

async function extractFecha(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const match = text.match(/Fecha de visita:\s*(\d{2})-(\d{2})-(\d{4})/);

  if (!match) return null;

  const [ , day, month, yearStr ] = match;
  const year = parseInt(yearStr);
  return { date: `${day}-${month}-${yearStr}`, year };
}

async function checkPdf(containerClient, nif, fileName) {
  const blobPath = `migr/${nif}/${fileName}`;
  const blobClient = containerClient.getBlobClient(blobPath);

  try {
    const response = await blobClient.download();
    const buffer = await streamToBuffer(response.readableStreamBody);
    const fechaInfo = await extractFecha(buffer);

    if (!fechaInfo) {
      console.log(`⚠️ [${nif}] "${fileName}": ❌ No se encontró la fecha de visita`);
      return null;
    }

    console.log(`[${nif}] "${fileName}": 📅 Fecha encontrada: ${fechaInfo.date}`);
    if (fechaInfo.year < 2000) {
      console.log(`❌ [${nif}] "${fileName}": Fecha anterior al 2000`);
    } else {
      console.log(`✅ [${nif}] "${fileName}": Fecha válida`);
    }

    return fechaInfo.date;

  } catch (error) {
    console.warn(`❌ [${nif}] "${fileName}": No se pudo descargar o procesar - ${error.message}`);
    return null;
  }
}

async function processNifs() {
  const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = "fincas";
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  for (const nif of nifs) {
    console.log(`\n🔍 Procesando NIF: ${nif}`);

    const results = {};

    // Primero verifica si el PDF principal existe
    const fechaPrincipal = await checkPdf(containerClient, nif, pdfFiles[0]);

    if (!fechaPrincipal) {
      console.log(`⛔ [${nif}] No se encontró el PDF obligatorio "${pdfFiles[0]}" — se omiten los demás.`);
      continue;
    }

    results[pdfFiles[0]] = fechaPrincipal;

    // Procesar los demás PDFs si el principal existe
    for (let i = 1; i < pdfFiles.length; i++) {
      const fecha = await checkPdf(containerClient, nif, pdfFiles[i]);
      if (fecha) results[pdfFiles[i]] = fecha;
    }

    console.log(`📦 Resultados para ${nif}:`, results);
  }
}

// Convierte un stream a buffer
function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", chunk => chunks.push(chunk));
    readableStream.on("end", () => resolve(Buffer.concat(chunks)));
    readableStream.on("error", reject);
  });
}

processNifs().catch(console.error);
