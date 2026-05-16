import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, Square, MapPin, Settings, Activity, Home, Info, Loader2, Footprints, PersonStanding, Bike, Car, Mountain } from 'lucide-react';
import { calculateHaversineDistance } from '../lib/routeUtils';
import { TravelMode } from '../lib/physics';
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
  onActivityComplete?: (data: any) => void;
  onToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onModeChange: (mode: TravelMode) => void;
  onNavigateHome?: () => void;
  onNavigateAbout?: () => void;
  onSwitchToPlan?: () => void;
}

export default function LiveTracker({ mode, userWeight, onActivityComplete, onToast, onModeChange, onNavigateHome, onNavigateAbout, onSwitchToPlan }: LiveTrackerProps) {
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
