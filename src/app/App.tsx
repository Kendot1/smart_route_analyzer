import { useState, useEffect, useRef } from "react";
import {
  Route,
  Home,
  MapPin,
  Info,
  X,
  Footprints,
  PersonStanding,
  Bike,
  Car,
  Zap,
  Navigation,
  Mountain,
} from "lucide-react";
import LandingPage from "./components/LandingPage";
import AboutPage from "./components/AboutPage";
import ModeSelector from "./components/ModeSelector";
import InteractiveMap from "./components/InteractiveMap";
import SimpleMap from "./components/SimpleMap";
import LiveTracker from "./components/LiveTracker";
import ResultsPanel from "./components/ResultsPanel";
import Toast from "./components/Toast";
import OnboardingTooltip from "./components/OnboardingTooltip";
import LoadingSpinner from "./components/LoadingSpinner";
import SuccessCelebration from "./components/SuccessCelebration";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import type { TravelMode } from "./lib/physics";
import { calculatePhysics, calculateCalories, calculateFuel, calculateCost } from "./lib/physics";
import { generateRecommendations } from "./lib/recommendations";
import {
  fetchOSRMRouteData,
  calculateHaversineDistance,
  generateRealisticCurvedRoute,
} from "./lib/routeUtils";
import { findNearestMountain, isNearTrailhead } from "./lib/mountains";
import type { AnalysisResult } from "./lib/types";

export default function App() {
  const [currentPage, setCurrentPage] = useState<
    "home" | "app" | "about"
  >("home");
  const [viewMode, setViewMode] = useState<"plan" | "track">(
    "plan",
  );
  const [mode, setMode] = useState<TravelMode>("walking");
  const [userWeight, setUserWeight] = useState(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(
    null,
  );
  const [activityData, setActivityData] = useState<any>(null);

  // Store route coordinates for recalculation when mode changes
  const [routeCoords, setRouteCoords] = useState<{
    origin: { lat: number; lon: number };
    destination: { lat: number; lon: number };
  } | null>(null);

  // Pin mode for plan map — Sidebar registers its handler here so SimpleMap can call it
  const [pinMode, setPinMode] = useState<
    "origin" | "dest" | null
  >(null);
  const pinPlacedCallbackRef = useRef<
    | ((
        type: "origin" | "dest",
        coords: { lat: number; lon: number },
        address: string,
      ) => void)
    | null
  >(null);

  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
  }>({ show: false, message: "", type: "info" });

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Success celebration state
  const [showCelebration, setShowCelebration] = useState(false);

  // Check if first visit for onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(
      "fitroute_onboarding_complete",
    );
    if (!hasSeenOnboarding && currentPage === "app") {
      setShowOnboarding(true);
    }
  }, [currentPage]);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setToast({ show: true, message, type });
  };

  const completeOnboarding = () => {
    localStorage.setItem(
      "fitroute_onboarding_complete",
      "true",
    );
    setShowOnboarding(false);
    setOnboardingStep(0);
  };

  // Recalculate route when mode changes (if route coordinates exist)
  useEffect(() => {
    if (routeCoords && viewMode === "plan") {
      console.log(
        `🔄 Mode changed to ${mode}, recalculating route...`,
      );
      handleRouteRequest(
        routeCoords.origin,
        routeCoords.destination,
      );
    }
  }, [mode]); // Only trigger when mode changes

  const handleRouteRequest = async (
    originCoords: { lat: number; lon: number },
    destCoords: { lat: number; lon: number },
  ) => {
    setLoading(true);
    setError(null);

    // Store coordinates for mode change recalculation
    setRouteCoords({
      origin: originCoords,
      destination: destCoords,
    });

    try {
      console.log("Route request:", mode);
      console.log("  From:", originCoords);
      console.log("  To:", destCoords);

      // Try OSRM for real road routing
      let routeData;
      let weatherData;
      let useDemo = false;

      const osrmResult = await fetchOSRMRouteData(
        originCoords.lat,
        originCoords.lon,
        destCoords.lat,
        destCoords.lon,
        mode,
      );

      if (osrmResult) {
        // OSRM SUCCESS - Use real road routing
        console.log(
          "OSRM SUCCESS - Using real OpenStreetMap road routing",
        );
        routeData = {
          routes: [
            {
              distance: osrmResult.distance,
              duration: osrmResult.duration,
              geometry: { coordinates: osrmResult.coordinates },
            },
          ],
        };
      } else {
        // All routing APIs unavailable - Use curved approximation
        console.log(
          "⚠️ All routing APIs blocked in preview environment",
        );
        console.log(
          "📝 Tried: OSRM, Valhalla, OpenRouteService - all failed",
        );
        console.log(
          "🔧 Using curved approximation as fallback",
        );
        useDemo = true;

        // Generate realistic curved route with waypoints
        const coords = generateRealisticCurvedRoute(
          originCoords.lat,
          originCoords.lon,
          destCoords.lat,
          destCoords.lon,
        );

        // Calculate actual path distance
        let totalDistance = 0;
        for (let i = 1; i < coords.length; i++) {
          const [lng1, lat1] = coords[i - 1];
          const [lng2, lat2] = coords[i];
          totalDistance += calculateHaversineDistance(
            lat1,
            lng1,
            lat2,
            lng2,
          );
        }

        const distanceKm = totalDistance / 1000;

        const speedMap: Record<string, number> = {
          walking: 4.8,
          hiking: 3.5,
          jogging: 9.0,
          biking: 18.0,
          car: 35.0,
        };
        const duration = (distanceKm / speedMap[mode]) * 60; // minutes

        routeData = {
          routes: [
            {
              distance: totalDistance, // meters
              duration: duration * 60, // seconds
              geometry: { coordinates: coords },
            },
          ],
        };

        setError(
          "⚠️ Real road routing APIs (OSRM/Valhalla/OpenRouteService) unavailable in preview. Using curved approximation. Deploy to production with proper CORS for accurate street-level routing.",
        );
      }

      // Try to fetch weather data for the route location
      try {
        const midLat = (originCoords.lat + destCoords.lat) / 2;
        const midLon = (originCoords.lon + destCoords.lon) / 2;

        // Fetch temperature, precipitation, wind, humidity, and weather code
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${midLat}&longitude=${midLon}&current=temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,weather_code&timezone=auto`;

        const weatherRes = await fetch(weatherUrl, {
          mode: "cors",
        });
        weatherData = await weatherRes.json();

        if (!weatherData.current) {
          throw new Error("Weather failed");
        }
      } catch (weatherError) {
        console.log(
          "⚠️ Weather API failed, using demo weather",
        );
        // Demo weather with realistic Philippine defaults
        weatherData = {
          current: {
            temperature_2m: 30,
            precipitation: 0,
            wind_speed_10m: 12,
            relative_humidity_2m: 72,
            weather_code: 1,
          },
        };
      }

      const route = routeData.routes[0];
      const distanceKm = route.distance / 1000;

      // Calculate duration using our research-backed base speeds per mode.
      // We DON'T rely on OSRM's duration because:
      //   1. OSRM's foot/bike profiles give inconsistent speeds
      //   2. OSRM often returns car-like durations for all profiles
      //   3. Our base speeds are calibrated for Philippine conditions
      const BASE_SPEEDS: Record<string, number> = {
        walking: 4.8,   // moderate pace, flat terrain
        hiking: 3.5,    // moderate trail with elevation
        jogging: 9.0,   // recreational jogger
        biking: 18.0,   // casual cyclist on road
        car: 35.0,      // urban Manila average (traffic)
      };
      const baseSpeedKmh = BASE_SPEEDS[mode] || 4.8;
      let duration = (distanceKm / baseSpeedKmh) * 60; // minutes

      const routeInfo = {
        distance: distanceKm,
        duration,
        polyline: JSON.stringify(route.geometry.coordinates),
        bounds: {
          northeast: {
            lat: Math.max(originCoords.lat, destCoords.lat),
            lng: Math.max(originCoords.lon, destCoords.lon),
          },
          southwest: {
            lat: Math.min(originCoords.lat, destCoords.lat),
            lng: Math.min(originCoords.lon, destCoords.lon),
          },
        },
      };

      // Debug logging
      console.log(`📊 ${mode} mode: ${distanceKm.toFixed(2)} km, base speed ${baseSpeedKmh} km/h → ${duration.toFixed(1)} min`);

      const weatherCodeDescriptions: Record<number, string> = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "foggy",
        48: "foggy",
        51: "light drizzle",
        53: "moderate drizzle",
        55: "dense drizzle",
        61: "light rain",
        63: "moderate rain",
        65: "heavy rain",
        71: "light snow",
        73: "moderate snow",
        75: "heavy snow",
        80: "light rain showers",
        81: "moderate rain showers",
        82: "heavy rain showers",
        95: "thunderstorm",
        96: "thunderstorm with hail",
      };

      const weather = {
        temperature: weatherData.current.temperature_2m,
        rain: weatherData.current.precipitation || 0,
        windSpeed: weatherData.current.wind_speed_10m,
        humidity: weatherData.current.relative_humidity_2m || 65,
        description:
          weatherCodeDescriptions[
            weatherData.current.weather_code
          ] || "unknown",
        icon: "01d",
      };

      // ─── HIKING MODE: Multi-segment route detection ─────────────
      let hikingRouteData: AnalysisResult['hikingRoute'] | undefined;

      if (mode === 'hiking') {
        // Check if destination is near a known mountain
        const mountain = findNearestMountain(destCoords.lat, destCoords.lon);

        if (!mountain) {
          // No mountain found — show error with guidance
          setError(
            "🏔️ Hiking mode requires a mountain destination. " +
            "Try searching for: Mt. Pulag, Mt. Pinatubo, Mt. Batulao, Mt. Maculot, " +
            "Mt. Pico de Loro, Mt. Apo, or other Philippine mountains. " +
            "Place your destination pin near a known mountain peak or trailhead."
          );
          setLoading(false);
          return;
        }

        console.log(`🏔️ Mountain detected: ${mountain.name} (${mountain.province})`);
        console.log(`   Peak: ${mountain.peak.lat}, ${mountain.peak.lng}`);
        console.log(`   Trailhead: ${mountain.trailhead.lat}, ${mountain.trailhead.lng}`);

        // Check if origin is already near the trailhead
        const alreadyAtTrailhead = isNearTrailhead(originCoords.lat, originCoords.lon, mountain);

        // Calculate Car segment: Origin → Trailhead
        const carDistanceKm = alreadyAtTrailhead
          ? 0
          : calculateHaversineDistance(
              originCoords.lat, originCoords.lon,
              mountain.trailhead.lat, mountain.trailhead.lng
            ) / 1000;
        const carDurationMinutes = alreadyAtTrailhead ? 0 : (carDistanceKm / 35) * 60;
        const carFuel = alreadyAtTrailhead ? 0 : calculateFuel(carDistanceKm, {
          temperature: weather.temperature,
          rain: weather.rain,
          windSpeed: weather.windSpeed,
          humidity: weather.humidity,
        });

        // Calculate Hiking segment: Trailhead → Peak (use mountain's known trail data)
        const hikeDistanceKm = mountain.trailDistanceKm;
        const hikeDurationMinutes = mountain.estimatedHikeHours * 60;
        const hikeCalories = calculateCalories(
          'hiking',
          userWeight,
          mountain.estimatedHikeHours,
          hikeDistanceKm / mountain.estimatedHikeHours
        );

        hikingRouteData = {
          mountainName: mountain.name,
          mountainProvince: mountain.province,
          elevationMeters: mountain.elevationMeters,
          difficulty: mountain.difficulty,
          description: mountain.description,
          carSegment: {
            distanceKm: Math.round(carDistanceKm * 10) / 10,
            durationMinutes: Math.round(carDurationMinutes),
            fuelCost: Math.round(calculateCost(carFuel) * 100) / 100,
          },
          hikingSegment: {
            distanceKm: hikeDistanceKm,
            durationMinutes: Math.round(hikeDurationMinutes),
            calories: Math.round(hikeCalories),
            elevationGain: mountain.elevationMeters,
          },
        };

        // Override the route distance/duration to show total trip
        routeInfo.distance = carDistanceKm + hikeDistanceKm;
        routeInfo.duration = carDurationMinutes + hikeDurationMinutes;

        console.log(`🚗 Car: ${carDistanceKm.toFixed(1)}km, ${carDurationMinutes.toFixed(0)}min`);
        console.log(`🥾 Hike: ${hikeDistanceKm}km, ${hikeDurationMinutes.toFixed(0)}min, ${hikeCalories.toFixed(0)}kcal`);
      }

      // Step 4: Calculate physics with full weather data (including humidity)
      const weatherInput = {
        temperature: weather.temperature,
        rain: weather.rain,
        windSpeed: weather.windSpeed,
        humidity: weather.humidity,
      };

      const physics = calculatePhysics(
        mode,
        routeInfo.distance,
        routeInfo.duration,
        weatherInput,
        userWeight,
      );

      // Step 5: Generate recommendations using user's selected mode
      const recommendations = generateRecommendations(
        weatherInput,
        mode,
        physics.difficultyLevel,
      );

      // Add hiking-specific recommendations
      if (hikingRouteData) {
        recommendations.unshift({
          type: 'info',
          message: `🏔️ ${hikingRouteData.mountainName} (${hikingRouteData.elevationMeters}m) — ${hikingRouteData.difficulty} difficulty. ${hikingRouteData.description}`,
        });
        if (hikingRouteData.carSegment.distanceKm > 0) {
          recommendations.unshift({
            type: 'info',
            message: `🚗 Drive ${hikingRouteData.carSegment.distanceKm}km to ${hikingRouteData.mountainName} trailhead (~${hikingRouteData.carSegment.durationMinutes}min, ₱${hikingRouteData.carSegment.fuelCost} fuel), then hike ${hikingRouteData.hikingSegment.distanceKm}km to the peak.`,
          });
        }
      }

      setResult({
        route: routeInfo,
        weather,
        physics,
        recommendations,
        hikingRoute: hikingRouteData,
      });

      // Show success celebration
      setShowCelebration(true);

      // Show success toast
      showToast(
        hikingRouteData
          ? `🏔️ ${hikingRouteData.mountainName} route: ${routeInfo.distance.toFixed(1)}km total (${hikingRouteData.carSegment.distanceKm}km drive + ${hikingRouteData.hikingSegment.distanceKm}km hike)`
          : `Route calculated! ${routeInfo.distance.toFixed(2)}km in ${routeInfo.duration.toFixed(0)} minutes`,
        "success",
      );
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "An error occurred during analysis";
      console.error("Analysis error:", err);

      // If we get here, even demo mode failed - show helpful message
      setError(
        "Unable to calculate route. Please try different points on the map or refresh the page.",
      );

      // Show error toast
      showToast(
        "Unable to calculate route. Please try again.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  // Global Footer Component
  const GlobalFooter = () => (
    <footer className="bg-gray-900 text-gray-400">
      <div className="container mx-auto px-4 py-6 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-6 md:mb-8">
          {/* About Section */}
          <div>
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="p-1.5 md:p-2 bg-brand-coral rounded-lg md:rounded-xl shadow-lg">
                <Route className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white">
                FitRoute
              </h3>
            </div>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              Plan smarter routes for walking, hiking, jogging, biking,
              and driving with weather-aware analytics and
              AI-powered insights for every trip.
            </p>
          </div>

          {/* Nav Links */}
          <div className="mx-[12px] my-[0px] mx-[14px] my-[0px] mx-[15px] my-[0px] mx-[16px] my-[0px] mx-[17px] my-[0px] mx-[18px] my-[0px] mx-[18px] my-[0px] mx-[19px] my-[0px] mx-[19px] my-[0px] mx-[20px] my-[0px] mx-[20px] my-[0px] mx-[21px] my-[0px] mx-[22px] my-[0px] mx-[22px] my-[0px] mx-[21px] my-[0px] mx-[21px] my-[0px] mx-[19px] my-[0px] mx-[18px] my-[0px] mx-[17px] my-[0px] mx-[18px] my-[0px] mx-[18px] my-[0px] mx-[19px] my-[0px] mx-[21px] my-[0px] mx-[23px] my-[0px] mx-[30px] my-[0px] mx-[34px] my-[0px] mx-[36px] my-[0px] mx-[39px] my-[0px] mx-[40px] my-[0px] mx-[42px] my-[0px] mx-[43px] my-[0px] mx-[45px] my-[0px] mx-[46px] my-[0px] mx-[47px] my-[0px] mx-[50px] my-[0px] mx-[53px] my-[0px] mx-[55px] my-[0px] mx-[56px] my-[0px] mx-[57px] my-[0px] mx-[59px] my-[0px] mx-[61px] my-[0px] mx-[64px] my-[0px] mx-[66px] my-[0px] mx-[67px] my-[0px] mx-[69px] my-[0px] mx-[71px] my-[0px] mx-[71px] my-[0px] mx-[72px] my-[0px] mx-[72px] my-[0px] mx-[72px] my-[0px]">
            <h3 className="font-bold text-white mb-3 md:mb-4 text-base md:text-lg">
              Navigate
            </h3>
            <ul className="text-sm md:text-base text-gray-400 space-y-2 md:space-y-3">
              <li>
                <button
                  onClick={() => setCurrentPage("home")}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Home className="w-4 h-4 text-brand-coral" />
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setCurrentPage("app"); setViewMode("track"); }}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <MapPin className="w-4 h-4 text-brand-purple" />
                  Track
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setCurrentPage("app"); setViewMode("plan"); }}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Navigation className="w-4 h-4 text-brand-teal" />
                  Plan
                </button>
              </li>
              <li>
                <button
                  onClick={() => setCurrentPage("about")}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Info className="w-4 h-4 text-amber-400" />
                  About
                </button>
              </li>
            </ul>
          </div>

          {/* Features */}
          <div>
            <h3 className="font-bold text-white mb-3 md:mb-4 text-base md:text-lg">
              Features
            </h3>
            <ul className="text-sm md:text-base text-gray-400 space-y-2 md:space-y-3">
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-coral" />
                Real-time GPS Tracking
              </li>
              <li className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-brand-purple" />
                Smart Route Planning
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand-teal" />
                Weather Analytics
              </li>
              <li className="flex items-center gap-2">
                <Footprints className="w-4 h-4 text-amber-400" />
                Multi-Mode Support
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 md:pt-6 border-t border-gray-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © 2026 FitRoute
            </p>
          </div>
        </div>
      </div>
    </footer>
  );

  // Render appropriate page
  if (currentPage === "home") {
    return (
      <>
        <Header
          currentPage={currentPage}
          onNavigateHome={() => setCurrentPage("home")}
          onNavigateTrack={() => {
            setCurrentPage("app");
            setViewMode("track");
          }}
          onNavigateAbout={() => setCurrentPage("about")}
        />
        <LandingPage
          onEnterApp={(mode) => {
            setViewMode(mode);
            setCurrentPage("app");
          }}
        />
        <GlobalFooter />
      </>
    );
  }

  if (currentPage === "about") {
    return (
      <>
        <Header
          currentPage={currentPage}
          onNavigateHome={() => setCurrentPage("home")}
          onNavigateTrack={() => {
            setCurrentPage("app");
            setViewMode("track");
          }}
          onNavigateAbout={() => setCurrentPage("about")}
        />
        <AboutPage />
        <GlobalFooter />
      </>
    );
  }

  // GPS Tracking Mode - Full screen tracking view
  if (viewMode === "track") {
    return (
      <div className="fixed inset-0 bg-white flex flex-col">
        {/* Header */}
        <Header
          currentPage={currentPage}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onNavigateHome={() => setCurrentPage("home")}
          onNavigateTrack={() => {
            setCurrentPage("app");
            setViewMode("track");
          }}
          onNavigateAbout={() => setCurrentPage("about")}
          fixed={false}
        />

        {/* LiveTracker Component */}
        <div className="flex-1">
          <LiveTracker
            mode={mode}
            userWeight={userWeight}
            onActivityComplete={(data) => {
              setActivityData(data);
              console.log("Activity completed:", data);
            }}
            onToast={showToast}
            onModeChange={setMode}
            onNavigateHome={() => setCurrentPage("home")}
            onNavigateAbout={() => setCurrentPage("about")}
          />
        </div>

        {/* Toast Notifications */}
        <Toast
          show={toast.show}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />

        {/* Success Celebration */}
        <SuccessCelebration
          show={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />

        {/* Activity Summary Modal */}
        {activityData && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-5 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-coral flex items-center gap-2">
                    <Zap className="w-6 h-6 sm:w-8 sm:h-8" />{" "}
                    Activity Complete!
                  </h2>
                  <button
                    onClick={() => setActivityData(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-600" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
                  <div className="p-4 md:p-5 bg-brand-teal/10 rounded-xl md:rounded-2xl border-2 border-brand-teal/20">
                    <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                      Distance
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-900">
                      {activityData.distance.toFixed(2)}{" "}
                      <span className="text-base md:text-lg text-gray-600">
                        km
                      </span>
                    </p>
                  </div>

                  <div className="p-4 md:p-5 bg-brand-purple/10 rounded-xl md:rounded-2xl border-2 border-brand-purple/20">
                    <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                      Duration
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-900">
                      {activityData.duration.toFixed(1)}{" "}
                      <span className="text-base md:text-lg text-gray-600">
                        min
                      </span>
                    </p>
                  </div>

                  <div className="p-4 md:p-5 bg-brand-coral/10 rounded-xl md:rounded-2xl border-2 border-brand-coral/20">
                    <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                      Avg Speed
                    </p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-900">
                      {activityData.velocity.toFixed(1)}{" "}
                      <span className="text-base md:text-lg text-gray-600">
                        km/h
                      </span>
                    </p>
                  </div>
                </div>

                {activityData.mode !== "car" && (
                  <div className="bg-amber-500/10 rounded-xl md:rounded-2xl p-4 md:p-5 mb-4 md:mb-6 border-2 border-amber-500/20">
                    <p className="text-xs md:text-sm font-medium text-gray-600 mb-1">
                      Calories Burned
                    </p>
                    <p className="text-3xl md:text-4xl font-bold text-gray-900">
                      {activityData.calories.toFixed(0)}{" "}
                      <span className="text-lg md:text-xl text-gray-600">
                        kcal
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setActivityData(null)}
                    className="flex-1 px-6 py-3 bg-brand-coral text-white rounded-xl font-bold hover:shadow-lg transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Plan mode - Sidebar layout
  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      {/* Header / Nav Bar */}
      <Header
        currentPage={currentPage}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNavigateHome={() => setCurrentPage("home")}
        onNavigateTrack={() => {
          setCurrentPage("app");
          setViewMode("track");
        }}
        onNavigateAbout={() => setCurrentPage("about")}
        fixed={false}
      />

      {/* Main Content: Map + Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map Section (Left) */}
        <div className="flex-1 relative">
          <SimpleMap
            result={result}
            originCoords={routeCoords?.origin}
            destCoords={routeCoords?.destination}
            pinMode={pinMode}
            mode={mode}
            onPinPlaced={(type, coords, address) => {
              pinPlacedCallbackRef.current?.(
                type,
                coords,
                address,
              );
              setPinMode(null);
            }}
          />

          {/* Error display on map */}
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] max-w-md w-[90%]">
              <div className="bg-blue-500/95 backdrop-blur-md rounded-xl px-4 py-3 border border-blue-300/50 shadow-lg">
                <p className="text-sm text-white font-medium">
                  {error}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Section (Right) */}
        <div className="w-80 lg:w-96 flex-shrink-0">
          <Sidebar
            mode={mode}
            userWeight={userWeight}
            onModeChange={setMode}
            onWeightChange={setUserWeight}
            onRouteRequest={handleRouteRequest}
            result={result}
            loading={loading}
            onReset={() => {
              setResult(null);
              setError(null);
              setRouteCoords(null);
            }}
            pinMode={pinMode}
            onPinModeChange={setPinMode}
            onPinPlaced={() => {}}
            onRegisterPinCallback={(cb) => {
              pinPlacedCallbackRef.current = cb;
            }}
          />
        </div>
      </div>

      {/* Toast Notifications */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, show: false })}
      />

      {/* Success Celebration */}
      <SuccessCelebration
        show={showCelebration}
        onComplete={() => setShowCelebration(false)}
      />

      {/* Onboarding Tooltips */}
      {showOnboarding && (
        <div className="relative">
          {onboardingStep === 0 && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999]">
              <OnboardingTooltip
                show={true}
                onClose={completeOnboarding}
                title="Welcome to FitRoute!"
                description="Let's take a quick tour of how to use the app. You can track your fitness activities or plan new routes."
                position="bottom"
                step={1}
                totalSteps={4}
                onNext={() => setOnboardingStep(1)}
              />
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999]">
              <OnboardingTooltip
                show={true}
                onClose={completeOnboarding}
                title="Switch Between Modes"
                description={`You're currently in ${viewMode === "track" ? "GPS Tracking" : "Route Planning"} mode. Use these buttons to switch between tracking your activity in real-time or planning a route.`}
                position="bottom"
                step={2}
                totalSteps={4}
                onNext={() => setOnboardingStep(2)}
              />
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="fixed top-64 left-1/2 -translate-x-1/2 z-[9999]">
              <OnboardingTooltip
                show={true}
                onClose={completeOnboarding}
                title="Choose Your Mode"
                description="Select your travel mode: Walking, Hiking, Jogging, Biking, or Car. Each mode calculates different metrics and travel times."
                position="bottom"
                step={3}
                totalSteps={4}
                onNext={() => setOnboardingStep(3)}
              />
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="fixed top-96 left-1/2 -translate-x-1/2 z-[9999]">
              <OnboardingTooltip
                show={true}
                onClose={completeOnboarding}
                title="Start Tracking or Planning"
                description={
                  viewMode === "track"
                    ? "Click inside the map to start tracking your GPS activity. Your distance, speed, and calories will be calculated in real-time!"
                    : "Click on the map to set your start and end points. We'll calculate the route, weather conditions, and give you smart recommendations!"
                }
                position="top"
                step={4}
                totalSteps={4}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}