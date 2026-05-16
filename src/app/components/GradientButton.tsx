import { Button } from './ui/button';
import { ButtonProps } from './ui/button';
import { forwardRef } from 'react';

interface GradientButtonProps extends ButtonProps {
  gradient?: 'primary' | 'secondary' | 'coral' | 'purple' | 'teal';
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ gradient = 'primary', className = '', children, ...props }, ref) => {
    const gradientClasses = {
      primary: 'bg-brand-coral hover:bg-brand-coral-dark text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300',
      secondary: 'bg-brand-purple hover:bg-brand-purple-dark text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300',
      coral: 'bg-brand-coral hover:bg-brand-coral-dark text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300',
      purple: 'bg-brand-purple hover:bg-brand-purple-dark text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300',
      teal: 'bg-brand-teal hover:bg-brand-teal-dark text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300',
    };

    return (
      <Button
        ref={ref}
        className={`${gradientClasses[gradient]} ${className}`}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

GradientButton.displayName = 'GradientButton';

export default GradientButton;
