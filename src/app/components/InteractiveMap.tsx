import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Loader2, Target, Clock, Navigation, Search, X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import type { AnalysisResult } from '../lib/types';

/* ── WMO Weather Code Descriptions ── */
const WMO_DESCRIPTIONS: Record<number, { label: string; icon: string; color: string }> = {
  0: { label: 'Clear Sky', icon: '☀️', color: '#f59e0b' },
  1: { label: 'Mainly Clear', icon: '🌤️', color: '#f59e0b' },
  2: { label: 'Partly Cloudy', icon: '⛅', color: '#6b7280' },
  3: { label: 'Overcast', icon: '☁️', color: '#6b7280' },
  45: { label: 'Foggy', icon: '🌫️', color: '#9ca3af' },
  48: { label: 'Rime Fog', icon: '🌫️', color: '#9ca3af' },
  51: { label: 'Light Drizzle', icon: '🌦️', color: '#3b82f6' },
  53: { label: 'Drizzle', icon: '🌦️', color: '#3b82f6' },
  55: { label: 'Dense Drizzle', icon: '🌧️', color: '#3b82f6' },
  61: { label: 'Light Rain', icon: '🌧️', color: '#3b82f6' },
  63: { label: 'Moderate Rain', icon: '🌧️', color: '#2563eb' },
  65: { label: 'Heavy Rain', icon: '🌧️', color: '#1d4ed8' },
  71: { label: 'Light Snow', icon: '🌨️', color: '#93c5fd' },
  73: { label: 'Moderate Snow', icon: '🌨️', color: '#93c5fd' },
  75: { label: 'Heavy Snow', icon: '❄️', color: '#93c5fd' },
  80: { label: 'Rain Showers', icon: '🌦️', color: '#3b82f6' },
  81: { label: 'Mod. Showers', icon: '🌧️', color: '#2563eb' },
  82: { label: 'Heavy Showers', icon: '🌧️', color: '#1d4ed8' },
  95: { label: 'Thunderstorm', icon: '⛈️', color: '#7c3aed' },
  96: { label: 'T-storm + Hail', icon: '⛈️', color: '#7c3aed' },
  99: { label: 'T-storm + Hail', icon: '⛈️', color: '#7c3aed' },
};

const getWeatherInfo = (code: number, temp: number) => {
  const info = WMO_DESCRIPTIONS[code];
  if (info) return info;
  // Fallback based on temperature
  if (temp > 33) return { label: 'Hot', icon: '🌡️', color: '#ef4444' };
  return { label: 'Clear', icon: '☀️', color: '#f59e0b' };
};

interface InteractiveMapProps {
  onRouteRequest: (origin: { lat: number; lon: number }, destination: { lat: number; lon: number }) => void;
  result: AnalysisResult | null;
  loading: boolean;
  onReset?: () => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function InteractiveMap({ onRouteRequest, result, loading, onReset }: InteractiveMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [originMarker, setOriginMarker] = useState<L.Marker | null>(null);
  const [destMarker, setDestMarker] = useState<L.Marker | null>(null);
  const [routeLayer, setRouteLayer] = useState<L.Polyline | null>(null);
  const [clickMode, setClickMode] = useState<'origin' | 'destination'>('origin');
  const [isLocating, setIsLocating] = useState(false);

  // Search states
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [originResults, setOriginResults] = useState<SearchResult[]>([]);
  const [destResults, setDestResults] = useState<SearchResult[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestResults, setShowDestResults] = useState(false);
  const searchTimeoutRef = useRef<{origin: NodeJS.Timeout | null, dest: NodeJS.Timeout | null}>({
    origin: null,
    dest: null
  });

  // Geocoding search function
  const searchLocation = async (query: string, isOrigin: boolean) => {
    if (!query.trim() || query.length < 3) {
      if (isOrigin) setOriginResults([]);
      else setDestResults([]);
      return;
    }

    if (isOrigin) setIsSearchingOrigin(true);
    else setIsSearchingDest(true);

    try {
      // Nominatim API with Philippines bounding box
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${encodeURIComponent(query)}&` +
        `countrycodes=ph&` +
        `bounded=1&` +
        `viewbox=116.0,21.5,127.0,4.0&` +
        `limit=5`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      if (!response.ok) throw new Error('Search failed');

      const data: SearchResult[] = await response.json();

      if (isOrigin) {
        setOriginResults(data);
        setShowOriginResults(true);
      } else {
        setDestResults(data);
        setShowDestResults(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      if (isOrigin) setIsSearchingOrigin(false);
      else setIsSearchingDest(false);
    }
  };

  // Handle search result selection
  const selectSearchResult = (result: SearchResult, isOrigin: boolean) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (isOrigin) {
      setOriginSearch(result.display_name);
      setShowOriginResults(false);

      if (originMarker) {
        map.removeLayer(originMarker);
      }

      const greenIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="position: relative; width: 32px; height: 32px;">
            <div style="position: absolute; top: 0; left: 0; width: 32px; height: 32px; background: #10b981; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 0 0 0 8px rgba(16, 185, 129, 0.1); animation: pulse-ring 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: greenIcon }).addTo(map);
      marker.bindPopup(
        '<div style="font-weight: 600; color: #059669; font-size: 14px;">Start Point</div>' +
        '<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">' + result.display_name + '</div>',
        { className: 'custom-popup' }
      ).openPopup();

      setOriginMarker(marker);
      map.setView([lat, lng], 15);

      if (destMarker) {
        const destPos = destMarker.getLatLng();
        onRouteRequest(
          { lat, lon: lng },
          { lat: destPos.lat, lon: destPos.lng }
        );
      }
    } else {
      setDestSearch(result.display_name);
      setShowDestResults(false);

      if (destMarker) {
        map.removeLayer(destMarker);
      }

      const redIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div style="position: relative; width: 32px; height: 32px;">
            <div style="position: absolute; top: 0; left: 0; width: 32px; height: 32px; background: #ef4444; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4), 0 0 0 8px rgba(239, 68, 68, 0.1); animation: pulse-ring 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: redIcon }).addTo(map);
      marker.bindPopup(
        '<div style="font-weight: 600; color: #dc2626; font-size: 14px;">Destination</div>' +
        '<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">' + result.display_name + '</div>',
        { className: 'custom-popup' }
      ).openPopup();

      setDestMarker(marker);
      map.setView([lat, lng], 15);

      if (originMarker) {
        const originPos = originMarker.getLatLng();
        onRouteRequest(
          { lat: originPos.lat, lon: originPos.lng },
          { lat, lon: lng }
        );
      }
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude: lat, longitude: lng } = position.coords;
        const map = mapInstanceRef.current;
        if (!map) return;

        // Update search field with coordinates
        setOriginSearch(`Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);

        map.setView([lat, lng], 15);
        
        if (originMarker) {
          map.removeLayer(originMarker);
        }

        const greenIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="position: relative; width: 32px; height: 32px;">
              <div style="position: absolute; top: 0; left: 0; width: 32px; height: 32px; background: #10b981; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 0 0 0 8px rgba(16, 185, 129, 0.1); animation: pulse-ring 2s infinite;"></div>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon: greenIcon }).addTo(map);
        marker.bindPopup(
          `<div style="font-weight: 600; color: #059669; font-size: 14px;">Your Location</div>
           <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Fetching local weather...</div>
           <div style="font-size: 11px; color: #9ca3af; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">Lat: ${lat.toFixed(5)}<br/>Lon: ${lng.toFixed(5)}</div>`,
          { className: 'custom-popup' }
        ).openPopup();
        
        setOriginMarker(marker);
        setClickMode('destination');

        // Fetch hyper-local weather for the user's GPS coordinates
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&timezone=auto`)
          .then(res => res.json())
          .then(data => {
            const temp = Math.round(data.current.temperature_2m);
            const weatherCode = data.current.weather_code ?? 0;
            const weather = getWeatherInfo(weatherCode, temp);
            
            marker.setPopupContent(
              `<div style="font-weight: 600; color: #059669; font-size: 14px;">Your Location</div>
               <div style="font-size: 13px; color: #4b5563; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                 <span>${weather.icon}</span> <b>${temp}°C</b> — ${weather.label}
               </div>
               <div style="font-size: 11px; color: #9ca3af; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">Click on map to set destination</div>`
            );
          })
          .catch(err => console.error("Local weather fetch failed:", err));
        
        if (destMarker) {
          const destPos = destMarker.getLatLng();
          onRouteRequest(
            { lat, lon: lng },
            { lat: destPos.lat, lon: destPos.lng }
          );
        }
      },
      (error) => {
        setIsLocating(false);
        console.error("Error getting location:", error.message || error.code || "Unknown error");

        // Fallback for preview environments or unavailable GPS
        alert("Using a simulated location (Rizal Park, Manila) for preview.");
        const lat = 14.5826; // Rizal Park, Manila mock
        const lng = 120.9787;

        setOriginSearch(`Mock Location - Rizal Park, Manila`);

        const map = mapInstanceRef.current;
        if (!map) return;

        map.setView([lat, lng], 15);
        
        if (originMarker) {
          map.removeLayer(originMarker);
        }

        const greenIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="position: relative; width: 32px; height: 32px;">
              <div style="position: absolute; top: 0; left: 0; width: 32px; height: 32px; background: #10b981; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 0 0 0 8px rgba(16, 185, 129, 0.1); animation: pulse-ring 2s infinite;"></div>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon: greenIcon }).addTo(map);
        marker.bindPopup(
          `<div style="font-weight: 600; color: #059669; font-size: 14px;">Mock Location</div>
           <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Fetching local weather...</div>
           <div style="font-size: 11px; color: #9ca3af; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">Lat: ${lat.toFixed(5)}<br/>Lon: ${lng.toFixed(5)}</div>`,
          { className: 'custom-popup' }
        ).openPopup();
        
        setOriginMarker(marker);
        setClickMode('destination');

        // Fetch hyper-local weather for the mock coordinates
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&timezone=auto`)
          .then(res => res.json())
          .then(data => {
            const temp = Math.round(data.current.temperature_2m);
            const weatherCode = data.current.weather_code ?? 0;
            const weather = getWeatherInfo(weatherCode, temp);
            
            marker.setPopupContent(
              `<div style="font-weight: 600; color: #059669; font-size: 14px;">Mock Location</div>
               <div style="font-size: 13px; color: #4b5563; margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                 <span>${weather.icon}</span> <b>${temp}°C</b> — ${weather.label}
               </div>
               <div style="font-size: 11px; color: #9ca3af; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">Click on map to set destination</div>`
            );
          })
          .catch(err => console.error("Local weather fetch failed:", err));
        
        if (destMarker) {
          const destPos = destMarker.getLatLng();
          onRouteRequest(
            { lat, lon: lng },
            { lat: destPos.lat, lon: destPos.lng }
          );
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

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

    // Add Regional Weather Stations to give visual context of what places are hot/raining
    const weatherStations = [
      { name: 'Baguio', lat: 16.4023, lon: 120.5960 },
      { name: 'Metro Manila', lat: 14.5995, lon: 120.9842 },
      { name: 'Cebu City', lat: 10.3157, lon: 123.8854 },
      { name: 'Davao City', lat: 7.1907, lon: 125.4553 },
      { name: 'Legazpi', lat: 13.1391, lon: 123.7438 },
      { name: 'Puerto Princesa', lat: 9.7392, lon: 118.7353 },
      { name: 'Tuguegarao', lat: 17.6185, lon: 121.7280 },
      { name: 'Batanes', lat: 20.4500, lon: 121.9667 }
    ];
    
    // Fetch real weather data from Open-Meteo API for accuracy
    const lats = weatherStations.map(s => s.lat).join(',');
    const lons = weatherStations.map(s => s.lon).join(',');

    const renderWeatherMarkers = (stations: any[], source: 'api' | 'mock') => {
      stations.forEach(station => {
        const weather = getWeatherInfo(station.weatherCode ?? 0, station.temp);
        const markerColor = weather.color;

        const iconHtml = `<div style="background-color: ${markerColor}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px ${markerColor}99; display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer;">
               <span>${weather.icon}</span>
             </div>`;

        const wIcon = L.divIcon({
          className: 'regional-weather',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const statusLabel = source === 'mock' ? ' (Offline)' : '';

        L.marker([station.lat, station.lon], { icon: wIcon, zIndexOffset: 500 })
          .bindPopup(
            `<div style="font-weight: 600; color: #1f2937; font-size: 14px; margin-bottom: 4px;">${station.name}</div>
             <div style="font-size: 12px; color: #4b5563;">
               <span style="display:inline-block; width: 60px;">Temp:</span> <b>${station.temp}°C</b><br/>
               <span style="display:inline-block; width: 60px;">Status:</span> <b>${weather.icon} ${weather.label}${statusLabel}</b>
             </div>`,
            { className: 'custom-popup' }
          )
          .addTo(map);
      });
    };

    // Use Promise.all to fetch individual API requests, bypassing Open-Meteo's fragile multi-location query parser
    const fetchPromises = weatherStations.map(station => 
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${station.lat}&longitude=${station.lon}&current=temperature_2m,precipitation,weather_code&timezone=auto`)
        .then(res => {
          if (!res.ok) throw new Error("API returned " + res.status);
          return res.json();
        })
        .then(data => {
          const current = data.current;
          return {
            ...station,
            temp: current ? Math.round(current.temperature_2m) : 28,
            rain: current ? current.precipitation : 0,
            weatherCode: current ? current.weather_code : 0
          };
        })
    );

    Promise.all(fetchPromises)
      .then(apiStations => {
        renderWeatherMarkers(apiStations, 'api');
      })
      .catch(err => {
        console.warn("Weather API failed, falling back to simulated data:", err);
        // Fallback mock data if API is down
        const mockStations = weatherStations.map((station, i) => ({
          ...station,
          temp: [18, 34, 31, 27, 33, 29, 36, 22][i] || 30,
          rain: [1, 0, 0, 5, 0, 0, 0, 2][i] || 0,
          weatherCode: [61, 0, 2, 63, 1, 0, 0, 80][i] || 0
        }));
        renderWeatherMarkers(mockStations, 'mock');
      });

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = () => {
      setShowOriginResults(false);
      setShowDestResults(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOriginResults(false);
        setShowDestResults(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Handle map clicks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      if (clickMode === 'origin') {
        // Remove old origin marker
        if (originMarker) {
          map.removeLayer(originMarker);
        }

        // Create modern marker
        const greenIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="position: relative; width: 32px; height: 32px;">
              <div style="position: absolute; top: 0; left: 0; width: 32px; height: 32px; background: #10b981; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4), 0 0 0 8px rgba(16, 185, 129, 0.1); animation: pulse-ring 2s infinite;"></div>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon: greenIcon }).addTo(map);
        marker.bindPopup(
          '<div style="font-weight: 600; color: #059669; font-size: 14px;">Start Point</div>' +
          '<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Click on map to set destination</div>' +
          '<div style="font-size: 11px; color: #9ca3af; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">Lat: ' + lat.toFixed(5) + '<br/>Lon: ' + lng.toFixed(5) + '</div>',
          { className: 'custom-popup' }
        ).openPopup();
        setOriginMarker(marker);
        setClickMode('destination');
      } else {
        // Remove old destination marker
        if (destMarker) {
          map.removeLayer(destMarker);
        }

        // Create modern destination marker
        const redIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `
            <div style="position: relative; width: 32px; height: 32px;">
              <div style="position: absolute; top: 0; left: 0; width: 32px; height: 32px; background: #ef4444; border-radius: 50%; border: 4px solid white; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4), 0 0 0 8px rgba(239, 68, 68, 0.1); animation: pulse-ring 2s infinite;"></div>
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 10px; height: 10px; background: white; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon: redIcon }).addTo(map);
        marker.bindPopup(
          '<div style="font-weight: 600; color: #dc2626; font-size: 14px;">Destination</div>' +
          '<div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Calculating route...</div>' +
          '<div style="font-size: 11px; color: #9ca3af; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb;">Lat: ' + lat.toFixed(5) + '<br/>Lon: ' + lng.toFixed(5) + '</div>',
          { className: 'custom-popup' }
        ).openPopup();
        setDestMarker(marker);

        // Calculate route
        if (originMarker) {
          const originPos = originMarker.getLatLng();
          onRouteRequest(
            { lat: originPos.lat, lon: originPos.lng },
            { lat, lon: lng }
          );
        }
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [clickMode, originMarker, destMarker, onRouteRequest]);

  // Draw route when result changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !result) return;

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
      weight: 8,
      opacity: 0.9,
      lineJoin: 'round',
      lineCap: 'round',
    }).addTo(map);

    setRouteLayer(polyline);

    // Fit bounds to show entire route
    map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
  }, [result]);

  // Reset function
  const handleReset = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove markers and route
    if (originMarker) {
      map.removeLayer(originMarker);
      setOriginMarker(null);
    }
    if (destMarker) {
      map.removeLayer(destMarker);
      setDestMarker(null);
    }
    if (routeLayer) {
      map.removeLayer(routeLayer);
      setRouteLayer(null);
    }

    // Clear search fields
    setOriginSearch('');
    setDestSearch('');
    setOriginResults([]);
    setDestResults([]);
    setShowOriginResults(false);
    setShowDestResults(false);

    setClickMode('origin');

    // Notify parent to clear results
    if (onReset) {
      onReset();
    }
  };

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="absolute inset-0" />

      {/* Search Bar - Top Center */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl z-[900]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border-2 border-gray-100">
          {/* Origin Search */}
          <div className="relative mb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                <input
                  type="text"
                  placeholder="Starting point (or use locate button)"
                  value={originSearch}
                  onChange={(e) => {
                    setOriginSearch(e.target.value);
                    // Debounce search
                    if (searchTimeoutRef.current.origin) {
                      clearTimeout(searchTimeoutRef.current.origin);
                    }
                    searchTimeoutRef.current.origin = setTimeout(() => {
                      searchLocation(e.target.value, true);
                    }, 500);
                  }}
                  onFocus={() => originResults.length > 0 && setShowOriginResults(true)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-gray-200 focus:border-emerald-400 focus:outline-none text-sm"
                />
                {originSearch && (
                  <button
                    onClick={() => {
                      setOriginSearch('');
                      setOriginResults([]);
                      setShowOriginResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                {isSearchingOrigin && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-500" />
                )}
              </div>
              <button
                onClick={handleLocateMe}
                disabled={isLocating}
                className="bg-emerald-500 text-white p-2.5 rounded-xl shadow-md hover:bg-emerald-600 transition-all flex-shrink-0"
                title="Use my current location"
              >
                {isLocating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Origin Results Dropdown */}
            {showOriginResults && originResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-10">
                {originResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSearchResult(result, true)}
                    className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{result.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Destination Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
            <input
              type="text"
              placeholder="Destination"
              value={destSearch}
              onChange={(e) => {
                setDestSearch(e.target.value);
                // Debounce search
                if (searchTimeoutRef.current.dest) {
                  clearTimeout(searchTimeoutRef.current.dest);
                }
                searchTimeoutRef.current.dest = setTimeout(() => {
                  searchLocation(e.target.value, false);
                }, 500);
              }}
              onFocus={() => destResults.length > 0 && setShowDestResults(true)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-gray-200 focus:border-red-400 focus:outline-none text-sm"
            />
            {destSearch && (
              <button
                onClick={() => {
                  setDestSearch('');
                  setDestResults([]);
                  setShowDestResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isSearchingDest && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-red-500" />
            )}

            {/* Destination Results Dropdown */}
            {showDestResults && destResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto z-10">
                {destResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSearchResult(result, false)}
                    className="w-full text-left px-4 py-3 hover:bg-red-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Target className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{result.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Route Results & Instructions */}
      {result && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 max-w-sm z-[900] border-2 border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-brand-teal flex items-center">
              <Navigation className="w-4 h-4 inline mr-1.5" /> Route Found!
            </h3>
            <button
              onClick={handleReset}
              className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:shadow-lg transition-all font-bold"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="px-3 py-2 bg-brand-teal/10 rounded-lg font-medium flex items-center">
              <Navigation className="w-3 h-3 inline-block mr-1 text-brand-teal" /> {result.route.distance.toFixed(2)} km
            </span>
            <span className="px-3 py-2 bg-brand-purple/10 rounded-lg font-medium flex items-center">
              <Clock className="w-3 h-3 inline-block mr-1 text-brand-purple" /> {result.route.duration.toFixed(0)} min
            </span>
          </div>
        </div>
      )}

      {/* Tip when no route */}
      {!result && !loading && (
        <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg px-4 py-2 z-[900] border border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">Tip:</span> Use search above or click the map to set points
          </p>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-[999]">
          <div className="bg-white/95 rounded-2xl p-6 shadow-2xl">
            <LoadingSpinner
              message="Calculating your route..."
              size="lg"
              fullScreen={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}