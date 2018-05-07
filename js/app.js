// Code for GEOG575 LFinal Project
// uses standard.js style guide, linter, and formatter
// https://standardjs.com/

(function (window, $) {
  'use strict'

  // Vehicle model years
  const VEHICLE_YEARS = ['2018', '2017', '2016']

  // Default map settings
  const MAP_SETTINGS = {
    center: [-101.05, 43.3],
    zoom: 3
  }

  let map = {}

  let evrApp = {
    init () {
      // Set default search type
      evrApp.searchType = 'range'

      mapboxgl.accessToken = 'pk.eyJ1IjoiZ2lzdXgiLCJhIjoiY2l5NjVveDJ4MDA0bzMzcDJjdWlqaDg4MiJ9.K4sFHK_WWcOTQa_59YhPoA'

      // Initialize map
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        center: MAP_SETTINGS.center,
        zoom: MAP_SETTINGS.zoom,
        hash: true
      })

      // Add navigation control
      map.addControl(new mapboxgl.NavigationControl(), 'top-left')

      // Add geolocation control
      map.addControl(new mapboxgl.GeolocateControl(), 'top-left')

      // Initialize geocoder control
      let geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        country: 'us',
        flyTo: false
      })

      // Add geocoder control
      $('#geocoder').append(geocoder.onAdd(map))

      // Add reset map control
      $('#btn-viewNW').on('click', evrApp.viewNationwide)

      // Display nearby stations and range circle
      evrApp.findStations(geocoder)

      // Load vehicle years and range data
      evrApp.loadVehicleYrs()
      evrApp.loadVehicles()

      evrApp.toggleSearch()

      // When the map style is finished loading, add layers and mouse events
      map.on('style.load', function (e) {
        evrApp.addLayers()

        // Display popup when marker is clicked
        map.on('click', evrApp.showStationPanel)

        // Change the cursor style to 'pointer' when hovering over station marker
        map.on('mousemove', function (e) {
          var features = map.queryRenderedFeatures(e.point, {
            layers: ['stations-2018']
          })
          map.getCanvas().style.cursor = (features.length) ? 'pointer' : ''
        })
      })

      // Bind layer switch event
      evrApp.switchLayers()
    },
    toggleSearch () {
      // Toggle search fields for range input or select vehicle
      $('.form-search').on('click', 'a', function () {
        let thisElm = $(this).closest('div')
        let target = '.' + $(this).data('target')

        // Toggle the display of the distance input or vehicle selector
        $(thisElm).add(target).toggleClass('hide')

        // Hide the vehicle details panel
        $('.vehicle-meta').addClass('hide')

        // Save the search type
        evrApp.searchType = $(this).data('searchtype')
      })
    },
    addLayers () { // Add layers to map
      // Add station data geojson source
      map.addSource('ev-stations', {
        type: 'geojson',
        data: 'evr-map/js/data/ev-stations-2018.geojson',
        buffer: 0,
        maxzoom: 12,
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 40
      })

      // Add location marker source
      map.addSource('single-point', {
        'type': 'geojson',
        'data': {
          'type': 'FeatureCollection',
          'features': []
        }
      })

      // Add cluster layer for station data
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'ev-stations',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            '#51bbd6',
            100,
            '#f1f075',
            750,
            '#fb8072'
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            20,
            100,
            30,
            750,
            40
          ]
        }
      })

      // Add layer for cluster label
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'ev-stations',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 12
        }
      })

      // Add layer for station locations
      map.addLayer({
        id: 'stations-2018',
        type: 'circle',
        source: 'ev-stations',
        filter: ['!has', 'point_count'],
        paint: {
          'circle-color': '#11b4da',
          'circle-radius': 6,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff'
        }
      })
    },
    viewNationwide () { // Reset map to the nationwide view
      map.flyTo({center: MAP_SETTINGS.center, zoom: MAP_SETTINGS.zoom})
    },
    switchLayers () { // Switch map layers
      $('[name="layerSwitch"]').on('change', function () {
        let layerID = this.value

        map.setStyle('mapbox://styles/mapbox/' + layerID + '-v9')
      })
    },
    loadVehicleYrs () { // Get vehicle model years
      let years = ''

      // Create HTML template for year options
      VEHICLE_YEARS.forEach(year => {
        years += '<option>' + year + '</option>'
      })

      // Populate year drop-down list
      $('#sel-year').append(years)

      // Load vehicle data for the selected year
      $('#sel-year').on('change', function () {
        evrApp.loadVehicles()
      })
    },
    loadVehicles () { // Get vehicle data
      let vehicles = ''
      let year = $('#sel-year').val()
      let jsonURL = '/js/data/ev-range-' + year + '.json'

      // Get vehicle JSON data
      $.getJSON(jsonURL, (vehicleData) => {
        evrApp.vehicleData = vehicleData

        // Create HTML template for vehicle options
        vehicleData.forEach((vehicle, index) => {
          vehicles += '<option value="' + vehicle.Range + '" data-index="' + index + '">' + vehicle.Make + ' ' + vehicle.Model + '</option>'
        })

        // Populate vehicle drop-down list
        $('#sel-vehicle').empty().append(vehicles)
      })
    },
    findStations (geocoder) { // Display stations near searched location and distance
      let geoCodeResult

      // Get geocoder results
      geocoder.on('result', function (ev) {
        geoCodeResult = ev.result
      })

      // Trigger the search button when user hits the enter key
      $('#circle-radius').on('keydown', function (event) {
        if (event.which == 13) { $('#btn-find').click() }
      })

      // Display location marker and circle with given radius
      $('#btn-find').on('click', function () {
        let radiusVal = 0
        let isValidSearch = false

        // Hide the station details panel
        $('.station-meta').addClass('hide')

        // Get location search and radius values
        let geoCodeVal = $('.mapboxgl-ctrl-geocoder').find('input').val()

        // Get the distance value based on search type (distance or vehicle)
        if (evrApp.searchType === 'range') {
          radiusVal = parseFloat($('#circle-radius').val())
        } else {
          radiusVal = parseFloat($('#sel-vehicle').val())
        }

        // Validate search inputs
        isValidSearch = evrApp.validateSearch(geoCodeVal, geoCodeResult, radiusVal)

        // If search is valid, dipslay location marker and range circle
        if (isValidSearch) {
          evrApp.addLocMarker(geoCodeResult)
          evrApp.addRangeCircle(geoCodeResult, radiusVal)

          // If search type is vehicle, then show vehicle data panel
          if (evrApp.searchType === 'vehicle') {
            evrApp.showVehicleData()
          }
        }
      })
    },
    validateSearch (geoCodeVal, geoCodeResult, radiusVal) {
      // Validate location search input
      if (geoCodeVal === '' || geoCodeResult === undefined) {
        window.alert('Invalid location. Please enter a location and select it from the search suggestions.')
        return false
      }

      // Validate geocoder result matches search input
      if (geoCodeVal !== geoCodeResult.place_name) {
        window.alert('Invalid location. Please enter a location and select it from the search suggestions.')
        return false
      }

      // Validate radius input
      if (radiusVal <= 0 || radiusVal === undefined || radiusVal === '' || isNaN(radiusVal)) {
        window.alert('Please enter a valid radius in miles.')
        $('#circle-radius').val('')
        return false
      }

      return true
    },
    addLocMarker (geoCodeResult) { // Add a location marker at the searched location
      // Remove existing location marker
      if (evrApp.marker) {
        evrApp.marker.remove()
      }

      // Display location marker
      evrApp.marker = new mapboxgl.Marker()
        .setLngLat(geoCodeResult.center)
        .addTo(map)
    },
    addRangeCircle (geoCodeResult, radiusVal) { // Display the range circle based on searched location
      const earthRadiiMeters = 6378100
      const earthRadiiMiles = 3963.1676

      // Convert given distance (mi) to meters
      let radiusMeters = (radiusVal / earthRadiiMiles) * earthRadiiMeters

      // Remove existing circle
      if (evrApp.rangeCircle !== undefined) {
        evrApp.rangeCircle.remove()
      }

      // Initalize the rangeCircle and add to map
      evrApp.rangeCircle = new MapboxCircle({
        lat: geoCodeResult.center[1],
        lng: geoCodeResult.center[0]
      }, radiusMeters, {
        editable: false,
        minRadius: 1500,
        fillColor: '#29AB87'
      }).addTo(map)

      // Get the bounding box of the range circle
      let neLat = evrApp.rangeCircle.getBounds().ne.lat
      let neLng = evrApp.rangeCircle.getBounds().ne.lng
      let swLat = evrApp.rangeCircle.getBounds().sw.lat
      let swLng = evrApp.rangeCircle.getBounds().sw.lng

      // Zoom the map to the range circle bounding box
      map.fitBounds([[
        swLng,
        swLat
      ], [
        neLng,
        neLat
      ]], { padding: 100})
    },
    showVehicleData () { // Display the vehicle details panel
      $('.vehicle-meta').removeClass('hide')

      // Get the vehicle details content
      let selectedVal = $('#sel-vehicle').find(':selected')
      let selectedIndex = $(selectedVal).data('index')
      let vehicleData = evrApp.vehicleData[selectedIndex]

      let vehicleName = vehicleData.Year + ' ' + vehicleData.Make + ' ' + vehicleData.Model
      let vehicleRange = vehicleData.Range + ' miles'
      let vehicleChargeTime = vehicleData.time_to_charge + ' hours'

      // Populate the vehicle details panel
      $('[data-vehicle]').text(vehicleName)
      $('[data-range]').text(vehicleRange)
      $('[data-chargeTime]').text(vehicleChargeTime)
    },
    showStationPanel (e) { // Display the station details panel
      // Get the embedded station details in the map layer
      let features = map.queryRenderedFeatures(e.point, {
        layers: ['stations-2018']
      })

      // If the selected point does not have features, then hide the station panel
      if (!features.length) {
        $('.station-meta').addClass('hide')
        return
      } else {
        $('.panel-meta, .station-meta').removeClass('hide')
      }

      let feature = features[0]

      // Get the station details content
      let stationName = feature.properties.station_name
      let stationAddr = feature.properties.street_address +
        '<br>' + feature.properties.city + ', ' + feature.properties.state
      let level1 = (feature.properties.ev_level1 === 'null' ? 0 : feature.properties.ev_level1)
      let level2 = (feature.properties.ev_level2 === 'null' ? 0 : feature.properties.ev_level2)
      let dcFast = (feature.properties.ev_dc_fast_count === 'null' ? 0 : feature.properties.ev_dc_fast_count)
      let connectorTypes = feature.properties.ev_connector_types.split(' ').join(', ')
      let accessType = feature.properties.groups_with_access_code

      // Populate the station details panel
      $('[data-station]').text(stationName)
      $('[data-addr]').html(stationAddr)
      $('[data-level1]').text(level1)
      $('[data-level2]').text(level2)
      $('[data-fastCharge]').text(dcFast)
      $('[data-connectorTypes]').text(connectorTypes)
      $('[data-accessType]').text(accessType)
    }
  }

  // Initialize the application
  evrApp.init()
})(window, jQuery)
