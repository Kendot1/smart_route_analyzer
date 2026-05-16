import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';

interface SuccessCelebrationProps {
  show: boolean;
  onComplete?: () => void;
}

export default function SuccessCelebration({ show, onComplete }: SuccessCelebrationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number; duration: number }>>([]);

  useEffect(() => {
    if (show) {
      // Generate particles
      const colors = ['#FF6B6B', '#A855F7', '#14B8A6', '#F59E0B', '#10B981'];
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100 - 50, // -50 to 50
        y: Math.random() * 100 - 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.2,
        duration: 0.8 + Math.random() * 0.4,
      }));
      setParticles(newParticles);

      // Complete after animation
      const timer = setTimeout(() => {
        onComplete?.();
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[10001] flex items-center justify-center">
          {/* Central checkmark */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="relative"
          >
            <div className="w-16 h-16 md:w-20 md:h-20 bg-brand-teal rounded-full flex items-center justify-center shadow-2xl border-2 md:border-4 border-white">
              <svg
                className="w-8 h-8 md:w-10 md:h-10 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <motion.path
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </motion.div>

          {/* Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
              animate={{
                scale: [0, 1, 1, 0],
                x: particle.x * 3,
                y: particle.y * 3 - 100,
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                ease: 'easeOut',
              }}
              className="absolute w-3 h-3 rounded-full"
              style={{ backgroundColor: particle.color }}
            />
          ))}

          {/* Ring pulse */}
          <motion.div
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute w-16 h-16 md:w-20 md:h-20 rounded-full border-2 md:border-4 border-brand-teal"
          />
        </div>
      )}
    </AnimatePresence>
  );
}
