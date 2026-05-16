import { TravelMode } from '../lib/physics';
import { MapPin, Navigation } from 'lucide-react';

interface InputFormProps {
  origin: string;
  destination: string;
  mode: TravelMode;
  userWeight: number;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onModeChange: (value: TravelMode) => void;
  onWeightChange: (value: number) => void;
  onAnalyze: () => void;
  loading: boolean;
}

export default function InputForm({
  origin,
  destination,
  mode,
  userWeight,
  onOriginChange,
  onDestinationChange,
  onModeChange,
  onWeightChange,
  onAnalyze,
  loading,
}: InputFormProps) {
  const modes: { value: TravelMode; label: string }[] = [
    { value: 'walking', label: 'Walking' },
    { value: 'hiking', label: 'Hiking' },
    { value: 'jogging', label: 'Jogging' },
    { value: 'biking', label: 'Biking' },
    { value: 'car', label: 'Car' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        Route Configuration
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="inline w-4 h-4 mr-1" />
            Origin
          </label>
          <input
            type="text"
            value={origin}
            onChange={(e) => onOriginChange(e.target.value)}
            placeholder="e.g., Eiffel Tower, Paris, France"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 Use landmarks or "City, Country" for best results
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Navigation className="inline w-4 h-4 mr-1" />
            Destination
          </label>
          <input
            type="text"
            value={destination}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder="e.g., Louvre Museum, Paris, France"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Travel Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {modes.map((m) => (
              <button
                key={m.value}
                onClick={() => onModeChange(m.value)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  mode === m.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {mode !== 'car' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Weight (kg)
            </label>
            <input
              type="number"
              value={userWeight}
              onChange={(e) => onWeightChange(Number(e.target.value))}
              min="30"
              max="200"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        <button
          onClick={onAnalyze}
          disabled={loading || !origin || !destination}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Analyzing Route...
            </span>
          ) : (
            '🗺️ Analyze Route'
          )}
        </button>
      </div>
    </div>
  );
}
