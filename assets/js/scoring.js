// Motor de cálculo del ACTA PAFAS.
// Reproduce fielmente las fórmulas originales de la hoja ACTA del libro Excel:
// edad -> grupo -> puntuación por prueba (BUSCARV en los baremos) -> total -> APTO/NO APTO.

const Scoring = (() => {

  function calcEdad(fechaNacimientoISO, fechaPruebaISO) {
    if (!fechaNacimientoISO || !fechaPruebaISO) return null;
    const nac = new Date(fechaNacimientoISO);
    const prueba = new Date(fechaPruebaISO);
    if (isNaN(nac) || isNaN(prueba)) return null;
    let edad = prueba.getFullYear() - nac.getFullYear();
    const m = prueba.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && prueba.getDate() < nac.getDate())) edad--;
    return edad >= 0 ? edad : null;
  }

  function calcGrupo(edad) {
    if (edad === null || edad === undefined) return null;
    const fila = PAFAS_DATA.gruposPorEdad.find(([e]) => e === edad);
    if (fila) return fila[1];
    // Fuera de la tabla (17-65): igual que en Excel, VLOOKUP con la fila más próxima inferior
    const ordenado = PAFAS_DATA.gruposPorEdad;
    if (edad < ordenado[0][0]) return null;
    let grupo = null;
    for (const [e, g] of ordenado) {
      if (e <= edad) grupo = g; else break;
    }
    return grupo;
  }

  // Búsqueda EXACTA en tablas ordenadas de forma descendente por marca (Abdominales, Ext. Brazos)
  function lookupExacto(tabla, marca, grupo) {
    if (marca === null || marca === undefined || marca === '' || grupo === null) return '';
    const col = grupo; // columna 1 = índice 1 en el array (índice 0 es la marca)
    const fila = tabla.find(r => r[0] === marca);
    if (!fila) return '';
    const val = fila[col];
    return val === undefined ? '' : val;
  }

  // Búsqueda APROXIMADA (como BUSCARV con último argumento VERDADERO):
  // la tabla está ordenada ascendentemente por marca; se busca la fila con la marca
  // más alta que sea <= al valor buscado.
  function lookupAproximado(tabla, marca, grupo) {
    if (marca === null || marca === undefined || marca === '' || grupo === null) return '';
    const col = grupo;
    let resultado = '';
    for (const fila of tabla) {
      if (fila[0] <= marca) {
        resultado = fila[col];
      } else {
        break;
      }
    }
    return resultado;
  }

  function puntosAbdominales(marca, grupo) {
    if (marca === null || marca === undefined || marca === '') return '';
    if (marca < 5) return 0;
    return lookupExacto(PAFAS_DATA.flexTronco, marca, grupo);
  }

  function puntosFlexiones(marca, sexo, grupo) {
    if (marca === null || marca === undefined || marca === '') return '';
    const tabla = sexo === 'M' ? PAFAS_DATA.extBrazosM : PAFAS_DATA.extBrazosF;
    return lookupExacto(tabla, marca, grupo);
  }

  // marcaSegundos: tiempo del circuito en segundos (con un decimal), p.ej. 11.6
  function puntosCircuito(marcaSegundos, sexo, grupo, edad) {
    if (edad !== null && edad > 44) return 'EXENTO';
    if (marcaSegundos === null || marcaSegundos === undefined || marcaSegundos === '') return '';
    const tabla = sexo === 'M' ? PAFAS_DATA.circuitoM : PAFAS_DATA.circuitoF;
    return lookupAproximado(tabla, marcaSegundos, grupo);
  }

  // marcaSegundos: tiempo de los 2000 m convertido a segundos (mm:ss -> mm*60+ss)
  function puntosResistencia(marcaSegundos, sexo, grupo) {
    if (marcaSegundos === null || marcaSegundos === undefined || marcaSegundos === '') return '';
    const tabla = sexo === 'M' ? PAFAS_DATA.resistenciaM : PAFAS_DATA.resistenciaF;
    return lookupAproximado(tabla, marcaSegundos, grupo);
  }

  function esNumero(v) {
    return typeof v === 'number' && !isNaN(v);
  }

  function puntuacionTotal(n, p, r, t) {
    const rExento = r === 'EXENTO';
    if (!esNumero(n) || !esNumero(p) || !esNumero(t)) return '';
    if (!rExento && !esNumero(r)) return '';
    if (rExento) return n + p + t;
    return n + p + r + t;
  }

  // Determina APTO/NO APTO según la lógica original de la columna V del ACTA.
  function calcApto({ nombre, n, p, r, t, total, incidencia, recMedico, edad }) {
    if (!nombre || total === '' || total === null || total === undefined) return '';
    if (incidencia) return 'NO (incidencia)';

    if (recMedico === 'APL') {
      const valores = [n, p, r, t].filter(v => esNumero(v));
      if (valores.length === 0) return 'NO';
      const ok = [n, p, r, t].every(v => !esNumero(v) || v >= 20);
      return ok ? 'SÍ' : 'NO';
    }

    if (edad !== null && edad > 44) {
      if (!esNumero(n) || !esNumero(p) || !esNumero(t)) return 'NO';
      return (n > 19 && p > 19 && t > 19) ? 'SÍ' : 'NO';
    }

    if (!esNumero(n) || !esNumero(p) || !esNumero(r) || !esNumero(t)) return 'NO';
    return (n > 19 && p > 19 && r > 19 && t > 19) ? 'SÍ' : 'NO';
  }

  // Calcula la fila completa a partir de los datos introducidos por el usuario.
  function calcularParticipante(row, fechaActaISO) {
    const edad = calcEdad(row.fechaNacimiento, fechaActaISO);
    const grupo = calcGrupo(edad);

    const abdMarca = row.abdMarca === '' || row.abdMarca === null || row.abdMarca === undefined ? '' : Number(row.abdMarca);
    const flexMarca = row.flexMarca === '' || row.flexMarca === null || row.flexMarca === undefined ? '' : Number(row.flexMarca);
    const circMarca = row.circMarca === '' || row.circMarca === null || row.circMarca === undefined ? '' : Number(row.circMarca);
    const resSegundos = parseMmSs(row.resMarca);

    const n = puntosAbdominales(abdMarca === '' ? '' : abdMarca, grupo);
    const p = puntosFlexiones(flexMarca === '' ? '' : flexMarca, row.sexo, grupo);
    const r = puntosCircuito(circMarca === '' ? '' : circMarca, row.sexo, grupo, edad);
    const t = puntosResistencia(resSegundos, row.sexo, grupo);

    const total = puntuacionTotal(n, p, r, t);
    const apto = calcApto({
      nombre: row.nombre, n, p, r, t, total,
      incidencia: row.incidencia, recMedico: row.recMedico, edad
    });
    const motivoPruebas = row.motivoPruebas === 'E' ? 'EXTRAORDINARIO' : 'PERIÓDICO';

    return { edad, grupo, n, p, r, t, total, apto, motivoPruebas };
  }

  // Convierte "mm:ss" o "m:ss" a segundos totales. Admite también un número (segundos) directo.
  function parseMmSs(v) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') return v;
    const s = String(v).trim();
    if (s === '') return '';
    const m = s.match(/^(\d{1,3}):([0-5]?\d)$/);
    if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    const asNum = Number(s);
    return isNaN(asNum) ? '' : asNum;
  }

  function segundosAMmSs(seg) {
    if (seg === '' || seg === null || seg === undefined || isNaN(seg)) return '';
    const m = Math.floor(seg / 60);
    const s = Math.round(seg % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return {
    calcEdad, calcGrupo, calcularParticipante, parseMmSs, segundosAMmSs,
    puntosAbdominales, puntosFlexiones, puntosCircuito, puntosResistencia, puntuacionTotal, calcApto
  };
})();
