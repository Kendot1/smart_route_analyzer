import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export interface ToastProps {
  show: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export default function Toast({
  show,
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  };

  const styles = {
    success: {
      bg: 'bg-brand-teal',
      icon: 'text-white',
    },
    error: {
      bg: 'bg-red-600',
      icon: 'text-white',
    },
    info: {
      bg: 'bg-brand-purple',
      icon: 'text-white',
    },
  };

  const Icon = icons[type];
  const style = styles[type];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          className="fixed top-3 md:top-4 right-3 md:right-4 z-[10000] max-w-sm md:max-w-md"
        >
          <div
            className={`${style.bg} text-white rounded-xl md:rounded-2xl shadow-2xl p-3 pr-10 md:p-4 md:pr-12 border-2 border-white/20 backdrop-blur-sm`}
          >
            <div className="flex items-start gap-2 md:gap-3">
              <Icon className={`w-5 h-5 md:w-6 md:h-6 ${style.icon} flex-shrink-0 mt-0.5`} />
              <p className="text-xs md:text-sm font-medium leading-relaxed">{message}</p>
            </div>

            <button
              onClick={onClose}
              className="absolute top-2 right-2 md:top-3 md:right-3 p-1 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>

            {/* Progress bar */}
            {duration > 0 && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: duration / 1000, ease: 'linear' }}
                className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 origin-left rounded-b-2xl"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
