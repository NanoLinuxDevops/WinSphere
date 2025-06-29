import React from 'react';
import { TrendingUp, Calendar } from 'lucide-react';

const PredictionCard: React.FC = () => {
  const recentPredictions = [
    { date: '2024-01-15', numbers: [3, 14, 18, 22, 25, 33], bonus: 2, matched: 4 },
    { date: '2024-01-12', numbers: [8, 12, 26, 27, 34, 38], bonus: 36, matched: 3 },
    { date: '2024-01-09', numbers: [1, 14, 17, 26, 35, 39], bonus: 28, matched: 5 },
    { date: '2024-01-06', numbers: [1, 7, 8, 9, 11, 30], bonus: 4, matched: 2 },
    { date: '2024-01-03', numbers: [5, 13, 19, 24, 31, 37], bonus: 12, matched: 3 },
  ];

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center">
        <TrendingUp className="h-6 w-6 mr-2 text-green-400" />
        Recent Predictions
      </h3>
      
      <div className="space-y-4">
        {recentPredictions.map((prediction, index) => (
          <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center text-sm text-blue-200">
                <Calendar className="h-4 w-4 mr-1" />
                {prediction.date}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                prediction.matched >= 4 
                  ? 'bg-green-500/20 text-green-400' 
                  : prediction.matched >= 2 
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {prediction.matched} matches
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {prediction.numbers.map((number, numIndex) => (
                <div
                  key={numIndex}
                  className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                >
                  {number}
                </div>
              ))}
              <div className="w-px h-6 bg-white/30 mx-2"></div>
              <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {prediction.bonus}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictionCard;