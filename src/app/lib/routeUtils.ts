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
  // Map mode to routing profile
  // For hiking: use 'foot' for OSRM, but ORS/Valhalla have hiking-specific profiles
  const profile = mode === 'car' ? 'car' : mode === 'biking' ? 'bike' : 'foot';

  // For hiking: prioritize ORS (foot-hiking profile includes mountain trails/paths)
  // For other modes: OSRM is fastest and most reliable
  const routingSources = mode === 'hiking' ? [
    {
      name: 'OpenRouteService (hiking)',
      fetch: () => tryOpenRouteService(startLat, startLng, endLat, endLng, profile, true)
    },
    {
      name: 'Valhalla (pedestrian)',
      fetch: () => tryValhalla(startLat, startLng, endLat, endLng, profile)
    },
    {
      name: 'OSRM (foot)',
      fetch: () => tryOSRMDirect(startLat, startLng, endLat, endLng, profile)
    }
  ] : [
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
      fetch: () => tryOpenRouteService(startLat, startLng, endLat, endLng, profile, false)
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

/**
 * Fetch the ACTUAL nearest trail from OSM near a mountain peak.
 * Returns the trail's real geometry (the brown lines on the map) and the trailhead coordinate.
 * The trailhead is the end of the trail furthest from the peak (where road access meets the trail).
 */
export async function fetchNearestTrail(
  peakLat: number,
  peakLng: number,
  searchRadiusKm: number = 8
): Promise<{
  trailCoords: [number, number][]; // [lng, lat][] oriented trailhead → peak
  trailheadCoord: [number, number]; // [lng, lat] where the trail starts (far from peak)
  trailDistanceKm: number;
} | null> {
  try {
    console.log(`🗺️ Searching for actual OSM trails within ${searchRadiusKm}km of peak...`);

    const radiusDeg = searchRadiusKm / 111;
    const bbox = `${peakLat - radiusDeg},${peakLng - radiusDeg},${peakLat + radiusDeg},${peakLng + radiusDeg}`;

    // Query Overpass for trail/path/track/footway ways WITH full geometry
    const query = `[out:json][timeout:15];(way["highway"="path"](${bbox});way["highway"="track"](${bbox});way["highway"="footway"](${bbox});way["highway"="steps"](${bbox});way["highway"="bridleway"](${bbox}););out body geom;`;

    const servers = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    let data: any = null;
    for (const server of servers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(server, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          data = await response.json();
          console.log(`   ✅ Overpass responded from ${server}`);
          break;
        }
      } catch (e) {
        console.log(`   ⚠️ ${server} failed, trying next...`);
      }
    }

    if (!data?.elements?.length) {
      console.log('ℹ️ No OSM trail ways found near the peak');
      return null;
    }

    // Filter to ways with valid geometry
    const ways = data.elements.filter((el: any) => el.geometry && el.geometry.length >= 2);
    console.log(`🗺️ Found ${ways.length} trail ways near the peak`);

    if (ways.length === 0) return null;

    // For each way, find the node closest to the peak
    let bestWay: any = null;
    let bestDist = Infinity;

    for (const way of ways) {
      for (const node of way.geometry) {
        const dist = calculateHaversineDistance(peakLat, peakLng, node.lat, node.lon);
        if (dist < bestDist) {
          bestDist = dist;
          bestWay = way;
        }
      }
    }

    if (!bestWay || bestDist > 3000) {
      console.log(`ℹ️ Closest trail is ${(bestDist/1000).toFixed(1)}km from peak — too far`);
      return null;
    }

    console.log(`✅ Best trail: way/${bestWay.id} (closest node ${(bestDist/1000).toFixed(2)}km from peak)`);

    // Now chain connected ways, but ONLY extend AWAY from the peak (toward trailhead).
    // This prevents cycles and loops.
    const usedWayIds = new Set<number>([bestWay.id]);
    const chainedCoords: { lat: number; lon: number }[] = [...bestWay.geometry];

    // Orient bestWay so last node is closest to peak
    const bFirst = calculateHaversineDistance(peakLat, peakLng, chainedCoords[0].lat, chainedCoords[0].lon);
    const bLast = calculateHaversineDistance(peakLat, peakLng, chainedCoords[chainedCoords.length - 1].lat, chainedCoords[chainedCoords.length - 1].lon);
    if (bFirst < bLast) {
      chainedCoords.reverse(); // Now chainedCoords[0] is far from peak, last is near peak
    }

    // Only extend from the START of the chain (the trailhead end, far from peak)
    let extended = true;
    while (extended) {
      extended = false;
      const firstNode = chainedCoords[0];
      const currentDistFromPeak = calculateHaversineDistance(peakLat, peakLng, firstNode.lat, firstNode.lon);

      let bestCandidate: { way: any; coords: { lat: number; lon: number }[]; dist: number } | null = null;

      for (const way of ways) {
        if (usedWayIds.has(way.id)) continue;

        const wayFirst = way.geometry[0];
        const wayLast = way.geometry[way.geometry.length - 1];

        const connectThreshold = 50;

        // Check if way connects to the start of our chain
        const distToStart1 = calculateHaversineDistance(firstNode.lat, firstNode.lon, wayLast.lat, wayLast.lon);
        const distToStart2 = calculateHaversineDistance(firstNode.lat, firstNode.lon, wayFirst.lat, wayFirst.lon);

        let candidateCoords: { lat: number; lon: number }[] | null = null;

        if (distToStart1 < connectThreshold) {
          // way's last connects to our first → prepend forward
          candidateCoords = way.geometry.slice(0, -1);
        } else if (distToStart2 < connectThreshold) {
          // way's first connects to our first → prepend reversed
          candidateCoords = [...way.geometry].reverse().slice(0, -1);
        }

        if (candidateCoords && candidateCoords.length > 0) {
          // Check that the new segment moves AWAY from the peak (prevents loops)
          const newEndDist = calculateHaversineDistance(peakLat, peakLng, candidateCoords[0].lat, candidateCoords[0].lon);
          if (newEndDist > currentDistFromPeak * 0.9) { // Allow slight tolerance
            if (!bestCandidate || newEndDist > bestCandidate.dist) {
              bestCandidate = { way, coords: candidateCoords, dist: newEndDist };
            }
          }
        }
      }

      if (bestCandidate) {
        chainedCoords.unshift(...bestCandidate.coords);
        usedWayIds.add(bestCandidate.way.id);
        extended = true;
      }
    }

    console.log(`🔗 Chained ${usedWayIds.size} ways → ${chainedCoords.length} total trail nodes`);

    // The chain is already oriented: trailhead (far from peak) → peak (close to peak)
    // Remove any backtracking: ensure monotonic decreasing distance to peak
    const cleaned: { lat: number; lon: number }[] = [chainedCoords[0]];
    let lastDistToPeak = calculateHaversineDistance(peakLat, peakLng, chainedCoords[0].lat, chainedCoords[0].lon);

    for (let i = 1; i < chainedCoords.length; i++) {
      const dist = calculateHaversineDistance(peakLat, peakLng, chainedCoords[i].lat, chainedCoords[i].lon);
      // Allow slight backtracking (up to 15% increase) for natural trail curves
      if (dist <= lastDistToPeak * 1.15) {
        cleaned.push(chainedCoords[i]);
        lastDistToPeak = Math.min(lastDistToPeak, dist);
      }
    }

    // Ensure the last point (closest to peak) is always included
    const lastPt = chainedCoords[chainedCoords.length - 1];
    const lastCleanedPt = cleaned[cleaned.length - 1];
    if (lastPt.lat !== lastCleanedPt.lat || lastPt.lon !== lastCleanedPt.lon) {
      cleaned.push(lastPt);
    }

    console.log(`🧹 Cleaned: ${chainedCoords.length} → ${cleaned.length} nodes (removed backtracking)`);

    // Convert to [lng, lat] format
    const trailCoords: [number, number][] = cleaned.map(n => [n.lon, n.lat]);

    // Calculate trail distance
    let trailDistanceKm = 0;
    for (let i = 1; i < trailCoords.length; i++) {
      trailDistanceKm += calculateHaversineDistance(
        trailCoords[i-1][1], trailCoords[i-1][0],
        trailCoords[i][1], trailCoords[i][0]
      ) / 1000;
    }

    const trailheadCoord = trailCoords[0];

    console.log(`🥾 Trail: ${trailDistanceKm.toFixed(1)}km, ${trailCoords.length} points`);
    console.log(`📍 Trailhead: [${trailheadCoord[1].toFixed(5)}, ${trailheadCoord[0].toFixed(5)}]`);

    return { trailCoords, trailheadCoord, trailDistanceKm };
  } catch (error) {
    console.log('⚠️ fetchNearestTrail failed:', error);
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
  profile: string,
  isHiking: boolean = false
): Promise<{ distance: number; duration: number; coordinates: [number, number][] } | null> {
  try {
    // Use foot-hiking profile for hiking mode (includes mountain trails/paths)
    const orsProfile = isHiking ? 'foot-hiking'
      : profile === 'car' ? 'driving-car'
      : profile === 'bike' ? 'cycling-regular'
      : 'foot-walking';
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
 * Generate a realistic trail path for mountain hiking segments.
 * Creates visible switchback curves that clearly look like a mountain trail,
 * not a straight line. Uses wider offsets and more waypoints.
 */
export function generateTrailPath(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): [number, number][] {
  const coords: [number, number][] = [];
  const distance = calculateHaversineDistance(startLat, startLng, endLat, endLng);

  // Seed-based pseudo-random for consistent results
  let seed = Math.abs(Math.sin(startLat * 10000 + endLng * 10000)) * 10000;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Generate a natural-looking trail with subtle variations
  // Stays close to the direct line — max ~50-100m lateral offset
  const numPoints = Math.min(Math.max(Math.floor(distance / 80), 15), 60);
  const perpAngle = Math.atan2(endLat - startLat, endLng - startLng) + Math.PI / 2;

  // Max lateral offset: ~0.05% of distance, capped at ~100m
  const maxOffset = Math.min(distance / 20000, 0.001);

  // Generate noise offsets at different frequencies for organic feel
  const noise: number[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const n1 = Math.sin(t * 5.7 + pseudoRandom() * 2) * 0.6;
    const n2 = Math.sin(t * 11.3 + pseudoRandom() * 3) * 0.3;
    const n3 = Math.sin(t * 23.1 + pseudoRandom() * 4) * 0.1;
    const taper = Math.sin(t * Math.PI);
    noise.push((n1 + n2 + n3) * taper);
  }

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const baseLat = startLat + (endLat - startLat) * t;
    const baseLng = startLng + (endLng - startLng) * t;
    const offset = maxOffset * noise[i];
    coords.push([
      baseLng + offset * Math.cos(perpAngle),
      baseLat + offset * Math.sin(perpAngle),
    ]);
  }

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

/**
 * Fetch actual trail/path geometry from OpenStreetMap via Overpass API.
 * These are the brown lines visible on the map (highway=path, track, footway).
 * Returns coordinates that follow real mapped trails, avoiding rivers.
 */
export async function fetchOSMTrailPath(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<[number, number][] | null> {
  try {
    // Calculate bounding box around start→end with generous padding (~3.3km)
    const minLat = Math.min(startLat, endLat) - 0.03;
    const maxLat = Math.max(startLat, endLat) + 0.03;
    const minLng = Math.min(startLng, endLng) - 0.03;
    const maxLng = Math.max(startLng, endLng) + 0.03;
    const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;

    // Query Overpass for walkable paths/tracks AND waterways (rivers to avoid)
    const query = `[out:json][timeout:15];(way["highway"="path"](${bbox});way["highway"="track"](${bbox});way["highway"="footway"](${bbox});way["highway"="steps"](${bbox});way["highway"="bridleway"](${bbox});way["highway"="unclassified"](${bbox});way["highway"="service"](${bbox});way["waterway"="river"](${bbox});way["waterway"="stream"](${bbox});way["waterway"="canal"](${bbox}););out body geom;`;

    console.log('🗺️ Fetching OSM trail data via Overpass...');
    console.log(`   Bbox: ${bbox}`);

    // Try multiple Overpass servers
    const servers = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    let data: any = null;
    for (const server of servers) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(server, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          data = await response.json();
          console.log(`   ✅ Overpass server ${server} responded`);
          break;
        }
      } catch (e) {
        console.log(`   ⚠️ ${server} failed, trying next...`);
      }
    }

    if (!data) throw new Error('All Overpass servers failed');

    if (!data.elements || data.elements.length === 0) {
      console.log('ℹ️ No OSM trails found in this area');
      return null;
    }

    console.log(`🗺️ Found ${data.elements.length} OSM elements`);

    // Separate trails and waterways
    const trailCoords: { lng: number; lat: number; progress: number }[] = [];
    const waterways: [number, number][][] = []; // Each waterway is an array of [lng, lat] points

    for (const way of data.elements) {
      if (!way.geometry || way.geometry.length < 2) continue;

      if (way.tags?.waterway) {
        // This is a river/stream — store as barrier
        waterways.push(way.geometry.map((g: { lat: number; lon: number }) => [g.lon, g.lat] as [number, number]));
        continue;
      }

      // Trail/path — project each point onto the start→end vector
      for (const g of way.geometry) {
        // Calculate progress: how far along the start→end line this point is
        const dx = endLng - startLng;
        const dy = endLat - startLat;
        const px = g.lon - startLng;
        const py = g.lat - startLat;
        const progress = (px * dx + py * dy) / (dx * dx + dy * dy);

        // Only include points that are between start and end (with some margin)
        if (progress >= -0.1 && progress <= 1.1) {
          // Check lateral distance from the line (perpendicular)
          const lateralDist = Math.abs(px * dy - py * dx) / Math.sqrt(dx * dx + dy * dy);
          const maxLateral = 0.03; // ~3.3km lateral tolerance
          if (lateralDist < maxLateral) {
            trailCoords.push({ lng: g.lon, lat: g.lat, progress });
          }
        }
      }
    }

    if (trailCoords.length < 3) {
      console.log(`ℹ️ Only ${trailCoords.length} trail points found, not enough`);
      return null;
    }

    console.log(`🗺️ ${trailCoords.length} trail points, ${waterways.length} waterways`);

    // Sort trail points by progress (0 = start, 1 = end)
    trailCoords.sort((a, b) => a.progress - b.progress);

    // Remove duplicate/very-close points to clean up the path
    const filtered: { lng: number; lat: number }[] = [trailCoords[0]];
    for (let i = 1; i < trailCoords.length; i++) {
      const prev = filtered[filtered.length - 1];
      const dist = calculateHaversineDistance(prev.lat, prev.lng, trailCoords[i].lat, trailCoords[i].lng);
      if (dist > 20) { // Skip points closer than 20m
        filtered.push(trailCoords[i]);
      }
    }

    // Build helper: check if a line segment crosses any waterway
    const crossesWaterway = (lat1: number, lng1: number, lat2: number, lng2: number): boolean => {
      for (const ww of waterways) {
        for (let i = 0; i < ww.length - 1; i++) {
          if (segmentsIntersect(lng1, lat1, lng2, lat2, ww[i][0], ww[i][1], ww[i+1][0], ww[i+1][1])) {
            return true;
          }
        }
      }
      return false;
    };

    // Build final path, skipping segments that cross rivers
    const result: [number, number][] = [[startLng, startLat]];
    let lastLat = startLat;
    let lastLng = startLng;

    for (const p of filtered) {
      // Check if this segment crosses a river
      if (waterways.length > 0 && crossesWaterway(lastLat, lastLng, p.lat, p.lng)) {
        continue; // Skip this point — would cross a river
      }
      result.push([p.lng, p.lat]);
      lastLat = p.lat;
      lastLng = p.lng;
    }

    result.push([endLng, endLat]);

    console.log(`✅ Built projection-sorted trail path: ${result.length} points (${waterways.length} waterways avoided)`);
    return result;

  } catch (error) {
    console.log('ℹ️ Overpass API unavailable:', error);
    return null;
  }
}

// Helper: check if two line segments intersect
function segmentsIntersect(
  x1: number, y1: number, x2: number, y2: number,
  x3: number, y3: number, x4: number, y4: number
): boolean {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-10) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
