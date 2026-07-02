# ACTA PAFAS EA — Aplicación web local

Aplicación estática (HTML + CSS + JavaScript, sin servidor ni conexión a internet) que
reproduce todas las funcionalidades del libro Excel `ACTA_PAFAS_EA_HTLM.xlsm` para la
gestión de las Pruebas de Aptitud Física del Ejército del Aire y del Espacio (PAFAS).
La generación de informes en PDF usa [html2pdf.js](https://github.com/eKoopmans/html2pdf.js)
(MIT), incluido localmente en `assets/js/vendor/`: no se descarga nada en tiempo de uso.

## Uso

Sirva la carpeta con cualquier servidor estático (o abra `index.html` directamente con
doble clic). No requiere conexión a internet ni instalación de nada: todos los datos se
guardan en el propio navegador (`localStorage`).

Para poder **elegir la carpeta de destino** al generar los informes en PDF (informe
individual e informes en lote), el navegador debe soportar la File System Access API,
lo que exige servir la aplicación por HTTP/HTTPS (por ejemplo `python3 -m http.server`)
en un navegador basado en Chromium; no funciona al abrir `index.html` con doble clic
(protocolo `file://`) ni en Firefox/Safari. Si no está disponible, los PDF se descargan
igualmente con el nombre correcto a la carpeta de Descargas del navegador.

## Funcionalidades

- **Configuración**: datos de la unidad, junta zonal, titulado en EF y jefe de unidad.
- **Convocatoria**: listado de personal convocado, imprimible.
- **ACTA**: alta de participantes con cálculo automático (igual que las fórmulas del
  Excel original) de edad, grupo de edad, puntuación de cada prueba (abdominales,
  flexo-extensiones de brazos, circuito de agilidad-velocidad, resistencia 2000 m),
  puntuación total y resultado APTO/NO APTO. Incluye los mismos avisos visuales que el
  original (sexo, exención de circuito a partir de 45 años, pruebas no superadas,
  DNI duplicado, resaltado de NO APTO/incompletos en el estado "FINAL").
- **Informe individual** y **Informes en lote**: generación de los informes de
  condiciones físicas directamente en PDF (uno por participante), con el nomenclátor
  `AAMMDD PAFAS Empleo Apellidos y nombre.pdf` (fecha de las pruebas del ACTA) y
  guardado en la carpeta que elija el usuario, sustituyendo a la exportación
  automática a PDF por macros del libro original.
- **Estadística**: resumen de aptos/no aptos por empleo y sexo, igual que la hoja
  ESTADÍSTICA del Excel.
- **Histórico**: archivo de actas cerradas, con búsqueda y exportación a CSV.
- **Copia de seguridad**: exportación/importación de todos los datos en un único
  archivo JSON (equivalente a guardar/abrir el propio libro Excel).

## Estructura

```
index.html                          Interfaz de la aplicación (todas las pestañas)
assets/css/styles.css               Estilos de pantalla
assets/css/print.css                Estilos de impresión (ACTA, convocatoria)
assets/css/pdf.css                  Estilos del contenedor oculto usado al generar los PDF
assets/js/data.js                   Baremos oficiales (tablas de puntuación) y catálogos
assets/js/scoring.js                Motor de cálculo (edad, grupo, puntuaciones, aptitud)
assets/js/store.js                  Persistencia local y copia de seguridad
assets/js/pdfExport.js              Generación de PDF por informe y guardado en carpeta
assets/js/app.js                    Lógica de interfaz de todas las pestañas
assets/js/vendor/html2pdf.bundle.min.js   Librería de terceros vendorizada (MIT)
```

## Notas de fidelidad respecto al Excel original

- Los baremos de puntuación (ABDOMINALES, EXT. BRAZOS, CIRCUITO A-V, 2.000 m) y la
  tabla de grupos de edad se han extraído directamente del libro original.
- La lógica de aptitud reproduce fielmente las fórmulas de la columna V de la hoja
  ACTA, incluyendo el caso de aplazamiento médico ("APL") y la exención del circuito
  de agilidad-velocidad a partir de 45 años.
- La generación de PDF por lotes del libro original (macros VBA) se sustituye por la
  generación de PDF en el propio navegador descrita arriba, sin macros ni servidor.
  El acta y la convocatoria se siguen imprimiendo con la función "Imprimir" del
  navegador (Guardar como PDF).
