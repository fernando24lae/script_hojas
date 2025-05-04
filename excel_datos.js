const xlsx = require("xlsx");

/**
 * Marca como "terminado" en la columna B para cada NIF corregido.
 * @param {string} rutaArchivo - Ruta al archivo Excel
 * @param {string[]} listaNIFsTerminados - Lista de NIFs corregidos
 */
function actualizarExcelTerminados(rutaArchivo, listaNIFsTerminados,tipoCaso) {
  const workbook = xlsx.readFile(rutaArchivo);
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  const datos = xlsx.utils.sheet_to_json(hoja, { header: 1, defval: "" });

  const nuevosDatos = datos.map(fila => {
    const nif = String(fila[0]).trim();
    const estado = String(fila[1] || "").toLowerCase().trim();
    const caso = listaNIFsTerminados.find(item => item.nif === nif);

    if (caso && estado === "corregir") {
      return [nif, "terminado", caso.tipo];
    }
    return fila.length >= 3 ? fila : [...fila, ""];
  });

  const nuevaHoja = xlsx.utils.aoa_to_sheet(nuevosDatos);
  workbook.Sheets[workbook.SheetNames[0]] = nuevaHoja;
  xlsx.writeFile(workbook, rutaArchivo);
  console.log(`📄 Excel actualizado con ${listaNIFsTerminados.length} NIF(s) marcados como "terminado".`);
}

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

/**
 * Marca como "correcta_por_defecto" en columna B si orderVisitaCorrecto es true y en Excel está como "corregir"
 * @param {string} rutaArchivo - Ruta al Excel
 * @param {Array<{nif: string, resultado: object}>} listaResultados
 */
function actualizarExcelCorrectasPorDefecto(rutaArchivo, listaResultados) {
    const workbook = xlsx.readFile(rutaArchivo);
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  
    const nuevosDatos = datos.map(fila => {
      const nif = String(fila[0] || "").trim();
      const estado = String(fila[1] || "").toLowerCase().trim();
  
      const resultadoItem = listaResultados.find(
        r => r.nif === nif && r.resultado?.orderVisitaCorrecto === true
      );
  
      if (resultadoItem && estado === "corregir") {
        return [nif, "correcta_por_defecto"];
      }
  
      return fila;
    });
  
    const nuevaHoja = xlsx.utils.aoa_to_sheet(nuevosDatos);
    workbook.Sheets[workbook.SheetNames[0]] = nuevaHoja;
    xlsx.writeFile(workbook, rutaArchivo);
  
    console.log(`📄 Excel actualizado con ${listaResultados.length} NIF(s) marcados como "correcta_por_defecto".`);
  }

  function actualizarExcelWorkcenter(rutaArchivo, listaResultados) {
    const workbook = xlsx.readFile(rutaArchivo);
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const datos = xlsx.utils.sheet_to_json(hoja, { header: 1, defval: "" });
  
    const nuevosDatos = datos.map(fila => {
      const nif = String(fila[0] || "").trim();
      const estado = String(fila[1] || "").toLowerCase().trim();
  
      const resultadoItem = listaResultados.find(
        r => r.nif === nif && r.resultado?.workcenter === true
      );
  
      if (resultadoItem && estado === "corregir") {
        return [nif, "workcenter"];
      }
  
      return fila;
    });
  
    const nuevaHoja = xlsx.utils.aoa_to_sheet(nuevosDatos);
    workbook.Sheets[workbook.SheetNames[0]] = nuevaHoja;
    xlsx.writeFile(workbook, rutaArchivo);
  
    console.log(`📄 Excel actualizado con ${listaResultados.length} NIF(s) marcados como "workcenter".`);
  }

module.exports = { actualizarExcelTerminados,leerExcelFiltrado,actualizarExcelCorrectasPorDefecto,actualizarExcelWorkcenter };
