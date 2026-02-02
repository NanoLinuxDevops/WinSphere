import React from 'react';
import { Trophy, Calendar } from 'lucide-react';
import NumberBall from './NumberBall';
import { IsraeliLotteryResult } from '../services/israeliLotteryAPI';

interface LastWinningNumbersProps {
  lastResult: IsraeliLotteryResult | null;
}

const LastWinningNumbers: React.FC<LastWinningNumbersProps> = ({ lastResult }) => {
  if (!lastResult) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 flex flex-col items-center justify-center min-h-[200px]">
        <Trophy className="w-12 h-12 text-yellow-500/50 mb-3" />
        <p className="text-blue-200">No winning numbers available yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:border-blue-500/50 transition-all duration-300 transform hover:-translate-y-1">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Last Winning Numbers
          </h3>
          <div className="flex items-center gap-2 mt-1 text-blue-200 text-sm">
            <Calendar className="w-4 h-4" />
            <span>Draw #{lastResult.drawNumber} • {new Date(lastResult.date).toLocaleDateString('he-IL')}</span>
          </div>
        </div>
        {lastResult.jackpot && (
            <div className="text-right">
                <p className="text-xs text-blue-300 uppercase tracking-wider">Jackpot</p>
                <p className="text-lg font-bold text-green-400">₪{lastResult.jackpot.toLocaleString()}</p>
            </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-3 mb-4">
        {lastResult.numbers.map((num, i) => (
          <NumberBall key={`win-${i}`} number={num} type="generated" delay={i * 0.1} />
        ))}
        <div className="border-l border-white/20 mx-2"></div>
        <NumberBall number={lastResult.bonus} type="bonus" delay={0.7} />
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs text-blue-300">
          <span>Official Result</span>
          {/* <span className="font-mono">{lastResult.drawNumber}</span> */}
      </div>
    </div>
  );
};

export default LastWinningNumbers;
