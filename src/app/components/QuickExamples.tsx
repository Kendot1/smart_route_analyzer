import { MapPin } from 'lucide-react';

interface QuickExamplesProps {
  onSelect: (origin: string, destination: string) => void;
}

export default function QuickExamples({ onSelect }: QuickExamplesProps) {
  const examples = [
    {
      name: 'Paris Tour',
      origin: 'Eiffel Tower, Paris, France',
      destination: 'Louvre Museum, Paris, France',
      emoji: '🗼',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      name: 'London Walk',
      origin: 'Big Ben, London, UK',
      destination: 'Tower Bridge, London, UK',
      emoji: '🏰',
      gradient: 'from-blue-500 to-indigo-500',
    },
    {
      name: 'NYC Adventure',
      origin: 'Times Square, New York, USA',
      destination: 'Central Park, New York, USA',
      emoji: '🗽',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      name: 'Tokyo Journey',
      origin: 'Tokyo Tower, Tokyo, Japan',
      destination: 'Senso-ji Temple, Tokyo, Japan',
      emoji: '🗾',
      gradient: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl md:rounded-2xl shadow-xl p-4 md:p-5 mb-4 md:mb-6 border-2 border-gray-100">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="p-1.5 md:p-2 bg-gradient-to-br from-brand-teal to-emerald-500 rounded-lg md:rounded-xl">
            <MapPin className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
          <h3 className="text-base md:text-lg font-bold text-gray-900">
            Quick Examples
          </h3>
        </div>
        <p className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          Try these routes
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
        {examples.map((example) => (
          <button
            key={example.name}
            onClick={() => onSelect(example.origin, example.destination)}
            className="group relative px-3 py-4 md:px-4 md:py-5 bg-white border-2 border-gray-200 hover:border-transparent rounded-xl md:rounded-2xl text-left transition-all hover:scale-105 hover:shadow-xl overflow-hidden"
          >
            {/* Gradient overlay on hover */}
            <div className={`absolute inset-0 bg-gradient-to-br ${example.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>

            {/* Content */}
            <div className="relative z-10">
              <div className="text-2xl md:text-3xl mb-1.5 md:mb-2">{example.emoji}</div>
              <div className="text-xs md:text-sm font-bold text-gray-900 mb-0.5 md:mb-1">{example.name}</div>
              <div className="text-[10px] md:text-xs text-gray-500">Click to load route</div>
            </div>

            {/* Hover indicator */}
            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${example.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>
          </button>
        ))}
      </div>
    </div>
  );
}
