
/************************************************************
 PROYECTO: Metodología para el análisis geoespacial
           de la dinámica urbana

 FUNCIÓN:
 1. Mostrar municipios
 2. Seleccionar municipio mediante clic
 3. Calcular superficie construida GHSL (km²)
 4. Mostrar gráfica temporal
 5. Preparar CSV para Google Drive

 GHSL: JRC/GHSL/P2023A/GHS_BUILT_S
************************************************************/


// ==========================================================
// 1. CONFIGURACIÓN
// ==========================================================

// Reemplazar con la ruta de tu shapefile en GEE Assets
var municipios = ee.FeatureCollection(
  'projects/appinfrarojos/assets/departamentales'
);

// Nombre del campo que contiene el nombre del municipio
// Cambiar según los atributos de tu shapefile
var CAMPO_NOMBRE = 'NOMBRE';

// Años de análisis
// 2025 y 2030 se excluyen porque son extrapolaciones
var anios = [2000, 2005, 2010, 2015, 2020];


// ==========================================================
// 2. CONFIGURAR MAPA
// ==========================================================

Map.centerObject(municipios, 7);

var estiloMunicipios = municipios.style({
  color: '555555',
  fillColor: 'FFFFFF00',
  width: 1
});

Map.addLayer(
  estiloMunicipios,
  {},
  'Municipios'
);


// ==========================================================
// 3. PANEL DE INTERFAZ
// ==========================================================

var panel = ui.Panel({
  style: {
    width: '360px',
    padding: '10px'
  }
});

panel.add(ui.Label({
  value: 'Análisis de dinámica urbana',
  style: {
    fontSize: '18px',
    fontWeight: 'bold'
  }
}));

panel.add(ui.Label(
  'Haz clic sobre un municipio para consultar ' +
  'la evolución de su superficie construida.'
));

var nombreMunicipio = ui.Label(
  'Municipio: pendiente de selección',
  {fontWeight: 'bold'}
);

panel.add(nombreMunicipio);

var panelGrafica = ui.Panel();

panel.add(panelGrafica);

ui.root.insert(0, panel);


// ==========================================================
// 4. FUNCIÓN PARA CALCULAR SUPERFICIE CONSTRUIDA
// ==========================================================

function calcularSuperficie(feature, anio) {

  var imagen = ee.Image(
    'JRC/GHSL/P2023A/GHS_BUILT_S/' + anio
  ).select('built_surface');

  // Sumar superficie construida en m²
  var resultado = imagen.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: feature.geometry(),
    scale: 100,
    maxPixels: 1e13,
    tileScale: 4
  });

  var superficie_m2 = ee.Number(
    resultado.get('built_surface', 0)
  );

  // Convertir a km²
  var superficie_km2 = superficie_m2.divide(1e6);

  return ee.Feature(null, {
    municipio: feature.get(CAMPO_NOMBRE),
    anio: anio,
    superficie_m2: superficie_m2,
    superficie_km2: superficie_km2
  });
}


// ==========================================================
// 5. CLIC SOBRE EL MAPA
// ==========================================================

Map.onClick(function(coords) {

  panelGrafica.clear();

  nombreMunicipio.setValue(
    'Consultando municipio...'
  );

  var punto = ee.Geometry.Point([
    coords.lon,
    coords.lat
  ]);

  var seleccionado = municipios.filterBounds(punto);

  seleccionado.first().get(CAMPO_NOMBRE).evaluate(
    function(nombre, error) {

      if (error || nombre === null) {
        nombreMunicipio.setValue(
          'No se encontró un municipio en ese punto.'
        );
        return;
      }

      nombreMunicipio.setValue(
        'Municipio: ' + nombre
      );

      // Obtener el polígono seleccionado
      var municipio = ee.Feature(
        seleccionado.first()
      );

      // Resaltar municipio seleccionado
      var seleccionadoEstilo = ee.FeatureCollection([
        municipio
      ]).style({
        color: 'FF0000',
        fillColor: 'FF000033',
        width: 3
      });

      Map.layers().set(
        1,
        ui.Map.Layer(
          seleccionadoEstilo,
          {},
          'Municipio seleccionado'
        )
      );

      // Calcular todos los años
      var resultados = ee.FeatureCollection(
        anios.map(function(anio) {
          return calcularSuperficie(
            municipio,
            anio
          );
        })
      );

      // Mostrar gráfica
      var grafica = ui.Chart.feature.byFeature({
        features: resultados,
        xProperty: 'anio',
        yProperties: ['superficie_km2']
      })
      .setChartType('LineChart')
      .setOptions({
        title: 'Superficie construida - ' + nombre,
        hAxis: {
          title: 'Año',
          format: '####'
        },
        vAxis: {
          title: 'Superficie construida (km²)',
          minValue: 0
        },
        lineWidth: 2,
        pointSize: 5,
        legend: {
          position: 'none'
        }
      });

      panelGrafica.add(grafica);

      // Mostrar tabla de resultados
      panelGrafica.add(ui.Label(
        'Datos calculados para exportar:',
        {fontWeight: 'bold'}
      ));

      print(
        'Resultados para ' + nombre,
        resultados
      );

      // Crear tarea de exportación CSV
      // En Code Editor aparecerá en la pestaña Tasks
      Export.table.toDrive({
        collection: resultados,
        description: 'GHSL_' + nombre.replace(/ /g, '_'),
        fileNamePrefix: 'GHSL_' + nombre.replace(/ /g, '_'),
        fileFormat: 'CSV',
        selectors: [
          'municipio',
          'anio',
          'superficie_m2',
          'superficie_km2'
        ]
      });

      panelGrafica.add(ui.Label(
        'CSV preparado. Abre la pestaña Tasks ' +
        'y ejecuta la exportación a Google Drive.',
        {
          color: 'green',
          fontSize: '12px'
        }
      ));

    }
  );

});
