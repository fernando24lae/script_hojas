const mysql = require("mysql2/promise");



async function consultarPorNif(nif,db) {
  const connection = await mysql.createConnection(db);
  try {
    console.log(`🔍 Consultando propiedad para NIF: ${nif}`);

    // 1. CONSULTA PROPIEDAD
    const [properties] = await connection.execute(
      "SELECT id, aaff_id, razonSocial, status FROM properties WHERE nif = ?",
      [nif]
    );

    if (properties.length === 0)
      throw new Error(`No se encontró ninguna propiedad con NIF: ${nif}`);

    const prop = properties[0];

    // 2. VALIDAR OBSERVACION DE NO VISITA
    const [aaffRows] = await connection.execute(
      "SELECT id, observacionNoVisita, status FROM aaffs WHERE id = ?",
      [prop.aaff_id]
    );

    if (aaffRows.length === 0) {
      throw new Error(`❌ No se encontró el aaff con ID: ${prop.aaff_id}`);
    }

    const aaff = aaffRows[0];
    if (
      aaff.observacionNoVisita !== null &&
      aaff.observacionNoVisita.trim() !== ""
    ) {
      throw new Error(
        `🚫 Observación de no visita: \"${aaff.observacionNoVisita}\"`
      );
    }

    console.log("✅ No hay observación de no visita, continuando...");

    // 3. CONSULTA SALES
    const [sales] = await connection.execute(
      "SELECT * FROM sales WHERE prop_id = ? AND servp_id IN (?, ?, ?, ?) AND status = true",
      [prop.id, 1, 3, 6, 7]
    );

    if (sales.length === 0)
      throw new Error(
        `No se encontró ninguna venta válida para la propiedad con ID: ${prop.id}`
      );

    const saleIds = sales.map((row) => row.id);

    // 4. CONSULTA DETAILS_CAES
    const placeholders1 = saleIds.map(() => "?").join(",");
    const [details] = await connection.execute(
      `SELECT * FROM details_caes WHERE sale_id IN (${placeholders1})`,
      saleIds
    );

    if (details.length === 0)
      throw new Error(
        `No se encontraron detalles en details_caes para sales: ${saleIds.join(
          ", "
        )}`
      );

    // 4.1 CONSULTA VISITSHEET SI EXISTE
    const visitSheetIds = details
      .filter((detail) => detail.visitSheet_id !== null) // Sólo donde existe visitSheet_id
      .map((detail) => detail.visitSheet_id);

    // Si hay algún visitSheet que consultar
    let visitSheetMap = {};

    if (visitSheetIds.length > 0) {
      const placeholdersVS = visitSheetIds.map(() => "?").join(",");
      const [visitSheets] = await connection.execute(
        `SELECT id,prop_id,aaff_id,tech_id,DATE_FORMAT(createdAt, '%d-%m-%Y') AS createdAt FROM visitsheets WHERE id IN (${placeholdersVS})`,
        visitSheetIds
      );

      // Crear un mapa rápido de id -> visitsheet
      visitSheets.forEach((vs) => {
        visitSheetMap[vs.id] = vs;
      });

      console.log(
        `✅ Se encontraron ${visitSheets.length} registros en visitsheet.`
      );
    }

    // 4.2 UNIR VISITSHEET A DETAILS
    const detailsConVisitas = details.map((detail) => {
      if (detail.visitSheet_id && visitSheetMap[detail.visitSheet_id]) {
        return {
          ...detail,
          visitSheetData: visitSheetMap[detail.visitSheet_id], // Añadimos los datos de visitsheet
        };
      }
      return detail; // Si no hay visitsheet, dejamos igual
    });

    // 5. CONSULTA DOCSPROPS
    const placeholders2 = saleIds.map(() => "?").join(",");
    const [docs] = await connection.execute(
      `SELECT * FROM docsprops WHERE sale_id IN (${placeholders2})`,
      saleIds
    );

    if (docs.length === 0)
      throw new Error(
        `No se encontraron documentos en docsprops para sales: ${saleIds.join(
          ", "
        )}`
      );

    // 7. VALIDAR ORDEN DE VISITAS
    const orderVisitaCorrecto = validarVisitas(details);

    // 8. RETORNAR OBJETO UNIFICADO
    const consultaUnificadaFinal = {
      properties: prop,
      sales: sales,
      details: detailsConVisitas,
      docs: docs,
      orderVisitaCorrecto: orderVisitaCorrecto, // <-- Aquí agregamos el booleano
    };

    return consultaUnificadaFinal;
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
    return null;
  } finally {
    // await connection.end();
    console.log("🔌 Conexión cerrada.");
  }
}

function validarVisitas(data) {
  const ordenado = [...data].sort(
    (a, b) => new Date(a.saleDate) - new Date(b.saleDate)
  );
  let huboNoVisitada = false;
  let errores = [];

  for (let i = 0; i < ordenado.length; i++) {
    const actual = ordenado[i];
    if (actual.visitada === 0) {
      huboNoVisitada = true;
    }
    if (actual.visitada === 1 && huboNoVisitada) {
      errores.push({
        id: actual.id,
        sale_id: actual.sale_id,
        saleDate: actual.saleDate,
        error:
          "Caso incorrecto: se ha marcado como visitada una fecha posterior a una no visitada.",
      });
    }
  }

  if (errores.length > 0) {
    console.log("❌ Se encontraron visitas en orden incorrecto:");
    errores.forEach((err) => {
      console.log(
        `- sale_id: ${err.sale_id} | Fecha: ${
          err.saleDate.toISOString().split("T")[0]
        } | ${err.error}`
      );
    });
    return false; // <- Se encontró error
  } else {
    console.log("✅ Todas las visitas están en orden correcto.");
    return true; // <- Todo OK
  }
}

module.exports = { consultarPorNif };
