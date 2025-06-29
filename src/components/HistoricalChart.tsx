import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart3 } from 'lucide-react';

const HistoricalChart: React.FC = () => {
  const data = [
    { month: 'Jan', accuracy: 85, predictions: 42 },
    { month: 'Feb', accuracy: 87, predictions: 38 },
    { month: 'Mar', accuracy: 83, predictions: 45 },
    { month: 'Apr', accuracy: 89, predictions: 41 },
    { month: 'May', accuracy: 91, predictions: 39 },
    { month: 'Jun', accuracy: 88, predictions: 43 },
    { month: 'Jul', accuracy: 87, predictions: 40 },
    { month: 'Aug', accuracy: 92, predictions: 37 },
    { month: 'Sep', accuracy: 86, predictions: 44 },
    { month: 'Oct', accuracy: 89, predictions: 42 },
    { month: 'Nov', accuracy: 90, predictions: 38 },
    { month: 'Dec', accuracy: 87, predictions: 41 },
  ];

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center">
        <BarChart3 className="h-6 w-6 mr-2 text-blue-400" />
        Model Performance
      </h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="month" 
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
            />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#3B82F6"
              strokeWidth={3}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-green-400">89.2%</p>
          <p className="text-xs text-blue-200">Avg Accuracy</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-400">492</p>
          <p className="text-xs text-blue-200">Total Predictions</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-400">+2.3%</p>
          <p className="text-xs text-blue-200">Improvement</p>
        </div>
      </div>
    </div>
  );
};

export default HistoricalChart;