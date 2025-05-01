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

    if (!fechaInfo || fechaInfo.year < 2000) return null;
    return { pdf: fileName, fecha: fechaInfo.date };

  } catch (error) {
    // console.error("❌ Error al descargar PDF: "+fileName, error.message, error.statusCode, error.details);
    // return null; 

    // Silenciar errores individuales por archivos no encontrados o sin permisos
    if (error.statusCode === 404 || error.statusCode === 403) return null;
    // Re-lanzar errores críticos (p. ej. problemas de conexión)
    throw error;
  }
}

async function getFechasPdf(nifArray) {
  try {
    const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = "fincas";
    const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(containerName);

    const nif = nifArray[0]; // Solo procesamos el primer NIF
    // console.log(`\n🔍 Procesando NIF: ${nif}`);

    const resultados = [];

    for (const file of pdfFiles) {
      const item = await checkPdf(containerClient, nif, file);
      if (item) resultados.push(item);
    }

    if (resultados.length === 0) {
      console.warn(`⚠️ No se encontró ningún PDF válido para el NIF: ${nif}`);
    }
    console.log(`Fechas de los pdf ${nif} :`,resultados);
    return resultados;
  } catch (error) {
    // console.log("Error al obtener las fechas de los pdf", error);
    console.error("❌ Error crítico al conectar con Azure Blob Storage:", error.message);

  }

}

function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", chunk => chunks.push(chunk));
    readableStream.on("end", () => resolve(Buffer.concat(chunks)));
    readableStream.on("error", reject);
  });
}

module.exports = {
  getFechasPdf
};
