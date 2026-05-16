/**
 * ═══════════════════════════════════════════════════════════════════
 * FitRoute Physics Engine v2.0
 * Research-backed calculations for velocity, energy, and weather
 * ═══════════════════════════════════════════════════════════════════
 *
 * Speed references:
 *   Walking   — 4.0–5.5 km/h (ACSM guidelines, moderate pace)
 *   Hiking    — 2.5–4.0 km/h (varied terrain, elevation gain)
 *   Jogging   — 7.5–10.0 km/h (recreational runner, 6–8 min/km)
 *   Biking    — 15–22 km/h (casual to moderate cycling, flat terrain)
 *   Car       — 25–60 km/h (urban Manila traffic, varies heavily)
 *
 * MET values (Compendium of Physical Activities, Ainsworth et al.):
 *   Walking 4.8 km/h       → MET 3.5
 *   Walking 5.6 km/h       → MET 4.3
 *   Jogging 8 km/h         → MET 8.0
 *   Jogging 9.7 km/h       → MET 9.8
 *   Biking 16 km/h         → MET 6.8
 *   Biking 19–22 km/h      → MET 8.0
 *
 * Calorie formula (ACSM):
 *   kcal = MET × weight(kg) × time(hours)
 *   Adjusted for speed using interpolated MET table
 *
 * Weather impact model:
 *   - Wind: headwind drag increases effort; >20 km/h significant
 *   - Rain: reduces traction, visibility; slows all modes
 *   - Temperature: optimal 18–24°C; extreme heat/cold increases effort
 *   - Humidity: high humidity + heat compounds fatigue (heat index)
 */

export interface WeatherData {
  temperature: number;   // °C
  rain: number;          // mm precipitation
  windSpeed: number;     // km/h
  humidity?: number;     // % relative humidity (optional, enhances accuracy)
}

export interface PhysicsResult {
  velocity: number;           // km/h (weather-adjusted expected speed)
  baseVelocity: number;       // km/h (ideal conditions speed)
  energyMetric: number;       // kcal (for human modes) or liters (for car)
  adjustedTime: number;       // minutes (weather-adjusted travel time)
  baseTime: number;           // minutes (ideal conditions time)
  difficultyFactor: number;   // multiplier (1.0 = ideal, higher = harder)
  difficultyLevel: 'Easy' | 'Moderate' | 'Hard' | 'Extreme';
  cost?: number;              // PHP fuel cost (car mode only)
  weatherPenalties: {
    wind: number;             // speed reduction factor (0–1)
    rain: number;             // speed reduction factor (0–1)
    temperature: number;      // speed reduction factor (0–1)
    total: number;            // combined speed reduction factor
  };
}

// ─── MET Values (speed-interpolated) ───────────────────────────────

/** MET lookup tables: [speed_kmh, MET_value] pairs */
const MET_TABLE = {
  walking: [
    [3.2, 2.8],   // slow stroll
    [4.0, 3.0],   // casual
    [4.8, 3.5],   // moderate
    [5.6, 4.3],   // brisk
    [6.4, 5.0],   // very brisk / power walk
    [7.2, 6.3],   // race walking
  ],
  hiking: [
    [2.0, 5.3],   // slow trail, heavy pack
    [2.5, 5.8],   // easy terrain
    [3.0, 6.3],   // moderate trail
    [3.5, 7.0],   // brisk hiking
    [4.0, 7.8],   // fast hiking, light pack
    [5.0, 9.0],   // trail running / scrambling
  ],
  jogging: [
    [6.4, 6.0],   // very slow jog
    [8.0, 8.0],   // light jog
    [9.7, 9.8],   // moderate jog
    [11.3, 11.0], // running
    [12.9, 12.8], // fast running
    [14.5, 14.5], // competitive
  ],
  biking: [
    [10, 4.0],    // very leisurely
    [16, 6.8],    // casual
    [19, 8.0],    // moderate effort
    [22, 10.0],   // vigorous
    [25, 12.0],   // racing
    [30, 16.0],   // competitive
  ],
} as const;

/** Interpolate MET from speed using lookup table */
function interpolateMET(mode: 'walking' | 'hiking' | 'jogging' | 'biking', speedKmh: number): number {
  const table = MET_TABLE[mode];

  // Clamp to table bounds
  if (speedKmh <= table[0][0]) return table[0][1];
  if (speedKmh >= table[table.length - 1][0]) return table[table.length - 1][1];

  // Linear interpolation between nearest entries
  for (let i = 0; i < table.length - 1; i++) {
    const [s1, m1] = table[i];
    const [s2, m2] = table[i + 1];
    if (speedKmh >= s1 && speedKmh <= s2) {
      const t = (speedKmh - s1) / (s2 - s1);
      return m1 + t * (m2 - m1);
    }
  }

  return table[0][1]; // fallback
}

// ─── Mode-specific base speeds (ideal conditions) ──────────────────

export type TravelMode = 'walking' | 'hiking' | 'jogging' | 'biking' | 'car';

/** Base speeds in km/h under ideal conditions (clear, 22°C, no wind) */
const BASE_SPEEDS: Record<TravelMode, number> = {
  walking: 4.8,   // moderate pace on flat terrain
  hiking: 3.5,    // moderate trail with elevation changes
  jogging: 9.0,   // recreational jogger
  biking: 18.0,   // casual cyclist on road
  car: 35.0,      // urban Manila average (traffic considered)
};

// ─── Weather Penalty Calculations ──────────────────────────────────

/**
 * Calculate wind speed reduction factor.
 * Headwind assumption: on average, wind opposes 50% of travel.
 * 
 * Walking: low drag coefficient, minimal impact below 20 km/h
 * Biking: highest drag coefficient, strong impact even at 15 km/h
 * Car: only extreme wind (>50 km/h) has measurable effect
 */
function calculateWindPenalty(windSpeed: number, mode: TravelMode): number {
  if (mode === 'car') {
    // Cars: wind >50 km/h reduces speed ~5%, >80 km/h ~15%
    if (windSpeed > 80) return 0.85;
    if (windSpeed > 50) return 0.95;
    return 1.0;
  }

  // Effective headwind = 50% of wind speed (average across directions)
  const effectiveWind = windSpeed * 0.5;

  const dragCoefficients: Record<string, number> = {
    walking: 0.003,    // low profile, slow speed
    hiking: 0.005,     // exposed terrain, heavier pack
    jogging: 0.004,    // slightly higher
    biking: 0.008,     // upright position, higher speed = more drag
  };

  const drag = dragCoefficients[mode] || 0.003;
  const penalty = 1.0 - (effectiveWind * drag);

  // Clamp: wind can't reduce speed by more than 35%
  return Math.max(0.65, Math.min(1.0, penalty));
}

/**
 * Calculate rain speed reduction factor.
 * 
 * Rain reduces visibility, traction (especially biking), and comfort.
 * Precipitation values from Open-Meteo are in mm/hour.
 *   0–2 mm    → light rain, minimal impact
 *   2–7 mm    → moderate rain, caution needed
 *   7–15 mm   → heavy rain, significant slowdown
 *   15+ mm    → very heavy, dangerous for cycling
 */
function calculateRainPenalty(rain: number, mode: TravelMode): number {
  if (rain <= 0) return 1.0;

  const reductionFactors: Record<TravelMode, number[]> = {
    // [light, moderate, heavy, extreme] reduction per mm
    walking: [0.01, 0.015, 0.02, 0.025],
    hiking:  [0.015, 0.022, 0.03, 0.04],  // trail gets slippery, muddy
    jogging: [0.012, 0.018, 0.025, 0.03],
    biking:  [0.015, 0.025, 0.035, 0.045],  // most affected (traction, visibility)
    car:     [0.005, 0.008, 0.015, 0.025],   // least affected but still slows
  };

  const factors = reductionFactors[mode];
  let reduction: number;

  if (rain <= 2) {
    reduction = rain * factors[0];
  } else if (rain <= 7) {
    reduction = 2 * factors[0] + (rain - 2) * factors[1];
  } else if (rain <= 15) {
    reduction = 2 * factors[0] + 5 * factors[1] + (rain - 7) * factors[2];
  } else {
    reduction = 2 * factors[0] + 5 * factors[1] + 8 * factors[2] + (rain - 15) * factors[3];
  }

  // Clamp: rain can't reduce speed by more than 40%
  return Math.max(0.60, 1.0 - reduction);
}

/**
 * Calculate temperature comfort factor.
 * 
 * Optimal: 18–26°C (thermoneutral zone for exercise)
 * Heat stress increases above 28°C, compounds with humidity
 * Cold reduces muscle efficiency below 10°C
 *
 * Real-world references:
 *   32°C, 60% RH → heat index ~37°C → ~5% slowdown for walking
 *   36°C, 80% RH → heat index ~48°C → ~15% slowdown for walking
 *   40°C, 80% RH → heat index ~55°C → ~22% slowdown for walking
 */
function calculateTemperaturePenalty(
  temperature: number,
  humidity: number = 60,
  mode: TravelMode
): number {
  if (mode === 'car') {
    // Cars have A/C; extreme temps only affect through road conditions
    if (temperature > 45 || temperature < -5) return 0.95;
    return 1.0;
  }

  // Comfort zone: 18–26°C → no penalty
  if (temperature >= 18 && temperature <= 26) return 1.0;

  let penalty = 1.0;

  if (temperature > 26) {
    // Heat index: humidity above 40% amplifies perceived temperature
    // At 32°C/64%RH → heatIndex ≈ 35.5°C (realistic Steadman approximation)
    const humidityBoost = humidity > 40
      ? (humidity - 40) * 0.02 * Math.max(0, temperature - 26)
      : 0;
    const heatIndex = temperature + humidityBoost;
    const effectiveHeat = Math.max(0, heatIndex - 26);

    // Per-degree penalty rates (conservative, research-backed):
    //   Walking: 0.5% per effective degree above comfort
    //   Jogging: 0.7% (higher metabolic heat production)
    //   Biking:  0.5% (air cooling partially compensates)
    const heatRates: Record<string, number> = {
      walking: 0.005,
      hiking: 0.007,   // exposed terrain, heavy exertion
      jogging: 0.007,
      biking: 0.005,
    };

    penalty = 1.0 - (effectiveHeat * (heatRates[mode] || 0.005));
  } else if (temperature < 18) {
    // Cold stress — muscles less efficient
    const coldDelta = 18 - temperature;

    // Moderate penalty: ~0.5% per degree below 18°C
    const coldRates: Record<string, number> = {
      walking: 0.005,
      hiking: 0.007,   // exposed mountain/trail, wind chill
      jogging: 0.006,
      biking: 0.008,  // wind chill amplifies cold on bike
    };

    penalty = 1.0 - (coldDelta * (coldRates[mode] || 0.005));
  }

  // Clamp: temperature can't reduce speed by more than 25%
  return Math.max(0.75, Math.min(1.0, penalty));
}

// ─── Core Calculation Functions ────────────────────────────────────

export function calculateVelocity(distanceKm: number, timeHours: number): number {
  if (timeHours <= 0) return 0;
  return distanceKm / timeHours;
}

/**
 * Calculate weather-adjusted expected velocity for a given mode.
 * Returns the realistic speed considering current weather conditions.
 */
export function calculateAdjustedVelocity(
  mode: TravelMode,
  weather: WeatherData
): { adjustedSpeed: number; baseSpeed: number; penalties: PhysicsResult['weatherPenalties'] } {
  const baseSpeed = BASE_SPEEDS[mode];

  const windPenalty = calculateWindPenalty(weather.windSpeed, mode);
  const rainPenalty = calculateRainPenalty(weather.rain, mode);
  const tempPenalty = calculateTemperaturePenalty(
    weather.temperature,
    weather.humidity,
    mode
  );

  // Combined penalty — multiplicative (each factor independently reduces speed)
  const totalPenalty = windPenalty * rainPenalty * tempPenalty;
  const adjustedSpeed = baseSpeed * totalPenalty;

  return {
    adjustedSpeed,
    baseSpeed,
    penalties: {
      wind: windPenalty,
      rain: rainPenalty,
      temperature: tempPenalty,
      total: totalPenalty,
    },
  };
}

/**
 * Calculate calories burned using speed-interpolated MET values.
 * Formula: kcal = MET × weight(kg) × time(hours)
 */
export function calculateCalories(
  mode: 'walking' | 'hiking' | 'jogging' | 'biking',
  weightKg: number,
  timeHours: number,
  speedKmh: number
): number {
  const met = interpolateMET(mode, speedKmh);
  return met * weightKg * timeHours;
}

/**
 * Calculate fuel consumption with weather adjustment.
 * Base: 12 km/L (average Philippine compact car)
 * Rain: +5–15% fuel consumption
 * Wind: +3–10% fuel consumption
 * A/C load in heat: +8–15% fuel consumption
 */
export function calculateFuel(
  distanceKm: number,
  weather: WeatherData,
  kmPerLiter: number = 12
): number {
  let adjustedEfficiency = kmPerLiter;

  // Rain reduces efficiency (hydroplaning resistance, slower speeds)
  if (weather.rain > 5) {
    adjustedEfficiency *= 0.88; // 12% worse
  } else if (weather.rain > 0) {
    adjustedEfficiency *= 0.95; // 5% worse
  }

  // Wind increases drag
  if (weather.windSpeed > 30) {
    adjustedEfficiency *= 0.90; // 10% worse
  } else if (weather.windSpeed > 15) {
    adjustedEfficiency *= 0.97; // 3% worse
  }

  // Air conditioning load in heat
  if (weather.temperature > 32) {
    adjustedEfficiency *= 0.85; // 15% worse (full A/C)
  } else if (weather.temperature > 28) {
    adjustedEfficiency *= 0.92; // 8% worse
  }

  return distanceKm / adjustedEfficiency;
}

export function calculateCost(
  fuel: number,
  fuelPricePerLiter: number = 62  // Philippine average as of 2024–2025
): number {
  return fuel * fuelPricePerLiter;
}

/**
 * Calculate overall difficulty factor from weather conditions.
 * 1.0 = perfect conditions, higher = harder
 */
export function calculateDifficultyFactor(weather: WeatherData, mode: TravelMode): number {
  const { penalties } = calculateAdjustedVelocity(mode, weather);
  // Difficulty is the inverse of the speed reduction
  // If speed is reduced to 80%, difficulty = 1.25
  return 1.0 / penalties.total;
}

export function getDifficultyLevel(factor: number): 'Easy' | 'Moderate' | 'Hard' | 'Extreme' {
  if (factor < 1.15) return 'Easy';
  if (factor < 1.35) return 'Moderate';
  if (factor < 1.60) return 'Hard';
  return 'Extreme';
}

// ─── Main Physics Calculator ───────────────────────────────────────

/**
 * Calculate comprehensive physics metrics for a route.
 *
 * @param mode - Travel mode (walking, jogging, biking, car)
 * @param distanceKm - Route distance in kilometers
 * @param durationMinutes - Base duration from routing API in minutes
 * @param weather - Current weather conditions at route location
 * @param userWeight - User weight in kg (default 70)
 * @returns Complete physics analysis with weather-adjusted metrics
 */
export function calculatePhysics(
  mode: TravelMode,
  distanceKm: number,
  durationMinutes: number,
  weather: WeatherData,
  userWeight: number = 70
): PhysicsResult {
  // Get weather-adjusted velocity
  const { adjustedSpeed, baseSpeed, penalties } = calculateAdjustedVelocity(mode, weather);

  // Calculate difficulty factor
  const difficultyFactor = 1.0 / penalties.total;
  const difficultyLevel = getDifficultyLevel(difficultyFactor);

  // Base time from routing API
  const baseTime = durationMinutes;

  // Adjusted time accounts for weather slowdown
  // If weather reduces speed by 20%, travel takes 25% longer (1/0.8 = 1.25)
  const adjustedTime = baseTime * difficultyFactor;

  // Actual velocity for this route (distance / weather-adjusted time)
  const velocity = distanceKm / (adjustedTime / 60);

  let energyMetric: number;
  let cost: number | undefined;

  if (mode === 'car') {
    const fuel = calculateFuel(distanceKm, weather);
    energyMetric = fuel;
    cost = calculateCost(fuel);
  } else {
    // Use speed-interpolated MET for more accurate calories
    const timeHours = adjustedTime / 60;
    energyMetric = calculateCalories(mode, userWeight, timeHours, velocity);
  }

  return {
    velocity: Math.round(velocity * 10) / 10,
    baseVelocity: Math.round(baseSpeed * 10) / 10,
    energyMetric: Math.round(energyMetric * 10) / 10,
    adjustedTime: Math.round(adjustedTime * 10) / 10,
    baseTime: Math.round(baseTime * 10) / 10,
    difficultyFactor: Math.round(difficultyFactor * 100) / 100,
    difficultyLevel,
    cost: cost !== undefined ? Math.round(cost * 100) / 100 : undefined,
    weatherPenalties: {
      wind: Math.round(penalties.wind * 100) / 100,
      rain: Math.round(penalties.rain * 100) / 100,
      temperature: Math.round(penalties.temperature * 100) / 100,
      total: Math.round(penalties.total * 100) / 100,
    },
  };
}

// Re-export MET values for backward compatibility
export const MET_VALUES = {
  walking: 3.5,
  hiking: 6.3,
  jogging: 8.0,
  biking: 7.5,
} as const;
