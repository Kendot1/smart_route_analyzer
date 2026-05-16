// Utility functions for route generation and street-based tracking

interface RoutePoint {
  lat: number;
  lng: number;
  timestamp: number;
}

/**
 * Fetch a real street route from OSRM
 */
export async function fetchOSRMRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: 'walking' | 'jogging' | 'biking' | 'car',
  roundTrip: boolean = false
): Promise<RoutePoint[] | null> {
  try {
    const profile = mode === 'car' ? 'car' : mode === 'biking' ? 'bike' : 'foot';

    // Create route URL (round trip or one-way)
    const waypoints = roundTrip
      ? `${startLng},${startLat};${endLng},${endLat};${startLng},${startLat}`
      : `${startLng},${startLat};${endLng},${endLat}`;

    const url = `https://router.project-osrm.org/route/v1/${profile}/${waypoints}?overview=full&geometries=geojson&steps=true`;

    console.log('🌐 Requesting OSRM route:', roundTrip ? 'round-trip' : 'one-way');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      const distance = data.routes[0].distance;

      console.log('✅ OSRM route received:');
      console.log('  - Distance:', (distance / 1000).toFixed(2), 'km');
      console.log('  - Points:', coordinates.length);

      const route = coordinates.map((coord: number[]) => ({
        lng: coord[0],
        lat: coord[1],
        timestamp: Date.now(),
      }));

      return route;
    } else {
      console.log('ℹ️ OSRM error code:', data.code);
      return null;
    }
  } catch (error) {
    console.log('ℹ️ OSRM not available (normal in preview environment)');
    return null;
  }
}

/**
 * Fetch real road routing from multiple sources
 */
export async function fetchOSRMRouteData(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: 'walking' | 'hiking' | 'jogging' | 'biking' | 'car'
): Promise<{ distance: number; duration: number; coordinates: [number, number][] } | null> {
  const profile = mode === 'car' ? 'car' : mode === 'biking' ? 'bike' : 'foot';

  // Try multiple routing services in order
  const routingSources = [
    {
      name: 'OSRM',
      fetch: () => tryOSRMDirect(startLat, startLng, endLat, endLng, profile)
    },
    {
      name: 'Valhalla (Mapzen)',
      fetch: () => tryValhalla(startLat, startLng, endLat, endLng, profile)
    },
    {
      name: 'OpenRouteService',
      fetch: () => tryOpenRouteService(startLat, startLng, endLat, endLng, profile)
    }
  ];

  for (const source of routingSources) {
    console.log(`🌐 Trying ${source.name}...`);
    const result = await source.fetch();
    if (result) {
      console.log(`✅ ${source.name} SUCCESS:`, (result.distance / 1000).toFixed(2), 'km,', result.coordinates.length, 'points');
      return result;
    }
  }

  console.log('ℹ️ All routing services unavailable');
  return null;
}

async function tryOSRMDirect(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  profile: string
): Promise<{ distance: number; duration: number; coordinates: [number, number][] } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes?.[0]) {
      return {
        distance: data.routes[0].distance,
        duration: data.routes[0].duration,
        coordinates: data.routes[0].geometry.coordinates,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function tryValhalla(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  profile: string
): Promise<{ distance: number; duration: number; coordinates: [number, number][] } | null> {
  try {
    const costing = profile === 'car' ? 'auto' : profile === 'bike' ? 'bicycle' : 'pedestrian';
    const url = `https://valhalla1.openstreetmap.de/route?json={"locations":[{"lat":${startLat},"lon":${startLng}},{"lat":${endLat},"lon":${endLng}}],"costing":"${costing}"}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.trip?.legs?.[0]) {
      const leg = data.trip.legs[0];
      // Decode polyline
      const coords = decodePolyline(leg.shape);
      return {
        distance: leg.summary.length * 1000, // km to m
        duration: leg.summary.time,
        coordinates: coords,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function tryOpenRouteService(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  profile: string
): Promise<{ distance: number; duration: number; coordinates: [number, number][] } | null> {
  try {
    const orsProfile = profile === 'car' ? 'driving-car' : profile === 'bike' ? 'cycling-regular' : 'foot-walking';
    const url = `https://api.openrouteservice.org/v2/directions/${orsProfile}?start=${startLng},${startLat}&end=${endLng},${endLat}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (data.features?.[0]?.geometry?.coordinates) {
      return {
        distance: data.features[0].properties.summary.distance,
        duration: data.features[0].properties.summary.duration,
        coordinates: data.features[0].geometry.coordinates,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Decode Valhalla polyline (encoded polyline6)
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    coords.push([lng / 1e6, lat / 1e6]);
  }

  return coords;
}

/**
 * Generate realistic curved route with waypoints (Google Maps style)
 * Uses Catmull-Rom splines to create smooth curves
 */
export function generateRealisticCurvedRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): [number, number][] {
  console.log('🛣️ Generating realistic curved route with waypoints');

  const coords: [number, number][] = [];

  // Calculate distance and generate appropriate number of waypoints
  const distance = calculateHaversineDistance(startLat, startLng, endLat, endLng);
  const numWaypoints = Math.min(Math.max(Math.floor(distance / 500), 2), 8); // 2-8 waypoints

  // Generate intermediate waypoints
  const waypoints: [number, number][] = [];
  waypoints.push([startLng, startLat]);

  for (let i = 1; i < numWaypoints; i++) {
    const progress = i / numWaypoints;
    const baseLat = startLat + (endLat - startLat) * progress;
    const baseLng = startLng + (endLng - startLng) * progress;

    // Add perpendicular offset
    const perpAngle = Math.atan2(endLat - startLat, endLng - startLng) + Math.PI / 2;
    const maxOffset = Math.min(distance / 10000, 0.005);
    const offsetAmount = maxOffset * Math.sin(progress * Math.PI) * (Math.random() * 0.6 + 0.4);

    waypoints.push([
      baseLng + offsetAmount * Math.cos(perpAngle),
      baseLat + offsetAmount * Math.sin(perpAngle)
    ]);
  }

  waypoints.push([endLng, endLat]);

  // Generate smooth curve through waypoints using Catmull-Rom spline
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = i > 0 ? waypoints[i - 1] : waypoints[i];
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const p3 = i < waypoints.length - 2 ? waypoints[i + 2] : waypoints[i + 1];

    const segmentDist = calculateHaversineDistance(p1[1], p1[0], p2[1], p2[0]);
    const pointsPerSegment = Math.max(10, Math.floor(segmentDist / 50));

    for (let t = 0; t < pointsPerSegment; t++) {
      const u = t / pointsPerSegment;

      // Catmull-Rom spline
      const lng = 0.5 * (
        (2 * p1[0]) +
        (-p0[0] + p2[0]) * u +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u * u +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u * u * u
      );

      const lat = 0.5 * (
        (2 * p1[1]) +
        (-p0[1] + p2[1]) * u +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u * u +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u * u * u
      );

      coords.push([lng, lat]);
    }
  }

  coords.push([endLng, endLat]);

  console.log(`✅ Generated ${coords.length} points with ${numWaypoints} waypoints`);
  return coords;
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}
