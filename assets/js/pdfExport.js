// Generación de informes en PDF (uno por participante) con nomenclátor fijo.
//
// Estrategia en tres niveles, de mejor a peor caso:
//  1) Carpeta elegida por el usuario (File System Access API): un PDF por
//     archivo, directamente donde el usuario quiera. Requiere Chromium
//     servido por HTTP/HTTPS y que el navegador/política del equipo lo
//     permita.
//  2) Si no hay carpeta disponible y se generan varios informes a la vez:
//     se empaquetan todos en un único ZIP descargable (funciona en
//     cualquier navegador, sin permisos especiales).
//  3) Si es un único informe sin carpeta: se descarga ese PDF suelto.
//
// Importante para evitar el error "NotAllowedError: The request is not
// allowed by the user agent or the platform in the current context": los
// navegadores solo permiten showDirectoryPicker()/requestPermission() como
// resultado DIRECTO de un gesto del usuario (clic), sin ninguna operación
// asíncrona de por medio (ni siquiera IndexedDB). Por eso la carpeta
// recordada se precarga en memoria al arrancar la app (no durante el clic),
// y solo se usa si ya tiene permiso concedido (queryPermission, que no
// requiere gesto); si no, se pide una carpeta nueva como primera acción.

const PdfExport = (() => {

  const DB_NAME = 'pafas_pdf_carpeta';
  const STORE = 'handles';
  const KEY = 'carpeta';

  function sanitizarNombreArchivo(s) {
    return String(s || '')
      .replace(/[/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '');
  }

  function formatoYYMMDD(iso) {
    let d = iso ? new Date(iso + 'T00:00:00') : null;
    if (!d || isNaN(d)) d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yy + mm + dd;
  }

  function nombreBase(fechaActaISO, row) {
    const fecha = formatoYYMMDD(fechaActaISO);
    return sanitizarNombreArchivo(`${fecha} PAFAS ${row.empleo || ''} ${row.nombre || ''}`);
  }

  function nombreZip(fechaActaISO) {
    return `${formatoYYMMDD(fechaActaISO)} PAFAS Informes.zip`;
  }

  function soportaSeleccionCarpeta() {
    return typeof window.showDirectoryPicker === 'function';
  }

  /* ---------------------------------------------------------------------- */
  /* Persistencia de la carpeta recordada (IndexedDB: los FileSystemHandle   */
  /* no se pueden guardar en localStorage, solo en IndexedDB).               */
  /* ---------------------------------------------------------------------- */

  function abrirDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('IndexedDB no disponible.')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function guardarCarpetaRecordada(handle) {
    const db = await abrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function obtenerCarpetaRecordada() {
    const db = await abrirDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function olvidarCarpetaRecordada() {
    const db = await abrirDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  // Precarga en memoria la carpeta recordada al cargar la página (nunca
  // durante un clic), para poder consultarla sin ninguna espera asíncrona
  // en el momento de generar informes.
  let carpetaCache = soportaSeleccionCarpeta()
    ? obtenerCarpetaRecordada().catch(() => null)
    : Promise.resolve(null);

  async function verificarPermiso(dirHandle, { pedir } = {}) {
    const opts = { mode: 'readwrite' };
    if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
    if (!pedir) return false;
    return (await dirHandle.requestPermission(opts)) === 'granted';
  }

  // Usado desde Configuración: abre el selector como primera acción del
  // clic, guarda la carpeta elegida para las próximas veces y la devuelve.
  async function elegirYRecordarCarpeta() {
    if (!soportaSeleccionCarpeta()) {
      throw new Error('Este navegador no permite elegir una carpeta del sistema.');
    }
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const ok = await verificarPermiso(dirHandle, { pedir: true });
    if (!ok) throw new Error('Permiso de escritura denegado para la carpeta seleccionada.');
    carpetaCache = Promise.resolve(dirHandle);
    try {
      await guardarCarpetaRecordada(dirHandle);
    } catch (e) {
      // La carpeta elegida sigue siendo válida para esta sesión aunque no
      // se haya podido recordar de forma persistente (p. ej. IndexedDB
      // deshabilitado): no lo tratamos como un fallo de la selección.
      console.warn('No se pudo recordar la carpeta de forma persistente:', e);
    }
    return dirHandle;
  }

  async function olvidarCarpeta() {
    await olvidarCarpetaRecordada();
    carpetaCache = Promise.resolve(null);
  }

  // Info para mostrar en Configuración: { soportado, nombre } (nombre null si no hay carpeta recordada).
  async function infoCarpetaRecordada() {
    if (!soportaSeleccionCarpeta()) return { soportado: false, nombre: null };
    try {
      const handle = await carpetaCache;
      return { soportado: true, nombre: handle ? handle.name : null };
    } catch (e) {
      return { soportado: true, nombre: null };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Resolución de la carpeta de destino al generar informes.                */
  /* ---------------------------------------------------------------------- */

  // 1) Si hay una carpeta recordada (ya precargada en memoria) con permiso
  //    ya concedido, se usa sin pedir nada (queryPermission no requiere
  //    gesto del usuario). 2) En caso contrario, se pide una carpeta nueva
  //    como primera operación tras el clic. Si el usuario cancela
  //    explícitamente, se relanza para abortar toda la generación; si el
  //    selector no existe o falla por cualquier otro motivo (navegador no
  //    compatible, política del equipo, etc.), se devuelve null para usar
  //    el modo ZIP/descarga directa.
  async function obtenerCarpetaDestino() {
    const recordada = await carpetaCache;
    if (recordada) {
      try {
        if (await verificarPermiso(recordada, { pedir: false })) return recordada;
      } catch (e) {
        // Handle inválido (p. ej. la carpeta se movió o se borró): seguimos con el flujo normal.
      }
    }

    if (!soportaSeleccionCarpeta()) return null;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const ok = await verificarPermiso(dirHandle, { pedir: true });
      return ok ? dirHandle : null;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e; // el usuario canceló el selector explícitamente
      // No permitido por el navegador o por política del entorno (p. ej. equipos
      // institucionales gestionados): seguimos sin carpeta (ZIP o descarga directa).
      console.warn('Selección de carpeta no disponible, se usará ZIP/descarga directa:', e);
      return null;
    }
  }

  async function generarBlobPdf(htmlInterno) {
    // El host queda fuera de la vista y nunca se clona; el contenedor sí se
    // clona (por html2pdf) y debe permanecer en flujo normal (ver pdf.css).
    const host = document.createElement('div');
    host.className = 'pdf-render-host';
    const contenedor = document.createElement('div');
    contenedor.className = 'pdf-render';
    contenedor.innerHTML = htmlInterno;
    host.appendChild(contenedor);
    document.body.appendChild(host);
    try {
      return await html2pdf()
        .set({
          margin: 10,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(contenedor)
        .outputPdf('blob');
    } finally {
      document.body.removeChild(host);
    }
  }

  async function guardarEnCarpeta(dirHandle, filename, blob) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  function descargarArchivo(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function nombreConSufijo(usados, base) {
    const n = (usados.get(base) || 0) + 1;
    usados.set(base, n);
    return n === 1 ? `${base}.pdf` : `${base} (${n}).pdf`;
  }

  // items: [{ row, html }]. Devuelve { ok, fail, modo: 'carpeta'|'zip'|'descarga' } o
  // null si el usuario canceló explícitamente la selección de carpeta.
  async function generarInformes(items, fechaActaISO, onProgress) {
    if (items.length === 0) return null;

    let dirHandle;
    try {
      dirHandle = await obtenerCarpetaDestino();
    } catch (e) {
      if (e && e.name === 'AbortError') return null;
      throw e;
    }

    const usados = new Map();
    let ok = 0, fail = 0;

    if (dirHandle) {
      for (let i = 0; i < items.length; i++) {
        const { row, html } = items[i];
        if (onProgress) onProgress(i + 1, items.length, row, 'pdf');
        try {
          const blob = await generarBlobPdf(html);
          await guardarEnCarpeta(dirHandle, nombreConSufijo(usados, nombreBase(fechaActaISO, row)), blob);
          ok++;
        } catch (e) {
          console.error('Error generando el PDF de', row.nombre, e);
          fail++;
        }
      }
      return { ok, fail, modo: 'carpeta' };
    }

    if (items.length === 1) {
      const { row, html } = items[0];
      if (onProgress) onProgress(1, 1, row, 'pdf');
      try {
        const blob = await generarBlobPdf(html);
        descargarArchivo(nombreBase(fechaActaISO, row) + '.pdf', blob);
        return { ok: 1, fail: 0, modo: 'descarga' };
      } catch (e) {
        console.error('Error generando el PDF de', row.nombre, e);
        return { ok: 0, fail: 1, modo: 'descarga' };
      }
    }

    // Varios informes y sin carpeta disponible: se empaquetan en un único ZIP.
    const zip = new JSZip();
    for (let i = 0; i < items.length; i++) {
      const { row, html } = items[i];
      if (onProgress) onProgress(i + 1, items.length, row, 'pdf');
      try {
        const blob = await generarBlobPdf(html);
        zip.file(nombreConSufijo(usados, nombreBase(fechaActaISO, row)), blob);
        ok++;
      } catch (e) {
        console.error('Error generando el PDF de', row.nombre, e);
        fail++;
      }
    }
    if (ok > 0) {
      if (onProgress) onProgress(items.length, items.length, null, 'zip');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      descargarArchivo(nombreZip(fechaActaISO), zipBlob);
    }
    return { ok, fail, modo: 'zip' };
  }

  return {
    generarInformes, soportaSeleccionCarpeta, nombreBase,
    elegirYRecordarCarpeta, olvidarCarpeta, infoCarpetaRecordada
  };
})();
