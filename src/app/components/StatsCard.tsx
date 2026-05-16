import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StatsCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  progress?: number; // 0-100
  animate?: boolean;
  gradient?: boolean;
  delay?: number;
}

export default function StatsCard({
  icon: Icon,
  value,
  label,
  progress,
  animate = true,
  gradient = false,
  delay = 0,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate || typeof value !== 'number') {
      setDisplayValue(value);
      return;
    }

    const duration = 1000; // 1 second
    const steps = 60;
    const increment = value / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value, animate]);

  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : false}
      animate={animate ? { opacity: 1, y: 0 } : false}
      transition={{ duration: 0.5, delay }}
      className={`
        relative overflow-hidden rounded-2xl p-6
        ${gradient
          ? 'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/20'
          : 'bg-white shadow-lg hover:shadow-xl'}
        transition-all duration-300 hover:-translate-y-1
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`
          p-3 rounded-xl
          ${gradient
            ? 'bg-white/10 backdrop-blur-sm'
            : 'bg-gradient-to-br from-brand-coral/10 to-brand-purple/10'}
        `}>
          <Icon className={`w-6 h-6 ${gradient ? 'text-white' : 'text-brand-coral'}`} />
        </div>

        <div className="flex-1">
          <div className={`text-3xl font-bold ${gradient ? 'text-white' : 'text-gray-900'}`}>
            {displayValue}
          </div>
          <div className={`text-sm ${gradient ? 'text-white/70' : 'text-gray-600'}`}>
            {label}
          </div>
        </div>
      </div>

      {progress !== undefined && (
        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, delay: delay + 0.3 }}
              className="h-full bg-gradient-to-r from-brand-coral to-brand-purple"
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}
