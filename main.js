const { consultarPorNif } = require("./db_registros");

(async () => {
    const resultado = await consultarPorNif("H25763103");
    console.log(resultado);
  })();