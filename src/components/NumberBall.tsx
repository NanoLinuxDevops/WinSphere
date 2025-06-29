import React from 'react';

interface NumberBallProps {
  number: number;
  isPrimary: boolean;
}

const NumberBall: React.FC<NumberBallProps> = ({ number, isPrimary }) => {
  return (
    <div
      className={`
        w-16 h-16 rounded-full flex items-center justify-center font-bold text-xl
        transform transition-all duration-500 hover:scale-110 cursor-pointer
        ${isPrimary 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50' 
          : 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/50'
        }
        animate-pulse
      `}
      style={{
        animationDelay: `${Math.random() * 0.5}s`,
        animationDuration: '2s'
      }}
    >
      {number}
    </div>
  );
};

export default NumberBall;