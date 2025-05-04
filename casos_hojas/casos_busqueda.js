const { getFechasPdf } = require("../get_pdf_info");
const {
  actualizarDosVentasDosPdf,
  actualizarDosVentasUnPdf,
} = require("./casos_actualizar");

const casoDosVentasUnPdf = async (resultado, connection, nif, fechas, tipoCaso) => {
  if (resultado.sales.length > 2) {
    // console.log("Esta CCPP tiene más de 2 ventas, no se puede corregir.");
    return { ok: false };
  }
  //Si no esta ordenado y si solo tiene 2 ventas
  if (
    resultado.orderVisitaCorrecto === false &&
    resultado.details.length === 2
  ) {
    //Obtenemos el details_cae visitado erroneamente junto con su fecha de visista
    const detalleVisitado = resultado.details.find(
      (d) => d.visitada === 1 && d.visitSheet_id !== null
    );
    const fechaVisita = detalleVisitado?.visitSheetData?.createdAt;

    //Tiene un pdf en azure,
    if (fechaVisita && fechas.length === 1 && fechas[0].fecha === fechaVisita) {
      console.log("Esta CCPP solo tiene 1 pdf en azure");
      const correcionRegistros = await actualizarDosVentasUnPdf(
        connection,
        resultado
      );
      tipoCaso = "Caso 2 Ventas 1 Pdf";
      console.log(`Esta CCPP ${nif}: Es el caso tiene 2 Ventas y 1 Pdf`);
      return correcionRegistros && { ok: true, tipo: tipoCaso };
    }
  }
  return { ok: false };
};
const casoDosVentasDosPdf = async (resultado, connection, nif, fechas, tipoCaso) => {
  if (resultado.sales.length > 2) {
    // console.log("Esta CCPP tiene más de 2 ventas, no se puede corregir.");
    return { ok: false };
  }
  //Si no esta ordenado y si solo tiene 2 ventas
  if (
    resultado.orderVisitaCorrecto === false &&
    resultado.details.length === 2
  ) {
    //Tiene dos pdf en azure
    if (fechas.length === 2) {
      console.log("Esta CCPP tiene 2 pdf en azure");

      const fechasAsignadas = asignarFechasPorCoincidencia(
        fechas,
        resultado.details
      );
      const correcionRegistros = await actualizarDosVentasDosPdf(
        connection,
        fechasAsignadas,
        nif
      );

      console.log(`Esta CCPP ${nif}: Es el caso tiene 2 Ventas y 2 Pdf`);
      tipoCaso = "Caso 2 Ventas 2 Pdf";
      return correcionRegistros && { ok: true, tipo: tipoCaso };
    }
  }

  return { ok: false };
};

const casoTresVentasDosPdf = async (resultado, connection, nif, fechas, tipoCaso) => {
  if (resultado.sales.length > 3) {
    console.log("Esta CCPP tiene más de 3 ventas, no se puede corregir.");
    return { ok: false };
  }

  //Si no esta ordenado y si tiene 3 ventas
  if (
    resultado.orderVisitaCorrecto === false &&
    resultado.details.length === 3 &&
    resultado.sales.length === 3
  ) {
    //Asugaramos que tiene 2 pdf
    if (fechas.length === 2) {
      console.log("ENTRARON AL CASO 3 VENTAS 2 PDF");

      const fechasAsignadas = asignarFechasTresVentasDosPdf(
        fechas,
        resultado.details
      );
      // console.log(fechasAsignadas);
      if (fechasAsignadas.ok && fechasAsignadas.unmatched) {
        const correcionRegistros = await actualizarDosVentasDosPdf(
          connection,
          fechasAsignadas,
          nif
        );

        console.log(`Esta CCPP ${nif}: Es el caso tiene 3 Ventas y 2 Pdf`);
        tipoCaso = "Caso 3 Ventas 2 Pdf";
        return correcionRegistros && { ok: true, tipo: tipoCaso };
      }
    }
  }
};

const casoTresVentasDosPdf2V = async (resultado, connection, nif, fechas, tipoCaso) => {
  if (resultado.sales.length > 3) {
    console.log("Esta CCPP tiene más de 3 ventas, no se puede corregir.");
    return { ok: false };
  }

  //Si no esta ordenado y si tiene 3 ventas
  if (
    resultado.orderVisitaCorrecto === false &&
    resultado.details.length === 3 &&
    resultado.sales.length === 3
  ) {
    //Asugaramos que tiene 2 pdf
    if (fechas.length === 2) {
      console.log("ENTRARON AL CASO 4, 2 VENTAS 2 PDF CON 2 VISISHEET");

      const fechasAsignadas = asignarFechasTresVentasDosPdf2v(
        fechas,
        resultado.details
      );
      if (fechasAsignadas.ok && fechasAsignadas.unmatched) {
        const correcionRegistros = await actualizarDosVentasDosPdf(
          connection,
          fechasAsignadas,
          nif
        );

        console.log(`Esta CCPP ${nif}: Es el caso tiene 3 Ventas y 2 Pdf`);
        tipoCaso = "Caso 3 Ventas 2 Pdf Y 2 VisitSheets";
        return correcionRegistros && { ok: true, tipo: tipoCaso };
      }
    }
  }
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
    console.warn(
      `La fecha del PDF a asignar (${pdfNoUsado.fecha
      }) no es posterior al saleDate del detail sin coincidencia (${saleDateUnmatched.toISOString().split("T")[0]
      })`
    );

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

function asignarFechasTresVentasDosPdf(fechasPdf, details) {
  // 1. Parsear fechas del PDF (formato 'DD-MM-YYYY')
  const fechasParsed = fechasPdf.map((f) => {
    const [day, month, year] = f.fecha.split("-");
    return {
      ...f,
      fechaDate: new Date(`${year}-${month}-${day}`),
    };
  });

  // 2. Validar que haya al menos un visitsheet
  const detailsConVisita = details.filter((d) => d.visitSheetData?.createdAt);

  if (detailsConVisita.length === 0) {
    return {
      ok: false,
      reason: "Ningún detail tiene visitSheetData",
      detalles: details,
      pdfsDisponibles: fechasPdf,
    };
  }

  // 🛑 NUEVO: validar que no haya más de uno con visitSheet
  if (detailsConVisita.length > 1) {
    return {
      ok: false,
      reason:
        "Hay más de un visitsheet en los detalles y la lógica solo permite uno para la asignación por descarte",
      // detallesConVisita,
      pdfsDisponibles: fechasPdf,
    };
  }

  let matchedDetail = null;
  let pdfUsado = null;

  // 3. Buscar coincidencia exacta entre visitsheet.createdAt y fecha de PDF
  for (const detail of detailsConVisita) {
    const fechaVisita = detail.visitSheetData.createdAt;
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

  if (!matchedDetail) {
    return {
      ok: false,
      reason:
        "Ningún visitSheetData.createdAt coincide con las fechas de los PDFs",
      // detallesConVisita,
      pdfsDisponibles: fechasPdf,
    };
  }

  // 4. Encontrar el otro PDF (no usado)
  const pdfNoUsado = fechasParsed.find((f) => f.fecha !== pdfUsado.fecha);

  // 5. Filtrar los detalles restantes (sin visita y distintos del matched)
  const unmatchedDetails = details.filter((d) => d.id !== matchedDetail.id);

  // 6. Buscar entre los unmatched uno cuya saleDate sea <= a la fecha del PDF no usado
  let elegido = null;
  for (const detail of unmatchedDetails) {
    const saleDate = new Date(detail.saleDate);
    if (saleDate <= pdfNoUsado.fechaDate) {
      elegido = detail;
      break;
    }
  }

  if (!elegido) {
    return {
      ok: false,
      reason: `Ningún detail disponible tiene un saleDate anterior o igual a ${pdfNoUsado.fecha}`,
      pdfNoAsignado: pdfNoUsado,
      detallesRechazados: unmatchedDetails,
    };
  }

  return {
    ok: true,
    matched: {
      detail: matchedDetail,
      fecha: pdfUsado.fecha,
      nombre_pdf: pdfUsado.pdf,
      status: "coincide",
    },
    unmatched: {
      detail: elegido,
      nuevaFechaAsignada: pdfNoUsado.fecha,
      nombre_pdf: pdfNoUsado.pdf,
      status: "asignada por descarte",
    },
  };
}

function asignarFechasTresVentasDosPdf2v(fechasPdf, details) {
  // 1. Parsear fechas del PDF (formato 'DD-MM-YYYY')
  const fechasParsed = fechasPdf.map((f) => {
    const [day, month, year] = f.fecha.split("-");
    return {
      ...f,
      fechaDate: new Date(`${year}-${month}-${day}`),
    };
  });

  // 2. Validar que haya exactamente dos detalles con visitSheet
  const detailsConVisita = details.filter((d) => d.visitSheetData?.createdAt);

  if (detailsConVisita.length !== 2) {
    return {
      ok: false,
      reason: "Debe haber exactamente 2 visitSheet asignados",
      // detallesConVisita,
      pdfsDisponibles: fechasPdf,
    };
  }

  // 3. Identificar cuál fecha ya fue usada (match exacto con createdAt)
  const detallesCoincidentes = [];
  const fechasCoincidentes = [];

  for (const detail of detailsConVisita) {
    const fechaVisita = detail.visitSheetData.createdAt;
    const [day, month, year] = fechaVisita.split("-");
    const fechaDetail = new Date(`${year}-${month}-${day}`);

    const match = fechasParsed.find(
      (pdf) => pdf.fechaDate.toDateString() === fechaDetail.toDateString()
    );

    if (match) {
      detallesCoincidentes.push(detail);
      fechasCoincidentes.push(match);
    }
  }

  // 4. Validación: debe haber solo una coincidencia exacta entre visitas y fechas
  if (detallesCoincidentes.length !== 1 || fechasCoincidentes.length !== 1) {
    return {
      ok: false,
      reason: "Debe haber una sola coincidencia entre un visitSheet y una fecha PDF",
      // detallesConVisita,
      fechasCoincidentes,
    };
  }

  // 5. Buscar el detail sin visitSheet
  const detailSinVisita = details.find((d) => !d.visitSheetData?.createdAt);

  if (!detailSinVisita) {
    return {
      ok: false,
      reason: "No se encontró un detail sin visitSheet para asignar la tercera fecha",
      // detalles,
    };
  }

  // 6. Detectar cuál de las fechas PDF no está en ningún visitSheet
  const fechasNoAsignadas = fechasParsed.filter(
    (f) => !fechasCoincidentes.find((fc) => fc.fecha === f.fecha)
  );

  if (fechasNoAsignadas.length !== 1) {
    return {
      ok: false,
      reason: "No se pudo determinar una única fecha PDF sin asignar",
      fechasCoincidentes,
      fechasNoAsignadas,
    };
  }

  const fechaParaAsignar = fechasNoAsignadas[0];
  const saleDateDetail = new Date(detailSinVisita.saleDate);

  // 7. Verificar si la fecha es posterior o igual al saleDate
  if (fechaParaAsignar.fechaDate >= saleDateDetail) {
    return {
      ok: true,
      visitados: detallesCoincidentes.map((d, i) => ({
        detail: d,
        fecha: fechasCoincidentes[i].fecha,
        nombre_pdf: fechasCoincidentes[i].pdf,
        status: "ya asignada",
      })),
      unmatched: {
        detail: detailSinVisita,
        nuevaFechaAsignada: fechaParaAsignar.fecha,
        nombre_pdf: fechaParaAsignar.pdf,
        status: "asignada por descarte",
      },
    };
  } else {
    return {
      ok: false,
      reason: `La fecha del PDF a asignar (${fechaParaAsignar.fecha}) es anterior al saleDate del detail sin visita (${saleDateDetail.toISOString().split("T")[0]})`,
      pdfNoAsignado: fechaParaAsignar,
      detailRechazado: detailSinVisita,
    };
  }
}

module.exports = {
  casoDosVentasUnPdf,
  casoDosVentasDosPdf,
  casoTresVentasDosPdf,
  casoTresVentasDosPdf2V
};
