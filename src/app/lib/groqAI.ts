/**
 * Groq AI Integration for route analysis summaries.
 * Uses Groq's fast inference API with Llama models.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Read API key from environment variable (.env file)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

export interface RouteSummaryInput {
  mode: string;
  distanceKm: number;
  baseDurationMin: number;
  adjustedDurationMin: number;
  velocityKmh: number;
  baseVelocityKmh: number;
  caloriesOrFuel: number;
  isCarMode: boolean;
  fuelCostPhp?: number;
  weather: {
    temperature: number;
    humidity: number;
    rain: number;
    windSpeed: number;
    description: string;
  };
  difficulty: string;
  difficultyFactor: number;
  weatherPenalties: {
    wind: number;
    rain: number;
    temperature: number;
    total: number;
  };
  recommendations: Array<{ type: string; message: string }>;
}

/**
 * Generate an AI-powered analysis summary using Groq API.
 * Falls back to a deterministic local summary if API is unavailable.
 */
export async function generateAISummary(input: RouteSummaryInput): Promise<string> {
  const prompt = buildPrompt(input);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are FitRoute AI, a concise fitness and route analysis assistant for the Philippines. Give a brief, actionable 2-3 sentence summary. Be specific with numbers. Use Filipino-friendly context (Philippine weather, Manila traffic, etc). Never use markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Groq API ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content?.trim();

    if (aiText) {
      return aiText;
    }

    throw new Error('Empty AI response');
  } catch (error) {
    console.log('ℹ️ Groq AI unavailable, using local summary');
    return generateLocalSummary(input);
  }
}

function buildPrompt(input: RouteSummaryInput): string {
  const penaltyPercent = Math.round((1 - input.weatherPenalties.total) * 100);
  const timeDiff = Math.round(input.adjustedDurationMin - input.baseDurationMin);

  return `You are FitRoute AI analyzing a ${input.mode} route in the Philippines. The user can ALREADY see: distance (${input.distanceKm.toFixed(2)} km), duration (${input.adjustedDurationMin.toFixed(0)} min), speed (${input.velocityKmh.toFixed(1)} km/h), ${input.isCarMode ? `fuel (${input.caloriesOrFuel.toFixed(2)}L / ₱${input.fuelCostPhp?.toFixed(0)})` : `calories (${input.caloriesOrFuel.toFixed(0)} kcal)`}, and weather data on screen.

DO NOT repeat those numbers. Instead, provide SMART INSIGHTS they can't see:

Context:
- Weather: ${input.weather.description}, ${input.weather.temperature}°C, humidity ${input.weather.humidity}%, rain ${input.weather.rain}mm/h, wind ${input.weather.windSpeed} km/h
- Weather is slowing them by ${penaltyPercent}% (${timeDiff} min added)
- Difficulty: ${input.difficulty}
${input.isCarMode ? '' : `- They weigh enough to burn ${input.caloriesOrFuel.toFixed(0)} kcal — is this equivalent to any common food?`}

Give 2-3 sentences of ACTIONABLE advice they can't figure out from the numbers alone. Examples of good insights:
- "Bring at least 500ml of water for every 30 min at this temperature and humidity"
- "The heat index feels like 38°C — consider starting before 7 AM or after 4 PM"
- "You'd save 15 minutes and burn 40% more calories by jogging instead"
- "This rain level makes painted road markings dangerously slippery for bikes"
- "At this pace, you'll need a rest stop around the halfway point"
- "That's equivalent to burning off 2 cups of rice — great workout!"

Be specific, practical, and Filipino-context-aware. No markdown.`;
}

/**
 * Local deterministic summary when Groq API is unavailable.
 * Provides genuinely useful, context-aware insights beyond the displayed data.
 */
function generateLocalSummary(input: RouteSummaryInput): string {
  const parts: string[] = [];
  const penaltyPercent = Math.round((1 - input.weatherPenalties.total) * 100);

  // ─── Smart insight #1: Health/safety advice ───────────────────
  if (!input.isCarMode) {
    // Heat index: matches the physics engine's realistic Steadman approximation
    const humidityBoost = input.weather.humidity > 40
      ? (input.weather.humidity - 40) * 0.02 * Math.max(0, input.weather.temperature - 26)
      : 0;
    const heatIndex = input.weather.temperature > 26
      ? input.weather.temperature + humidityBoost
      : input.weather.temperature;

    if (heatIndex > 40) {
      parts.push(
        `⚠️ The heat index feels like ${heatIndex.toFixed(0)}°C — high risk of heat stroke. Postpone to early morning (before 7 AM) or evening (after 5 PM) if possible.`
      );
    } else if (heatIndex > 35) {
      parts.push(
        `The heat index feels like ${heatIndex.toFixed(0)}°C. Bring at least ${Math.ceil(input.adjustedDurationMin / 20) * 250}ml of water and take shade breaks every 15 minutes.`
      );
    } else if (input.weather.temperature > 28 && input.weather.humidity > 70) {
      parts.push(
        `High humidity (${input.weather.humidity}%) makes ${input.weather.temperature}°C feel hotter. Bring ${Math.ceil(input.adjustedDurationMin / 30) * 500}ml of water and wear light, breathable clothing.`
      );
    } else if (input.weather.rain > 5 && input.mode === 'biking') {
      parts.push(
        `Rain at ${input.weather.rain.toFixed(1)} mm/h makes painted road markings and metal surfaces dangerously slippery. Slow down on turns and avoid manhole covers.`
      );
    } else if (penaltyPercent > 10) {
      parts.push(
        `Weather is adding ~${Math.round(input.adjustedDurationMin - input.baseDurationMin)} minutes to your trip. ${input.weather.windSpeed > 20 ? 'Headwind resistance is the main factor — consider a wind-shielded route.' : 'Consider adjusting your departure time for better conditions.'}`
      );
    } else {
      parts.push(
        `Conditions are great for ${input.mode === 'walking' ? 'a walk' : input.mode === 'jogging' ? 'a run' : 'cycling'}! The ${input.weather.temperature}°C with ${input.weather.humidity}% humidity is near the comfort zone for exercise.`
      );
    }
  } else {
    // Car mode insights
    if (input.weather.rain > 5) {
      parts.push(
        `Wet roads increase braking distance by 2-3x. Keep extra following distance and expect ~${Math.round((1 - input.weatherPenalties.rain) * 100)}% longer travel time from reduced visibility.`
      );
    } else if (input.weather.temperature > 32) {
      parts.push(
        `Running A/C in ${input.weather.temperature}°C heat increases fuel consumption by ~15%. Your estimated ₱${input.fuelCostPhp?.toFixed(0)} already accounts for this.`
      );
    } else {
      parts.push(
        `Good driving conditions. At ${input.velocityKmh.toFixed(0)} km/h average (accounting for Manila traffic), keep steady throttle for best fuel efficiency.`
      );
    }
  }

  // ─── Smart insight #2: Calorie equivalence or mode comparison ───
  if (!input.isCarMode && input.caloriesOrFuel > 50) {
    const riceCalories = 130; // per cup of cooked rice
    const cupEquivalent = input.caloriesOrFuel / riceCalories;

    if (cupEquivalent >= 1.5) {
      parts.push(
        `That's roughly ${cupEquivalent.toFixed(1)} cups of rice worth of energy — a solid workout! ${input.adjustedDurationMin > 45 ? 'Consider a light snack at the halfway point to maintain energy.' : ''}`
      );
    } else {
      parts.push(
        `A good ${Math.round(input.adjustedDurationMin)}-minute session. ${input.mode === 'walking' ? 'Jogging the same route would burn roughly 2x more calories in half the time.' : input.mode === 'jogging' ? 'Great calorie burn! A steady pace is more effective than sprinting.' : 'Cycling is great for cardio with less joint stress than running.'}`
      );
    }
  } else if (input.isCarMode) {
    const walkingTime = (input.distanceKm / 4.8) * 60;
    if (walkingTime < 30) {
      parts.push(
        `This is a short ${input.distanceKm.toFixed(1)} km trip — walking would take ~${Math.round(walkingTime)} minutes and save ₱${input.fuelCostPhp?.toFixed(0)} in fuel. Consider going on foot if weather permits!`
      );
    }
  }

  return parts.join(' ').trim();
}
