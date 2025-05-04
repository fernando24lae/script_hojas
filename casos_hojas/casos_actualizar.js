//Cambia el unmached que siempre será 1 si solo hay un resuletado que añadir
async function actualizarDosVentasDosPdf(connection, resultadoFinal, nif) {
  try {
    
    const detail = resultadoFinal.unmatched.detail;
    const saleId = detail.sale_id;
    const hojaVisitaNombre = resultadoFinal.unmatched.nombre_pdf;

    // 1. Iniciar transacción
    await connection.beginTransaction();

    // 2. Verificar que sale no tenga workcenter asignado
    const [saleRow] = await connection.execute(
      "SELECT workcenter_id FROM sales WHERE id = ?",
      [saleId]
    );

    const workcenter = saleRow[0]?.workcenter;

    if (workcenter) {
      throw new Error(`La venta ${saleId} ya tiene workcenter asignado.`);
    }

    // 3. Marcar la detail como visitada
    await connection.execute(
      "UPDATE details_caes SET visitada = 1 WHERE id = ?",
      [detail.id]
    );

    // 4. Insertar 3 registros en docsprops
    const docs = [
      {
        nombre: "plan de emergencia",
        ruta: `/storage/migr/${nif}/plan-emergencia.pdf`,
        type: "planEmergencia",
      },
      {
        nombre: "hoja de visita",
        ruta: `/storage/migr/${nif}/${hojaVisitaNombre}`,
        type: "hojaVisita",
      },
      {
        nombre: "identificacion de riesgos",
        ruta: `/storage/migr/${nif}/evaluacion-riesgos.pdf`,
        type: "evaluacionRiesgos",
      },
    ];

    for (const doc of docs) {
      await connection.execute(
        `INSERT INTO docsprops 
              (sale_id, visitSheet_id, servp_id, nombre, pendiente, ruta, validado, leido, status, type,createdAt,updatedAt)
              VALUES (?, NULL, NULL, ?, 1, ?, 1, NULL, 1, ?, NOW(), NOW())`,
        [saleId, doc.nombre, doc.ruta, doc.type]
      );
    }

    await connection.commit();
    console.log(`✅ Corrección aplicada con éxito para NIF ${nif}`);
    return true;
  } catch (err) {
    await connection.rollback();
    console.error(`❌ Error aplicando corrección para ${nif}:`, err.message);
    return false;
  }
}
async function actualizarDosVentasUnPdf(connection, consulta) {
  try {
    await connection.beginTransaction(); // ⏳ INICIAR TRANSACCIÓN

    const saleConVisitada0 = consulta.details.find((d) => d.visitada === 0);
    const saleConVisitada1 = consulta.details.find((d) => d.visitada === 1);

    if (!saleConVisitada0 || !saleConVisitada1) {
      throw new Error("No se encontraron detalles correctos para ajustar.");
    }
    
    // 🔵 PRIMERO obtener el tech_id de la venta visitada
    const [rows] = await connection.execute(
      "SELECT tech_id FROM sales WHERE id = ?",
      [saleConVisitada1.sale_id]
    );

    const techId = rows[0]?.tech_id ?? null;

    // 🔵 Ahora actualizar tech_id manualmente
    await connection.execute("UPDATE sales SET tech_id = ? WHERE id = ?", [
      techId,
      saleConVisitada0.sale_id,
    ]);

    // 🔵 Y dejar tech_id a NULL en la antigua
    await connection.execute("UPDATE sales SET tech_id = NULL WHERE id = ?", [
      saleConVisitada1.sale_id,
    ]);

    // 2. Invertir visitada en details_caes
    await connection.execute(
      "UPDATE details_caes SET visitada = 1 WHERE id = ?",
      [saleConVisitada0.id]
    );

    await connection.execute(
      "UPDATE details_caes SET visitada = 0, visitSheet_id = NULL WHERE id = ?",
      [saleConVisitada1.id]
    );

    // 3. Mover visitSheet_id si existe
    if (saleConVisitada1.visitSheet_id) {
      await connection.execute(
        "UPDATE details_caes SET visitSheet_id = ? WHERE id = ?",
        [saleConVisitada1.visitSheet_id, saleConVisitada0.id]
      );
    }

    // 4. Actualizar sale_id en docsprops
    await connection.execute(
      "UPDATE docsprops SET sale_id = ? WHERE sale_id = ?",
      [saleConVisitada0.sale_id, saleConVisitada1.sale_id]
    );

    await connection.commit(); // ✅ COMMIT
    console.log("✅ Corrección realizada y confirmada correctamente.");

    return true;
  } catch (err) {
    await connection.rollback(); // ❌ ROLLBACK
    console.error("❌ Error en la corrección, cambios deshechos:", err.message);
    return false;
  }
}
module.exports = {
    actualizarDosVentasDosPdf,
    actualizarDosVentasUnPdf
  };
  