import React from 'react';

interface NumberBallProps {
  number: number;
  /** 'primary' = indigo ball, 'bonus' = amber/power ball, 'result' = white ball */
  type?: 'primary' | 'bonus' | 'result';
  /** backward-compat alias: isPrimary=true → 'primary', false → 'bonus' */
  isPrimary?: boolean;
  size?: 'sm' | 'md' | 'lg';
  delay?: number;
}

const NumberBall: React.FC<NumberBallProps> = ({
  number,
  type,
  isPrimary,
  size = 'md',
  delay = 0,
}) => {
  // Resolve variant
  const variant: 'primary' | 'bonus' | 'result' =
    type ?? (isPrimary ? 'primary' : 'bonus');

  const sizeClasses = {
    sm: 'w-9 h-9 text-sm font-semibold',
    md: 'w-12 h-12 text-base font-bold',
    lg: 'w-14 h-14 text-lg font-bold',
  };

  const variantClasses = {
    primary: 'bg-[#5E5CE6] text-white shadow-md shadow-indigo-200',
    bonus:   'bg-amber-400 text-white shadow-md shadow-amber-200',
    result:  'bg-white border border-[#E5E5EA] text-[#1D1D1F] shadow-sm',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        rounded-full flex items-center justify-center
        transition-transform duration-200 hover:scale-110 cursor-default ball-enter
      `}
      style={{ animationDelay: `${delay}s` }}
    >
      {String(number).padStart(2, '0')}
    </div>
  );
};

export default NumberBall;