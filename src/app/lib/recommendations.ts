import type { WeatherData, TravelMode } from './physics';
import { calculateAdjustedVelocity } from './physics';

export interface Recommendation {
  type: 'warning' | 'info' | 'success';
  message: string;
}

/**
 * Generate context-aware recommendations based on weather, mode, and difficulty.
 * Uses the physics engine's weather penalty data for accurate advice.
 */
export function generateRecommendations(
  weather: WeatherData,
  mode: TravelMode,
  difficultyLevel: string
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Get weather impact data for this mode
  const { penalties, adjustedSpeed, baseSpeed } = calculateAdjustedVelocity(mode, weather);
  const speedReduction = Math.round((1 - penalties.total) * 100);

  // ─── Rain Recommendations ─────────────────────────────────────

  if (weather.rain > 15) {
    recommendations.push({
      type: 'warning',
      message: `Very heavy rain (${weather.rain.toFixed(1)} mm/h) — ${mode === 'biking' ? 'strongly avoid cycling, roads are slippery' : mode === 'car' ? 'reduce speed, risk of hydroplaning' : 'consider postponing or driving instead'}`,
    });
  } else if (weather.rain > 7) {
    recommendations.push({
      type: 'warning',
      message: `Heavy rain detected (${weather.rain.toFixed(1)} mm/h) — ${mode === 'biking' ? 'cycling not recommended, reduced traction' : 'bring rain gear, expect slower pace'}`,
    });
  } else if (weather.rain > 2) {
    recommendations.push({
      type: 'info',
      message: `Light rain expected (${weather.rain.toFixed(1)} mm/h) — bring rain gear, roads may be slippery`,
    });
  }

  // ─── Temperature Recommendations ──────────────────────────────

  if (mode !== 'car') {
    if (weather.temperature > 35) {
      recommendations.push({
        type: 'warning',
        message: `Extreme heat (${weather.temperature}°C) — high risk of heat exhaustion. Bring 500ml+ water, take shade breaks every 15 min`,
      });
    } else if (weather.temperature > 32) {
      recommendations.push({
        type: 'warning',
        message: `High temperature (${weather.temperature}°C) — stay hydrated, reduce intensity, avoid direct sun exposure`,
      });
    } else if (weather.temperature > 28) {
      recommendations.push({
        type: 'info',
        message: `Warm conditions (${weather.temperature}°C) — bring water and wear breathable clothing`,
      });
    } else if (weather.temperature < 10) {
      recommendations.push({
        type: 'info',
        message: `Cold weather (${weather.temperature}°C) — warm up properly, dress in layers`,
      });
    }

    // Humidity warning (heat + humidity is dangerous)
    if (weather.humidity && weather.humidity > 80 && weather.temperature > 28) {
      recommendations.push({
        type: 'warning',
        message: `High humidity (${weather.humidity}%) with heat — increased heat stress. Pace yourself and hydrate frequently`,
      });
    }
  }

  // ─── Wind Recommendations ─────────────────────────────────────

  if (weather.windSpeed > 40) {
    recommendations.push({
      type: 'warning',
      message: `Strong winds (${weather.windSpeed} km/h) — ${mode === 'biking' ? 'dangerous for cycling, strong crosswinds' : 'exercise extra caution, expect significant resistance'}`,
    });
  } else if (weather.windSpeed > 25) {
    recommendations.push({
      type: 'info',
      message: `Windy conditions (${weather.windSpeed} km/h) — expect ${mode === 'biking' ? '~' + Math.round((1 - penalties.wind) * 100) + '% speed reduction from drag' : 'some resistance against wind'}`,
    });
  }

  // ─── Overall Weather Impact ───────────────────────────────────

  if (speedReduction > 20) {
    recommendations.push({
      type: 'warning',
      message: `Weather reduces your expected speed by ~${speedReduction}% (${adjustedSpeed.toFixed(1)} km/h vs ${baseSpeed.toFixed(1)} km/h ideal)`,
    });
  } else if (speedReduction > 8) {
    recommendations.push({
      type: 'info',
      message: `Weather conditions may slow you by ~${speedReduction}% (estimated ${adjustedSpeed.toFixed(1)} km/h)`,
    });
  }

  // ─── Positive Conditions ──────────────────────────────────────

  if (difficultyLevel === 'Easy' && mode !== 'car') {
    recommendations.push({
      type: 'success',
      message: 'Great conditions for outdoor activity!',
    });
  }

  if (
    mode !== 'car' &&
    weather.rain < 1 &&
    weather.temperature >= 18 &&
    weather.temperature <= 26 &&
    weather.windSpeed < 15
  ) {
    recommendations.push({
      type: 'success',
      message: `Perfect weather for ${mode === 'walking' ? 'a walk' : mode === 'hiking' ? 'a hike' : mode === 'jogging' ? 'a run' : 'a ride'}! Enjoy your journey.`,
    });
  }

  // ─── Mode-specific Tips ───────────────────────────────────────

  if (mode === 'biking' && weather.rain > 0) {
    recommendations.push({
      type: 'info',
      message: 'Tip: Reduce speed on turns and painted road markings — they become very slippery when wet',
    });
  }

  if (mode === 'car' && weather.rain > 5) {
    recommendations.push({
      type: 'info',
      message: 'Tip: Increase following distance by 2–3x in rain. Fuel consumption increases ~12% on wet roads',
    });
  }

  if (mode === 'hiking' && weather.rain > 0) {
    recommendations.push({
      type: 'warning',
      message: 'Tip: Trail surfaces become muddy and slippery in rain. Wear proper hiking boots and use trekking poles for stability',
    });
  }

  if (mode === 'hiking' && weather.temperature > 30) {
    recommendations.push({
      type: 'info',
      message: 'Tip: Bring extra water (1L per hour recommended). Seek shade during rest breaks and watch for signs of heat exhaustion',
    });
  }

  return recommendations;
}
