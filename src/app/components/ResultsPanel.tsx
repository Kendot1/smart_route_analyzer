import { useState, useEffect } from 'react';
import { AnalysisResult } from '../lib/types';
import {
  MapPin,
  Clock,
  Zap,
  Gauge,
  Flame,
  Fuel,
  CloudRain,
  Cloud,
  Thermometer,
  Wind,
  AlertCircle,
  Info,
  CheckCircle,
  Droplets,
  Sparkles,
  Loader2,
  TrendingDown,
  Mountain,
  Car,
  ArrowRight,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import { motion } from 'motion/react';
import { generateAISummary, type RouteSummaryInput } from '../lib/groqAI';

/** Format minutes into hours and minutes (e.g., 360 → "6hr 0min") */
function formatDuration(minutes: number): string {
  const totalMin = Math.round(minutes);
  if (totalMin < 60) return `${totalMin}min`;
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hrs}hr ${mins}min` : `${hrs}hr`;
}

interface ResultsPanelProps {
  result: AnalysisResult | null;
  mode?: string;
}

export default function ResultsPanel({ result, mode = 'walking' }: ResultsPanelProps) {
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Generate AI summary when result changes
  useEffect(() => {
    if (!result) {
      setAiSummary(null);
      return;
    }

    const fetchSummary = async () => {
      setAiLoading(true);
      try {
        const input: RouteSummaryInput = {
          mode,
          distanceKm: result.route.distance,
          baseDurationMin: result.physics.baseTime ?? result.route.duration,
          adjustedDurationMin: result.physics.adjustedTime,
          velocityKmh: result.physics.velocity,
          baseVelocityKmh: result.physics.baseVelocity ?? result.physics.velocity,
          caloriesOrFuel: result.physics.energyMetric,
          isCarMode: mode === 'car',
          fuelCostPhp: result.physics.cost,
          weather: {
            temperature: result.weather.temperature,
            humidity: (result.weather as any).humidity ?? 65,
            rain: result.weather.rain,
            windSpeed: result.weather.windSpeed,
            description: result.weather.description,
          },
          difficulty: result.physics.difficultyLevel,
          difficultyFactor: result.physics.difficultyFactor,
          weatherPenalties: result.physics.weatherPenalties ?? {
            wind: 1,
            rain: 1,
            temperature: 1,
            total: 1,
          },
          recommendations: result.recommendations,
        };

        const summary = await generateAISummary(input);
        setAiSummary(summary);
      } catch {
        setAiSummary(null);
      } finally {
        setAiLoading(false);
      }
    };

    fetchSummary();
  }, [result, mode]);

  if (!result) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-100">
        <p className="text-gray-500 flex flex-col items-center justify-center text-center font-medium">
          <MapPin className="w-6 h-6 mb-2 text-gray-400" />
          Click two points on the map to analyze your route
        </p>
      </div>
    );
  }

  const { route, weather, physics, recommendations } = result;
  const penalties = physics.weatherPenalties;
  const totalPenaltyPct = penalties ? Math.round((1 - penalties.total) * 100) : 0;

  // Calculate display metrics for multi-modal routes
  let displayDistance = route.distance;
  let displayBaseTime = physics.baseTime ?? route.duration;
  let displayAdjustedTime = physics.adjustedTime;

  if (result.hikingRoute) {
    const { carSegment, hikingSegment } = result.hikingRoute;
    displayDistance = carSegment.distanceKm + hikingSegment.distanceKm;
    displayBaseTime = carSegment.durationMinutes + hikingSegment.durationMinutes;
    // Add car time to the weather-adjusted hike time
    displayAdjustedTime = carSegment.durationMinutes + physics.adjustedTime;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-3"
    >
      {/* Premium AI Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="relative rounded-2xl p-[2px] bg-gradient-to-br from-brand-purple via-brand-teal to-orange-400 shadow-lg shadow-brand-purple/10 overflow-hidden"
      >
        {/* Animated Background Glow */}
        <div className="absolute -inset-2 bg-gradient-to-r from-brand-purple via-brand-teal to-orange-400 opacity-20 blur-xl animate-pulse"></div>
        
        <div className="relative bg-white/95 backdrop-blur-xl rounded-[14px] p-3.5 flex flex-col h-full">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-brand-purple to-brand-teal shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-white" />
              <div className="absolute inset-0 rounded-lg border border-white/40"></div>
              <div className="absolute inset-0 rounded-lg bg-white/30 animate-ping opacity-20"></div>
            </div>
            <span className="text-xs font-black bg-gradient-to-r from-brand-purple to-brand-teal bg-clip-text text-transparent uppercase tracking-widest">
              FitRoute Intelligence
            </span>
          </div>

          {aiLoading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-5 h-5 text-brand-purple animate-spin" />
              <span className="text-xs font-medium text-gray-500 animate-pulse">Synthesizing data...</span>
            </div>
          ) : aiSummary ? (
            (() => {
              let parsedAnalysis = aiSummary;
              let parsedRecommendation = "";
              const recIndex = aiSummary.indexOf("RECOMMENDATION");
              if (recIndex !== -1) {
                parsedAnalysis = aiSummary.substring(0, recIndex).replace("AI ANALYSIS", "").trim();
                parsedRecommendation = aiSummary.substring(recIndex).replace("RECOMMENDATION", "").trim();
              } else {
                parsedAnalysis = aiSummary.replace("AI ANALYSIS", "").trim();
              }

              return (
                <div className="space-y-3">
                  {/* Clean & Distinct Analysis Section */}
                  <div className="relative bg-white rounded-xl p-3 shadow-sm border border-brand-purple/10 overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-brand-purple to-brand-teal"></div>
                    <div className="flex items-center gap-1.5 mb-2 pl-2">
                      <div className="p-1 bg-brand-purple/10 rounded text-brand-purple">
                        <TrendingDown className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-black text-brand-purple uppercase tracking-widest">
                        Smart Analysis
                      </span>
                    </div>
                    <p className="text-[11.5px] text-gray-700 leading-relaxed whitespace-pre-wrap relative z-10 font-medium pl-2">
                      {parsedAnalysis}
                    </p>
                  </div>
                  
                  {/* Glowing Recommendation Section */}
                  {parsedRecommendation && (
                    <div className="relative rounded-xl p-[1px] bg-gradient-to-r from-amber-400 to-orange-500 shadow-md">
                      <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 rounded-[11px] p-3 h-full">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="p-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded text-white shadow-sm">
                            <Info className="w-3 h-3" />
                          </div>
                          <span className="text-[10px] font-extrabold text-orange-800 uppercase tracking-widest">
                            Actionable Advice
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-orange-950/80 leading-relaxed whitespace-pre-wrap">
                          {parsedRecommendation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <p className="text-[11px] text-gray-500 italic text-center py-2">Summary unavailable</p>
          )}
        </div>
      </motion.div>

      {/* Hiking Mountain Info Card */}
      {result.hikingRoute && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200 shadow-lg"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-600 rounded-lg">
              <Mountain className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">{result.hikingRoute.mountainName}</h3>
              <p className="text-[10px] text-gray-500">
                {result.hikingRoute.mountainProvince} · {result.hikingRoute.elevationMeters}m · {result.hikingRoute.difficulty}
              </p>
            </div>
          </div>



          {/* Two-segment breakdown */}
          <div className="space-y-2">
            {/* Car Segment: Drive to Trailhead */}
            <div className="flex items-center gap-2 p-2 bg-white/70 rounded-lg border border-amber-100">
              <div className="p-1.5 bg-gray-700 rounded-lg">
                <Car className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Drive to Trailhead</p>
                <p className="text-sm font-bold text-gray-900">
                  {result.hikingRoute.carSegment.distanceKm} km
                  <span className="text-xs font-normal text-gray-500 ml-2">~{formatDuration(result.hikingRoute.carSegment.durationMinutes)}</span>
                </p>
              </div>
              {result.hikingRoute.carSegment.fuelCost > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-500">Fuel</p>
                  <p className="text-sm font-bold text-amber-700">₱{result.hikingRoute.carSegment.fuelCost}</p>
                </div>
              )}
            </div>

            {/* Arrow connector */}
            <div className="flex justify-center">
              <ArrowRight className="w-4 h-4 text-amber-400 rotate-90" />
            </div>

            {/* Hiking Segment: Hike to Destination */}
            <div className="flex flex-col gap-2 p-2 bg-white/70 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-600 rounded-lg">
                  <Mountain className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Hike to Peak</p>
                  <p className="text-sm font-bold text-gray-900">
                    {result.hikingRoute.hikingSegment.distanceKm} km
                  </p>
                </div>
                {totalPenaltyPct > 0 && (
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-brand-coral bg-brand-coral/10 px-1.5 py-0.5 rounded-full">
                      Weather Penalty: +{formatDuration(physics.adjustedTime - (physics.baseTime ?? route.duration))}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-1 bg-amber-50/50 p-2 rounded border border-amber-50">
                <div>
                  <p className="text-[10px] text-gray-500">Base Time</p>
                  <p className="text-sm font-bold text-gray-700">{formatDuration(result.hikingRoute.hikingSegment.durationMinutes)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Weather-Adjusted</p>
                  <p className="text-sm font-bold text-gray-900">{formatDuration(physics.adjustedTime)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Velocity</p>
                  <p className="text-sm font-bold text-gray-900">{physics.velocity.toFixed(1)} km/h</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">Calories</p>
                  <p className="text-sm font-bold text-orange-600">{result.hikingRoute.hikingSegment.calories} kcal</p>
                </div>
              </div>
            </div>
          </div>

          {/* Elevation badge */}
          <div className="mt-2 flex items-center justify-center gap-1 p-1.5 bg-amber-100/60 rounded-lg">
            <Mountain className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-xs font-bold text-amber-800">Elevation Gain: {result.hikingRoute.hikingSegment.elevationGain}m</span>
          </div>
        </motion.div>
      )}

      {!result.hikingRoute && (
        <div className="bg-white rounded-xl shadow-lg p-3 border border-gray-100">
        {/* Hero Distance Metric */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-3 p-3 bg-brand-teal/10 border border-brand-teal/30 rounded-xl text-center"
        >
          <MapPin className="w-6 h-6 text-brand-teal mx-auto mb-1" />
          <div className="text-[10px] font-medium text-gray-600 mb-0.5">Total Distance</div>
          <div className="text-3xl font-bold text-gray-900">{displayDistance.toFixed(2)}</div>
          <div className="text-xs text-gray-600">km</div>
        </motion.div>

        <div className="grid grid-cols-1 gap-2 mb-3">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex items-center gap-2 p-2 bg-brand-purple/10 border border-brand-purple/20 rounded-lg"
          >
            <div className="p-1.5 bg-brand-purple rounded-lg">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-medium text-gray-600">Base Time</p>
              <p className="text-lg font-bold text-gray-900">
                {formatDuration(displayBaseTime)}
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center gap-2 p-2 bg-brand-coral/10 border border-brand-coral/20 rounded-lg"
          >
            <div className="p-1.5 bg-brand-coral rounded-lg">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-medium text-gray-600">Weather-Adjusted Time</p>
              <p className="text-lg font-bold text-gray-900">
                {formatDuration(displayAdjustedTime)}
              </p>
            </div>
            {totalPenaltyPct > 0 && (
              <span className="text-[9px] font-bold text-brand-coral bg-brand-coral/10 px-1.5 py-0.5 rounded-full">
                +{formatDuration(physics.adjustedTime - (physics.baseTime ?? route.duration))}
              </span>
            )}
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex items-center gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
          >
            <div className="p-1.5 bg-emerald-500 rounded-lg">
              <Gauge className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-medium text-gray-600">Velocity</p>
              <p className="text-lg font-bold text-gray-900">
                {physics.velocity.toFixed(1)} <span className="text-xs text-gray-600">km/h</span>
              </p>
            </div>
            {physics.baseVelocity && physics.baseVelocity !== physics.velocity && (
              <span className="text-[9px] font-medium text-gray-400 line-through">
                {physics.baseVelocity.toFixed(1)}
              </span>
            )}
          </motion.div>
        </div>

        {/* Energy Metrics */}
        {physics.cost === undefined ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 rounded-lg">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-medium text-gray-600">Calories Burned</p>
                <p className="text-lg font-bold text-gray-900">
                  {physics.energyMetric.toFixed(0)} <span className="text-xs text-gray-600">kcal</span>
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3"
          >
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 rounded-lg">
                <Fuel className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-medium text-gray-600">Fuel Used</p>
                <p className="text-lg font-bold text-gray-900">
                  {physics.energyMetric.toFixed(2)} <span className="text-xs text-gray-600">L</span>
                  <span className="ml-2 text-sm text-amber-700 font-medium">
                    ₱{physics.cost.toFixed(0)}
                  </span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Difficulty Badge */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <div
            className={`px-3 py-2 rounded-lg border flex items-center justify-between ${physics.difficultyLevel === 'Easy'
                ? 'bg-green-50 border-green-300 text-green-800'
                : physics.difficultyLevel === 'Moderate'
                  ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                  : physics.difficultyLevel === 'Hard'
                    ? 'bg-orange-50 border-orange-300 text-orange-800'
                    : 'bg-red-50 border-red-300 text-red-800'
              }`}
          >
            <span className="font-bold text-sm">{physics.difficultyLevel}</span>
            <span className="text-[10px] font-medium opacity-80">
              {physics.difficultyFactor.toFixed(2)}x factor
            </span>
          </div>
        </motion.div>
      </div>
      )}

      {/* Accordion for Weather, Penalties & Recommendations */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.7 }}
        className="bg-white rounded-xl shadow-lg p-2 border border-gray-100"
      >
        <Accordion type="multiple" defaultValue={["weather", "penalties", "recommendations"]} className="space-y-2">
          {/* Weather Accordion */}
          <AccordionItem value="weather" className="border border-gray-200 rounded-lg px-2 bg-white">
            <AccordionTrigger className="text-xs font-bold text-gray-900 hover:no-underline py-2">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-brand-teal rounded-lg">
                  <CloudRain className="w-3 h-3 text-white" />
                </div>
                <span>Weather Conditions</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2 pt-2 pb-1">
                <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                  <Thermometer className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-[10px] font-medium text-gray-600">Temp</p>
                    <p className="text-sm font-bold text-gray-900">
                      {weather.temperature.toFixed(1)}°C
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <Droplets className="w-4 h-4 text-cyan-600" />
                  <div>
                    <p className="text-[10px] font-medium text-gray-600">Humidity</p>
                    <p className="text-sm font-bold text-gray-900">
                      {(weather as any).humidity ?? '—'}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <CloudRain className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-[10px] font-medium text-gray-600">Rain</p>
                    <p className="text-sm font-bold text-gray-900">
                      {weather.rain.toFixed(1)} mm/h
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <Wind className="w-4 h-4 text-gray-600" />
                  <div>
                    <p className="text-[10px] font-medium text-gray-600">Wind</p>
                    <p className="text-sm font-bold text-gray-900">
                      {weather.windSpeed.toFixed(1)} km/h
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-2 text-[10px] text-gray-600 capitalize font-medium bg-gray-50 px-2 py-1 rounded-lg flex items-center justify-center gap-1">
                <Cloud className="w-3 h-3 text-brand-teal" /> {weather.description}
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Weather Impact / Penalties Accordion */}
          {penalties && totalPenaltyPct > 0 && (
            <AccordionItem value="penalties" className="border border-gray-200 rounded-lg px-2 bg-white">
              <AccordionTrigger className="text-xs font-bold text-gray-900 hover:no-underline py-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-brand-coral rounded-lg">
                    <TrendingDown className="w-3 h-3 text-white" />
                  </div>
                  <span>Weather Impact</span>
                  <span className="ml-auto mr-2 px-1.5 py-0.5 bg-brand-coral/10 text-brand-coral text-[10px] font-bold rounded-full">
                    -{totalPenaltyPct}%
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pt-2 pb-1">
                  {/* Wind penalty */}
                  <div className="flex items-center gap-2">
                    <Wind className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-[10px] font-medium text-gray-600 flex-1">Wind Drag</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-400 rounded-full transition-all"
                        style={{ width: `${Math.round((1 - penalties.wind) * 100 * 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 w-10 text-right">
                      -{Math.round((1 - penalties.wind) * 100)}%
                    </span>
                  </div>

                  {/* Rain penalty */}
                  <div className="flex items-center gap-2">
                    <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[10px] font-medium text-gray-600 flex-1">Rain Friction</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.round((1 - penalties.rain) * 100 * 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 w-10 text-right">
                      -{Math.round((1 - penalties.rain) * 100)}%
                    </span>
                  </div>

                  {/* Temperature penalty */}
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px] font-medium text-gray-600 flex-1">Heat Stress</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-400 rounded-full transition-all"
                        style={{ width: `${Math.round((1 - penalties.temperature) * 100 * 5)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700 w-10 text-right">
                      -{Math.round((1 - penalties.temperature) * 100)}%
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Removed recommendations accordion as it's now in the AI card */}
        </Accordion>
      </motion.div>
    </motion.div>
  );
}
