import { useEffect, useRef } from 'react';
import type { AnalysisResult } from '../lib/types';

interface LiveMapProps {
  result: AnalysisResult | null;
}

export default function LiveMap({ result }: LiveMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!result || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Parse coordinates
    const coordinates: [number, number][] = JSON.parse(result.route.polyline);

    // Get bounds
    const lats = coordinates.map(([, lat]) => lat);
    const lons = coordinates.map(([lon]) => lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    // Add padding
    const padding = 40;
    const latRange = maxLat - minLat || 0.01;
    const lonRange = maxLon - minLon || 0.01;

    // Convert lat/lon to canvas coordinates
    const toCanvasX = (lon: number) => {
      return padding + ((lon - minLon) / lonRange) * (width - 2 * padding);
    };

    const toCanvasY = (lat: number) => {
      return height - padding - ((lat - minLat) / latRange) * (height - 2 * padding);
    };

    // Draw grid background
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = padding + (i / 10) * (width - 2 * padding);
      const y = padding + (i / 10) * (height - 2 * padding);

      // Vertical lines
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();

      // Horizontal lines
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }

    // Draw route shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    coordinates.forEach(([lon, lat], i) => {
      const x = toCanvasX(lon);
      const y = toCanvasY(lat) + 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw route line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    coordinates.forEach(([lon, lat], i) => {
      const x = toCanvasX(lon);
      const y = toCanvasY(lat);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw start marker
    const startX = toCanvasX(coordinates[0][0]);
    const startY = toCanvasY(coordinates[0][1]);

    // Start marker shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(startX, startY + 2, 12, 0, Math.PI * 2);
    ctx.fill();

    // Start marker
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(startX, startY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(startX, startY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw end marker
    const endX = toCanvasX(coordinates[coordinates.length - 1][0]);
    const endY = toCanvasY(coordinates[coordinates.length - 1][1]);

    // End marker shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(endX, endY + 2, 12, 0, Math.PI * 2);
    ctx.fill();

    // End marker
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(endX, endY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw labels
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START', startX, startY - 20);
    ctx.fillText('END', endX, endY - 20);

  }, [result]);

  if (!result) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center px-4">
          <div className="text-6xl mb-4">🗺️</div>
          <p className="text-gray-600 text-lg font-medium">
            Route Visualizer Ready
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Enter locations and click "Analyze Route" to see your route
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-white rounded-lg">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />

      {/* Info overlay */}
      <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium text-gray-700">Start Point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="font-medium text-gray-700">Destination</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Total Distance</div>
            <div className="text-lg font-bold text-gray-800">
              {result.route.distance.toFixed(2)} km
            </div>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-full h-1.5 bg-blue-600 rounded-full"></div>
            <span className="text-xs text-gray-600 whitespace-nowrap">Route path</span>
          </div>
        </div>
      </div>
    </div>
  );
}
