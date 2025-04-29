async function corregirOrden(connection, consulta) {
    try {
      await connection.beginTransaction(); // ⏳ INICIAR TRANSACCIÓN
  
      const saleConVisitada0 = consulta.details.find(d => d.visitada === 0);
      const saleConVisitada1 = consulta.details.find(d => d.visitada === 1);
  
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
      await connection.execute(
        "UPDATE sales SET tech_id = ? WHERE id = ?",
        [techId, saleConVisitada0.sale_id]
      );
  
      // 🔵 Y dejar tech_id a NULL en la antigua
      await connection.execute(
        "UPDATE sales SET tech_id = NULL WHERE id = ?",
        [saleConVisitada1.sale_id]
      );
  
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
  
  module.exports = { corregirOrden };
  