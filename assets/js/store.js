// Persistencia local (localStorage) del estado de la aplicación.
// Sustituye al propio archivo .xlsm como "base de datos": todo se guarda en el
// navegador y se puede exportar/importar como copia de seguridad en JSON.

const Store = (() => {
  const KEY = 'pafas_ea_state_v1';

  function nuevoParticipante(orden) {
    return {
      orden,
      destino: '', motivoPruebas: 'P', empleo: '', nombre: '', dni: '',
      fechaNacimiento: '', sexo: 'M', recMedico: '', incidencia: '',
      abdMarca: '', flexMarca: '', circMarca: '', resMarca: ''
    };
  }

  function estadoInicial() {
    return {
      config: {
        juntaZonal: '', unidadArticulo: 'DEL', unidad: '', localidad: '',
        tituladoArticulo: 'La', tituladoEmpleo: '', tituladoNombre: '',
        jefeArticulo: 'El', jefeEmpleo: '', jefeNombre: ''
      },
      acta: {
        fecha: '', hora: '', lugar: '', estado: 'INICIAL',
        participantes: [nuevoParticipante(1)]
      },
      convocatoria: {
        fecha: '', hora: '', lugar: '',
        participantes: []
      },
      historico: []
    };
  }

  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return estadoInicial();
    try {
      const parsed = JSON.parse(raw);
      const base = estadoInicial();
      return {
        config: Object.assign(base.config, parsed.config),
        acta: Object.assign(base.acta, parsed.acta),
        convocatoria: Object.assign(base.convocatoria, parsed.convocatoria),
        historico: parsed.historico || []
      };
    } catch (e) {
      console.error('Error al leer los datos guardados, se reinicia el estado.', e);
      return estadoInicial();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function exportBackup(state) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pafas_backup_${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importBackup(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        callback(null, parsed);
      } catch (e) {
        callback(e);
      }
    };
    reader.onerror = () => callback(reader.error);
    reader.readAsText(file);
  }

  return { estadoInicial, nuevoParticipante, load, save, exportBackup, importBackup };
})();
