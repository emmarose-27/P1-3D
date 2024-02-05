// need to fix earthquake list

require([
  "esri/Map",
  "esri/views/SceneView",
  "esri/layers/FeatureLayer",
  "esri/Basemap",
  "esri/core/watchUtils"
], function (Map, SceneView, FeatureLayer, Basemap, watchUtils) {
  const countryBorders = new FeatureLayer({
    url:
      "https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/World_Countries_(Generalized)/FeatureServer/0",
    renderer: {
      type: "simple",
      symbol: {
        type: "polygon-3d",
        symbolLayers: [
          {
            type: "fill",
            outline: {
              color: [255, 255, 255, 0.8],
              size: 1
            }
          }
        ]
      }
    }
  });

  const plateTectonicBorders = new FeatureLayer({
    url:
      "https://services2.arcgis.com/cFEFS0EWrhfDeVw9/arcgis/rest/services/plate_tectonics_boundaries/FeatureServer/0",
    elevationInfo: {
      mode: "on-the-ground"
    },
    renderer: {
      type: "simple",
      symbol: {
        type: "line-3d",
        symbolLayers: [
          {
            type: "line",
            material: { color: [255, 133, 125, 0.7] },
            size: 3
          }
        ]
      }
    }
  });

  const map = new Map({
    ground: {
      opacity: 0,
      navigationConstraint: "none"
    },
    basemap: new Basemap({
      baseLayers: [countryBorders, plateTectonicBorders]
    })
  });

  // the view associated with the map has a transparent background
  // so that we can apply a CSS shadow filter for the glow
  const view = new SceneView({
    container: "view-container",
    qualityProfile: "high",
    map: map,
    alphaCompositingEnabled: true,
    environment: {
      background: {
        type: "color",
        color: [0, 0, 0, 0]
      },
      starsEnabled: false,
      atmosphereEnabled: false
    },
    ui: {
      components: []
    },
    highlightOptions: {
      color: [21, 250, 250],
      fillOpacity: 1
    },
    padding: {
      bottom: 200
    },
    popup: {
      collapseEnabled: false,
      dockEnabled: false,
      dockOptions: {
        breakpoint: false
      }
    },
    camera: {
      position: [-105.6127318, 3.20596275, 13086004.69753],
      heading: 0.24,
      tilt: 0.16
    }
  });

  const exaggeratedElevation = {
    mode: "absolute-height",
    featureExpressionInfo: {
      expression: "$feature.elevation * 6"
    },
    unit: "meters"
  };

  const realElevation = {
    mode: "absolute-height",
    featureExpressionInfo: {
      expression: "$feature.elevation"
    },
    unit: "meters"
  };

  let exaggerated = true;

  const earthquakeLayer = new FeatureLayer({
    url:
      "https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/Historical_Quakes/FeatureServer/0",
    //   only uncomment the line below for testing only
    // definitionExpression: "mag > 7",
    elevationInfo: exaggeratedElevation,
    screenSizePerspectiveEnabled: true,
    renderer: {
      type: "simple",
      symbol: {
        type: "point-3d",
        symbolLayers: [
          {
            type: "object",
            resource: {
              primitive: "sphere"
            },
            material: { color: [255, 250, 239, 0.8] },
            depth: 10000,
            height: 10000,
            width: 10000
          }
        ]
      },
      visualVariables: [
        {
          type: "size",
          field: "mag",
          axis: "all",
          stops: [
            { value: 5.5, size: 10000, label: "5.5" },
            { value: 7, size: 100000, label: "7" }
          ]
        },
        {
          type: "color",
          field: "mag",
          legendOptions: {
            title: "Magnitude"
          },
          stops: [
            { value: 6, color: [254, 240, 217], label: "4.0 - 6" },
            { value: 7, color: [179, 0, 0], label: ">7" }
          ]
        }
      ]
    },
    popupTemplate: {
      content:
        "Magnitude {mag} {type} hit {place} on {time} at a depth of {kmDepth} km.",
      title: "Earthquake Information",
      fieldInfos: [
        {
          fieldName: "time",
          format: {
            dateFormat: "short-date-long-time-24"
          }
        },
        {
          fieldName: "mag",
          format: {
            places: 1,
            digitSeparator: true
          }
        },
        {
          fieldName: "kmDepth",
          format: {
            places: 1,
            digitSeparator: true
          }
        }
      ]
    }
  });

  map.add(earthquakeLayer);

  let earthquakeLayerView = null;
  let highlightHandler = null;

  view.whenLayerView(earthquakeLayer).then(function (lyrView) {
    earthquakeLayerView = lyrView;
  });

  function formatDate(date) {
    const fDate = new Date(date);
    const year = fDate.getFullYear();
    const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
      fDate
    );
    const day = fDate.getDate();
    const hours = fDate.getHours();
    const minutes = fDate.getMinutes();
    const prefix = minutes < 10 ? "0" : "";
    return `${day} ${month} ${year}, at ${hours}:${prefix}${minutes}`;
  }

  let zooming = false;

  earthquakeLayer
    .queryFeatures({
      where: "mag > 7",
      //    if outFields isn't specified, only unique id field will be returned
      outFields: "OBJECTID, place, time, mag, kmDepth",
      //     need to explicitly tell query to return geometry
      returnGeometry: true
    })
    .then(function (result) {
      const features = result.features;
      const list = document.getElementById("earthquake-list");
      features.forEach(function (earthquake) {
        const attr = earthquake.attributes;
        const content = document.createElement("div");
        content.innerHTML = `
          <div>
            <h3>${attr.place}</h3>
            <span class="date-time"><i>${formatDate(attr.time)}</i></span>
            </br>
            Magnitude ${attr.mag} | Depth ${attr.kmDepth} km
          </div>
        `;
        const goToButton = document.createElement("button");
        goToButton.innerText = "Zoom to earthquake";
        goToButton.addEventListener("click", function () {
          zooming = true;
          //           changed target to center, made "earthquake" argument into [earthquake.geometry.x, earthquake.geometry.y]
          view.goTo(
            //             the set zoom doesn't work for the deeper earthquakes, may need to zoom further to get them to highligh
            { center: [earthquake.geometry.x, earthquake.geometry.y], zoom: 6 },
            { speedFactor: 0.5 }
          );

          if (earthquakeLayerView) {
            if (highlightHandler) {
              highlightHandler.remove();
            }
            highlightHandler = earthquakeLayerView.highlight(earthquake);
          }
        });
        content.appendChild(goToButton);
        list.appendChild(content);
      });
    });

  document
    .getElementById("toggle-exaggeration")
    .addEventListener("click", function () {
      if (exaggerated) {
        earthquakeLayer.elevationInfo = realElevation;
        exaggerated = false;
      } else {
        earthquakeLayer.elevationInfo = exaggeratedElevation;
        exaggerated = true;
      }
    });

  function rotate() {
    if (!view.interacting && !zooming) {
      const camera = view.camera.clone();
      camera.position.longitude -= 0.1;
      view.camera = camera;
      requestAnimationFrame(rotate);
    }
  }

  view.when(function () {
    view.constraints.clipDistance.far = 40000000;
    watchUtils.whenFalseOnce(view, "updating", function () {
      rotate();
    });
  });

  let legendVisible = true;
  const legendController = document.getElementById("legend-control");
  const legendContainer = document.getElementById("legend");
  legendController.addEventListener("click", function () {
    legendContainer.style.display = legendVisible ? "none" : "block";
    legendController.innerHTML = legendVisible
      ? "Show explanation"
      : "Hide explanation";
    legendVisible = !legendVisible;
  });
});
