const { consultarPorNif } = require("../db_registros");
const { getFechasPdf } = require("./get_pdf_info");
const { corregirOrden } = require("./update_registros");
const mysql = require("mysql2/promise");

(async () => {
  const dbConfig = {
    host: "localhost",
    user: "root",
    password: "root",
    database: "fincas",
  };

  const connection = await mysql.createConnection(dbConfig);

  const nif = "H28609964";
  const resultado = await consultarPorNif(nif,dbConfig);

  // Orden incorrecto de las ventas
  if (resultado.orderVisitaCorrecto === false) {
    const fechas = await getFechasPdf([nif]);
    
    for (const item of resultado.details) {
      if (resultado.details.length === 2) {
        if (item.visitada === 1 && item.visitSheet_id !== null) {
          console.log(item.visitSheetData.createdAt);

          for (const item2 of fechas) {
            // Si la fecha del pdf es igual a la del visitSheet de la db
            if (item2.fecha === item.visitSheetData.createdAt) {
              if (fechas.length === 1) {
                console.log("✅ Solo hay un pdf y sus fechas son iguales pero el orden es distinto");
                await corregirOrden(connection, resultado); // <--- Aquí llamas correctamente
              }
            }
          }
        }
      }
    }
  }

//   console.log(resultado);

  await connection.end();
})();
