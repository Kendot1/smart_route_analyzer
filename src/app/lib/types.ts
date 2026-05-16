export interface RouteData {
  distance: number;
  duration: number;
  polyline: string;
  bounds: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
}

export interface WeatherResponse {
  temperature: number;
  rain: number;
  windSpeed: number;
  humidity?: number;
  description: string;
  icon: string;
}

export interface AnalysisResult {
  route: RouteData;
  weather: WeatherResponse;
  physics: {
    velocity: number;
    baseVelocity?: number;
    energyMetric: number;
    adjustedTime: number;
    baseTime?: number;
    difficultyFactor: number;
    difficultyLevel: string;
    cost?: number;
    weatherPenalties?: {
      wind: number;
      rain: number;
      temperature: number;
      total: number;
    };
  };
  recommendations: Array<{
    type: string;
    message: string;
  }>;
  hikingRoute?: {
    mountainName: string;
    mountainProvince: string;
    elevationMeters: number;
    difficulty: string;
    description: string;
    carSegment: {
      distanceKm: number;
      durationMinutes: number;
      fuelCost: number;
    };
    hikingSegment: {
      distanceKm: number;
      durationMinutes: number;
      calories: number;
      elevationGain: number;
    };
  };
}
