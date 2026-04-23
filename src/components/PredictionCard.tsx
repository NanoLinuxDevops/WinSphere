import React from 'react';
import { Zap, Info } from 'lucide-react';
import NumberBall from './NumberBall';

interface PredictionCardProps {
  numbers?: number[];
  bonus?: number;
  confidence?: number;
  method?: string;
  isLoading?: boolean;
  onGenerate?: () => void;
}

const PredictionCard: React.FC<PredictionCardProps> = ({
  numbers = [7, 12, 19, 26, 28, 37],
  bonus = 3,
  confidence = 87,
  method = 'LSTM + ARIMA Ensemble Neural Engine',
  isLoading = false,
  onGenerate,
}) => {
  return (
    <div className="rounded-2xl border border-[#DDDCF8] bg-[#F0EFFD] p-6">
      {/* Top row: generate button + title + confidence */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#3a3a3c] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors duration-200"
        >
          {isLoading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <Zap className="h-4 w-4" />
          )}
          GENERATE NEW PREDICTION
        </button>

        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 bg-[#5E5CE6] text-white text-xs font-semibold px-3 py-1.5 rounded-full">
            <Zap className="h-3 w-3" />
            Confidence {confidence}%
          </span>
          <h2 className="text-2xl font-bold text-[#1D1D1F]">AI Prediction</h2>
        </div>
      </div>

      {/* Method label */}
      <p className="text-[#6E6E73] text-xs flex items-center gap-1 mb-5">
        Using {method}
        <Info className="h-3.5 w-3.5 text-[#6E6E73]" />
      </p>

      {/* Balls */}
      <div className="bg-white/60 rounded-xl py-5 px-4 flex items-center justify-center gap-2 flex-wrap">
        <NumberBall number={bonus} type="bonus" size="lg" delay={0} />
        <span className="text-[#C7C7CC] text-lg font-light mx-1">—</span>
        {numbers.map((num, i) => (
          <NumberBall key={i} number={num} type="primary" size="lg" delay={i * 0.06 + 0.1} />
        ))}
      </div>
    </div>
  );
};

export default PredictionCard;