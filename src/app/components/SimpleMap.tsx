import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import type { AnalysisResult } from '../lib/types';
import type { TravelMode } from '../lib/physics';
import { PHILIPPINE_MOUNTAINS } from '../lib/mountains';

interface SimpleMapProps {
  result: AnalysisResult | null;
  originCoords?: { lat: number; lon: number } | null;
  destCoords?: { lat: number; lon: number } | null;
  hikingTrailhead?: { lat: number; lon: number; name: string } | null;
  pinMode?: 'origin' | 'dest' | null;
  mode?: TravelMode;
  onPinPlaced?: (type: 'origin' | 'dest', coords: { lat: number; lon: number }, address: string) => void;
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return data.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

/**
 * Fetch weather for specific points along the route to visualize
 * rain and temperature hotspots on the map.
 */
async function fetchRouteWeatherPoints(
  coordinates: [number, number][]
): Promise<Array<{ lat: number; lon: number; temp: number; rain: number; humidity: number }>> {
  if (coordinates.length < 2) return [];

  // Sample 3–5 points along the route (origin, midpoints, destination)
  const sampleCount = Math.min(5, Math.max(3, Math.floor(coordinates.length / 20)));
  const points: { lat: number; lon: number }[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const idx = Math.floor((i / (sampleCount - 1)) * (coordinates.length - 1));
    const [lon, lat] = coordinates[idx];
    points.push({ lat, lon });
  }

  // Build batch API call — Open-Meteo supports multiple locations
  const lats = points.map((p) => p.lat.toFixed(4)).join(',');
  const lons = points.map((p) => p.lon.toFixed(4)).join(',');

  try {
    // Fetch each point individually (Open-Meteo doesn't batch well with free tier)
    const results = await Promise.all(
      points.map(async (point) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${point.lat}&longitude=${point.lon}&current=temperature_2m,precipitation,relative_humidity_2m&timezone=auto`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          const data = await res.json();

          return {
            lat: point.lat,
            lon: point.lon,
            temp: data.current?.temperature_2m ?? 28,
            rain: data.current?.precipitation ?? 0,
            humidity: data.current?.relative_humidity_2m ?? 65,
          };
        } catch {
          return {
            lat: point.lat,
            lon: point.lon,
            temp: 28,
            rain: 0,
            humidity: 65,
          };
        }
      })
    );

    return results;
  } catch {
    return [];
  }
}

export default function SimpleMap({ result, originCoords, destCoords, hikingTrailhead, pinMode, mode, onPinPlaced }: SimpleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destMarker, setDestMarker] = useState<L.Marker | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Polyline | null>(null);
  const trailheadMarkerRef = useRef<L.Marker | null>(null);
  const weatherLayersRef = useRef<L.LayerGroup | null>(null);
  const mountainLayersRef = useRef<L.LayerGroup | null>(null);
  const pinModeRef = useRef<'origin' | 'dest' | null>(null);
  const onPinPlacedRef = useRef(onPinPlaced);

  // Keep refs in sync so click handlers don't capture stale closures
  useEffect(() => { pinModeRef.current = pinMode ?? null; }, [pinMode]);
  useEffect(() => { onPinPlacedRef.current = onPinPlaced; }, [onPinPlaced]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Create map centered on Philippines
    const map = L.map(mapRef.current, {
      center: [12.8797, 121.7740], // Center of Philippines
      zoom: 6, // Show entire Philippines archipelago
      zoomControl: true,
      maxBounds: [
        [4.0, 116.0], // Southwest coordinates (with buffer)
        [21.5, 127.0] // Northeast coordinates (with buffer)
      ],
      maxBoundsViscosity: 1.0, // Hard bounce when dragging out of bounds
      minZoom: 6, // Prevent zooming out beyond Philippines view
      maxZoom: 19,
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Drop pin on map click
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const type = pinModeRef.current;
      if (!type || !onPinPlacedRef.current) return;
      const { lat, lng } = e.latlng;
      const address = await reverseGeocode(lat, lng);
      onPinPlacedRef.current(type, { lat, lon: lng }, address);
    });

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update cursor style based on pin mode
  useEffect(() => {
    const container = mapInstanceRef.current?.getContainer();
    if (!container) return;
    container.style.cursor = pinMode ? 'crosshair' : '';
  }, [pinMode]);

  // Show mountain markers when hiking mode is selected
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing mountain markers
    if (mountainLayersRef.current) {
      map.removeLayer(mountainLayersRef.current);
      mountainLayersRef.current = null;
    }

    if (mode !== 'hiking') return;

    // Create mountain marker icon (smaller for many peaks)
    const mountainIcon = L.divIcon({
      className: 'mountain-marker',
      html: `<div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: linear-gradient(135deg, #d97706, #b45309);
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        cursor: pointer;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
        </svg>
      </div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16],
    });

    // Use MarkerClusterGroup for performance with 1500+ peaks
    const group = (L as any).markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 12,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count > 100 ? 44 : count > 30 ? 38 : 32;
        return L.divIcon({
          html: `<div style="
            display:flex;align-items:center;justify-content:center;
            width:${size}px;height:${size}px;
            background:linear-gradient(135deg,#d97706,#92400e);
            border-radius:50%;border:3px solid white;
            box-shadow:0 3px 12px rgba(0,0,0,0.4);
            color:white;font-weight:800;font-size:${size > 38 ? 14 : 12}px;
            font-family:system-ui;
          ">${count}</div>`,
          className: 'mountain-cluster',
          iconSize: [size, size],
          iconAnchor: [size/2, size/2],
        });
      }
    });

    PHILIPPINE_MOUNTAINS.forEach((mt) => {
      const diffColor = mt.difficulty === 'Easy' ? '#16a34a'
        : mt.difficulty === 'Moderate' ? '#d97706'
        : mt.difficulty === 'Difficult' ? '#dc2626'
        : '#7c3aed';

      const marker = L.marker([mt.peak.lat, mt.peak.lng], { icon: mountainIcon });
      marker.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 200px; padding: 4px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="background: linear-gradient(135deg, #d97706, #b45309); width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
              </svg>
            </div>
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #1f2937;">${mt.name}</div>
              <div style="font-size: 11px; color: #6b7280;">${mt.province}</div>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
            <div style="background: #fef3c7; padding: 6px 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: #92400e; font-weight: 600;">Elevation</div>
              <div style="font-size: 14px; font-weight: 700; color: #78350f;">${mt.elevationMeters}m</div>
            </div>
            <div style="background: ${diffColor}15; padding: 6px 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: ${diffColor}; font-weight: 600;">Difficulty</div>
              <div style="font-size: 14px; font-weight: 700; color: ${diffColor};">${mt.difficulty}</div>
            </div>
            <div style="background: #f0fdf4; padding: 6px 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: #166534; font-weight: 600;">Trail Distance</div>
              <div style="font-size: 14px; font-weight: 700; color: #15803d;">${mt.trailDistanceKm} km</div>
            </div>
            <div style="background: #eff6ff; padding: 6px 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: #1e40af; font-weight: 600;">Est. Hike Time</div>
              <div style="font-size: 14px; font-weight: 700; color: #1d4ed8;">${mt.estimatedHikeHours}h</div>
            </div>
          </div>
          <div style="margin-top: 4px; padding-top: 6px; border-top: 1px solid #e5e7eb;">
            <div style="font-size: 10px; color: #9ca3af; text-align: center;">
              📍 Set as destination to calculate your hiking route
            </div>
          </div>
        </div>
      `, { maxWidth: 280 });

      // Tooltip on hover only (not permanent — too many markers)
      marker.bindTooltip(`${mt.name} (${mt.elevationMeters}m)`, {
        permanent: false,
        direction: 'top',
        offset: [0, -16],
        className: 'mountain-tooltip',
      });

      group.addLayer(marker);
    });

    group.addTo(map);
    mountainLayersRef.current = group;

  }, [mode]);

  // Update origin marker when coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old marker
    if (originMarker) {
      map.removeLayer(originMarker);
      setOriginMarker(null);
    }

    if (!originCoords) return;

    // Create distinctive origin pin icon
    const greenIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative; width: 36px; height: 48px;">
          <div style="position: absolute; top: 0; left: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.5);"></div>
          <div style="position: absolute; top: 4px; left: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="5"/>
              <path d="M20 21a8 8 0 0 0-16 0"/>
            </svg>
          </div>
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: 800; color: #059669; background: white; padding: 1px 5px; border-radius: 4px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.2); font-family: system-ui;">START</div>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44],
    });

    const m = L.marker([originCoords.lat, originCoords.lon], { icon: greenIcon, draggable: true }).addTo(map);
    m.bindPopup(
      '<div style="font-weight: 600; color: #059669; font-size: 14px;">📍 Start Point</div>',
      { className: 'custom-popup' }
    );
    m.on('dragend', async () => {
      const { lat, lng } = m.getLatLng();
      const address = await reverseGeocode(lat, lng);
      onPinPlacedRef.current?.('origin', { lat, lon: lng }, address);
    });

    setOriginMarker(m);
    map.setView([originCoords.lat, originCoords.lon], 13);
  }, [originCoords]);

  // Update destination marker when coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old marker
    if (destMarker) {
      map.removeLayer(destMarker);
      setDestMarker(null);
    }

    if (!destCoords) return;

    // Create distinctive destination pin icon
    const redIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative; width: 36px; height: 48px;">
          <div style="position: absolute; top: 0; left: 0; width: 36px; height: 36px; background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.5);"></div>
          <div style="position: absolute; top: 4px; left: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" x2="4" y1="22" y2="15"/>
            </svg>
          </div>
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: 800; color: #dc2626; background: white; padding: 1px 5px; border-radius: 4px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.2); font-family: system-ui;">END</div>
        </div>
      `,
      iconSize: [36, 48],
      iconAnchor: [18, 44],
      popupAnchor: [0, -44],
    });

    const dm = L.marker([destCoords.lat, destCoords.lon], { icon: redIcon, draggable: true }).addTo(map);
    dm.bindPopup(
      '<div style="font-weight: 600; color: #dc2626; font-size: 14px;">🏁 Destination</div>',
      { className: 'custom-popup' }
    );
    dm.on('dragend', async () => {
      const { lat, lng } = dm.getLatLng();
      const address = await reverseGeocode(lat, lng);
      onPinPlacedRef.current?.('dest', { lat, lon: lng }, address);
    });

    setDestMarker(dm);
  }, [destCoords]);

  // Hiking trailhead marker — shows where driving stops and hiking begins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old trailhead marker
    if (trailheadMarkerRef.current) {
      map.removeLayer(trailheadMarkerRef.current);
      trailheadMarkerRef.current = null;
    }

    if (!hikingTrailhead) return;

    const trailheadIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="position: relative; width: 40px; height: 48px;">
          <div style="position: absolute; top: 0; left: 2px; width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 3px solid white; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.5);"></div>
          <div style="position: absolute; top: 6px; left: 9px; font-size: 18px; line-height: 1;">🥾</div>
          <div style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); font-size: 8px; font-weight: 800; color: #d97706; background: white; padding: 1px 4px; border-radius: 4px; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.2); font-family: system-ui;">TRAILHEAD</div>
        </div>
      `,
      iconSize: [40, 48],
      iconAnchor: [20, 44],
      popupAnchor: [0, -44],
    });

    const marker = L.marker([hikingTrailhead.lat, hikingTrailhead.lon], { icon: trailheadIcon }).addTo(map);
    marker.bindPopup(
      `<div style="font-weight: 600; color: #d97706; font-size: 13px;">🥾 ${hikingTrailhead.name}</div>
       <div style="font-size: 11px; color: #666; margin-top: 2px;">🚗 Stop driving here → Start hiking</div>`,
      { className: 'custom-popup' }
    );
    trailheadMarkerRef.current = marker;
  }, [hikingTrailhead]);

  // Draw route + weather overlays when result changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old weather overlays
    if (weatherLayersRef.current) {
      weatherLayersRef.current.clearLayers();
    }

    if (!result) {
      // Remove old route if no result
      if (routeLayer) {
        map.removeLayer(routeLayer);
        setRouteLayer(null);
      }
      return;
    }

    // Remove old route
    if (routeLayer) {
      map.removeLayer(routeLayer);
    }

    // Parse coordinates
    const coordinates: [number, number][] = JSON.parse(result.route.polyline);
    const latLngs: L.LatLng[] = coordinates.map(([lon, lat]) => L.latLng(lat, lon));

    // Draw route with brand coral color
    const polyline = L.polyline(latLngs, {
      color: '#FF6B6B', // brand-coral
      weight: 6,
      opacity: 0.8,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    setRouteLayer(polyline);

    // Fit bounds to show entire route
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });

    // Fetch and display weather overlay points along the route
    if (coordinates.length > 2) {
      fetchRouteWeatherPoints(coordinates).then((weatherPoints) => {
        if (!mapInstanceRef.current || weatherPoints.length === 0) return;

        // Create weather layer group
        if (!weatherLayersRef.current) {
          weatherLayersRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        }
        weatherLayersRef.current.clearLayers();

        weatherPoints.forEach((wp) => {
          const map = mapInstanceRef.current!;

          // Determine color based on conditions
          const isRainy = wp.rain > 1;
          const isHot = wp.temp > 32;
          const isVeryHot = wp.temp > 35;

          // Skip points with mild conditions (only show notable weather)
          if (!isRainy && !isHot) return;

          // Determine overlay style
          let color: string;
          let fillColor: string;
          let label: string;
          let radius: number;

          if (isRainy && isHot) {
            // Both rain and heat
            color = '#7c3aed';
            fillColor = '#7c3aed';
            label = `🌧️🔥 ${wp.temp}°C, ${wp.rain.toFixed(1)}mm rain`;
            radius = 800;
          } else if (isRainy) {
            // Rain zone
            color = '#3b82f6';
            fillColor = '#60a5fa';
            label = `🌧️ ${wp.rain.toFixed(1)} mm/h rain`;
            radius = 600 + wp.rain * 30;
          } else if (isVeryHot) {
            // Extreme heat
            color = '#dc2626';
            fillColor = '#f87171';
            label = `🔥 ${wp.temp}°C — Extreme heat`;
            radius = 800;
          } else {
            // Hot
            color = '#f59e0b';
            fillColor = '#fbbf24';
            label = `☀️ ${wp.temp}°C — Hot`;
            radius = 500;
          }

          // Add circle overlay
          const circle = L.circle([wp.lat, wp.lon], {
            radius,
            color,
            fillColor,
            fillOpacity: 0.18,
            weight: 2,
            opacity: 0.6,
            dashArray: isRainy ? '8, 6' : undefined,
          });

          circle.bindPopup(
            `<div style="font-size: 13px; font-weight: 600; padding: 4px;">${label}<br/>` +
            `<span style="font-size: 11px; color: #666; font-weight: 400;">Humidity: ${wp.humidity}%</span></div>`
          );

          weatherLayersRef.current?.addLayer(circle);

          // Add animated pulse for rain zones
          if (isRainy) {
            const rainIcon = L.divIcon({
              className: 'weather-rain-icon',
              html: `
                <div style="
                  width: 28px; height: 28px; 
                  background: rgba(59, 130, 246, 0.25); 
                  border: 2px solid rgba(59, 130, 246, 0.6); 
                  border-radius: 50%; 
                  display: flex; align-items: center; justify-content: center;
                  animation: weather-pulse 2s ease-in-out infinite;
                  font-size: 14px;
                ">🌧️</div>
              `,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });
            const rainMarker = L.marker([wp.lat, wp.lon], { icon: rainIcon, interactive: false });
            weatherLayersRef.current?.addLayer(rainMarker);
          }

          // Add heat indicator
          if (isHot) {
            const heatIcon = L.divIcon({
              className: 'weather-heat-icon',
              html: `
                <div style="
                  width: 28px; height: 28px; 
                  background: rgba(${isVeryHot ? '220, 38, 38' : '245, 158, 11'}, 0.25); 
                  border: 2px solid rgba(${isVeryHot ? '220, 38, 38' : '245, 158, 11'}, 0.6); 
                  border-radius: 50%; 
                  display: flex; align-items: center; justify-content: center;
                  animation: weather-pulse 2.5s ease-in-out infinite;
                  font-size: 14px;
                ">${isVeryHot ? '🔥' : '☀️'}</div>
              `,
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            });
            const heatMarker = L.marker(
              [wp.lat + 0.002, wp.lon + 0.002], // Slight offset if rain already placed
              { icon: heatIcon, interactive: false }
            );
            weatherLayersRef.current?.addLayer(heatMarker);
          }
        });
      });
    }
  }, [result]);

  return (
    <div className="absolute inset-0">
      <div ref={mapRef} className="absolute inset-0" />

      {/* Weather overlay animation styles */}
      <style>{`
        @keyframes weather-pulse {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>

      {pinMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-brand-coral text-white text-sm font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Click on the map to pin {pinMode === 'origin' ? 'starting point' : 'destination'}
          </div>
        </div>
      )}
    </div>
  );
}
