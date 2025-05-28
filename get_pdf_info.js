require("dotenv").config();
const { BlobServiceClient } = require("@azure/storage-blob");
const pdfParse = require("pdf-parse");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");
const fontkit = require("@pdf-lib/fontkit");
const { PdfReader } = require("pdfreader");

const pdfFiles = [
  "hoja-visita.pdf",
  "hoja-visita_2020.pdf",
  "hoja-visita_2021.pdf",
  "hoja-visita_2022.pdf",
  "hoja-visita_2023.pdf",
  "hoja-visita_2024.pdf",
  "hoja-visita_2025.pdf",
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
    const AZURE_STORAGE_CONNECTION_STRING =
      process.env.AZURE_STORAGE_CONNECTION_STRING;
    const containerName = "fincas";
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      AZURE_STORAGE_CONNECTION_STRING
    );
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
    console.log(`Fechas de los pdf ${nif} :`, resultados);
    return resultados;
  } catch (error) {
    // console.log("Error al obtener las fechas de los pdf", error);
    console.error(
      "❌ Error crítico al conectar con Azure Blob Storage:",
      error.message
    );
  }
}

function streamToBuffer(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (chunk) => chunks.push(chunk));
    readableStream.on("end", () => resolve(Buffer.concat(chunks)));
    readableStream.on("error", reject);
  });
}

async function findDateCoordinates(buffer, dateString) {
  // Carga con pdfjs
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(1);                // asumimos página 1
  const viewport = page.getViewport({ scale: 1.0 }); // escala 1:1

  // Extrae todos los textos con sus transformaciones
  const textContent = await page.getTextContent();
  for (const item of textContent.items) {
    if (item.str.trim() === dateString) {
      const [ , , , , x, yPDFjs ] = item.transform;
      // pdfjs y=distancia desde la esquina **inferior** de la página
      // viewport.height es la altura en unidades PDF
      return { x, yPDFjs, pageHeight: viewport.height };
    }
  }
  throw new Error(`No encontré el texto "${dateString}" en la página 1.`);
}

async function actualizarFechaPdf(aaff_size,nif, originalName, oldDate, newDate, newName) {
  // 1) Inicializar Azure BlobService
  const AZ = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const blobService = BlobServiceClient.fromConnectionString(AZ);
  const container = blobService.getContainerClient("fincas");
  const path = `migr/${nif}/${originalName}`;

  // 2) Descargar PDF a Buffer
  const blobClient = container.getBlobClient(path);
  const downloadRes = await blobClient.download();
  const buffer = await streamToBuffer(downloadRes.readableStreamBody);

  // 2.1) Encontrar posición de "Fecha de visita:" en ese buffer
  const pos = await getTextPositionFromBuffer(buffer, "Fecha de visita:");
  if (!pos) {
    throw new Error(`No se encontró "Fecha de visita:" en ${originalName}`);
  }
  console.log("possss",pos);
  throw new Error(`pararra`);
  // 3) Verificar que la fecha vieja está en el PDF
  const found = await extractFecha(buffer);
  if (!found) {
    throw new Error(`Fecha "${oldDate}" no encontrada en ${originalName}`);
  }
  if (found !== oldDate) {
    console.warn(
      `Fecha detectada "${found}" ≠ fecha solicitada "${oldDate}", se reemplazará igual.`
    );
  }

  // 4) Cargar PDF, registrar fontkit e embeber Liberation Sans
  const pdfDoc = await PDFDocument.load(buffer);
  pdfDoc.registerFontkit(fontkit);
  const fontBytes = fs.readFileSync("./fonts/LiberationSans-Regular.ttf");
  const liberSans = await pdfDoc.embedFont(fontBytes);

  const pages = pdfDoc.getPages();

  // 5) Ajustes de posición y estilo
  console.log("Tamaño del nombre del aaff:", aaff_size);
  const x =  164; // Ajuste según el tamaño del nombre del aaff
  // const y = (aaff_size <= 26 ) ? 642 : 639; // Ajuste según el tamaño del nombre del aaff
  const y = pos.y;
  const width = 110;
  const height = 10;
  const fontSize = 8.2;

  const firstPage = pages[0];
    // Ocultar la fecha vieja
    firstPage.drawRectangle({
      x : x- 2,
      y: y - 1,
      width,
      height : height + 2,
      color: rgb(1,1,1),
    });
    // Escribir la fecha nueva
    firstPage.drawText(newDate, {
      x,
      y:y + 2,
      size: fontSize,
      font: liberSans,
      color: rgb(0, 0, 0),
    });
  

  const modifiedPdf = await pdfDoc.save();

  // 6) Subir el PDF modificado bajo el nombre indicado
  const newBlobClient = container.getBlockBlobClient(`migr/${nif}/${newName}`);
  await newBlobClient.uploadData(modifiedPdf, {
    blobHTTPHeaders: { blobContentType: "application/pdf" },
  });

  console.log(`✔ "${originalName}" → "${newName}" subido correctamente.`);
}

// helper que lee un Buffer de PDF y devuelve {x,y} de "Fecha de visita:" en la página 1

function getTextPositionFromBuffer(buffer) {
  return new Promise((resolve, reject) => {
    let currentPage = 0;
    const page1Items = [];

    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) return reject(err);

      if (!item) {
        // Agrupar por línea usando Y redondeado
        const lines = {};
        for (const it of page1Items) {
          const yKey = Math.round(it.y);
          (lines[yKey] ||= []).push(it);
        }

        // Buscar en cada línea el patrón de fecha
        const regex = /Fecha de visita:\s*(\d{2}-\d{2}-\d{4})/i;
        for (const yKey of Object.keys(lines).sort((a, b) => a - b)) {
          const items = lines[yKey].sort((a, b) => a.x - b.x);
          
          // Reconstruir la línea conservando espacios aproximados
          let row = '';
          let prevX = 0;
          for (const it of items) {
            if (row.length > 0 && it.x > prevX + 5) { // Añadir espacio si hay suficiente separación
              row += ' ';
            }
            row += it.text;
            prevX = it.x + (it.text.length * 5); // Estimación aproximada del ancho del texto
          }

          const m = row.match(regex);
          if (m) {
            const dateStr = m[1];
            const fullMatch = m[0]; // "Fecha de visita: DD-MM-YYYY"
            const matchStart = m.index;
            const dateStart = matchStart + fullMatch.indexOf(dateStr);
            
            // Encontrar el fragmento exacto que contiene la fecha
            let currentPos = 0;
            for (const it of items) {
              const textLength = it.text.length;
              if (currentPos + textLength > dateStart) {
                // Calcular la posición exacta dentro del fragmento
                const offsetInFragment = dateStart - currentPos;
                return resolve({
                  x: it.x + (offsetInFragment * 5), // Aproximación del ancho de caracter
                  y: it.y,
                  date: dateStr,
                  text: fullMatch // Solo devolvemos el texto que nos interesa
                });
              }
              currentPos += textLength + (currentPos > 0 ? 1 : 0); // +1 por los espacios añadidos
            }
          }
        }
        return resolve(null);
      }

      if (item.page) {
        currentPage = item.page;
        return;
      }

      if (currentPage === 1 && item.text) {
        page1Items.push(item);
      }
    });
  });
}

// Ejemplo de llamada
// (async () => {
//   try {
//     await actualizarFechaPdf(
//       "H54083365",
//       "hoja-visita_2024.pdf",
//       "26-11-2024",
//       "30-05-2025",
//       "hoja-visita_2023.pdf"
//     );
//   } catch (err) {
//     console.error("Error:", err.message);
//   }
// })();
module.exports = {
  getFechasPdf,
  actualizarFechaPdf
};
