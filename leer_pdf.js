require("dotenv").config();
const { BlobServiceClient } = require("@azure/storage-blob");
const pdfParse = require("pdf-parse");

// NIFs que deseas analizar (puedes reemplazarlos por cualquier lista dinámica)
const nifs = ["H25520222","H25483231","H25520222"];

async function checkFechaVisita(buffer, nif) {
  try {
    const data = await pdfParse(buffer);
    const text = data.text;

    const match = text.match(/Fecha de visita:\s*(\d{2})-(\d{2})-(\d{4})/);

    if (match) {
      const day = match[1];
      const month = match[2];
      const year = parseInt(match[3]);

      console.log(`[${nif}] Fecha encontrada: ${day}-${month}-${year}`);
      if (year < 2000) {
        console.log(`❌ [${nif}] La fecha es anterior al año 2000`);
      } else {
        console.log(`✅ [${nif}] La fecha es válida`);
      }
    } else {
      console.log(`⚠️ [${nif}] No se encontró la fecha de visita en el PDF`);
    }
  } catch (error) {
    console.error(`❌ [${nif}] Error al procesar PDF:`, error.message);
  }
}

async function processNifs() {
  const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = "fincas";

  const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient(containerName);

  for (const nif of nifs) {
    const blobName = `migr/${nif}/hoja-visita.pdf`;
    const blobClient = containerClient.getBlobClient(blobName);

    try {
      const downloadBlockBlobResponse = await blobClient.download();
      const buffer = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);

      await checkFechaVisita(buffer, nif);
    } catch (err) {
      console.error(`❌ [${nif}] No se pudo acceder al blob ${blobName}:`, err.message);
    }
  }
}

// Helper para convertir stream a Buffer
function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on("error", reject);
  });
}

processNifs().catch(console.error);
