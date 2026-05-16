import L from 'leaflet';

export const applyPhilippinesMask = async (map: L.Map) => {
  try {
    const res = await fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries/PHL.geo.json');
    if (!res.ok) throw new Error('Failed to fetch Philippines GeoJSON');
    const data = await res.json();

    // Expanded world covering coordinates to ensure full coverage
    const worldCoords: [number, number][] = [
      [85, -180],   // North-West (reduced from 90 to avoid pole issues)
      [85, 180],    // North-East
      [-85, 180],   // South-East
      [-85, -180],  // South-West
      [85, -180],   // Close the polygon
    ];

    const holes: [number, number][][] = [];
    const geom = data.features[0].geometry;

    if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach((polygon: any) => {
        // polygon[0] is the outer ring of each island/island group
        const islandCoords = polygon[0].map((coord: [number, number]) => {
          // GeoJSON uses [lng, lat], Leaflet uses [lat, lng]
          return [coord[1], coord[0]] as [number, number];
        });
        // Close the polygon if not already closed
        const first = islandCoords[0];
        const last = islandCoords[islandCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          islandCoords.push(first);
        }
        holes.push(islandCoords);
      });
    } else if (geom.type === 'Polygon') {
      const islandCoords = geom.coordinates[0].map((coord: [number, number]) => {
        return [coord[1], coord[0]] as [number, number];
      });
      const first = islandCoords[0];
      const last = islandCoords[islandCoords.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        islandCoords.push(first);
      }
      holes.push(islandCoords);
    }

    // Add mask layer with proper z-index
    const maskLayer = L.polygon([worldCoords, ...holes], {
      fillColor: '#ffffff',
      fillOpacity: 1,
      color: '#e5e7eb', // Light gray border for subtle definition
      weight: 0.5,
      interactive: false,
      pane: 'overlayPane' // Ensure it renders above tiles but below markers
    }).addTo(map);

    // Set explicit z-index
    const maskElement = maskLayer.getElement();
    if (maskElement) {
      maskElement.style.zIndex = '400';
    }

    console.log("✓ Philippines mask applied - all other countries hidden");
  } catch (error) {
    console.error("✗ Error applying Philippines mask:", error);
    // Graceful degradation - map still works, just without mask
  }
};
