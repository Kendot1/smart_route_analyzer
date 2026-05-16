import { Footprints, PersonStanding, Bike, Car, Mountain } from 'lucide-react';
import { TravelMode } from '../lib/physics';

interface ModeSelectorProps {
  mode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
}

const modes = [
  {
    value: 'walking' as TravelMode,
    label: 'Walking',
    icon: Footprints,
    color: 'bg-activity-walking',
  },
  {
    value: 'hiking' as TravelMode,
    label: 'Hiking',
    icon: Mountain,
    color: 'bg-amber-600',
  },
  {
    value: 'jogging' as TravelMode,
    label: 'Jogging',
    icon: PersonStanding,
    color: 'bg-activity-jogging',
  },
  {
    value: 'biking' as TravelMode,
    label: 'Biking',
    icon: Bike,
    color: 'bg-activity-biking',
  },
  {
    value: 'car' as TravelMode,
    label: 'Car',
    icon: Car,
    color: 'bg-activity-car',
  },
];

export default function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">Travel Mode</label>
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.value;

          return (
            <button
              key={m.value}
              onClick={() => onModeChange(m.value)}
              className={`
                relative group p-3 md:p-4 rounded-xl md:rounded-2xl border-2 transition-all duration-300
                ${isActive
                  ? `border-transparent ${m.color} text-white shadow-lg scale-105`
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md text-gray-700'}
              `}
            >
              <div className="relative flex flex-col items-center gap-1.5 md:gap-2">
                <Icon className={`w-5 h-5 md:w-6 md:h-6 ${isActive ? 'text-white' : 'text-gray-600'}`} />
                <span className="text-xs md:text-sm font-medium">{m.label}</span>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-pulse"></div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
