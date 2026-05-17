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
  Sparkles,
  Loader2,
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
  generateTrailPath,
  fetchOSMTrailPath,
  fetchNearestTrail,
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

  // Separate pin states — updated immediately when pins are placed
  const [pinOrigin, setPinOrigin] = useState<{ lat: number; lon: number } | null>(null);
  const [pinDest, setPinDest] = useState<{ lat: number; lon: number } | null>(null);

  // External override for sidebar destination text (used by hiking auto-snap)
  const [destSearchOverride, setDestSearchOverride] = useState<string | null>(null);
  // Trailhead marker — shown on map where driving stops and hiking starts
  const [hikingTrailhead, setHikingTrailhead] = useState<{ lat: number; lon: number; name: string } | null>(null);

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
  
  // Post activity analysis state
  const [postAnalysis, setPostAnalysis] = useState<string | null>(null);
  const [isPostAnalysisLoading, setIsPostAnalysisLoading] = useState(false);

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

  // Generate LLM analysis when activity completes
  useEffect(() => {
    if (activityData) {
      setIsPostAnalysisLoading(true);
      setPostAnalysis(null);
      import("./lib/groqAI").then((module) => {
        module.generatePostActivityAnalysis({
          mode: activityData.mode,
          distanceKm: activityData.distance,
          durationMin: activityData.duration,
          velocityKmh: activityData.velocity,
          calories: activityData.calories || 0,
          weather: result?.weather,
        }).then((analysis) => {
          setPostAnalysis(analysis);
          setIsPostAnalysisLoading(false);
        }).catch(() => {
          setPostAnalysis("Activity tracked successfully!");
          setIsPostAnalysisLoading(false);
        });
      });
    }
  }, [activityData, result]);

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
    setHikingTrailhead(null); // Clear trailhead on new route/mode change

    // Store coordinates for mode change recalculation
    setRouteCoords({
      origin: originCoords,
      destination: destCoords,
    });

    try {
      console.log("Route request:", mode);
      console.log("  From:", originCoords);
      console.log("  To:", destCoords);

      let routeData;
      let weatherData;
      let useDemo = false;

      // ─── HIKING MODE: Two-segment routing ─────────────────────
      // For hiking, we build a combined route:
      //   Segment 1: Car route (origin → mountain trailhead) via OSRM car profile
      //   Segment 2: Trail path (trailhead → peak) via curved approximation
      // This avoids OSRM foot profile cutting off in remote mountain areas.

      let hikingRouteData: AnalysisResult['hikingRoute'] | undefined;

      if (mode === 'hiking') {
        // Validate: DESTINATION must be near a mountain peak for hiking mode
        // Search within 2km radius — user must click near a mountain marker
        const mountain = findNearestMountain(destCoords.lat, destCoords.lon, 2);

        if (!mountain) {
          const originMountain = findNearestMountain(originCoords.lat, originCoords.lon, 2);
          if (originMountain) {
            setError(
              `🏔️ Your starting point is near ${originMountain.name}, but hiking mode requires ` +
              "the DESTINATION (end pin) to be the mountain. " +
              "Try swapping your origin and destination pins."
            );
          } else {
            setError(
              "🏔️ Hiking mode requires selecting a mountain as your destination. " +
              "Please click on a mountain marker (🏔️) on the map to set it as your destination, " +
              "or search for a mountain name (e.g. Mt. Pulag, Mt. Batulao, Mt. Ayaas)."
            );
          }
          setLoading(false);
          return;
        }

        // AUTO-SNAP: Move destination to exact mountain peak coordinates
        const originalDest = { ...destCoords };
        destCoords = { lat: mountain.peak.lat, lon: mountain.peak.lng };
        console.log(`📌 Auto-snapped destination to ${mountain.name} peak: ${destCoords.lat}, ${destCoords.lon}`);

        // Update pin on map and sidebar text
        setPinDest(destCoords);
        setRouteCoords({ origin: originCoords, destination: destCoords });
        setDestSearchOverride(`${mountain.name}, ${mountain.province}, Philippines`);

        // Notify user about the reroute
        const snapDist = calculateHaversineDistance(
          originalDest.lat, originalDest.lon,
          destCoords.lat, destCoords.lon
        );

        if (snapDist > 100) {
          showToast(
            `📌 Destination rerouted to ${mountain.name} peak (${(snapDist / 1000).toFixed(1)}km from your pin)`,
            'info'
          );
        } else {
          showToast(`🏔️ Routing to ${mountain.name} peak`, 'info');
        }

        console.log(`🏔️ Mountain detected: ${mountain.name} (${mountain.province})`);

        // We will overwrite hikingRouteData below with DYNAMIC calculations
        // based on where the car route actually stops.
        hikingRouteData = {
          mountainName: mountain.name,
          mountainProvince: mountain.province,
          elevationMeters: mountain.elevationMeters,
          difficulty: mountain.difficulty,
          description: mountain.description,
          carSegment: { distanceKm: 0, durationMinutes: 0, fuelCost: 0 },
          hikingSegment: { distanceKm: 0, durationMinutes: 0, calories: 0, elevationGain: mountain.elevationMeters },
        };
      }

      // ─── ROUTING ───
      if (mode === 'hiking' && hikingRouteData) {
        const mountain = findNearestMountain(destCoords.lat, destCoords.lon, 2)!;

        let combinedCoords: [number, number][] = [];
        let totalDistance = 0;
        let totalDuration = 0;

        // ══════════════════════════════════════════════════════════════
        // HIKING ROUTING: 3-tier approach
        //   1. Route car to peak → trace backwards to find trailhead
        //   2. Use OSRM foot routing from trailhead → peak (follows brown trails!)
        //   3. Fallback: Overpass trail extraction or procedural path
        // ══════════════════════════════════════════════════════════════

        // Step 1: Drive toward the mountain to find the road network near it
        console.log(`🚗 Step 1: Driving toward ${mountain.name}...`);
        const carSegment = await fetchOSRMRouteData(
          originCoords.lat, originCoords.lon,
          destCoords.lat, destCoords.lon,
          'car',
        );

        let trailStart: [number, number] = [originCoords.lon, originCoords.lat];
        let truncatedCarCoords: [number, number][] = [];
        let remainingCarCoords: [number, number][] = [];

        if (carSegment && carSegment.coordinates.length > 0) {
          // Trace backwards along the car route to find a realistic trailhead
          const elev = mountain.elevationMeters;
          let targetHikeKm = 2;
          if (elev > 400) targetHikeKm = 3;
          if (elev > 800) targetHikeKm = 5;
          if (elev > 1500) targetHikeKm = 8;
          if (elev > 2000) targetHikeKm = 12;

          let accumulatedBackwardsDist = 0;
          let splitIndex = carSegment.coordinates.length - 1;

          for (let i = carSegment.coordinates.length - 1; i > 0; i--) {
            const p1 = carSegment.coordinates[i];
            const p2 = carSegment.coordinates[i - 1];
            const segDist = calculateHaversineDistance(p1[1], p1[0], p2[1], p2[0]) / 1000;
            accumulatedBackwardsDist += segDist;
            const distToPeak = calculateHaversineDistance(p2[1], p2[0], destCoords.lat, destCoords.lon) / 1000;
            if (distToPeak >= targetHikeKm || accumulatedBackwardsDist >= targetHikeKm) {
              splitIndex = i - 1;
              break;
            }
          }

          truncatedCarCoords = carSegment.coordinates.slice(0, splitIndex + 1);
          combinedCoords.push(...truncatedCarCoords);
          const lengthRatio = truncatedCarCoords.length / carSegment.coordinates.length;
          totalDistance += carSegment.distance * lengthRatio;
          totalDuration += carSegment.duration * lengthRatio;
          trailStart = truncatedCarCoords[truncatedCarCoords.length - 1];

          // Save the remaining car route (split→peak) to use as a bridge segment.
          // This portion includes proper bridge crossings over rivers!
          remainingCarCoords = carSegment.coordinates.slice(splitIndex);
        }

        // Set trailhead marker
        setHikingTrailhead({
          lat: trailStart[1],
          lon: trailStart[0],
          name: `${mountain.name} Trailhead`,
        });

        // Step 2: Try hiking-specific routing from trailhead → peak
        // ORS foot-hiking profile includes tracks (red dashed lines), paths, and bridges
        console.log(`🥾 Step 2: Trying hiking route (ORS/Valhalla/OSRM)...`);
        const footRoute = await fetchOSRMRouteData(
          trailStart[1], trailStart[0],
          destCoords.lat, destCoords.lon,
          'hiking',
        );

        let hikeDistKm: number;
        let hikeHours: number;

        if (footRoute && footRoute.coordinates.length > 3) {
          // SUCCESS: OSRM foot routing found a path along actual trails
          console.log(`✅ OSRM foot route: ${(footRoute.distance / 1000).toFixed(1)}km, ${footRoute.coordinates.length} points`);

          // Bridge gap using remaining car route (includes bridge crossings!)
          if (combinedCoords.length > 0 && remainingCarCoords.length > 1) {
            const lastPt = combinedCoords[combinedCoords.length - 1];
            const firstFootPt = footRoute.coordinates[0];
            const gap = calculateHaversineDistance(lastPt[1], lastPt[0], firstFootPt[1], firstFootPt[0]);
            if (gap > 100) {
              // Use remaining car route to bridge (it includes proper bridge crossings)
              // Find the point in remainingCarCoords closest to the foot route start
              let bestIdx = 0;
              let bestDist = Infinity;
              for (let i = 0; i < remainingCarCoords.length; i++) {
                const d = calculateHaversineDistance(
                  remainingCarCoords[i][1], remainingCarCoords[i][0],
                  firstFootPt[1], firstFootPt[0]
                );
                if (d < bestDist) { bestDist = d; bestIdx = i; }
              }
              // Insert car route from trailhead up to the closest point to foot start
              if (bestIdx > 0) {
                combinedCoords.push(...remainingCarCoords.slice(1, bestIdx + 1));
              }
            } else if (gap > 20) {
              combinedCoords.push(firstFootPt);
            }
          }

          combinedCoords.push(...footRoute.coordinates);
          hikeDistKm = footRoute.distance / 1000;

          // Use Naismith's rule for hiking time
          const flatTime = hikeDistKm / 3.5;
          const ascentTime = mountain.elevationMeters / 600;
          hikeHours = Math.max(0.5, Math.round((flatTime + ascentTime * 0.4) * 10) / 10);

        } else {
          // FALLBACK: Try Overpass trail extraction
          console.log(`⚠️ OSRM foot failed. Trying Overpass trail extraction...`);
          const realTrail = await fetchNearestTrail(destCoords.lat, destCoords.lon);

          if (realTrail && realTrail.trailCoords.length > 3) {
            console.log(`✅ Overpass trail found: ${realTrail.trailDistanceKm.toFixed(1)}km`);

            // Bridge gap
            if (combinedCoords.length > 0 && realTrail.trailCoords.length > 0) {
              const lastPt = combinedCoords[combinedCoords.length - 1];
              const firstTrailPt = realTrail.trailCoords[0];
              const gap = calculateHaversineDistance(lastPt[1], lastPt[0], firstTrailPt[1], firstTrailPt[0]);
              if (gap > 20) combinedCoords.push(firstTrailPt);
            }

            combinedCoords.push(...realTrail.trailCoords);
            hikeDistKm = realTrail.trailDistanceKm;
          } else {
            // LAST RESORT: Procedural path
            console.log(`⚠️ Overpass also failed. Using procedural trail.`);
            const trailCoords = generateTrailPath(trailStart[1], trailStart[0], destCoords.lat, destCoords.lon);
            combinedCoords.push(...trailCoords.slice(1));

            const straightDist = calculateHaversineDistance(trailStart[1], trailStart[0], destCoords.lat, destCoords.lon) / 1000;
            let multiplier = 1.5;
            if (mountain.elevationMeters >= 2000) multiplier = 2.1;
            else if (mountain.elevationMeters >= 1500) multiplier = 1.9;
            else if (mountain.elevationMeters >= 1000) multiplier = 1.7;
            else if (mountain.elevationMeters >= 500) multiplier = 1.5;
            else multiplier = 1.3;
            hikeDistKm = Math.max(0.5, Math.round(straightDist * multiplier * 10) / 10);
          }

          const flatTime = hikeDistKm / 3.5;
          const ascentTime = mountain.elevationMeters / 600;
          hikeHours = Math.max(0.5, Math.round((flatTime + ascentTime * 0.4) * 10) / 10);
        }

        // Connect to peak pin
        const lastCoord = combinedCoords[combinedCoords.length - 1];
        const peakPt: [number, number] = [destCoords.lon, destCoords.lat];
        const distToPin = calculateHaversineDistance(lastCoord[1], lastCoord[0], destCoords.lat, destCoords.lon);
        if (distToPin > 50) combinedCoords.push(peakPt);

        // Calculate hiking metrics
        const hikeCalories = calculateCalories('hiking', userWeight, hikeHours, hikeDistKm / hikeHours);
        hikingRouteData.hikingSegment = {
          distanceKm: Math.round(hikeDistKm * 10) / 10,
          durationMinutes: Math.round(hikeHours * 60),
          calories: Math.round(hikeCalories),
          elevationGain: mountain.elevationMeters,
        };

        totalDistance += hikeDistKm * 1000;
        totalDuration += hikingRouteData.hikingSegment.durationMinutes * 60;

        // Car segment stats
        const carDistKm = carSegment ? carSegment.distance / 1000 : 0;
        const carDurMin = carSegment ? carSegment.duration / 60 : 0;
        hikingRouteData.carSegment = {
          distanceKm: Math.round(carDistKm * 10) / 10,
          durationMinutes: Math.round(carDurMin),
          fuelCost: Math.round(carDistKm * 7.5),
        };

        console.log(`🚗 Car: ${carDistKm.toFixed(1)}km, ${carDurMin.toFixed(0)}min`);
        console.log(`🥾 Hike: ${hikeDistKm.toFixed(1)}km, ${hikeHours.toFixed(1)}hr`);

        // Ensure route connects to origin pin
        const originPoint: [number, number] = [originCoords.lon, originCoords.lat];
        if (combinedCoords.length > 0) {
          const startGap = calculateHaversineDistance(
            originCoords.lat, originCoords.lon,
            combinedCoords[0][1], combinedCoords[0][0]
          );
          if (startGap > 50) combinedCoords.unshift(originPoint);
        }

        routeData = {
          routes: [{
            distance: totalDistance,
            duration: totalDuration,
            geometry: { coordinates: combinedCoords },
          }],
        };
      } else {
        // Non-hiking modes: single-segment routing
        const osrmResult = await fetchOSRMRouteData(
          originCoords.lat, originCoords.lon,
          destCoords.lat, destCoords.lon,
          mode,
        );

        if (osrmResult) {
          console.log(`✅ OSRM SUCCESS (${mode}): ${(osrmResult.distance / 1000).toFixed(1)}km`);

          const coords = osrmResult.coordinates;
          const originPoint: [number, number] = [originCoords.lon, originCoords.lat];
          const destPoint: [number, number] = [destCoords.lon, destCoords.lat];

          const routeStart = coords[0];
          const startGap = calculateHaversineDistance(
            originCoords.lat, originCoords.lon, routeStart[1], routeStart[0]
          );
          if (startGap > 50) coords.unshift(originPoint);

          const routeEnd = coords[coords.length - 1];
          const endGap = calculateHaversineDistance(
            destCoords.lat, destCoords.lon, routeEnd[1], routeEnd[0]
          );
          if (endGap > 50) coords.push(destPoint);

          routeData = {
            routes: [{
              distance: osrmResult.distance,
              duration: osrmResult.duration,
              geometry: { coordinates: coords },
            }],
          };
        } else {
          console.log("⚠️ All routing APIs unavailable, using curved approximation");
          useDemo = true;

          const coords = generateRealisticCurvedRoute(
            originCoords.lat, originCoords.lon,
            destCoords.lat, destCoords.lon,
          );

          let totalDistance = 0;
          for (let i = 1; i < coords.length; i++) {
            const [lng1, lat1] = coords[i - 1];
            const [lng2, lat2] = coords[i];
            totalDistance += calculateHaversineDistance(lat1, lng1, lat2, lng2);
          }

          const distanceKm = totalDistance / 1000;
          const speedMap: Record<string, number> = {
            walking: 4.8, hiking: 3.5, jogging: 9.0, biking: 18.0, car: 35.0,
          };
          const dur = (distanceKm / (speedMap[mode] || 4.8)) * 60;

          routeData = {
            routes: [{
              distance: totalDistance,
              duration: dur * 60,
              geometry: { coordinates: coords },
            }],
          };

          setError("⚠️ Real road routing APIs unavailable. Using curved approximation.");
        }
      }

      // Fetch weather
      try {
        const midLat = (originCoords.lat + destCoords.lat) / 2;
        const midLon = (originCoords.lon + destCoords.lon) / 2;
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${midLat}&longitude=${midLon}&current=temperature_2m,precipitation,wind_speed_10m,relative_humidity_2m,weather_code&timezone=auto`;
        const weatherRes = await fetch(weatherUrl, { mode: "cors" });
        weatherData = await weatherRes.json();
        if (!weatherData.current) throw new Error("Weather failed");
      } catch {
        weatherData = {
          current: {
            temperature_2m: 30, precipitation: 0,
            wind_speed_10m: 12, relative_humidity_2m: 72, weather_code: 1,
          },
        };
      }

      const route = routeData.routes[0];
      const osrmDistanceKm = route.distance / 1000;

      // Calculate duration using research-backed base speeds
      const BASE_SPEEDS: Record<string, number> = {
        walking: 4.8, hiking: 3.5, jogging: 9.0, biking: 18.0, car: 35.0,
      };

      // For hiking: use trail distance (not road distance) for metrics
      // The map shows the road route, but metrics show hiking trail data
      const distanceKm = hikingRouteData
        ? hikingRouteData.hikingSegment.distanceKm
        : osrmDistanceKm;
      const baseSpeedKmh = BASE_SPEEDS[mode] || 4.8;
      const duration = hikingRouteData
        ? hikingRouteData.hikingSegment.durationMinutes
        : (distanceKm / baseSpeedKmh) * 60;

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

      console.log(`📊 ${mode} mode: ${routeInfo.distance.toFixed(2)} km → ${duration.toFixed(1)} min`);

      const weatherCodeDescriptions: Record<number, string> = {
        0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
        45: "foggy", 48: "foggy", 51: "light drizzle", 53: "moderate drizzle",
        55: "dense drizzle", 61: "light rain", 63: "moderate rain", 65: "heavy rain",
        71: "light snow", 73: "moderate snow", 75: "heavy snow",
        80: "light rain showers", 81: "moderate rain showers", 82: "heavy rain showers",
        95: "thunderstorm", 96: "thunderstorm with hail",
      };

      const weather = {
        temperature: weatherData.current.temperature_2m,
        rain: weatherData.current.precipitation || 0,
        windSpeed: weatherData.current.wind_speed_10m,
        humidity: weatherData.current.relative_humidity_2m || 65,
        description:
          weatherCodeDescriptions[weatherData.current.weather_code] || "unknown",
        icon: "01d",
      };

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
            weatherInfo={result?.weather}
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

                {/* Smart Post-Activity Analysis */}
                <div className="bg-brand-purple/5 border border-brand-purple/20 rounded-xl md:rounded-2xl p-4 md:p-5 mb-4 md:mb-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-brand-purple" />
                    <span className="text-xs font-bold text-brand-purple uppercase tracking-widest">Smart Analysis</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    {isPostAnalysisLoading ? (
                      <span className="flex items-center gap-2 text-gray-500 animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing activity data...
                      </span>
                    ) : (
                      postAnalysis
                    )}
                  </p>
                </div>

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
            originCoords={pinOrigin ?? routeCoords?.origin}
            destCoords={pinDest ?? routeCoords?.destination}
            hikingTrailhead={hikingTrailhead}
            pinMode={pinMode}
            mode={mode}
            onPinPlaced={(type, coords, address) => {
              // INSTANT HIKING SNAP: If placing dest pin in hiking mode,
              // snap to nearest mountain peak immediately (before route request)
              let finalCoords = coords;
              let finalAddress = address;
              if (type === 'dest' && mode === 'hiking') {
                const nearMountain = findNearestMountain(coords.lat, coords.lon, 2);
                if (nearMountain) {
                  finalCoords = { lat: nearMountain.peak.lat, lon: nearMountain.peak.lng };
                  finalAddress = `${nearMountain.name}, ${nearMountain.province}, Philippines`;
                  setDestSearchOverride(finalAddress);
                  showToast(`📌 Destination snapped to ${nearMountain.name} peak`, 'info');
                }
              }

              // Update pin state IMMEDIATELY so marker appears right away
              if (type === 'origin') setPinOrigin(finalCoords);
              else setPinDest(finalCoords);

              pinPlacedCallbackRef.current?.(
                type,
                finalCoords,
                finalAddress,
              );
              setPinMode(null);
            }}
          />

          {/* Centered error overlay on map */}
          {error && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/30 backdrop-blur-sm">
              <div className="bg-white rounded-2xl px-6 py-5 border border-red-200 shadow-2xl max-w-md w-[90%] text-center">
                <div className="text-4xl mb-3">🏔️</div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Hiking Mode Notice</h3>
                <p className="text-sm text-gray-600 leading-relaxed mb-4">
                  {error.replace(/🏔️\s*/g, '')}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="px-6 py-2 bg-brand-coral text-white rounded-lg font-semibold hover:bg-red-500 transition-all shadow-md"
                >
                  Got it
                </button>
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
              setPinOrigin(null);
              setPinDest(null);
              setDestSearchOverride(null);
              setHikingTrailhead(null);
            }}
            pinMode={pinMode}
            onPinModeChange={setPinMode}
            onPinPlaced={(type, coords) => {
              if (type === 'origin') setPinOrigin(coords);
              else setPinDest(coords);
            }}
            onRegisterPinCallback={(cb) => {
              pinPlacedCallbackRef.current = cb;
            }}
            destSearchOverride={destSearchOverride}
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