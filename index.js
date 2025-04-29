const fs = require('fs');
const pdfParse = require('pdf-parse');

const buffer = fs.readFileSync('./hoja-visita_2.pdf');

pdfParse(buffer).then(data => {
  const text = data.text;

  // Buscar la línea con la fecha de visita
  const match = text.match(/Fecha de visita:\s*(\d{2})-(\d{2})-(\d{4})/);
  
  if (match) {
    const day = match[1];
    const month = match[2];
    const year = parseInt(match[3]);

    console.log(`Fecha encontrada: ${day}-${month}-${year}`);
    if (year < 2000) {
      console.log('❌ La fecha es anterior al año 2000');
    } else {
      console.log('✅ La fecha es válida');
    }
  } else {
    console.log('No se encontró la fecha de visita en el PDF');
  }
});
