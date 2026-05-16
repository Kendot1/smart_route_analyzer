import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface OnboardingTooltipProps {
  show: boolean;
  onClose: () => void;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  step?: number;
  totalSteps?: number;
  onNext?: () => void;
}

export default function OnboardingTooltip({
  show,
  onClose,
  title,
  description,
  position = 'bottom',
  step,
  totalSteps,
  onNext,
}: OnboardingTooltipProps) {
  const positionClasses = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2',
    right: 'left-full ml-2',
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: position === 'bottom' ? -10 : 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`absolute ${positionClasses[position]} z-[9999] w-72 md:w-80 max-w-[90vw]`}
        >
          {/* Arrow */}
          <div
            className={`absolute ${
              position === 'bottom'
                ? 'bottom-full left-6 border-b-6 md:border-b-8 border-l-6 md:border-l-8 border-r-6 md:border-r-8 border-b-white border-l-transparent border-r-transparent'
                : position === 'top'
                ? 'top-full left-6 border-t-6 md:border-t-8 border-l-6 md:border-l-8 border-r-6 md:border-r-8 border-t-white border-l-transparent border-r-transparent'
                : ''
            }`}
          ></div>

          <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl border-2 border-brand-coral/20 p-4 md:p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-2 md:mb-3">
              <div className="flex-1">
                {step && totalSteps && (
                  <div className="text-[10px] md:text-xs font-bold text-brand-coral mb-1">
                    Step {step} of {totalSteps}
                  </div>
                )}
                <h3 className="font-bold text-gray-900 text-base md:text-lg">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="ml-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs md:text-sm text-gray-600 mb-3 md:mb-4 leading-relaxed">{description}</p>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={onClose}
                className="text-[10px] md:text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Skip tutorial
              </button>

              {onNext && (
                <button
                  onClick={onNext}
                  className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-brand-coral text-white rounded-lg font-medium text-xs md:text-sm hover:shadow-lg transition-all"
                >
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
              )}

              {!onNext && (
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 md:px-4 md:py-2 bg-brand-teal text-white rounded-lg font-medium text-xs md:text-sm hover:shadow-lg transition-all"
                >
                  Got it!
                </button>
              )}
            </div>

            {/* Progress dots */}
            {step && totalSteps && totalSteps > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-100">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i + 1 === step
                        ? 'w-6 bg-brand-coral'
                        : i + 1 < step
                        ? 'w-1.5 bg-brand-teal'
                        : 'w-1.5 bg-gray-300'
                    }`}
                  ></div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
