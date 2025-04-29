require("dotenv").config();
const { BlobServiceClient } = require("@azure/storage-blob");
const pdfParse = require("pdf-parse");

const pdfFiles = [
  "hoja-visita.pdf",
  "hoja-visita_2020.pdf",
  "hoja-visita_2021.pdf",
  "hoja-visita_2022.pdf",
  "hoja-visita_2023.pdf",
  "hoja-visita_2024.pdf",
  "hoja-visita_2025.pdf"
];

async function extractFecha(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  const match = text.match(/Fecha de visita:\s*(\d{2})-(\d{2})-(\d{4})/);

  if (!match) return null;

  const [, day, month, yearStr] = match;
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

    if (fechaInfo.year < 2000) {
      console.log(`❌ [${nif}] "${fileName}": Fecha anterior al 2000`);
      return null;
    }

    console.log(`✅ [${nif}] "${fileName}": 📅 ${fechaInfo.date}`);
    return fechaInfo.date;

  } catch (error) {
    console.warn(`❌ [${nif}] "${fileName}": Error al descargar o procesar - ${error.message}`);
    return null;
  }
}

async function getFechasVisitaPorNif(nifArray) {
  const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = "fincas";
  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const resultadosPorNif = {};

  for (const nif of nifArray) { 
    console.log(`\n🔍 Procesando NIF: ${nif}`);
    const resultados = {};

    // Validar que exista el principal
    const fechaPrincipal = await checkPdf(containerClient, nif, pdfFiles[0]);

    if (!fechaPrincipal) {
      console.log(`⛔ [${nif}] Falta el archivo obligatorio "${pdfFiles[0]}" — omitiendo este NIF.`);
      continue;
    }

    resultados[pdfFiles[0]] = fechaPrincipal;

    for (let i = 1; i < pdfFiles.length; i++) {
      const fecha = await checkPdf(containerClient, nif, pdfFiles[i]);
      if (fecha) resultados[pdfFiles[i]] = fecha;
    }

    resultadosPorNif[nif] = resultados;
  }

  return resultadosPorNif;
}

function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", chunk => chunks.push(chunk));
    readableStream.on("end", () => resolve(Buffer.concat(chunks)));
    readableStream.on("error", reject);
  });
}

// EJEMPLO DE USO
// const nifs = ["H25763103"];
// getFechasVisitaPorNif(nifs).then(result => {
//   console.log( result);
// }).catch(console.error);
module.exports = {
    getFechasVisitaPorNif
  };