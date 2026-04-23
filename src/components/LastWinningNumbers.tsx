import React from 'react';
import NumberBall from './NumberBall';
import { IsraeliLotteryResult } from '../services/israeliLotteryAPI';

interface LastWinningNumbersProps {
  lastResult: IsraeliLotteryResult | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDrawDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const LastWinningNumbers: React.FC<LastWinningNumbersProps> = ({ lastResult }) => {
  if (!lastResult) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-[#E5E5EA] shadow-sm flex flex-col items-center justify-center min-h-[120px]">
        <p className="text-[#6E6E73] text-sm">No winning numbers available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E5E5EA] shadow-sm">
      <div className="flex items-center justify-between">
        {/* Left: date info */}
        <div className="min-w-[130px]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-1">Drawing Date</p>
          <p className="text-[17px] font-semibold text-[#1D1D1F] leading-tight">
            {formatDrawDate(lastResult.date)}
          </p>
        </div>

        {/* Balls row */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Power / bonus first — matches the design */}
          <NumberBall number={lastResult.bonus} type="bonus" delay={0} />
          <div className="w-px h-6 bg-[#E5E5EA] mx-1" />
          {lastResult.numbers.map((num, i) => (
            <NumberBall key={i} number={num} type="result" delay={i * 0.05 + 0.05} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LastWinningNumbers;
