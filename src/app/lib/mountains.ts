/**
 * ═══════════════════════════════════════════════════════════════════
 * Philippine Mountain Database — PH 100 Mountain Checklist
 * ═══════════════════════════════════════════════════════════════════
 *
 * 100 mountains across Luzon (1–60), Visayas (61–80), Mindanao (81–100)
 * Data loaded from JSON: src/app/data/ph100_mountains.json
 */

import mountainsJson from '../data/ph100_mountains.json';

export interface MountainData {
  name: string;
  province: string;
  peak: { lat: number; lng: number };
  trailhead: { lat: number; lng: number };
  elevationMeters: number;
  trailDistanceKm: number;
  estimatedHikeHours: number;
  difficulty: 'Easy' | 'Moderate' | 'Difficult' | 'Expert';
  description: string;
}

interface RawMountain {
  name: string;
  province: string;
  peak: [number, number];
  trailhead: [number, number];
  elevation: number;
  trailKm: number;
  hikeHrs: number;
  difficulty: string;
  desc: string;
}

/** Transform compact JSON format to typed MountainData */
export const PHILIPPINE_MOUNTAINS: MountainData[] = (mountainsJson as RawMountain[]).map((m) => ({
  name: m.name,
  province: m.province,
  peak: { lat: m.peak[0], lng: m.peak[1] },
  trailhead: { lat: m.trailhead[0], lng: m.trailhead[1] },
  elevationMeters: m.elevation,
  trailDistanceKm: m.trailKm,
  estimatedHikeHours: m.hikeHrs,
  difficulty: m.difficulty as MountainData['difficulty'],
  description: m.desc,
}));

/** Haversine distance between two coordinates in km */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the nearest mountain to a given coordinate.
 * Returns null if no mountain is within the radius threshold.
 */
export function findNearestMountain(
  lat: number,
  lng: number,
  radiusKm: number = 15
): MountainData | null {
  let nearest: MountainData | null = null;
  let minDistance = Infinity;

  for (const mountain of PHILIPPINE_MOUNTAINS) {
    const peakDist = haversineDistance(lat, lng, mountain.peak.lat, mountain.peak.lng);
    const trailDist = haversineDistance(lat, lng, mountain.trailhead.lat, mountain.trailhead.lng);
    const closestDist = Math.min(peakDist, trailDist);

    if (closestDist < minDistance && closestDist <= radiusKm) {
      minDistance = closestDist;
      nearest = mountain;
    }
  }

  return nearest;
}

/** Check if coordinates are within 2km of a mountain trailhead */
export function isNearTrailhead(
  lat: number,
  lng: number,
  mountain: MountainData
): boolean {
  return haversineDistance(lat, lng, mountain.trailhead.lat, mountain.trailhead.lng) <= 2.0;
}

/** Get all mountain names for search/display */
export function getMountainNames(): string[] {
  return PHILIPPINE_MOUNTAINS.map(m => `${m.name}, ${m.province}`);
}

/** Search mountains by name or province (partial match) */
export function searchMountains(query: string): MountainData[] {
  const q = query.toLowerCase();
  return PHILIPPINE_MOUNTAINS.filter(m =>
    m.name.toLowerCase().includes(q) ||
    m.province.toLowerCase().includes(q)
  );
}
