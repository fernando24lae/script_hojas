const path = require("path");
const mysql = require("mysql2/promise");
const { consultarPorNif } = require("./db_registros");
const {
  casoDosVentas,
  casoDosVentasDosPdf,
  casoDosVentasUnPdf,
} = require("./casos_hojas/casos_busqueda");
const {
  actualizarExcelTerminados,
  leerExcelFiltrado,
  actualizarExcelCorrectasPorDefecto,
} = require("./excel_datos");

const isDev = process.env.NODE_ENV !== "production";
const ruta = path.resolve(__dirname, "ventas_v2.xlsx");
const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "root",
  database: process.env.MYSQL_DATABASE || "fincas",
  port: isDev ? process.env.MYSQL_PORT || 3306 : 3306,
  port: isDev ? process.env.MYSQL_PORT || 3306 : 3306,
  ssl:
    process.env.CUSTOM_SSL_DEPLOY === "deploy"
      ? {
          rejectUnauthorized: true, // o false si usas certificados autofirmados
        }
      : undefined,
};

const resultadoExcel = leerExcelFiltrado(ruta);

(async () => {
  // Configuración de la base de datos
  const connection = await mysql.createConnection(dbConfig);
  const nifsCorregidos = [];
  const listaResultadosCorrectos = [];

  // Leer el archivo Excel filtrado
  for (const nif of resultadoExcel) {
    try {
      
      // Consultar la base de datos por NIF
      const resultado = await consultarPorNif(nif, dbConfig);

      // Verificamos si ya estaba correcto
      if (resultado.orderVisitaCorrecto === true) {
        listaResultadosCorrectos.push({ nif, resultado });
        continue; // saltamos a la siguiente iteración
      }

      const salida = await ejecutarCasosEnCadena(resultado, connection, nif, [
        casoDosVentasDosPdf,
        casoDosVentasUnPdf,
      ]);

      if (salida) {
        console.log(`✅ Caso resuelto para ${nif}`);
        nifsCorregidos.push(nif);
      } else {
        console.log(`⚠️ Ningún caso aplicable para ${nif}`);
      }
    } catch (error) {
      console.error(`❌ Error procesando ${nif}:`, error.message);
    }
  }
  // Cerrar la conexión a la base de datos
  await connection.end();

  if (listaResultadosCorrectos.length > 0) {
    actualizarExcelCorrectasPorDefecto(ruta, listaResultadosCorrectos);
  }
  if (nifsCorregidos.length > 0) {
    actualizarExcelTerminados(ruta, nifsCorregidos);
  } else {
    console.log("⚠️ No se corrigió ningún NIF.");
  }
})();

async function ejecutarCasosEnCadena(resultado, connection, nif, casos) {
  for (const caso of casos) {
    const salida = await caso(resultado, connection, nif);
    if (salida && salida.ok) {
      return salida; // Caso resuelto
    }
  }
  return null; // Ningún caso resolvió
}
