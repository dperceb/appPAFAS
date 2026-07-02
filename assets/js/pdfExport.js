// Generación de informes en PDF (uno por participante) con nomenclátor fijo
// y guardado en una carpeta elegida por el usuario mediante la File System
// Access API. Si el navegador no soporta elegir carpeta (p. ej. al abrir
// index.html con doble clic, sin servidor local), cada PDF se descarga con
// el mismo nombre a la carpeta de Descargas del navegador.

const PdfExport = (() => {

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

  async function elegirCarpeta() {
    const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const opts = { mode: 'readwrite' };
    const permiso = (await dirHandle.queryPermission(opts)) === 'granted'
      ? 'granted' : await dirHandle.requestPermission(opts);
    if (permiso !== 'granted') throw new Error('Permiso de escritura denegado para la carpeta seleccionada.');
    return dirHandle;
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

    let dirHandle = null;
    if (soportaSeleccionCarpeta()) {
      try {
        dirHandle = await elegirCarpeta();
      } catch (e) {
        if (e && e.name === 'AbortError') return null; // el usuario canceló el selector de carpeta
        throw e;
      }
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

  return { generarInformes, soportaSeleccionCarpeta, nombreBase };
})();
