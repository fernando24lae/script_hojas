const { getFechasPdf } = require("../get_pdf_info");
const { actualizarDosVentasDosPdf, actualizarDosVentasUnPdf } = require("./casos_actualizar");

const casoDosVentasUnPdf = async (resultado, connection, nif, fechas) => {
  //Si no esta ordenado y si solo tiene 2 ventas
  if (
    resultado.orderVisitaCorrecto === false &&
    resultado.details.length === 2
  ) {
    // const fechas = await getFechasPdf([resultado.properties.nif]);

    //Obtenemos el details_cae visitado erroneamente junto con su fecha de visista
    const detalleVisitado = resultado.details.find(d => d.visitada === 1 && d.visitSheet_id !== null);
    const fechaVisita = detalleVisitado?.visitSheetData?.createdAt;

    //Tiene un pdf en azure,
    if (fechaVisita && fechas.length === 1 && fechas[0].fecha === fechaVisita) {
      console.log("Esta CCPP solo tiene 1 pdf en azure");
      const correcionRegistros = await actualizarDosVentasUnPdf(connection, resultado);

      // console.log(correcionRegistros);
      return correcionRegistros && { ok: true };
    }
  }
  return { ok: false };

};
const casoDosVentasDosPdf = async (resultado, connection, nif, fechas) => {
  //Si no esta ordenado y si solo tiene 2 ventas
  if (
    resultado.orderVisitaCorrecto === false &&
    resultado.details.length === 2
  ) {
    // const fechas = await getFechasPdf([resultado.properties.nif]);
    //Tiene dos pdf en azure
    if (fechas.length === 2) {
      console.log("Esta CCPP tiene 2 pdf en azure");
      //   console.log(fechas);
      //   console.log(resultado.details);
      const fechasAsignadas = asignarFechasPorCoincidencia(
        fechas,
        resultado.details
      );
      const correcionRegistros = await actualizarDosVentasDosPdf(connection, fechasAsignadas, nif);

      // console.log(correcionRegistros);
      return correcionRegistros && { ok: true };
    }
  }

  return { ok: false };
};

function asignarFechasPorCoincidencia(fechasPdf, details) {
  // Parsear fechas del PDF (formato 'DD-MM-YYYY')
  const fechasParsed = fechasPdf.map((f) => {
    const [day, month, year] = f.fecha.split("-");
    return {
      ...f,
      fechaDate: new Date(`${year}-${month}-${day}`),
    };
  });

  // 🔍 Verificar si al menos un detail tiene visitSheetData con createdAt
  const hayAlgunVisitSheet = details.some((d) => d.visitSheetData?.createdAt);
  if (!hayAlgunVisitSheet) {
    return {
      ok: false,
      reason: "Ningún detail tiene visitSheetData",
      detalles: details,
      pdfsDisponibles: fechasPdf,
    };
  }

  let matchedDetail = null;
  let unmatchedDetail = null;
  let pdfUsado = null;

  // 🔁 Buscar coincidencia exacta en visitSheetData.createdAt
  for (const detail of details) {
    const fechaVisita = detail.visitSheetData?.createdAt;
    if (!fechaVisita) continue;

    const [day, month, year] = fechaVisita.split("-");
    const fechaDetail = new Date(`${year}-${month}-${day}`);

    const match = fechasParsed.find(
      (pdf) => pdf.fechaDate.toDateString() === fechaDetail.toDateString()
    );

    if (match) {
      matchedDetail = detail;
      pdfUsado = match;
      break;
    }
  }

  // ❌ Si no se encontró ninguna coincidencia con los PDFs
  if (!matchedDetail) {
    return {
      ok: false,
      reason:
        "Ningún visitSheetData.createdAt coincide con las fechas de los PDFs",
      detallesConVisita: details.filter((d) => d.visitSheetData),
      pdfsDisponibles: fechasPdf,
    };
  }

  // ✅ Hay coincidencia con una de las fechas, intentar asignar la otra por descarte
  unmatchedDetail = details.find((d) => d.id !== matchedDetail.id);
  const pdfNoUsado = fechasParsed.find((f) => f.fecha !== pdfUsado.fecha);
  const saleDateUnmatched = new Date(unmatchedDetail.saleDate);

  // Validación: la fecha del PDF debe ser mayor al saleDate del unmatched
  if (pdfNoUsado.fechaDate > saleDateUnmatched) {
    return {
      ok: true,
      matched: {
        detail: matchedDetail,
        fecha: pdfUsado.fecha,
        nombre_pdf: pdfUsado.pdf,
        status: "coincide",
      },
      unmatched: {
        detail: unmatchedDetail,
        nuevaFechaAsignada: pdfNoUsado.fecha,
        nombre_pdf: pdfNoUsado.pdf,
        status: "asignada por descarte",
      },
    };
  } else {
    return {
      ok: false,
      reason: `La fecha del PDF a asignar (${pdfNoUsado.fecha
        }) no es posterior al saleDate del detail sin coincidencia (${saleDateUnmatched.toISOString().split("T")[0]
        })`,
      detalleRechazado: unmatchedDetail,
      pdfNoAsignado: pdfNoUsado.fecha,
    };
  }
}

module.exports = { casoDosVentasUnPdf, casoDosVentasDosPdf };
