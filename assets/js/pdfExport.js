// Generación de informes en PDF (uno por participante) con nomenclátor fijo
// y guardado en una carpeta elegida por el usuario mediante la File System
// Access API. Si el navegador no soporta elegir carpeta, o el acceso está
// bloqueado (p. ej. por políticas de un equipo institucional gestionado),
// cada PDF se descarga igualmente con el mismo nombre a la carpeta de
// Descargas del navegador. Configuración permite recordar una carpeta para
// no tener que elegirla cada vez que se generan informes.

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

  async function verificarPermiso(dirHandle) {
    const opts = { mode: 'readwrite' };
    if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
    if ((await dirHandle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  // Usado desde Configuración: abre el selector, guarda la carpeta elegida
  // para las próximas veces y la devuelve. Lanza si el usuario cancela o si
  // el navegador/entorno no permite elegir carpeta.
  async function elegirYRecordarCarpeta() {
    if (!soportaSeleccionCarpeta()) {
      throw new Error('Este navegador no permite elegir una carpeta del sistema.');
    }
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const ok = await verificarPermiso(dirHandle);
    if (!ok) throw new Error('Permiso de escritura denegado para la carpeta seleccionada.');
    await guardarCarpetaRecordada(dirHandle);
    return dirHandle;
  }

  async function olvidarCarpeta() {
    await olvidarCarpetaRecordada();
  }

  // Info para mostrar en Configuración: { soportado, nombre } (nombre null si no hay carpeta recordada).
  async function infoCarpetaRecordada() {
    if (!soportaSeleccionCarpeta()) return { soportado: false, nombre: null };
    try {
      const handle = await obtenerCarpetaRecordada();
      return { soportado: true, nombre: handle ? handle.name : null };
    } catch (e) {
      return { soportado: true, nombre: null };
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Resolución de la carpeta de destino al generar informes.                */
  /* ---------------------------------------------------------------------- */

  // Intenta, por este orden: 1) la carpeta recordada en Configuración,
  // 2) pedir una carpeta nueva. Si nada funciona (no soportado, bloqueado
  // por política del navegador, permiso denegado...) devuelve null y los
  // PDF se descargarán individualmente, salvo que el usuario cancele
  // explícitamente el selector (entonces se relanza para abortar todo).
  async function obtenerCarpetaDestino() {
    try {
      const recordada = await obtenerCarpetaRecordada();
      if (recordada && await verificarPermiso(recordada)) return recordada;
    } catch (e) {
      // Sin IndexedDB o carpeta recordada inválida: seguimos con el flujo normal.
    }

    if (!soportaSeleccionCarpeta()) return null;
    try {
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const ok = await verificarPermiso(dirHandle);
      return ok ? dirHandle : null;
    } catch (e) {
      if (e && e.name === 'AbortError') throw e; // el usuario canceló el selector explícitamente
      // Bloqueado por el navegador o por política del entorno (p. ej. equipos
      // institucionales gestionados): seguimos sin carpeta, se descargará cada PDF.
      console.warn('Selección de carpeta no disponible, los PDF se descargarán:', e);
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

  // items: [{ row, html }]. Devuelve { ok, fail, carpeta } o null si se canceló la selección de carpeta.
  async function generarInformes(items, fechaActaISO, onProgress) {
    if (items.length === 0) return null;

    let dirHandle;
    try {
      dirHandle = await obtenerCarpetaDestino();
    } catch (e) {
      if (e && e.name === 'AbortError') return null; // el usuario canceló el selector de carpeta
      throw e;
    }

    const usados = new Map();
    let ok = 0, fail = 0;
    for (let i = 0; i < items.length; i++) {
      const { row, html } = items[i];
      if (onProgress) onProgress(i + 1, items.length, row);
      try {
        const blob = await generarBlobPdf(html);
        const base = nombreBase(fechaActaISO, row);
        const n = (usados.get(base) || 0) + 1;
        usados.set(base, n);
        const filename = n === 1 ? `${base}.pdf` : `${base} (${n}).pdf`;
        if (dirHandle) {
          await guardarEnCarpeta(dirHandle, filename, blob);
        } else {
          descargarArchivo(filename, blob);
        }
        ok++;
      } catch (e) {
        console.error('Error generando el PDF de', row.nombre, e);
        fail++;
      }
    }
    return { ok, fail, carpeta: !!dirHandle };
  }

  return {
    generarInformes, soportaSeleccionCarpeta, nombreBase,
    elegirYRecordarCarpeta, olvidarCarpeta, infoCarpetaRecordada
  };
})();
