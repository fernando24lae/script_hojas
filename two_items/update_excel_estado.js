const xlsx = require("xlsx");

/**
 * Marca como "terminado" en la columna B para cada NIF corregido.
 * @param {string} rutaArchivo - Ruta al archivo Excel
 * @param {string[]} listaNIFsTerminados - Lista de NIFs corregidos
 */
function actualizarExcelTerminados(rutaArchivo, listaNIFsTerminados) {
  const workbook = xlsx.readFile(rutaArchivo);
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const datos = xlsx.utils.sheet_to_json(hoja, { header: 1, defval: "" });

  const nuevosDatos = datos.map(fila => {
    const nif = String(fila[0]).trim();
    const estado = String(fila[1] || "").toLowerCase().trim();

    if (listaNIFsTerminados.includes(nif) && estado === "corregir") {
      return [nif, "terminado"];
    }
    return fila;
  });

  const nuevaHoja = xlsx.utils.aoa_to_sheet(nuevosDatos);
  workbook.Sheets[workbook.SheetNames[0]] = nuevaHoja;
  xlsx.writeFile(workbook, rutaArchivo);
  console.log(`📄 Excel actualizado con ${listaNIFsTerminados.length} NIF(s) marcados como "terminado".`);
}

module.exports = { actualizarExcelTerminados };
