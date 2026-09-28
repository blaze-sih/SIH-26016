/**
 * LRVS — Enterprise GIS Mapping Engine
 * Team BLAZE | SIH26016
 *
 * Real geographic mapping architecture supporting:
 * 1. Central: India real state boundaries & request choropleth
 * 2. State: Maharashtra real district boundaries & request choropleth
 * 3. District: Nashik district boundary & village land project points
 *
 * Supports Google Maps JavaScript API (via GOOGLE_MAPS_API_KEY) with
 * high-performance GeoJSON Data Layer, and graceful Leaflet GIS engine fallback.
 */

'use strict';

(function () {
  // Official Request Stats
  const INDIA_STATE_STATS = {
    'Maharashtra': 28,
    'Uttar Pradesh': 22,
    'Madhya Pradesh': 18,
    'Rajasthan': 14,
    'Karnataka': 12,
    'Gujarat': 9,
    'Tamil Nadu': 8,
    'Andhra Pradesh': 7,
    'West Bengal': 6,
    'Bihar': 5,
    'Odisha': 5,
    'Telangana': 4,
    'Haryana': 4,
    'Punjab': 3,
    'Kerala': 3,
    'Jharkhand': 2,
    'Assam': 2,
    'Chhattisgarh': 2,
    'Uttarakhand': 2,
    'Himachal Pradesh': 1,
    'Goa': 1
  };

  const MH_DISTRICT_STATS = {
    'Nashik': 18,
    'Pune': 14,
    'Aurangabad': 12,
    'Nagpur': 10,
    'Thane': 8,
    'Dhule': 6,
    'Jalgaon': 5,
    'Ahmednagar': 5,
    'Solapur': 4,
    'Kolhapur': 4,
    'Satara': 3,
    'Amravati': 3,
    'Nanded': 3,
    'Latur': 2,
    'Raigad': 2,
    'Palghar': 2,
    'Ratnagiri': 2,
    'Sindhudurg': 1,
    'Chandrapur': 1,
    'Yavatmal': 1
  };

  // Helper to match state names safely
  function getStateCount(name) {
    if (!name) return 0;
    if (INDIA_STATE_STATS[name] !== undefined) return INDIA_STATE_STATS[name];
    const n = name.trim().toLowerCase().replace(/&/g, 'and');
    for (const [key, val] of Object.entries(INDIA_STATE_STATS)) {
      if (key.toLowerCase().replace(/&/g, 'and') === n) return val;
    }
    return 0;
  }

  // Color gradient generator based on request count (Step 6)
  // Higher request count: stronger teal
  // Lower request count: lighter teal
  // States without data: very light neutral color
  function getStateColor(count) {
    if (!count || count <= 0) return '#F1F5F9';
    if (count >= 25) return '#0D5C63'; // Maharashtra (28) — deep strong teal
    if (count >= 20) return '#176B73'; // Uttar Pradesh (22)
    if (count >= 16) return '#207E85'; // Madhya Pradesh (18) — brand LRVS teal
    if (count >= 13) return '#2E9AA4'; // Rajasthan (14)
    if (count >= 10) return '#4FB2BD'; // Karnataka (12)
    if (count >= 6)  return '#7DC9D1'; // Gujarat (9), Tamil Nadu (8), AP (7), WB (6)
    if (count >= 3)  return '#AEE0E5'; // Bihar, Odisha, Telangana, Haryana, etc.
    return '#D2F0F3';                  // 1-2 requests
  }

  function getDistrictColor(count) {
    if (!count || count === 0) return '#F1F5F9';
    if (count >= 16) return '#0D5C63'; // High
    if (count >= 13) return '#207E85'; // High-Med
    if (count >= 11) return '#3AA4B0'; // Med
    if (count >= 8)  return '#75C2CB'; // Med-Low
    return '#A8DFE5';                  // Low
  }

  // Google Maps light enterprise style
  const GOOGLE_MAPS_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#f5f7f8' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f7f8' }] },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#d8eef3' }] }
  ];

  // Helper tooltip
  let activeTooltip = null;
  function showTooltip(x, y, title, subtitle) {
    if (!activeTooltip) {
      activeTooltip = document.createElement('div');
      activeTooltip.className = 'fixed z-[9999] pointer-events-none bg-[#1A2A42] text-white px-3 py-1.5 rounded-lg shadow-xl text-xs border border-slate-600 transition-opacity';
      document.body.appendChild(activeTooltip);
    }
    activeTooltip.innerHTML = `<div class="font-bold">${title}</div><div class="text-[11px] text-teal-300 font-medium">${subtitle}</div>`;
    activeTooltip.style.left = (x + 12) + 'px';
    activeTooltip.style.top = (y + 12) + 'px';
    activeTooltip.style.opacity = '1';
  }

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.style.opacity = '0';
    }
  }

  // =========================================================================
  // 1. CENTRAL MINISTRY: INDIA STATE-WISE REAL GIS MAP
  // =========================================================================
  async function initCentralMap(containerId, apiKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    try {
      const resp = await fetch('/geojson/india-states.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status} loading GeoJSON`);
      const geojson = await resp.json();

      // OPTION A: Google Maps JavaScript API (when API key is valid and available)
      if (window.google && window.google.maps && apiKey) {
        const map = new google.maps.Map(el, {
          center: { lat: 22.8, lng: 82.5 },
          zoom: 4,
          minZoom: 3,
          maxZoom: 7,
          styles: GOOGLE_MAPS_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeId: 'roadmap'
        });

        map.data.addGeoJson(geojson);

        map.data.setStyle(function (feature) {
          const name = feature.getProperty('ST_NM') || feature.getProperty('name') || '';
          const count = getStateCount(name);
          return {
            fillColor: getStateColor(count),
            fillOpacity: count > 0 ? 0.88 : 0.45,
            strokeColor: '#FFFFFF',
            strokeWeight: 1.2,
            cursor: 'pointer'
          };
        });

        const infoWindow = new google.maps.InfoWindow();

        map.data.addListener('mouseover', function (event) {
          const name = event.feature.getProperty('ST_NM') || event.feature.getProperty('name') || '';
          const count = getStateCount(name);
          map.data.overrideStyle(event.feature, {
            strokeColor: '#0D5C63',
            strokeWeight: 2.5,
            fillOpacity: 0.95
          });
          const mouseEvent = event.domEvent;
          showTooltip(mouseEvent.clientX, mouseEvent.clientY, name, `Requests: ${count}`);
        });

        map.data.addListener('mouseout', function () {
          map.data.revertStyle();
          hideTooltip();
        });

        map.data.addListener('click', function (event) {
          hideTooltip();
          const name = event.feature.getProperty('ST_NM') || event.feature.getProperty('name') || '';
          const count = getStateCount(name);
          const targetUrl = (name === 'Maharashtra')
            ? '/dashboard/state'
            : `/land/requests?state=${encodeURIComponent(name)}`;
          const content = `
            <div style="font-family:sans-serif; padding:4px 6px; min-width:130px;">
              <div style="font-weight:bold; font-size:13px; color:#1A2A42;">${name}</div>
              <div style="font-size:12px; color:#207E85; font-weight:bold; margin-top:2px;">Requests: ${count}</div>
              ${count > 0 ? `<div style="margin-top:6px;"><a href="${targetUrl}" style="display:inline-block; font-size:11px; background:#207E85; color:#fff; padding:3px 8px; border-radius:4px; text-decoration:none; font-weight:600;">View Requests &rarr;</a></div>` : ''}
            </div>
          `;
          infoWindow.setContent(content);
          infoWindow.setPosition(event.latLng);
          infoWindow.open(map);
        });
        return;
      }

      // OPTION B: Leaflet + OpenStreetMap basemap + Verified India States GeoJSON
      if (typeof L !== 'undefined') {
        if (el._leaflet_id) {
          el._leaflet_id = null;
          el.innerHTML = '';
        }

        const map = L.map(containerId, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          dragging: true
        });

        // OpenStreetMap clean basemap layer
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 9,
          minZoom: 3,
          opacity: 0.55
        }).addTo(map);

        let selectedLayer = null;

        // Verified India State Boundaries Choropleth Layer
        const geojsonLayer = L.geoJSON(geojson, {
          style: function (feature) {
            const name = feature.properties.ST_NM || feature.properties.st_nm || feature.properties.name || '';
            const count = getStateCount(name);
            return {
              fillColor: getStateColor(count),
              weight: 1.2,
              opacity: 1,
              color: '#FFFFFF',
              fillOpacity: count > 0 ? 0.88 : 0.45
            };
          },
          onEachFeature: function (feature, layer) {
            const name = feature.properties.ST_NM || feature.properties.st_nm || feature.properties.name || '';
            const count = getStateCount(name);

            // Hover: Show tooltip with State Name and Requests: XX
            layer.on('mouseover', function (e) {
              const l = e.target;
              if (selectedLayer !== l) {
                l.setStyle({
                  weight: 2.5,
                  color: '#0D5C63',
                  fillOpacity: 0.95
                });
              }
              l.bringToFront();
              showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, name, `Requests: ${count}`);
            });

            layer.on('mousemove', function (e) {
              showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, name, `Requests: ${count}`);
            });

            layer.on('mouseout', function () {
              hideTooltip();
              if (selectedLayer !== layer) {
                layer.setStyle({
                  weight: 1.2,
                  color: '#FFFFFF',
                  fillOpacity: count > 0 ? 0.88 : 0.45
                });
              }
            });

            // Click: Show selected state and request count with navigation
            layer.on('click', function (e) {
              hideTooltip();
              if (selectedLayer && selectedLayer !== layer) {
                const prevName = selectedLayer.feature.properties.ST_NM || selectedLayer.feature.properties.name || '';
                const prevCount = getStateCount(prevName);
                selectedLayer.setStyle({
                  weight: 1.2,
                  color: '#FFFFFF',
                  fillOpacity: prevCount > 0 ? 0.88 : 0.45
                });
              }
              selectedLayer = layer;
              layer.setStyle({
                weight: 3,
                color: '#1A2A42',
                fillOpacity: 0.98
              });

              const targetUrl = (name === 'Maharashtra')
                ? '/dashboard/state'
                : `/land/requests?state=${encodeURIComponent(name)}`;

              const popupHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px 6px; min-width: 140px;">
                  <div style="font-weight: 700; font-size: 13px; color: #1A2A42;">${name}</div>
                  <div style="font-size: 12px; color: #207E85; font-weight: 700; margin-top: 3px;">
                    Requests: ${count}
                  </div>
                  ${count > 0 ? `
                    <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #E2E8F0;">
                      <a href="${targetUrl}"
                         style="display: inline-block; font-size: 11px; background: #207E85; color: white; padding: 4px 10px; border-radius: 4px; text-decoration: none; font-weight: 600;">
                         ${name === 'Maharashtra' ? 'Open State Dashboard &rarr;' : 'View Land Requests &rarr;'}
                      </a>
                    </div>
                  ` : '<div style="font-size: 10px; color: #94A3B8; margin-top: 3px;">No active requests</div>'}
                </div>
              `;
              layer.bindPopup(popupHtml, { closeButton: true, autoPan: false }).openPopup(e.latlng);
            });
          }
        }).addTo(map);

        // Auto-fit geographic boundaries of India accurately
        map.fitBounds(geojsonLayer.getBounds(), { padding: [4, 4] });

        // Ensure Leaflet resizes properly after CSS / DOM rendering
        setTimeout(function () {
          map.invalidateSize();
          map.fitBounds(geojsonLayer.getBounds(), { padding: [4, 4] });
        }, 150);

        window.addEventListener('resize', function () {
          map.invalidateSize();
        });
      }
    } catch (err) {
      console.error('Error loading Central India map:', err);
    }
  }

  // =========================================================================
  // 2. STATE GOVERNMENT: MAHARASHTRA DISTRICT-WISE REAL GIS MAP
  // =========================================================================
  async function initStateMap(containerId, apiKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    try {
      const resp = await fetch('/geojson/maharashtra-districts.json');
      const geojson = await resp.json();

      // Check Google Maps
      if (window.google && window.google.maps && apiKey) {
        const map = new google.maps.Map(el, {
          center: { lat: 19.5, lng: 76.0 },
          zoom: 6,
          minZoom: 5,
          maxZoom: 9,
          styles: GOOGLE_MAPS_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeId: 'roadmap'
        });

        map.data.addGeoJson(geojson);

        map.data.setStyle(function (feature) {
          const name = feature.getProperty('district') || feature.getProperty('dtname') || feature.getProperty('name') || '';
          const count = MH_DISTRICT_STATS[name] || 0;
          return {
            fillColor: getDistrictColor(count),
            fillOpacity: count > 0 ? 0.85 : 0.45,
            strokeColor: '#FFFFFF',
            strokeWeight: 1,
            cursor: 'pointer'
          };
        });

        map.data.addListener('mouseover', function (event) {
          const name = event.feature.getProperty('district') || event.feature.getProperty('dtname') || event.feature.getProperty('name') || '';
          const count = MH_DISTRICT_STATS[name] || 0;
          map.data.overrideStyle(event.feature, {
            strokeColor: '#0D5C63',
            strokeWeight: 2.5,
            fillOpacity: 0.95
          });
          const mouseEvent = event.domEvent;
          showTooltip(mouseEvent.clientX, mouseEvent.clientY, `${name} District`, `${count} Acquisition Requests`);
        });

        map.data.addListener('mouseout', function (event) {
          map.data.revertStyle();
          hideTooltip();
        });

        map.data.addListener('click', function (event) {
          const name = event.feature.getProperty('district') || event.feature.getProperty('dtname') || event.feature.getProperty('name') || '';
          if (name.toLowerCase() === 'nashik') {
            window.location.href = '/dashboard/district';
          } else {
            window.location.href = `/land/requests?district=${encodeURIComponent(name)}`;
          }
        });
        return;
      }

      // Leaflet fallback with exact same real GeoJSON
      if (typeof L !== 'undefined') {
        const map = L.map(containerId, {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: false
        }).setView([19.5, 76.0], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 10
        }).addTo(map);

        const layer = L.geoJSON(geojson, {
          style: function (feature) {
            const name = feature.properties.district || feature.properties.dtname || feature.properties.name || '';
            const count = MH_DISTRICT_STATS[name] || 0;
            return {
              fillColor: getDistrictColor(count),
              weight: 1,
              opacity: 1,
              color: '#FFFFFF',
              fillOpacity: count > 0 ? 0.85 : 0.45
            };
          },
          onEachFeature: function (feature, l) {
            const name = feature.properties.district || feature.properties.dtname || feature.properties.name || '';
            const count = MH_DISTRICT_STATS[name] || 0;
            l.on({
              mouseover: function (e) {
                l.setStyle({ weight: 2.5, color: '#0D5C63', fillOpacity: 0.95 });
                l.bringToFront();
                showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, `${name} District`, `${count} Acquisition Requests`);
              },
              mouseout: function () {
                hideTooltip();
                l.setStyle({
                  weight: 1,
                  color: '#FFFFFF',
                  fillOpacity: count > 0 ? 0.85 : 0.45
                });
              },
              click: function () {
                if (name.toLowerCase() === 'nashik') {
                  window.location.href = '/dashboard/district';
                } else {
                  window.location.href = `/land/requests?district=${encodeURIComponent(name)}`;
                }
              }
            });
          }
        }).addTo(map);

        map.fitBounds(layer.getBounds(), { padding: [10, 10] });
      }
    } catch (err) {
      console.error('Error loading State Maharashtra map:', err);
    }
  }

  // =========================================================================
  // 3. DISTRICT AUTHORITY: NASHIK DISTRICT REAL BOUNDARY & VILLAGE GIS MAP
  // =========================================================================
  async function initDistrictMap(containerId, apiKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    try {
      // 1. Fetch real Nashik boundary
      const boundaryResp = await fetch('/geojson/nashik-district.json');
      const boundaryJson = await boundaryResp.json();

      // 2. Fetch real Nashik village project coordinates
      const villagesResp = await fetch('/geojson/nashik-villages.json');
      const villagesJson = await villagesResp.json();

      // Google Maps Implementation
      if (window.google && window.google.maps && apiKey) {
        const map = new google.maps.Map(el, {
          center: { lat: 19.9975, lng: 73.7898 },
          zoom: 10,
          minZoom: 9,
          maxZoom: 14,
          styles: GOOGLE_MAPS_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeId: 'roadmap'
        });

        // Add real district boundary polygon
        map.data.addGeoJson(boundaryJson);
        map.data.setStyle({
          fillColor: '#207E85',
          fillOpacity: 0.08,
          strokeColor: '#207E85',
          strokeWeight: 2
        });

        // Add village markers
        villagesJson.features.forEach(function (f) {
          const coords = f.geometry.coordinates;
          const props = f.properties;
          const marker = new google.maps.Marker({
            position: { lat: coords[1], lng: coords[0] },
            map: map,
            title: props.projectName ? `${props.projectName} (${props.village})` : props.village,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: props.color || '#207E85',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2.5
            }
          });

          const infoContent = `
            <div style="font-family:sans-serif; padding:4px 6px;">
              <div style="font-weight:bold; font-size:12px; color:#1A2A42;">${props.projectName || props.village}</div>
              <div style="font-size:11px; color:#64748B;">Village: ${props.village} | Taluka: ${props.taluka}</div>
              ${props.landAreaHa ? `<div style="font-size:11px; color:#0284C7; font-weight:600;">Area: ${props.landAreaHa} Ha</div>` : ''}
              <div style="font-size:10px; font-weight:bold; color:${props.color}; margin-top:2px;">Status: ${props.status}</div>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({ content: infoContent });
          marker.addListener('click', function () {
            infoWindow.open(map, marker);
          });
        });
        return;
      }

      // Leaflet fallback with exact real boundary & pins
      if (typeof L !== 'undefined') {
        const map = L.map(containerId, {
          zoomControl: true,
          attributionControl: false
        }).setView([19.9975, 73.7898], 10);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 16
        }).addTo(map);

        // Add real boundary polygon
        const boundaryLayer = L.geoJSON(boundaryJson, {
          style: {
            fillColor: '#207E85',
            weight: 2,
            opacity: 1,
            color: '#207E85',
            fillOpacity: 0.08
          }
        }).addTo(map);

        map.fitBounds(boundaryLayer.getBounds(), { padding: [15, 15] });

        // Add village pins
        villagesJson.features.forEach(function (f) {
          const coords = f.geometry.coordinates;
          const p = f.properties;

          const pinIcon = L.divIcon({
            className: 'custom-pin',
            html: `
              <div style="display:flex; align-items:center; gap:4px; transform:translate(-50%, -50%); cursor:pointer;">
                <div style="width:14px; height:14px; border-radius:50%; background:${p.color || '#207E85'}; border:2.5px solid white; box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
                <span style="background:white; border:1px solid #E2E8F0; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:700; color:#1E293B; box-shadow:0 1px 2px rgba(0,0,0,0.1); white-space:nowrap;">
                  ${p.village}
                </span>
              </div>
            `,
            iconSize: [0, 0]
          });

          const popupContent = `
            <div class="text-xs space-y-1">
              <div class="font-bold text-[#1A2A42]">${p.projectName || p.village}</div>
              <div class="text-slate-500">Village: <b>${p.village}</b> (Taluka: ${p.taluka})</div>
              ${p.landAreaHa ? `<div class="text-blue-600 font-semibold">Land Area: ${p.landAreaHa} Ha</div>` : ''}
              <div class="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white" style="background:${p.color}">
                ${p.status}
              </div>
              ${p.requestId ? `<div class="text-[10px] text-slate-400 mt-1"><a href="/land/requests" class="text-teal-600 hover:underline">View Request ${p.requestId} &rarr;</a></div>` : ''}
            </div>
          `;

          L.marker([coords[1], coords[0]], { icon: pinIcon })
            .bindPopup(popupContent)
            .addTo(map);
        });
      }
    } catch (err) {
      console.error('Error loading District Nashik map:', err);
    }
  }

  // Export to window
  window.LRVS_GIS = {
    initCentralMap: initCentralMap,
    initStateMap: initStateMap,
    initDistrictMap: initDistrictMap
  };
})();
