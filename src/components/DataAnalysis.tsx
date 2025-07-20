import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, BarChart3, Target, Brain } from 'lucide-react';
import { IsraeliLotteryAPI } from '../services/israeliLotteryAPI';

interface DataAnalysisProps {
  realDataCount: number;
}

const DataAnalysis: React.FC<DataAnalysisProps> = ({ realDataCount }) => {
  const [frequencyData, setFrequencyData] = useState<Array<{number: number, frequency: number}>>([]);
  const [trendData, setTrendData] = useState<Array<{draw: number, avgNumber: number}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataStats, setDataStats] = useState({
    totalDraws: 0,
    dateRange: '',
    mostFrequent: 0,
    leastFrequent: 0,
    avgSum: 0
  });

  useEffect(() => {
    analyzeRealData();
  }, [realDataCount]);

  const analyzeRealData = async () => {
    try {
      setIsLoading(true);
      
      // Load real data from CSV
      const results = await IsraeliLotteryAPI.loadFromFile();
      
      if (results.length > 0) {
        // Frequency analysis
        const frequency = IsraeliLotteryAPI.analyzeFrequency(results);
        const freqData = Array.from(frequency.entries())
          .map(([num, freq]) => ({ number: num, frequency: freq }))
          .sort((a, b) => b.frequency - a.frequency);
        
        setFrequencyData(freqData);
        
        // Trend analysis - average number per draw
        const trendAnalysis = results.slice(-50).map((result, index) => ({
          draw: result.drawNumber,
          avgNumber: result.numbers.reduce((sum, num) => sum + num, 0) / 6
        }));
        
        setTrendData(trendAnalysis);
        
        // Statistics
        const sortedFreq = freqData.sort((a, b) => b.frequency - a.frequency);
        const allSums = results.map(r => r.numbers.reduce((sum, num) => sum + num, 0));
        const avgSum = allSums.reduce((sum, total) => sum + total, 0) / allSums.length;
        
        setDataStats({
          totalDraws: results.length,
          dateRange: `${results[results.length - 1]?.date} - ${results[0]?.date}`,
          mostFrequent: sortedFreq[0]?.number || 0,
          leastFrequent: sortedFreq[sortedFreq.length - 1]?.number || 0,
          avgSum: Math.round(avgSum)
        });
        
        console.log(`📊 Analyzed ${results.length} real lottery draws from Pais.co.il`);
      }
    } catch (error) {
      console.error('Failed to analyze real data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-white">Analyzing real lottery data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Statistics */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center">
          <BarChart3 className="h-6 w-6 mr-2 text-blue-400" />
          Real Data Analysis - Pais.co.il
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{dataStats.totalDraws}</div>
            <div className="text-sm text-blue-200">Total Draws</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{dataStats.mostFrequent}</div>
            <div className="text-sm text-blue-200">Most Frequent</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{dataStats.leastFrequent}</div>
            <div className="text-sm text-blue-200">Least Frequent</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{dataStats.avgSum}</div>
            <div className="text-sm text-blue-200">Avg Sum</div>
          </div>
        </div>
        
        <div className="text-sm text-blue-200">
          <p><strong>Date Range:</strong> {dataStats.dateRange}</p>
          <p><strong>Data Source:</strong> Real historical data from Pais.co.il</p>
          <p><strong>Algorithm Status:</strong> LSTM + ARIMA trained on real patterns</p>
        </div>
      </div>

      {/* Frequency Chart */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2 text-green-400" />
          Number Frequency Analysis (Top 20)
        </h4>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={frequencyData.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="number" 
                stroke="rgba(255,255,255,0.7)"
                fontSize={12}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.7)"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white'
                }}
                formatter={(value: number) => [`${value} times`, 'Frequency']}
                labelFormatter={(label: number) => `Number ${label}`}
              />
              <Bar 
                dataKey="frequency" 
                fill="url(#frequencyGradient)"
                radius={[4, 4, 0, 0]}
              />
              <defs>
                <linearGradient id="frequencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#1E40AF" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-purple-400" />
          Average Number Trend (Last 50 Draws)
        </h4>
        
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="draw" 
                stroke="rgba(255,255,255,0.7)"
                fontSize={12}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.7)"
                fontSize={12}
                domain={[15, 25]}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white'
                }}
                formatter={(value: number) => [value.toFixed(1), 'Average']}
                labelFormatter={(label: number) => `Draw ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="avgNumber" 
                stroke="#8B5CF6" 
                strokeWidth={2}
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#A855F7' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Algorithm Insights */}
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
        <h4 className="text-lg font-bold text-white mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-yellow-400" />
          AI Algorithm Insights
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-xl p-4">
            <h5 className="font-semibold text-white mb-2">LSTM Neural Network</h5>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Analyzes sequences of {dataStats.totalDraws} historical draws</li>
              <li>• Learns patterns in number combinations</li>
              <li>• Uses frequency analysis for confidence scoring</li>
              <li>• Validates predictions against realistic patterns</li>
            </ul>
          </div>
          
          <div className="bg-white/5 rounded-xl p-4">
            <h5 className="font-semibold text-white mb-2">ARIMA Time Series</h5>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Processes {dataStats.totalDraws * 6} individual number occurrences</li>
              <li>• Identifies trends and seasonal patterns</li>
              <li>• Uses autocorrelation for prediction</li>
              <li>• Complements LSTM with statistical analysis</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl border border-blue-500/30">
          <p className="text-sm text-white">
            <strong>🎯 Prediction Method:</strong> The hybrid model combines LSTM pattern recognition (70%) 
            with ARIMA statistical forecasting (30%) to generate intelligent predictions based on 
            real historical data from Pais.co.il lottery archive.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataAnalysis;