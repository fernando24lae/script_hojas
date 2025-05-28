const fs = require('fs');
const { PDFDocument } = require('pdf-lib');




async function getTextPosition(pdfPath, targetText) {
  // Importación dinámica de pdfjs-dist
  const { getDocument } = await import('pdfjs-dist');

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = getDocument(data);
  const pdf = await loadingTask.promise;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (item.str.includes(targetText)) {
        console.log(`Texto encontrado en la página ${i}:`);
        console.log(`Posición X: ${item.transform[4]}, Y: ${item.transform[5]}`);
        return { page: i, y: item.transform[5] };
      }
    }
  }

  console.log("Texto no encontrado.");
  return null;
}

// Uso
getTextPosition('./hoja-visita_2023.pdf', 'Fecha de visita:')
  .then(result => {
    if (result) {
      console.log(`La posición Y de "Fecha de visita:" es: ${result.y}`);
    }
  });