// Aplicación ACTA PAFAS EA — lógica de interfaz.
// Todo el estado vive en memoria (variable `state`) y se persiste en localStorage
// a través de Store. No hay llamadas de red: la aplicación es 100% local.

let state = Store.load();

function persist() { Store.save(state); }

/* ---------------------------------------------------------------------- */
/* Navegación por pestañas                                                 */
/* ---------------------------------------------------------------------- */
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => gotoTab(btn.dataset.tab));
  });
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => gotoTab(btn.dataset.goto));
  });
}

function gotoTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
  if (tab === 'informe') renderInformeSelect();
  if (tab === 'lote') renderLote();
  if (tab === 'estadistica') renderEstadistica();
  if (tab === 'historico') renderHistorico();
  if (tab === 'convocatoria') renderConvocatoria();
}

/* ---------------------------------------------------------------------- */
/* Utilidades                                                              */
/* ---------------------------------------------------------------------- */
function fillSelect(select, opciones, { placeholder } = {}) {
  select.innerHTML = '';
  if (placeholder) {
    const o = document.createElement('option');
    o.value = ''; o.textContent = placeholder;
    select.appendChild(o);
  }
  opciones.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    select.appendChild(o);
  });
}

function formatFechaEs(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatFechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('es-ES');
}

function nombreCapitalizado(s) {
  return s || '';
}

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------------------------------------------------------------------- */
/* CONFIGURACIÓN                                                           */
/* ---------------------------------------------------------------------- */
function initConfiguracion() {
  fillSelect(document.getElementById('cfg-juntaZonal'), PAFAS_DATA.juntasZonales, { placeholder: '— Seleccione —' });
  fillSelect(document.getElementById('cfg-tituladoEmpleo'), PAFAS_DATA.empleos, { placeholder: '— Seleccione —' });
  fillSelect(document.getElementById('cfg-jefeEmpleo'), PAFAS_DATA.empleos, { placeholder: '— Seleccione —' });

  const c = state.config;
  document.getElementById('cfg-juntaZonal').value = c.juntaZonal;
  document.getElementById('cfg-unidadArticulo').value = c.unidadArticulo;
  document.getElementById('cfg-unidad').value = c.unidad;
  document.getElementById('cfg-localidad').value = c.localidad;
  document.getElementById('cfg-tituladoArticulo').value = c.tituladoArticulo;
  document.getElementById('cfg-tituladoEmpleo').value = c.tituladoEmpleo;
  document.getElementById('cfg-tituladoNombre').value = c.tituladoNombre;
  document.getElementById('cfg-jefeArticulo').value = c.jefeArticulo;
  document.getElementById('cfg-jefeEmpleo').value = c.jefeEmpleo;
  document.getElementById('cfg-jefeNombre').value = c.jefeNombre;

  document.getElementById('form-config').addEventListener('submit', e => {
    e.preventDefault();
    state.config = {
      juntaZonal: document.getElementById('cfg-juntaZonal').value,
      unidadArticulo: document.getElementById('cfg-unidadArticulo').value,
      unidad: document.getElementById('cfg-unidad').value.trim(),
      localidad: document.getElementById('cfg-localidad').value.trim(),
      tituladoArticulo: document.getElementById('cfg-tituladoArticulo').value,
      tituladoEmpleo: document.getElementById('cfg-tituladoEmpleo').value,
      tituladoNombre: document.getElementById('cfg-tituladoNombre').value.trim(),
      jefeArticulo: document.getElementById('cfg-jefeArticulo').value,
      jefeEmpleo: document.getElementById('cfg-jefeEmpleo').value,
      jefeNombre: document.getElementById('cfg-jefeNombre').value.trim()
    };
    persist();
    alert('Configuración guardada correctamente.');
  });

  document.getElementById('btn-export-backup').addEventListener('click', () => Store.exportBackup(state));
  document.getElementById('input-import-backup').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    Store.importBackup(file, (err, data) => {
      if (err) { alert('El archivo no es una copia de seguridad válida.'); return; }
      if (!confirm('Se sustituirán todos los datos actuales por los del archivo importado. ¿Continuar?')) return;
      state = Object.assign(Store.estadoInicial(), data);
      persist();
      location.reload();
    });
    e.target.value = '';
  });
  document.getElementById('btn-reset-all').addEventListener('click', () => {
    if (!confirm('Esto borrará TODOS los datos guardados en este navegador (configuración, acta, convocatoria e histórico). ¿Continuar?')) return;
    state = Store.estadoInicial();
    persist();
    location.reload();
  });

  initCarpetaInformes();
}

async function initCarpetaInformes() {
  const estado = document.getElementById('carpeta-informes-estado');
  const btnElegir = document.getElementById('btn-carpeta-elegir');
  const btnOlvidar = document.getElementById('btn-carpeta-olvidar');

  async function refrescar() {
    const info = await PdfExport.infoCarpetaRecordada();
    if (!info.soportado) {
      estado.textContent = 'Su navegador (o las políticas de este equipo) no permiten elegir carpeta: los informes en lote se descargarán empaquetados en un ZIP, y el individual directamente.';
      btnElegir.disabled = true;
      btnOlvidar.hidden = true;
    } else if (info.nombre) {
      estado.textContent = `Carpeta recordada: "${info.nombre}". Los informes se guardarán ahí automáticamente.`;
      btnElegir.disabled = false;
      btnOlvidar.hidden = false;
    } else {
      estado.textContent = 'No hay ninguna carpeta recordada: se preguntará cada vez que genere informes.';
      btnElegir.disabled = false;
      btnOlvidar.hidden = true;
    }
  }

  btnElegir.addEventListener('click', async () => {
    try {
      await PdfExport.elegirYRecordarCarpeta();
    } catch (e) {
      if (e && e.name !== 'AbortError') alert('No se pudo elegir la carpeta: ' + e.message);
    }
    refrescar();
  });
  btnOlvidar.addEventListener('click', async () => {
    await PdfExport.olvidarCarpeta();
    refrescar();
  });

  refrescar();
}

/* ---------------------------------------------------------------------- */
/* CONVOCATORIA                                                            */
/* ---------------------------------------------------------------------- */
function renderConvocatoria() {
  document.getElementById('conv-fecha').value = state.convocatoria.fecha;
  document.getElementById('conv-hora').value = state.convocatoria.hora;
  document.getElementById('conv-lugar').value = state.convocatoria.lugar;

  const tbody = document.querySelector('#tabla-convocatoria tbody');
  tbody.innerHTML = '';
  state.convocatoria.participantes.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><select data-idx="${idx}" data-field="empleo"></select></td>
      <td><input type="text" data-idx="${idx}" data-field="nombre" value="${escapeHtml(p.nombre)}" style="text-align:left"></td>
      <td><input type="text" data-idx="${idx}" data-field="dni" value="${escapeHtml(p.dni)}"></td>
      <td><button class="btn-remove-row" data-idx="${idx}" title="Eliminar">✕</button></td>
    `;
    tbody.appendChild(tr);
    fillSelect(tr.querySelector('select'), PAFAS_DATA.empleos, { placeholder: '—' });
    tr.querySelector('select').value = p.empleo;
  });
}

function initConvocatoria() {
  ['fecha', 'hora', 'lugar'].forEach(f => {
    document.getElementById(`conv-${f}`).addEventListener('change', e => {
      state.convocatoria[f] = e.target.value;
      persist();
    });
  });

  document.getElementById('btn-conv-add').addEventListener('click', () => {
    state.convocatoria.participantes.push({ empleo: '', nombre: '', dni: '' });
    persist();
    renderConvocatoria();
  });

  document.getElementById('btn-conv-from-acta').addEventListener('click', () => {
    if (!confirm('Se sustituirá la lista actual de la convocatoria por los participantes del ACTA. ¿Continuar?')) return;
    state.convocatoria.participantes = state.acta.participantes
      .filter(p => p.nombre.trim() !== '')
      .map(p => ({ empleo: p.empleo, nombre: p.nombre, dni: p.dni }));
    persist();
    renderConvocatoria();
  });

  document.querySelector('#tabla-convocatoria tbody').addEventListener('input', e => {
    const { idx, field } = e.target.dataset;
    if (idx === undefined) return;
    state.convocatoria.participantes[idx][field] = e.target.value;
    persist();
  });
  document.querySelector('#tabla-convocatoria tbody').addEventListener('change', e => {
    const { idx, field } = e.target.dataset;
    if (idx === undefined) return;
    state.convocatoria.participantes[idx][field] = e.target.value;
    persist();
  });
  document.querySelector('#tabla-convocatoria tbody').addEventListener('click', e => {
    if (!e.target.classList.contains('btn-remove-row')) return;
    const idx = Number(e.target.dataset.idx);
    state.convocatoria.participantes.splice(idx, 1);
    persist();
    renderConvocatoria();
  });

  document.getElementById('btn-conv-print').addEventListener('click', imprimirConvocatoria);
}

function imprimirConvocatoria() {
  const c = state.convocatoria;
  const filas = c.participantes.map((p, i) => `
    <tr><td>${i + 1}</td><td>${escapeHtml(p.empleo)}</td><td>${escapeHtml(p.nombre)}</td><td>${escapeHtml(p.dni)}</td></tr>
  `).join('');
  const html = `
    <div class="hoja convocatoria-print">
      <h1>CONVOCATORIA PARA LA REALIZACIÓN DE LAS PRUEBAS FÍSICAS<br>PARA LA EVALUACIÓN DE LA APTITUD PSICOFÍSICA ${escapeHtml(state.config.unidadArticulo)} ${escapeHtml(state.config.unidad)}</h1>
      <p><b>Fecha de las pruebas:</b> ${formatFechaCorta(c.fecha)} &nbsp;&nbsp; <b>Hora:</b> ${escapeHtml(c.hora)} &nbsp;&nbsp; <b>Lugar:</b> ${escapeHtml(c.lugar)}</p>
      <table>
        <thead><tr><th>Orden</th><th>Empleo</th><th>Apellidos y nombre</th><th>DNI</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p><b>Instrucciones:</b> El personal que figura en la presente convocatoria deberá presentarse a la hora
      señalada en las instalaciones deportivas indicadas en ropa deportiva y con el certificado médico en vigor.
      La ausencia en la convocatoria, sin causa justificada, será reflejada como "no presentado" en el informe
      personal.</p>
    </div>`;
  imprimir(html);
}

/* ---------------------------------------------------------------------- */
/* ACTA                                                                     */
/* ---------------------------------------------------------------------- */
const MAX_PARTICIPANTES_ACTA = 80;

function initActa() {
  document.getElementById('acta-fecha').value = state.acta.fecha;
  document.getElementById('acta-hora').value = state.acta.hora;
  document.getElementById('acta-lugar').value = state.acta.lugar;
  document.getElementById('acta-estado').value = state.acta.estado;

  document.getElementById('acta-fecha').addEventListener('change', e => {
    state.acta.fecha = e.target.value; persist(); renderActaTable();
  });
  document.getElementById('acta-hora').addEventListener('change', e => {
    state.acta.hora = e.target.value; persist();
  });
  document.getElementById('acta-lugar').addEventListener('input', e => {
    state.acta.lugar = e.target.value; persist();
  });
  document.getElementById('acta-estado').addEventListener('change', e => {
    state.acta.estado = e.target.value; persist(); renderActaTable();
  });

  document.getElementById('btn-acta-add').addEventListener('click', () => {
    if (state.acta.participantes.length >= MAX_PARTICIPANTES_ACTA) {
      alert(`El acta admite un máximo de ${MAX_PARTICIPANTES_ACTA} participantes.`);
      return;
    }
    state.acta.participantes.push(Store.nuevoParticipante(state.acta.participantes.length + 1));
    persist();
    renderActaTable();
  });

  document.getElementById('btn-acta-print').addEventListener('click', imprimirActa);
  document.getElementById('btn-acta-archivar').addEventListener('click', archivarActa);

  const tbody = document.querySelector('#tabla-acta tbody');
  tbody.addEventListener('input', onActaCellEdit);
  tbody.addEventListener('change', onActaCellEdit);
  tbody.addEventListener('click', e => {
    if (!e.target.classList.contains('btn-remove-row')) return;
    const idx = Number(e.target.dataset.idx);
    if (!confirm('¿Eliminar esta fila del acta?')) return;
    state.acta.participantes.splice(idx, 1);
    state.acta.participantes.forEach((p, i) => p.orden = i + 1);
    persist();
    renderActaTable();
  });

  renderActaTable();
}

const ACTA_NUMERIC_FIELDS = new Set(['abdMarca', 'flexMarca', 'circMarca']);

function onActaCellEdit(e) {
  const { idx, field } = e.target.dataset;
  if (idx === undefined) return;
  const row = state.acta.participantes[idx];
  let val = e.target.value;
  if (ACTA_NUMERIC_FIELDS.has(field)) {
    row[field] = val === '' ? '' : Number(val);
  } else {
    row[field] = val;
  }
  persist();
  updateActaRow(Number(idx));
  updateActaResumen();
}

function renderActaTable() {
  const tbody = document.querySelector('#tabla-acta tbody');
  tbody.innerHTML = '';
  state.acta.participantes.forEach((row, idx) => {
    tbody.appendChild(buildActaRowElement(row, idx));
  });
  updateActaResumen();
}

function buildActaRowElement(row, idx) {
  const tr = document.createElement('tr');
  tr.dataset.idx = idx;
  tr.innerHTML = `
    <td class="readonly orden">${idx + 1}</td>
    <td class="destino"><input type="text" data-idx="${idx}" data-field="destino" value="${escapeHtml(row.destino)}"></td>
    <td><select data-idx="${idx}" data-field="motivoPruebas">
        <option value="P" ${row.motivoPruebas === 'P' ? 'selected' : ''}>P</option>
        <option value="E" ${row.motivoPruebas === 'E' ? 'selected' : ''}>E</option>
      </select></td>
    <td><select data-idx="${idx}" data-field="empleo" class="sel-empleo"></select></td>
    <td class="nombre"><input type="text" data-idx="${idx}" data-field="nombre" value="${escapeHtml(row.nombre)}"></td>
    <td><input type="text" data-idx="${idx}" data-field="dni" value="${escapeHtml(row.dni)}"></td>
    <td><input type="date" data-idx="${idx}" data-field="fechaNacimiento" value="${row.fechaNacimiento || ''}"></td>
    <td class="sexo-cell"><select data-idx="${idx}" data-field="sexo">
        <option value="M" ${row.sexo === 'M' ? 'selected' : ''}>M</option>
        <option value="F" ${row.sexo === 'F' ? 'selected' : ''}>F</option>
      </select></td>
    <td class="readonly edad">-</td>
    <td class="readonly grupo">-</td>
    <td><select data-idx="${idx}" data-field="recMedico">
        <option value="">-</option>
        <option value="SÍ" ${row.recMedico === 'SÍ' ? 'selected' : ''}>SÍ</option>
        <option value="NO" ${row.recMedico === 'NO' ? 'selected' : ''}>NO</option>
        <option value="APL" ${row.recMedico === 'APL' ? 'selected' : ''}>APL</option>
      </select></td>
    <td><select data-idx="${idx}" data-field="incidencia" class="sel-incidencia"></select></td>
    <td><input type="number" min="0" data-idx="${idx}" data-field="abdMarca" value="${row.abdMarca}"></td>
    <td class="readonly abd-p">-</td>
    <td><input type="number" min="0" data-idx="${idx}" data-field="flexMarca" value="${row.flexMarca}"></td>
    <td class="readonly flex-p">-</td>
    <td class="circ-marca-cell"><input type="number" min="0" step="0.1" data-idx="${idx}" data-field="circMarca" value="${row.circMarca}"></td>
    <td class="readonly circ-p">-</td>
    <td><input type="text" placeholder="m:ss" data-idx="${idx}" data-field="resMarca" value="${escapeHtml(row.resMarca)}"></td>
    <td class="readonly res-p">-</td>
    <td class="readonly total">-</td>
    <td class="readonly apto">-</td>
    <td><button class="btn-remove-row" data-idx="${idx}" title="Eliminar fila">✕</button></td>
  `;
  fillSelect(tr.querySelector('.sel-empleo'), PAFAS_DATA.empleos, { placeholder: '—' });
  tr.querySelector('.sel-empleo').value = row.empleo;
  fillSelect(tr.querySelector('.sel-incidencia'), PAFAS_DATA.motivosIncidencia, { placeholder: '-' });
  tr.querySelector('.sel-incidencia').value = row.incidencia;
  return tr;
}

function updateActaRow(idx) {
  const row = state.acta.participantes[idx];
  const tr = document.querySelector(`#tabla-acta tbody tr[data-idx="${idx}"]`);
  if (!tr || !row) return;

  const calc = Scoring.calcularParticipante(row, state.acta.fecha);

  tr.querySelector('.edad').textContent = calc.edad === null ? '-' : calc.edad;
  tr.querySelector('.grupo').textContent = calc.grupo === null ? '-' : calc.grupo;

  setScoreCell(tr.querySelector('.abd-p'), calc.n);
  setScoreCell(tr.querySelector('.flex-p'), calc.p);
  setScoreCell(tr.querySelector('.circ-p'), calc.r);
  setScoreCell(tr.querySelector('.res-p'), calc.t);

  tr.querySelector('.total').textContent = calc.total === '' ? '-' : calc.total;
  tr.querySelector('.apto').textContent = calc.apto || '-';

  // Circuito exento -> deshabilitar/atenuar el campo de marca
  const circInput = tr.querySelector('[data-field="circMarca"]');
  const circExento = calc.r === 'EXENTO';
  tr.querySelector('.circ-marca-cell').style.background = circExento ? '#eef2f5' : '';
  circInput.disabled = circExento;

  // Sexo F resaltado (igual que en el Excel original, solo la celda)
  tr.querySelector('.sexo-cell').style.background = row.sexo === 'F' ? '#fdf1f6' : '';

  // Edad 45-65: circuito exento por edad
  tr.querySelector('.edad').classList.toggle('row-exempt', calc.edad !== null && calc.edad > 44 && calc.edad <= 65);

  // Filas final: NO APTO / incompleto
  tr.classList.remove('row-final-fail', 'row-final-incomplete');
  if (state.acta.estado === 'FINAL' && row.nombre.trim() !== '') {
    if (calc.apto === 'NO') tr.classList.add('row-final-fail');
    else if (calc.apto !== 'SÍ') tr.classList.add('row-final-incomplete');
  }

  refreshDniDuplicates();
}

function setScoreCell(td, val) {
  td.textContent = val === '' || val === undefined ? '-' : val;
  td.classList.toggle('score-partial', typeof val === 'number' && val < 20 && val > 0);
}

function refreshDniDuplicates() {
  const dnis = state.acta.participantes.map(p => (p.dni || '').trim().toUpperCase());
  document.querySelectorAll('#tabla-acta tbody tr').forEach((tr, idx) => {
    const dni = dnis[idx];
    const dup = dni !== '' && dnis.filter(d => d === dni).length > 1;
    const input = tr.querySelector('[data-field="dni"]');
    if (input) input.parentElement.classList.toggle('dup-dni', dup);
  });
}

function updateActaResumen() {
  const total = state.acta.participantes.filter(p => p.nombre.trim() !== '').length;
  document.getElementById('acta-total-presentados').textContent = total;
  state.acta.participantes.forEach((_, idx) => updateActaRowLight(idx));
}

// Recalcula solo las celdas dependientes (usado tras cambiar fecha/estado del acta)
function updateActaRowLight(idx) {
  updateActaRow(idx);
}

function archivarActa() {
  const registros = state.acta.participantes.filter(p => p.nombre.trim() !== '');
  if (registros.length === 0) {
    alert('No hay registros para archivar.');
    return;
  }
  if (!confirm(`¿Archivar ${registros.length} registro(s) en el Histórico y vaciar el acta?`)) return;

  registros.forEach(row => {
    const calc = Scoring.calcularParticipante(row, state.acta.fecha);
    state.historico.push({
      fecha: state.acta.fecha, hora: state.acta.hora, orden: row.orden,
      destino: row.destino, motivoPruebas: row.motivoPruebas, empleo: row.empleo,
      nombre: row.nombre, dni: row.dni, fechaNacimiento: row.fechaNacimiento, sexo: row.sexo,
      edad: calc.edad, grupo: calc.grupo, recMedico: row.recMedico, incidencia: row.incidencia,
      abdMarca: row.abdMarca, abdPuntos: calc.n, flexMarca: row.flexMarca, flexPuntos: calc.p,
      circMarca: row.circMarca, circPuntos: calc.r, resMarca: row.resMarca, resPuntos: calc.t,
      total: calc.total, apto: calc.apto
    });
  });

  state.acta.participantes = [Store.nuevoParticipante(1)];
  persist();
  renderActaTable();
  alert(`${registros.length} registro(s) archivado(s) en Histórico.`);
}

function imprimirActa() {
  const cfg = state.config;
  const titulo = `ACTA DE RESULTADOS DE LAS PRUEBAS FÍSICAS PARA LA EVALUACIÓN DE LA APTITUD PSICOFÍSICA\nTRIBUNAL DE EVALUACIÓN ${cfg.unidadArticulo} ${cfg.unidad}`;
  const filas = state.acta.participantes.map((row, idx) => {
    const calc = Scoring.calcularParticipante(row, state.acta.fecha);
    let cls = '';
    if (state.acta.estado === 'FINAL' && row.nombre.trim() !== '') {
      if (calc.apto === 'NO') cls = 'row-final-fail';
      else if (calc.apto !== 'SÍ') cls = 'row-final-incomplete';
    }
    return `<tr class="${cls}">
      <td>${idx + 1}</td><td>${escapeHtml(row.destino)}</td><td>${escapeHtml(row.motivoPruebas)}</td>
      <td>${escapeHtml(row.empleo)}</td><td style="text-align:left">${escapeHtml(row.nombre)}</td>
      <td>${escapeHtml(row.dni)}</td><td>${formatFechaCorta(row.fechaNacimiento)}</td><td>${escapeHtml(row.sexo)}</td>
      <td>${calc.edad ?? ''}</td><td>${calc.grupo ?? ''}</td><td>${escapeHtml(row.recMedico)}</td>
      <td>${escapeHtml(row.incidencia)}</td>
      <td>${row.abdMarca}</td><td>${calc.n}</td>
      <td>${row.flexMarca}</td><td>${calc.p}</td>
      <td>${calc.r === 'EXENTO' ? '' : row.circMarca}</td><td>${calc.r}</td>
      <td>${row.resMarca}</td><td>${calc.t}</td>
      <td>${calc.total}</td><td>${calc.apto}</td>
    </tr>`;
  }).join('');

  const total = state.acta.participantes.filter(p => p.nombre.trim() !== '').length;

  const html = `
    <div class="hoja acta-print">
      <h1>${escapeHtml(titulo)}</h1>
      <div class="meta-row">
        <span><b>Fecha y hora de las pruebas:</b> ${formatFechaCorta(state.acta.fecha)} ${escapeHtml(state.acta.hora)}</span>
        <span><b>Lugar de realización:</b> ${escapeHtml(state.acta.lugar)}</span>
        <span><b>Total presentados:</b> ${total}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Orden</th><th>Destino</th><th>Motivo</th><th>Empleo</th><th>Apellidos y nombre</th><th>DNI</th>
            <th>F. nacim.</th><th>Sexo</th><th>Edad</th><th>Grupo</th><th>Rec. médico</th><th>Incidencia</th>
            <th colspan="2">Abdominales</th><th colspan="2">Flexiones</th><th colspan="2">Circuito A-V</th>
            <th colspan="2">2000 m</th><th>Puntuación</th><th>Apto</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
  imprimir(html);
}

/* ---------------------------------------------------------------------- */
/* INFORME INDIVIDUAL                                                       */
/* ---------------------------------------------------------------------- */
function renderInformeSelect() {
  const select = document.getElementById('informe-select');
  const nombres = state.acta.participantes.filter(p => p.nombre.trim() !== '').map(p => p.nombre);
  fillSelect(select, nombres, { placeholder: '— Seleccione un participante —' });
  renderInformePreview();
}

function initInforme() {
  document.getElementById('informe-select').addEventListener('change', renderInformePreview);
  document.getElementById('btn-informe-print').addEventListener('click', () => {
    const nombre = document.getElementById('informe-select').value;
    if (!nombre) { alert('Seleccione un participante.'); return; }
    const row = state.acta.participantes.find(p => p.nombre === nombre);
    generarInformesPdfConUI(document.getElementById('btn-informe-print'),
      [{ row, html: construirInformeHtml(row) }]);
  });
}

// Genera uno o varios informes en PDF (pidiendo carpeta de destino) mostrando
// progreso en el propio botón y un resumen final al usuario.
async function generarInformesPdfConUI(btn, items) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  try {
    const resultado = await PdfExport.generarInformes(items, state.acta.fecha, (actual, total, row, fase) => {
      if (fase === 'zip') { btn.textContent = 'Empaquetando ZIP…'; return; }
      btn.textContent = total > 1 ? `Generando ${actual}/${total}…` : 'Generando…';
    });
    if (!resultado) return; // el usuario canceló la selección de carpeta
    const errores = resultado.fail ? ` (${resultado.fail} con error, revise la consola)` : '';
    let destino;
    if (resultado.modo === 'carpeta') destino = 'en la carpeta seleccionada';
    else if (resultado.modo === 'zip') destino = 'empaquetados en un único archivo ZIP (el navegador no permite elegir carpeta)';
    else destino = 'descargados directamente (el navegador no permite elegir carpeta)';
    alert(`${resultado.ok} de ${items.length} informe(s) ${destino}${errores}.`);
  } catch (e) {
    console.error(e);
    alert('No se pudo generar el PDF: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function construirInformeHtml(row) {
  const cfg = state.config;
  const calc = Scoring.calcularParticipante(row, state.acta.fecha);
  const anioActa = state.acta.fecha ? new Date(state.acta.fecha + 'T00:00:00').getFullYear() : '';
  const proximaEval = calc.apto === 'SÍ' && anioActa ? anioActa + 2 : '';
  const motivoNoSuperado = (calc.apto === 'NO' || calc.apto === 'NO (incidencia)') ? (row.incidencia || '') : '';

  return `
    <div class="hoja informe-print">
      <div class="membrete">
        <img src="assets/img/logo-ministerio.png" alt="Ministerio de Defensa" class="membrete-logo" onerror="this.remove()">
        <div class="membrete-caja">
          <b>EJÉRCITO DEL AIRE Y DEL ESPACIO</b>
          <span>${escapeHtml(cfg.juntaZonal)}</span>
          <span>${escapeHtml(cfg.unidad)}</span>
          <span>Tribunal de evaluación de pruebas físicas</span>
        </div>
      </div>
      <h2>INFORME DE CONDICIONES FÍSICAS</h2>
      <div class="campo"><b>D./Dª.:</b> ${escapeHtml(row.nombre)}</div>
      <div class="campo"><b>DNI/TMI:</b> ${escapeHtml(row.dni)}</div>
      <div class="campo"><b>EMPLEO:</b> ${escapeHtml(row.empleo)}</div>
      <div class="campo"><b>FECHA DE NACIMIENTO:</b> ${formatFechaCorta(row.fechaNacimiento)}</div>
      <div class="campo"><b>DESTINO:</b> ${escapeHtml(row.destino)}</div>
      <div class="campo"><b>MOTIVO DE LAS PRUEBAS (PERIÓDICO/EXTRAORDINARIO):</b> ${escapeHtml(calc.motivoPruebas)}</div>
      <div class="campo-caja"><span>RECONOCIMIENTO MÉDICO (APTO/ NO APTO):</span><b class="caja">${escapeHtml(row.recMedico)}</b></div>
      <table>
        <thead><tr><th>PRUEBA</th><th>MARCA</th><th>PUNTOS</th></tr></thead>
        <tbody>
          <tr><td>FLEXIONES DE TRONCO</td><td>${row.abdMarca}</td><td>${calc.n}</td></tr>
          <tr><td>FLEXO-EXTENSIONES DE BRAZOS EN EL SUELO</td><td>${row.flexMarca}</td><td>${calc.p}</td></tr>
          <tr><td>CIRCUITO DE AGILIDAD-VELOCIDAD (CAV) (segundos)</td><td>${calc.r === 'EXENTO' ? '' : row.circMarca}</td><td>${calc.r}</td></tr>
          <tr><td>RESISTENCIA 2.000 m (minutos)</td><td>${escapeHtml(row.resMarca)}</td><td>${calc.t}</td></tr>
        </tbody>
      </table>
      <div class="total-puntos"><span>TOTAL PUNTOS</span><b>${calc.total}</b></div>
      <div class="campo-caja"><span>SUPERADO (SI/NO):</span><b class="caja">${calc.apto}</b></div>
      <div class="campo-caja"><span>NO SUPERADO (MOTIVO):</span><b class="caja">${escapeHtml(motivoNoSuperado)}</b></div>
      <div class="campo-caja"><span>FECHA PARA LA PRÓXIMA EVALUACIÓN (AÑO):</span><b class="caja">${proximaEval}</b></div>
      <p class="informe-fecha">En ${escapeHtml(cfg.localidad)}, a ${formatFechaEs(state.acta.fecha)}</p>
      <div class="firma">
        <p>${escapeHtml(cfg.tituladoArticulo)} ${escapeHtml(cfg.tituladoEmpleo)}<br>
        oficial titulado en Educación Física y Deportes</p>
        <div class="firma-espacio"></div>
        <p class="firma-nombre">${escapeHtml(cfg.tituladoNombre)}</p>
      </div>
      <p class="vobo">Vº Bº,</p>
      <div class="firma">
        <p>${escapeHtml(cfg.jefeArticulo)} ${escapeHtml(cfg.jefeEmpleo)}<br>
        Presidente del tribunal de evaluación de pruebas físicas</p>
        <div class="firma-espacio"></div>
        <p class="firma-nombre">${escapeHtml(cfg.jefeNombre)}</p>
      </div>
      <p class="destinatarios"><b>DESTINATARIOS:</b><br>Jefe de la UCO<br>Interesado</p>
    </div>`;
}

function renderInformePreview() {
  const nombre = document.getElementById('informe-select').value;
  const contenedor = document.getElementById('informe-preview');
  if (!nombre) { contenedor.innerHTML = '<p class="muted">Seleccione un participante para ver la vista previa.</p>'; return; }
  const row = state.acta.participantes.find(p => p.nombre === nombre);
  contenedor.innerHTML = construirInformeHtml(row).replace('hoja informe-print', '');
}

/* ---------------------------------------------------------------------- */
/* INFORMES EN LOTE                                                         */
/* ---------------------------------------------------------------------- */
function renderLote() {
  const cont = document.getElementById('lote-lista');
  const participantes = state.acta.participantes.filter(p => p.nombre.trim() !== '');
  if (participantes.length === 0) {
    cont.innerHTML = '<p class="muted">No hay participantes en el ACTA.</p>';
    return;
  }
  cont.innerHTML = participantes.map((p, i) => `
    <label class="lote-item"><input type="checkbox" class="lote-check" data-nombre="${escapeHtml(p.nombre)}" checked> ${escapeHtml(p.nombre)}</label>
  `).join('');
}

function initLote() {
  document.getElementById('btn-lote-all').addEventListener('click', () => {
    document.querySelectorAll('.lote-check').forEach(c => c.checked = true);
  });
  document.getElementById('btn-lote-none').addEventListener('click', () => {
    document.querySelectorAll('.lote-check').forEach(c => c.checked = false);
  });
  document.getElementById('btn-lote-print').addEventListener('click', () => {
    const nombres = Array.from(document.querySelectorAll('.lote-check:checked')).map(c => c.dataset.nombre);
    if (nombres.length === 0) { alert('Seleccione al menos un participante.'); return; }
    const items = nombres.map(n => {
      const row = state.acta.participantes.find(p => p.nombre === n);
      return { row, html: construirInformeHtml(row) };
    });
    generarInformesPdfConUI(document.getElementById('btn-lote-print'), items);
  });
}

/* ---------------------------------------------------------------------- */
/* ESTADÍSTICA                                                              */
/* ---------------------------------------------------------------------- */
const GRUPOS_RANGO = {
  OFICIALES: ['Coronel', 'Teniente coronel', 'Comandante', 'Capitán', 'Teniente'],
  SUBOFICIALES: ['Suboficial Mayor', 'Subteniente', 'Brigada', 'Sargento 1º', 'Sargento'],
  TROPA: ['Cabo Mayor', 'Cabo 1º', 'Cabo', 'Soldado']
};

function renderEstadistica() {
  const origen = document.getElementById('est-origen').value;
  const fechaSelect = document.getElementById('est-fecha');
  const fechasDisponibles = [...new Set(state.historico.map(r => r.fecha))].sort();
  const fechaSeleccionada = fechaSelect.value;
  fillSelect(fechaSelect, fechasDisponibles.map(formatFechaCorta));
  if (fechaSeleccionada && Array.from(fechaSelect.options).some(o => o.value === fechaSeleccionada)) {
    fechaSelect.value = fechaSeleccionada;
  }
  fechaSelect.disabled = origen !== 'historico';

  let registros;
  if (origen === 'historico') {
    const fechaTexto = fechaSelect.options[fechaSelect.selectedIndex] ? fechaSelect.options[fechaSelect.selectedIndex].text : null;
    registros = state.historico.filter(r => formatFechaCorta(r.fecha) === fechaTexto);
  } else {
    registros = state.acta.participantes
      .filter(p => p.nombre.trim() !== '')
      .map(p => {
        const calc = Scoring.calcularParticipante(p, state.acta.fecha);
        return { empleo: p.empleo, sexo: p.sexo, incidencia: p.incidencia, apto: calc.apto };
      });
  }

  document.getElementById('tabla-estadistica').innerHTML = construirTablaEstadistica(registros);
}

function initEstadistica() {
  document.getElementById('est-origen').addEventListener('change', renderEstadistica);
  document.getElementById('est-fecha').addEventListener('change', renderEstadistica);
}

function contar(registros, filtro) {
  return registros.filter(filtro).length;
}

function construirTablaEstadistica(registros) {
  function filaEmpleo(empleo) {
    const deEste = registros.filter(r => r.empleo === empleo);
    const W = contar(deEste, r => r.sexo === 'M');
    const X = contar(deEste, r => r.sexo === 'F');
    const D = contar(deEste, r => r.sexo === 'M' && r.apto === 'SÍ');
    const E = contar(deEste, r => r.sexo === 'F' && r.apto === 'SÍ');
    const I = contar(deEste, r => r.sexo === 'M' && r.incidencia === 'LESIONADO');
    const J = contar(deEste, r => r.sexo === 'F' && r.incidencia === 'LESIONADO');
    const K = contar(deEste, r => r.sexo === 'M' && r.incidencia === 'RETIRADO');
    const L = contar(deEste, r => r.sexo === 'F' && r.incidencia === 'RETIRADO');
    const M = contar(deEste, r => r.sexo === 'M' && r.incidencia === 'ELIMINADO');
    const N = contar(deEste, r => r.sexo === 'F' && r.incidencia === 'ELIMINADO');
    const O = contar(deEste, r => r.sexo === 'M' && (r.incidencia || '').startsWith('NO'));
    const P = contar(deEste, r => r.sexo === 'F' && (r.incidencia || '').startsWith('NO'));
    const Q = contar(deEste, r => r.sexo === 'F' && r.incidencia === 'MATERNIDAD');
    const R = contar(deEste, r => r.sexo === 'M' && (r.incidencia || '').startsWith('N/A'));
    const S = contar(deEste, r => r.sexo === 'F' && (r.incidencia || '').startsWith('N/A'));
    const G = Math.max(0, W - D - (I + K + M + O + R));
    const H = Math.max(0, X - E - (J + L + N + P + Q + S));
    return { empleo, W, X, D, E, F: D + E, G, H, I, J, K, L, M, N, O, P, Q, R, S, Y: W + X };
  }

  function sumar(filas) {
    const campos = ['W', 'X', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'Y'];
    const acc = Object.fromEntries(campos.map(c => [c, 0]));
    filas.forEach(f => campos.forEach(c => acc[c] += f[c]));
    return acc;
  }

  function filaHtml(f, destacada) {
    return `<tr${destacada ? ' style="font-weight:700;background:#eef2f5"' : ''}>
      <td style="text-align:left">${escapeHtml(f.empleo || '')}</td>
      <td>${f.D}</td><td>${f.E}</td><td>${f.F}</td>
      <td>${f.G}</td><td>${f.H}</td>
      <td>${f.I}</td><td>${f.J}</td><td>${f.K}</td><td>${f.L}</td>
      <td>${f.M}</td><td>${f.N}</td><td>${f.O}</td><td>${f.P}</td>
      <td>${f.Q}</td><td>${f.R}</td><td>${f.S}</td>
      <td>${f.G + f.H + f.I + f.J + f.K + f.L + f.M + f.N + f.O + f.P + f.Q + f.R + f.S}</td>
      <td>${f.W}</td><td>${f.X}</td><td>${f.Y}</td>
    </tr>`;
  }

  let cuerpo = '';
  let filasCategoria = [];
  Object.entries(GRUPOS_RANGO).forEach(([categoria, empleos]) => {
    cuerpo += `<tr><td colspan="21" style="text-align:left;background:#0b3d67;color:#fff;font-weight:700">${categoria}</td></tr>`;
    const filas = empleos.map(filaEmpleo);
    filas.forEach(f => { cuerpo += filaHtml(f, false); });
    const subtotal = sumar(filas);
    subtotal.empleo = 'SUBTOTAL';
    cuerpo += filaHtml(subtotal, true);
    filasCategoria.push(subtotal);
  });
  const total = sumar(filasCategoria);
  total.empleo = 'TOTAL GENERAL';

  return `
    <thead>
      <tr>
        <th rowspan="2">Empleo</th>
        <th colspan="3">PAFA SUPERADAS</th>
        <th colspan="13">PAFA NO SUPERADAS</th>
        <th colspan="1"></th>
        <th colspan="3">TOTAL</th>
      </tr>
      <tr>
        <th>H</th><th>M</th><th>Subtotal</th>
        <th>NO APTO H</th><th>NO APTO M</th>
        <th>Lesionado H</th><th>Lesionado M</th>
        <th>Retirado H</th><th>Retirado M</th>
        <th>Eliminado H</th><th>Eliminado M</th>
        <th>No pres. H</th><th>No pres. M</th>
        <th>Maternidad M</th>
        <th>No apto médico H</th><th>No apto médico M</th>
        <th>Subtotal</th>
        <th>H</th><th>M</th><th>Total</th>
      </tr>
    </thead>
    <tbody>${cuerpo}${filaHtml(total, true)}</tbody>`;
}

/* ---------------------------------------------------------------------- */
/* HISTÓRICO                                                                */
/* ---------------------------------------------------------------------- */
function renderHistorico(filtro) {
  const tabla = document.getElementById('tabla-historico');
  const buscar = (filtro !== undefined ? filtro : document.getElementById('hist-buscar').value).trim().toLowerCase();
  const registros = state.historico.filter(r =>
    !buscar || r.nombre.toLowerCase().includes(buscar) || (r.dni || '').toLowerCase().includes(buscar)
  );

  const filas = registros.map((r, i) => `
    <tr>
      <td>${formatFechaCorta(r.fecha)}</td><td>${escapeHtml(r.hora)}</td><td>${escapeHtml(r.destino)}</td>
      <td>${escapeHtml(r.motivoPruebas)}</td><td>${escapeHtml(r.empleo)}</td><td style="text-align:left">${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(r.dni)}</td><td>${r.edad ?? ''}</td><td>${escapeHtml(r.sexo)}</td>
      <td>${escapeHtml(r.recMedico)}</td><td>${escapeHtml(r.incidencia)}</td>
      <td>${r.abdMarca}</td><td>${r.abdPuntos}</td><td>${r.flexMarca}</td><td>${r.flexPuntos}</td>
      <td>${r.circMarca}</td><td>${r.circPuntos}</td><td>${escapeHtml(r.resMarca)}</td><td>${r.resPuntos}</td>
      <td>${r.total}</td><td>${r.apto}</td>
      <td><button class="btn-remove-row" data-idx="${state.historico.indexOf(r)}">✕</button></td>
    </tr>`).join('');

  tabla.innerHTML = `
    <thead><tr>
      <th>Fecha</th><th>Hora</th><th>Destino</th><th>Motivo</th><th>Empleo</th><th>Apellidos y nombre</th>
      <th>DNI</th><th>Edad</th><th>Sexo</th><th>Rec. médico</th><th>Incidencia</th>
      <th>Abd. marca</th><th>Abd. ptos</th><th>Flex. marca</th><th>Flex. ptos</th>
      <th>Circ. marca</th><th>Circ. ptos</th><th>2000m marca</th><th>2000m ptos</th>
      <th>Total</th><th>Apto</th><th></th>
    </tr></thead>
    <tbody>${filas || '<tr><td colspan="22" class="muted">Sin registros</td></tr>'}</tbody>`;
}

function initHistorico() {
  document.getElementById('hist-buscar').addEventListener('input', e => renderHistorico(e.target.value));
  document.getElementById('tabla-historico').addEventListener('click', e => {
    if (!e.target.classList.contains('btn-remove-row')) return;
    if (!confirm('¿Eliminar este registro del histórico?')) return;
    state.historico.splice(Number(e.target.dataset.idx), 1);
    persist();
    renderHistorico();
  });
  document.getElementById('btn-hist-csv').addEventListener('click', exportarHistoricoCsv);
}

function exportarHistoricoCsv() {
  const cabecera = ['Fecha', 'Hora', 'Destino', 'Motivo', 'Empleo', 'Apellidos y nombre', 'DNI', 'Fecha nacimiento',
    'Sexo', 'Edad', 'Grupo', 'Rec. médico', 'Incidencia', 'Abd. marca', 'Abd. puntos', 'Flex. marca', 'Flex. puntos',
    'Circuito marca', 'Circuito puntos', '2000m marca', '2000m puntos', 'Total', 'Apto'];
  const filas = state.historico.map(r => [
    formatFechaCorta(r.fecha), r.hora, r.destino, r.motivoPruebas, r.empleo, r.nombre, r.dni,
    formatFechaCorta(r.fechaNacimiento), r.sexo, r.edad, r.grupo, r.recMedico, r.incidencia,
    r.abdMarca, r.abdPuntos, r.flexMarca, r.flexPuntos, r.circMarca, r.circPuntos, r.resMarca, r.resPuntos,
    r.total, r.apto
  ]);
  const csv = [cabecera, ...filas].map(fila => fila.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'historico_pafas.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------------------------------------------------------------------- */
/* IMPRESIÓN                                                                */
/* ---------------------------------------------------------------------- */
function imprimir(htmlInterno) {
  const root = document.getElementById('print-root');
  root.innerHTML = htmlInterno;
  window.print();
}

/* ---------------------------------------------------------------------- */
/* ARRANQUE                                                                 */
/* ---------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initConfiguracion();
  initConvocatoria();
  initActa();
  initInforme();
  initLote();
  initEstadistica();
  initHistorico();
});
