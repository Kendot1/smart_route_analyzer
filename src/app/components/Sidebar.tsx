import { useState, useRef, useEffect } from 'react';
import {
  Search,
  X,
  MapPin,
  Target,
  Loader2,
  Footprints,
  PersonStanding,
  Bike,
  Car,
  Navigation,
  Clock,
  Pin,
  Mountain,
} from 'lucide-react';
import type { TravelMode } from '../lib/physics';
import type { AnalysisResult } from '../lib/types';
import ResultsPanel from './ResultsPanel';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface SidebarProps {
  mode: TravelMode;
  userWeight: number;
  onModeChange: (mode: TravelMode) => void;
  onWeightChange: (weight: number) => void;
  onRouteRequest: (origin: { lat: number; lon: number }, destination: { lat: number; lon: number }) => void;
  result: AnalysisResult | null;
  loading: boolean;
  onReset: () => void;
  pinMode: 'origin' | 'dest' | null;
  onPinModeChange: (mode: 'origin' | 'dest' | null) => void;
  onPinPlaced: (type: 'origin' | 'dest', coords: { lat: number; lon: number }, address: string) => void;
  onRegisterPinCallback: (cb: (type: 'origin' | 'dest', coords: { lat: number; lon: number }, address: string) => void) => void;
}

export default function Sidebar({
  mode,
  userWeight,
  onModeChange,
  onWeightChange,
  onRouteRequest,
  result,
  loading,
  onReset,
  pinMode,
  onPinModeChange,
  onPinPlaced,
  onRegisterPinCallback,
}: SidebarProps) {
  const [originSearch, setOriginSearch] = useState('');
  const [destSearch, setDestSearch] = useState('');
  const [originResults, setOriginResults] = useState<SearchResult[]>([]);
  const [destResults, setDestResults] = useState<SearchResult[]>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestResults, setShowDestResults] = useState(false);
  const [originCoords, setOriginCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

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
    const lon = parseFloat(result.lon);

    if (isOrigin) {
      setOriginSearch(result.display_name);
      setShowOriginResults(false);
      setOriginCoords({ lat, lon });

      if (destCoords) {
        onRouteRequest({ lat, lon }, destCoords);
      }
    } else {
      setDestSearch(result.display_name);
      setShowDestResults(false);
      setDestCoords({ lat, lon });

      if (originCoords) {
        onRouteRequest(originCoords, { lat, lon });
      }
    }
  };

  // Handle locate me
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
        setOriginSearch(`Current Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        setOriginCoords({ lat, lon: lng });

        if (destCoords) {
          onRouteRequest({ lat, lon: lng }, destCoords);
        }
      },
      (error) => {
        setIsLocating(false);
        console.error("Error getting location:", error);

        // Fallback
        const lat = 14.5826;
        const lng = 120.9787;
        setOriginSearch(`Mock Location - Rizal Park, Manila`);
        setOriginCoords({ lat, lon: lng });

        if (destCoords) {
          onRouteRequest({ lat, lon: lng }, destCoords);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle pin placed/dragged from map — also registered as callback for SimpleMap
  const handlePinPlaced = (type: 'origin' | 'dest', coords: { lat: number; lon: number }, address: string) => {
    onPinModeChange(null); // exit pin mode
    if (type === 'origin') {
      setOriginSearch(address);
      setOriginCoords(coords);
      if (destCoords) onRouteRequest(coords, destCoords);
    } else {
      setDestSearch(address);
      setDestCoords(coords);
      if (originCoords) onRouteRequest(originCoords, coords);
    }
    onPinPlaced(type, coords, address);
  };

  // Re-register callback whenever coords change (closure captures latest state)
  useEffect(() => {
    onRegisterPinCallback(handlePinPlaced);
  }, [originCoords, destCoords]);

  // Handle reset
  const handleClear = () => {
    setOriginSearch('');
    setDestSearch('');
    setOriginResults([]);
    setDestResults([]);
    setShowOriginResults(false);
    setShowDestResults(false);
    setOriginCoords(null);
    setDestCoords(null);
    onReset();
  };

  // Close dropdowns when clicking outside
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

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200" onClick={(e) => e.stopPropagation()}>
      {/* Search Inputs Section */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Search Location</h3>

        {/* Origin Search */}
        <div className="relative mb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
              <input
                type="text"
                placeholder="Starting point"
                value={originSearch}
                onChange={(e) => {
                  setOriginSearch(e.target.value);
                  if (searchTimeoutRef.current.origin) {
                    clearTimeout(searchTimeoutRef.current.origin);
                  }
                  searchTimeoutRef.current.origin = setTimeout(() => {
                    searchLocation(e.target.value, true);
                  }, 500);
                }}
                onFocus={() => originResults.length > 0 && setShowOriginResults(true)}
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-gray-200 focus:border-emerald-400 focus:outline-none text-sm"
              />
              {originSearch && (
                <button
                  onClick={() => {
                    setOriginSearch('');
                    setOriginResults([]);
                    setShowOriginResults(false);
                    setOriginCoords(null);
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
            {/* Pin on map */}
            <button
              onClick={() => onPinModeChange(pinMode === 'origin' ? null : 'origin')}
              className={`p-2.5 rounded-lg transition-all flex-shrink-0 border-2 ${
                pinMode === 'origin'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-400'
              }`}
              title="Pin start on map"
            >
              <Pin className="w-4 h-4" />
            </button>
            {/* Locate me */}
            <button
              onClick={handleLocateMe}
              disabled={isLocating}
              className="bg-emerald-500 text-white p-2.5 rounded-lg shadow-md hover:bg-emerald-600 transition-all flex-shrink-0"
              title="Use my current location"
            >
              {isLocating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Origin Results Dropdown */}
          {showOriginResults && originResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto z-10">
              {originResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => selectSearchResult(result, true)}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-gray-700">{result.display_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destination Search */}
        <div className="relative flex items-center gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
            <input
              type="text"
              placeholder="Destination"
              value={destSearch}
              onChange={(e) => {
                setDestSearch(e.target.value);
                if (searchTimeoutRef.current.dest) {
                  clearTimeout(searchTimeoutRef.current.dest);
                }
                searchTimeoutRef.current.dest = setTimeout(() => {
                  searchLocation(e.target.value, false);
                }, 500);
              }}
              onFocus={() => destResults.length > 0 && setShowDestResults(true)}
              className="w-full pl-10 pr-10 py-2.5 rounded-lg border-2 border-gray-200 focus:border-red-400 focus:outline-none text-sm"
            />
            {destSearch && (
              <button
                onClick={() => {
                  setDestSearch('');
                  setDestResults([]);
                  setShowDestResults(false);
                  setDestCoords(null);
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
              <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-xl border border-gray-200 max-h-48 overflow-y-auto z-10">
                {destResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSearchResult(result, false)}
                    className="w-full text-left px-3 py-2 hover:bg-red-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Target className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-xs text-gray-700">{result.display_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Pin on map */}
          <button
            onClick={() => onPinModeChange(pinMode === 'dest' ? null : 'dest')}
            className={`p-2.5 rounded-lg transition-all flex-shrink-0 border-2 ${
              pinMode === 'dest'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-white text-red-500 border-red-200 hover:border-red-400'
            }`}
            title="Pin destination on map"
          >
            <Pin className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Travel Mode Selector */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">Travel Mode</h3>
        <div className="grid grid-cols-5 gap-2">
          {(['walking', 'hiking', 'jogging', 'biking', 'car'] as TravelMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`p-3 rounded-lg transition-all flex flex-col items-center gap-1 ${
                mode === m
                  ? 'bg-brand-coral text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={m.charAt(0).toUpperCase() + m.slice(1)}
            >
              {m === 'walking' && <Footprints className="w-5 h-5" />}
              {m === 'hiking' && <Mountain className="w-5 h-5" />}
              {m === 'jogging' && <PersonStanding className="w-5 h-5" />}
              {m === 'biking' && <Bike className="w-5 h-5" />}
              {m === 'car' && <Car className="w-5 h-5" />}
              <span className="text-[10px] font-medium">{m}</span>
            </button>
          ))}
        </div>

        {/* Weight input - only show for non-car */}
        {mode !== 'car' && (
          <div className="mt-3 bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Weight:</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={userWeight}
                onChange={(e) => onWeightChange(Number(e.target.value))}
                min="30"
                max="200"
                className="w-20 bg-white text-gray-900 text-sm font-bold px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-coral"
              />
              <span className="text-sm text-gray-600">kg</span>
            </div>
          </div>
        )}
      </div>

      {/* Outputs Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Route Analysis</h3>
            {result && (
              <button
                onClick={handleClear}
                className="text-xs px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-bold"
              >
                Clear
              </button>
            )}
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-coral mb-3" />
              <p className="text-sm text-gray-600">Calculating route...</p>
            </div>
          )}

          {!loading && !result && (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                Enter origin and destination to calculate your route
              </p>
            </div>
          )}

          {!loading && result && (
              <ResultsPanel result={result} mode={mode} />
          )}
        </div>
      </div>
    </div>
  );
}
