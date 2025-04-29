const { consultarPorNif } = require("../db_registros");
const { leerExcelFiltrado } = require("./excel_array");
const { getFechasPdf } = require("./get_pdf_info");
const { corregirOrden } = require("./update_registros");
const { actualizarExcelTerminados } = require("./update_excel_estado");
const mysql = require("mysql2/promise");
const path = require("path");

const ruta = path.resolve(__dirname, "ventas.xlsx");
const resultadoExcel = leerExcelFiltrado(ruta);

(async () => {
  const dbConfig = {
    host: "localhost",
    user: "root",
    password: "root",
    database: "fincas",
  };

  const connection = await mysql.createConnection(dbConfig);
  const nifsCorregidos = [];

  for (const nif of resultadoExcel) {
    try {
      const resultado = await consultarPorNif(nif, dbConfig);

      if (resultado.orderVisitaCorrecto === true) {
        console.log(`✅ ${nif} ya está ordenado correctamente.`);
        nifsCorregidos.push(nif); // 💾 marcar como terminado igualmente
        continue;
      }
      if (resultado.orderVisitaCorrecto === false && resultado.details.length === 2) {
        const fechas = await getFechasPdf([nif]);

        const detalleVisitado = resultado.details.find(d => d.visitada === 1 && d.visitSheet_id !== null);
        const fechaVisita = detalleVisitado?.visitSheetData?.createdAt;


        if (fechaVisita && fechas.length === 1 && fechas[0].fecha === fechaVisita) {
          console.log(`✅ Corrigiendo ${nif}...`);
          const ok = await corregirOrden(connection, resultado);
          if (ok) {
            nifsCorregidos.push(nif);
          }
        } else {
          console.log(`⏭️ NIF ${nif} no cumple condiciones de fecha/PDF.`);
        }
      } else {
        console.log(`✅ ${nif} ya está ordenado o no tiene 2 detalles.`);
      }
    } catch (err) {
      console.error(`❌ Error procesando ${nif}:`, err.message);
    }
  }

  await connection.end();

  if (nifsCorregidos.length > 0) {
    actualizarExcelTerminados(ruta, nifsCorregidos);
  } else {
    console.log("⚠️ No se corrigió ningún NIF.");
  }
})();
