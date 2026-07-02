# ACTA PAFAS EA — Aplicación web local

Aplicación estática (HTML + CSS + JavaScript, sin servidor ni dependencias externas) que
reproduce todas las funcionalidades del libro Excel `ACTA_PAFAS_EA_HTLM.xlsm` para la
gestión de las Pruebas de Aptitud Física del Ejército del Aire y del Espacio (PAFAS).

## Uso

Abra `index.html` directamente en el navegador (doble clic) o sírvalo con cualquier
servidor estático. No requiere conexión a internet ni instalación de nada: todos los
datos se guardan en el propio navegador (`localStorage`).

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
  condiciones físicas, listos para imprimir o guardar como PDF desde el propio
  navegador (Archivo → Imprimir → Guardar como PDF), sustituyendo a la exportación
  automática a PDF por macros del libro original.
- **Estadística**: resumen de aptos/no aptos por empleo y sexo, igual que la hoja
  ESTADÍSTICA del Excel.
- **Histórico**: archivo de actas cerradas, con búsqueda y exportación a CSV.
- **Copia de seguridad**: exportación/importación de todos los datos en un único
  archivo JSON (equivalente a guardar/abrir el propio libro Excel).

## Estructura

```
index.html              Interfaz de la aplicación (todas las pestañas)
assets/css/styles.css   Estilos de pantalla
assets/css/print.css    Estilos de impresión (ACTA, informes, convocatoria)
assets/js/data.js       Baremos oficiales (tablas de puntuación) y catálogos
assets/js/scoring.js    Motor de cálculo (edad, grupo, puntuaciones, aptitud)
assets/js/store.js      Persistencia local y copia de seguridad
assets/js/app.js        Lógica de interfaz de todas las pestañas
```

## Notas de fidelidad respecto al Excel original

- Los baremos de puntuación (ABDOMINALES, EXT. BRAZOS, CIRCUITO A-V, 2.000 m) y la
  tabla de grupos de edad se han extraído directamente del libro original.
- La lógica de aptitud reproduce fielmente las fórmulas de la columna V de la hoja
  ACTA, incluyendo el caso de aplazamiento médico ("APL") y la exención del circuito
  de agilidad-velocidad a partir de 45 años.
- La generación de PDF por lotes del libro original (macros VBA) se sustituye por la
  función de impresión del navegador, que permite guardar como PDF sin necesidad de
  macros ni de un servidor.
