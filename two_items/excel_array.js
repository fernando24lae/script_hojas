const xlsx = require("xlsx");
const path = require("path");

function leerExcelFiltrado(rutaArchivo) {
  const workbook = xlsx.readFile(rutaArchivo);
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const datos = xlsx.utils.sheet_to_json(hoja, { header: 1, defval: "" });

  const resultado = [];

  for (let i = 0; i < datos.length; i++) {
    const fila = datos[i];
    // console.log(`🔎 Fila ${i + 1}:`, fila); // 👈 importante

    const colB = String(fila[0] || "").trim();
    const colC = String(fila[1] || "").toLowerCase().trim();

    if (colB !== "" && colC == "corregir") {
      resultado.push(colB);
    }
  }

  return resultado;
}

module.exports = { leerExcelFiltrado };
