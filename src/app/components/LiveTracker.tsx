import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import { Play, Pause, Square, MapPin, Settings, Activity, Home, Info, Loader2, Footprints, PersonStanding, Bike, Car, Mountain, AlertCircle, CloudRain, Thermometer } from 'lucide-react';
import { calculateHaversineDistance } from '../lib/routeUtils';
import { TravelMode } from '../lib/physics';
import { PHILIPPINE_MOUNTAINS } from '../lib/mountains';
import ModeSelector from './ModeSelector';
import Header from './Header';

interface Position {
  lat: number;
  lng: number;
  timestamp: number;
}

interface LiveTrackerProps {
  mode: TravelMode;
  userWeight: number;
  weatherInfo?: any;
  destinationCoords?: { lat: number; lon: number };
  onActivityComplete?: (data: any) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onModeChange: (mode: TravelMode) => void;
  onNavigateHome?: () => void;
  onNavigateAbout?: () => void;
  onSwitchToPlan?: () => void;
}

export default function LiveTracker({ mode, userWeight, weatherInfo, destinationCoords, onActivityComplete, onToast, onModeChange, onNavigateHome, onNavigateAbout, onSwitchToPlan }: LiveTrackerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [distance, setDistance] = useState(0); // in meters
  const [duration, setDuration] = useState(0); // in seconds
  const [velocity, setVelocity] = useState(0); // in km/h
  const [calories, setCalories] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);
  const lastPauseTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const mountainLayersRef = useRef<L.LayerGroup | null>(null);
  const weatherMarkerRef = useRef<L.Marker | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const simulationIntervalRef = useRef<number | null>(null);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const mockStartRef = useRef<{ lat: number; lng: number } | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [14.5995, 120.9842], // Manila for tracking
      zoom: 16,
      zoomControl: true,
      maxBounds: [
        [4.0, 116.0], // Southwest coordinates of Philippines (with buffer)
        [21.5, 127.0] // Northeast coordinates of Philippines (with buffer)
      ],
      maxBoundsViscosity: 1.0,
      minZoom: 6,
      maxZoom: 19,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Display destination weather marker
  useEffect(() => {
    // Map might not be fully initialized on first render, so we wait briefly
    const timer = setTimeout(() => {
      const map = mapInstanceRef.current;
      if (!map || !destinationCoords || !weatherInfo) return;

      if (weatherMarkerRef.current) {
        map.removeLayer(weatherMarkerRef.current);
      }

      // Use weatherCode for more accurate icons if available, otherwise fallback to rain/heat logic
      const isRaining = weatherInfo.rain > 0 || (weatherInfo.weatherCode >= 51 && weatherInfo.weatherCode <= 82);
      const isHot = weatherInfo.temperature > 32;
      const isThunder = weatherInfo.weatherCode >= 95;
      
      const iconHtml = isRaining || isThunder
        ? `<div style="background-color: ${isThunder ? '#7c3aed' : '#3b82f6'}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px ${isThunder ? 'rgba(124, 58, 237, 0.6)' : 'rgba(59, 130, 246, 0.6)'}; display: flex; align-items: center; justify-content: center; color: white;">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${isThunder ? '<path d="M19 16.9A5 5 0 1 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polyline points="13 11 9 17 15 17 11 23"/>' : '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>'}</svg>
           </div>`
        : isHot 
        ? `<div style="background-color: #ef4444; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(239, 68, 68, 0.6); display: flex; align-items: center; justify-content: center; color: white;">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>
           </div>`
        : `<div style="background-color: #f59e0b; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px rgba(245, 158, 11, 0.6); display: flex; align-items: center; justify-content: center; color: white;">
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
           </div>`;

      const icon = L.divIcon({
        className: 'weather-marker',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      weatherMarkerRef.current = L.marker([destinationCoords.lat, destinationCoords.lon], { icon, zIndexOffset: 1000 })
        .bindPopup(`<b>Destination Weather</b><br/>Temp: ${weatherInfo.temperature}°C<br/>Condition: <span style="text-transform: capitalize;">${weatherInfo.description || (isRaining ? 'Raining' : isHot ? 'Extreme Heat' : 'Clear Skies')}</span>`)
        .addTo(map);
    }, 500);

    return () => {
      clearTimeout(timer);
      if (weatherMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(weatherMarkerRef.current);
      }
    };
  }, [destinationCoords, weatherInfo]);

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

    // Create mountain marker icon
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
              🥾 Mountain reference — GPS is tracking your route
            </div>
          </div>
        </div>
      `, { maxWidth: 280 });

      // Tooltip on hover
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


  // Calculate calories
  const calculateCalories = (distanceKm: number, timeHours: number): number => {
    const MET_VALUES: Record<string, number> = {
      walking: 3.5,  // Moderate walking at 4-5 km/h
      jogging: 8.0,  // Light to moderate jogging at 8-10 km/h
      biking: 7.5,   // Moderate cycling at 15-18 km/h
      car: 0,
    };
    const met = MET_VALUES[mode];
    return met * userWeight * timeHours;
  };

  // Simulate movement (for testing when GPS unavailable)
  const startSimulation = () => {
    setSimulationMode(true);
    setIsTracking(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;

    // Use located position if available, otherwise default to Manila City Hall
    const startLat = mockStartRef.current?.lat ?? 14.5995;
    const startLng = mockStartRef.current?.lng ?? 120.9842;

    const initialPos: Position = {
      lat: startLat,
      lng: startLng,
      timestamp: Date.now(),
    };

    setCurrentPosition(initialPos);
    setPositions([initialPos]);

    // Center map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([startLat, startLng], 18);

      if (currentMarkerRef.current) {
        currentMarkerRef.current.setLatLng([startLat, startLng]);
      } else {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        currentMarkerRef.current = L.marker([startLat, startLng], { icon }).addTo(
          mapInstanceRef.current
        );
      }
    }

    console.log('▶️ Starting realistic movement - path builds as you "move"');

    // Realistic movement simulation with natural variations
    let currentLat = startLat;
    let currentLng = startLng;
    let heading = Math.random() * 360; // Random initial direction

    // Realistic speeds in degrees per 1.5s interval
    // At ~14.5° latitude: 1 degree ≈ 111 km
    // Formula: (km/h) / (111 * 2400) where 2400 = 3600s/h ÷ 1.5s/interval
    const speedMap = {
      walking: 0.000017,   // 4.5 km/h
      jogging: 0.000034,   // 9 km/h
      biking: 0.00006,     // 16 km/h
      car: 0.000131,       // 35 km/h
    };
    let speed = speedMap[mode];

    simulationIntervalRef.current = window.setInterval(() => {
      if (isPaused) return;

      // Simulate realistic human/vehicle movement with curves
      // Change direction slightly (natural wandering)
      heading += (Math.random() - 0.5) * 30; // Turn up to 15° left or right

      // Vary speed slightly (realistic acceleration/deceleration)
      const speedVariation = 0.8 + Math.random() * 0.4; // 80% to 120% of base speed
      const currentSpeed = speed * speedVariation;

      // Move in current heading
      const headingRad = (heading * Math.PI) / 180;
      currentLat += Math.cos(headingRad) * currentSpeed;
      currentLng += Math.sin(headingRad) * currentSpeed;

      const newPos: Position = {
        lat: currentLat,
        lng: currentLng,
        timestamp: Date.now(),
      };

      setCurrentPosition(newPos);
      setPositions((prev) => {
        const updated = [...prev, newPos];

        // Calculate distance using Haversine formula
        if (updated.length >= 2) {
          const lastPos = updated[updated.length - 2];
          const dist = calculateHaversineDistance(
            lastPos.lat,
            lastPos.lng,
            newPos.lat,
            newPos.lng
          );
          setDistance((prevDist) => prevDist + dist);
        }

        // Update map
        if (mapInstanceRef.current) {
          if (currentMarkerRef.current) {
            currentMarkerRef.current.setLatLng([newPos.lat, newPos.lng]);
          }

          const latLngs = updated.map((p) => L.latLng(p.lat, p.lng));

          if (routeLayerRef.current) {
            routeLayerRef.current.setLatLngs(latLngs);
          } else {
            routeLayerRef.current = L.polyline(latLngs, {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
            }).addTo(mapInstanceRef.current);
          }

          mapInstanceRef.current.setView([newPos.lat, newPos.lng], undefined, {
            animate: true,
          });
        }

        return updated;
      });
    }, 1500);

    // Update duration
    intervalRef.current = window.setInterval(() => {
      if (!isPaused && startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000;
        setDuration(elapsed);

        if (elapsed > 0 && distance > 0) {
          const distKm = distance / 1000;
          const timeHours = elapsed / 3600;
          const vel = distKm / timeHours;
          setVelocity(vel);

          const cal = calculateCalories(distKm, timeHours);
          setCalories(cal);
        }
      }
    }, 1000);
  };

  // Start tracking
  const startTracking = () => {
    if (!navigator.geolocation) {
      // No GPS available, use simulation
      onToast?.('GPS not available. Starting simulation mode.', 'info');
      startSimulation();
      return;
    }

    setSimulationMode(false);
    setIsTracking(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;

    // Show toast notification
    onToast?.(`${mode.charAt(0).toUpperCase() + mode.slice(1)} activity started!`, 'success');

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos: Position = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          timestamp: Date.now(),
        };
        setCurrentPosition(pos);
        setPositions([pos]);

        // Center map on user
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([pos.lat, pos.lng], 18);

          // Add current position marker
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

          currentMarkerRef.current = L.marker([pos.lat, pos.lng], { icon }).addTo(
            mapInstanceRef.current
          );
        }
      },
      (error) => {
        // Suppress console errors, handle gracefully
        if (error.code === 1) {
          // PERMISSION_DENIED
          onToast?.('Location access denied. Using simulation mode.', 'info');
        } else {
          onToast?.('GPS unavailable. Using simulation mode.', 'info');
        }

        // GPS failed, use simulation instead
        startSimulation();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Watch position (only if not simulation)
    if (!simulationMode) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          if (isPaused) return;

          const newPos: Position = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: Date.now(),
          };

          setCurrentPosition(newPos);
          setPositions((prev) => {
            const updated = [...prev, newPos];

            // Calculate distance between GPS points
            if (updated.length >= 2) {
              const lastPos = updated[updated.length - 2];
              const dist = calculateHaversineDistance(
                lastPos.lat,
                lastPos.lng,
                newPos.lat,
                newPos.lng
              );
              setDistance((prevDist) => prevDist + dist);
            }

            // Update map
            if (mapInstanceRef.current) {
              // Update current marker
              if (currentMarkerRef.current) {
                currentMarkerRef.current.setLatLng([newPos.lat, newPos.lng]);
              }

              // Update route polyline
              const latLngs = updated.map((p) => L.latLng(p.lat, p.lng));

              if (routeLayerRef.current) {
                routeLayerRef.current.setLatLngs(latLngs);
              } else {
                routeLayerRef.current = L.polyline(latLngs, {
                  color: '#3b82f6',
                  weight: 4,
                  opacity: 0.8,
                }).addTo(mapInstanceRef.current);
              }

              // Center on current position
              mapInstanceRef.current.setView([newPos.lat, newPos.lng], undefined, {
                animate: true,
              });
            }

            return updated;
          });
        },
        (error) => {
          // Silently handle watch position errors - simulation may already be active
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );
    }

    // Update duration every second
    intervalRef.current = window.setInterval(() => {
      if (!isPaused && startTimeRef.current) {
        const elapsed = (Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000;
        setDuration(elapsed);

        // Calculate velocity
        if (elapsed > 0 && distance > 0) {
          const distKm = distance / 1000;
          const timeHours = elapsed / 3600;
          const vel = distKm / timeHours;
          setVelocity(vel);

          // Calculate calories
          const cal = calculateCalories(distKm, timeHours);
          setCalories(cal);
        }
      }
    }, 1000);
  };

  // Pause tracking
  const pauseTracking = () => {
    setIsPaused(true);
    lastPauseTimeRef.current = Date.now();
    onToast?.('Activity paused', 'info');
  };

  // Resume tracking
  const resumeTracking = () => {
    if (lastPauseTimeRef.current) {
      pausedTimeRef.current += Date.now() - lastPauseTimeRef.current;
      lastPauseTimeRef.current = null;
    }
    setIsPaused(false);
    onToast?.('Activity resumed', 'success');
  };

  // Stop tracking
  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (simulationIntervalRef.current !== null) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsTracking(false);
    setIsPaused(false);
    setSimulationMode(false);

    // Save activity data
    if (onActivityComplete && positions.length > 1) {
      const distanceKm = distance / 1000;
      const durationMin = duration / 60;

      onActivityComplete({
        mode,
        distance: distanceKm, // km
        duration: durationMin, // minutes
        velocity,
        calories,
        positions,
      });

      // Show success toast
      onToast?.(
        `Activity completed! ${distanceKm.toFixed(2)}km in ${durationMin.toFixed(1)} minutes. ${mode !== 'car' ? `${calories.toFixed(0)} calories burned.` : ''}`,
        'success'
      );
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (simulationIntervalRef.current !== null) {
        clearInterval(simulationIntervalRef.current);
      }
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Format time
  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Locate current position and center map
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      onToast?.("Geolocation is not supported by your browser", 'error');
      // Use fallback location
      useFallbackLocation();
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude: lat, longitude: lng } = position.coords;
        const map = mapInstanceRef.current;
        if (!map) return;

        map.setView([lat, lng], 18);
        mockStartRef.current = { lat, lng };

        // Place or update the position marker
        if (currentMarkerRef.current) {
          currentMarkerRef.current.setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          currentMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }

        onToast?.(`Location found: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 'success');
      },
      (error) => {
        setIsLocating(false);

        // Check error type and provide appropriate message
        if (error.code === error.PERMISSION_DENIED) {
          onToast?.("Location access denied. Using demo location (Manila).", 'info');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          onToast?.("Location unavailable. Using demo location (Manila).", 'info');
        } else if (error.code === error.TIMEOUT) {
          onToast?.("Location request timed out. Using demo location (Manila).", 'info');
        } else {
          onToast?.("Geolocation disabled. Using demo location (Manila).", 'info');
        }

        useFallbackLocation();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Fallback location helper
  const useFallbackLocation = () => {
    const lat = 14.5826;
    const lng = 120.9787;
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([lat, lng], 18);

    // Store mock start so simulation begins here
    mockStartRef.current = { lat, lng };

    // Place or update the position marker
    if (currentMarkerRef.current) {
      currentMarkerRef.current.setLatLng([lat, lng]);
    } else {
      const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      currentMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }
  };

  return (
    <div className="relative w-full h-full bg-white">
      <div ref={mapRef} className="absolute inset-0" />

      {/* Weather Condition Banner */}
      {weatherInfo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] w-[90%] max-w-sm transition-all duration-300">
          <div className={`p-3 rounded-xl shadow-lg border-l-4 flex items-center gap-3 backdrop-blur-md ${
            weatherInfo.rain > 0 || (weatherInfo.weatherCode >= 51 && weatherInfo.weatherCode <= 82) || weatherInfo.weatherCode >= 95
              ? 'bg-blue-900/90 border-blue-400 text-white' 
              : weatherInfo.temperature > 32 
                ? 'bg-red-900/90 border-red-500 text-white'
                : 'bg-white/95 border-brand-teal text-gray-800'
          }`}>
            <div className={`p-2 rounded-full ${weatherInfo.rain > 0 || weatherInfo.weatherCode >= 51 || weatherInfo.temperature > 32 ? 'bg-white/20' : 'bg-brand-teal/10'}`}>
              {weatherInfo.weatherCode >= 95
                ? <AlertCircle className="w-5 h-5 text-white" />
                : weatherInfo.rain > 0 || (weatherInfo.weatherCode >= 51 && weatherInfo.weatherCode <= 82)
                ? <CloudRain className="w-5 h-5 text-white" /> 
                : weatherInfo.temperature > 32 
                  ? <Thermometer className="w-5 h-5 text-white" />
                  : <Activity className="w-5 h-5 text-brand-teal" />
              }
            </div>
            <div className="flex-1">
              <p className={`text-xs font-bold uppercase tracking-wide mb-0.5 ${weatherInfo.rain > 0 || weatherInfo.weatherCode >= 51 || weatherInfo.temperature > 32 ? 'opacity-80' : 'text-gray-500'}`}>
                {weatherInfo.rain > 0 || weatherInfo.weatherCode >= 51 || weatherInfo.temperature > 32 ? 'Live Hazard' : 'Current Conditions'}
              </p>
              <p className="text-sm font-medium capitalize">
                {weatherInfo.description 
                  ? `${weatherInfo.description}, ${weatherInfo.temperature}°C`
                  : weatherInfo.rain > 0 
                    ? `Rain detected (${weatherInfo.rain}mm/h). Road slippery.` 
                    : weatherInfo.temperature > 32 
                      ? `Extreme heat (${weatherInfo.temperature}°C). Hydrate.`
                      : `Clear skies, ${weatherInfo.temperature}°C. Perfect.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Locate Me Button - Top Right */}
      <button
        onClick={handleLocateMe}
        disabled={isLocating}
        className="absolute top-4 right-4 bg-white/95 backdrop-blur-xl text-gray-800 p-3 rounded-xl shadow-lg z-[1001] border-2 border-gray-100 hover:bg-gray-50 transition-all focus:outline-none flex items-center gap-2"
        title="Locate my current position"
      >
        {isLocating ? (
          <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
        ) : (
          <>
            <MapPin className="w-5 h-5 text-brand-teal" />
            <span className="text-sm font-medium hidden md:inline">Locate Me</span>
          </>
        )}
      </button>

      {/* Activity Mode Selector - beside zoom controls */}
      <div className="absolute z-[1001] flex flex-col gap-2" style={{ top: 10, left: 46 }}>
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-xl rounded-xl p-1 shadow-lg border border-gray-200">
          {(['walking', 'hiking', 'jogging', 'biking', 'car'] as TravelMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={isTracking}
              className={`p-2 rounded-lg transition-all ${
                mode === m
                  ? 'bg-brand-coral text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              } ${isTracking ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={m.charAt(0).toUpperCase() + m.slice(1)}
            >
              {m === 'walking' && <Footprints className="w-4 h-4" />}
              {m === 'hiking' && <Mountain className="w-4 h-4" />}
              {m === 'jogging' && <PersonStanding className="w-4 h-4" />}
              {m === 'biking' && <Bike className="w-4 h-4" />}
              {m === 'car' && <Car className="w-4 h-4" />}
            </button>
          ))}
        </div>

        {/* Weight info - only show for non-car */}
        {mode !== 'car' && (
          <div className="bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200 p-2 flex items-center gap-2">
            <span className="text-gray-600 text-xs font-medium">Weight:</span>
            <span className="text-gray-900 text-xs font-bold">{userWeight} kg</span>
          </div>
        )}
      </div>

      {/* Stats Overlay - Glass-morphism */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl z-[1000] border border-gray-200">
        {!isTracking ? (
          <div className="p-4">
            <button
              onClick={startTracking}
              className="w-full flex items-center justify-center gap-2 bg-brand-teal text-white px-6 py-3.5 rounded-2xl font-bold hover:shadow-lg transition-shadow"
            >
              <Play className="w-5 h-5" />
              Start Recording
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {/* Compact Stats Grid */}
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Dist</div>
                <div className="text-lg font-bold text-gray-900">{(distance / 1000).toFixed(2)}</div>
                <div className="text-[9px] text-gray-400">km</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Time</div>
                <div className="text-lg font-bold text-gray-900">{formatTime(duration)}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Pace</div>
                <div className="text-lg font-bold text-gray-900">{velocity.toFixed(1)}</div>
                <div className="text-[9px] text-gray-400">km/h</div>
              </div>
              {mode !== 'car' && (
                <div className="text-center">
                  <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Cal</div>
                  <div className="text-lg font-bold text-gray-900">{calories.toFixed(0)}</div>
                  <div className="text-[9px] text-gray-400">kcal</div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200"></div>

            {/* Compact Controls */}
            <div className="flex gap-2">
              {!isPaused ? (
                <>
                  <button
                    onClick={pauseTracking}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 text-white px-3 py-2.5 rounded-xl font-bold text-sm hover:bg-amber-600 transition-all active:scale-95"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                  <button
                    onClick={stopTracking}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 text-white px-3 py-2.5 rounded-xl font-bold text-sm hover:bg-red-600 transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4" />
                    Finish
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={resumeTracking}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-brand-teal text-white px-3 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-all active:scale-95"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                  <button
                    onClick={stopTracking}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 text-white px-3 py-2.5 rounded-xl font-bold text-sm hover:bg-red-600 transition-all active:scale-95"
                  >
                    <Square className="w-4 h-4" />
                    Finish
                  </button>
                </>
              )}
            </div>

            {isPaused && (
              <div className="bg-amber-50 px-3 py-1.5 rounded-lg text-center border border-amber-200">
                <p className="text-xs font-medium text-amber-800 flex items-center"><Pause className="w-3 h-3 mr-1" /> Paused</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Current position indicator */}
      {isTracking && !isPaused && (
        <div className="absolute bottom-4 left-4 bg-brand-coral text-white px-5 py-3 rounded-full shadow-xl z-[1000] flex items-center gap-2 border-2 border-white/50 backdrop-blur-sm">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span className="text-sm font-bold">
            {simulationMode ? <><MapPin className="w-4 h-4 inline mr-1" /> Recording Path...</> : <><MapPin className="w-4 h-4 inline mr-1" /> GPS Tracking...</>}
          </span>
        </div>
      )}
    </div>
  );
}
