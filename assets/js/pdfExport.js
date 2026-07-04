// Generación de informes en PDF con nomenclátor fijo.
//
// La app es 100% estática (sin servidor): los archivos se descargan con el
// mecanismo normal del navegador, que decide dónde guardarlos según su
// propia configuración (carpeta de Descargas, o preguntar dónde guardar
// cada archivo si el usuario lo tiene así configurado).
//
//  - Informe individual: se descarga un único PDF.
//  - Informes en lote: se descargan siempre empaquetados en un único ZIP
//    (independientemente de cuántos participantes se hayan seleccionado),
//    para no depender de que el navegador permita varias descargas
//    simultáneas.

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

  function nombreZip(fechaActaISO) {
    return `${formatoYYMMDD(fechaActaISO)} PAFAS Informes.zip`;
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

  // Genera y descarga el PDF de un único participante.
  async function generarInformeIndividual(row, html, fechaActaISO) {
    try {
      const blob = await generarBlobPdf(html);
      descargarArchivo(nombreBase(fechaActaISO, row) + '.pdf', blob);
      return { ok: 1, fail: 0 };
    } catch (e) {
      console.error('Error generando el PDF de', row.nombre, e);
      return { ok: 0, fail: 1 };
    }
  }

  // Genera los PDF de varios participantes y los descarga empaquetados en un
  // único ZIP, sin importar cuántos sean. items: [{ row, html }].
  async function generarInformesLote(items, fechaActaISO, onProgress) {
    if (items.length === 0) return { ok: 0, fail: 0 };

    const usados = new Map();
    const zip = new JSZip();
    let ok = 0, fail = 0;
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
    return { ok, fail };
  }

  return { generarInformeIndividual, generarInformesLote, nombreBase };
})();
