import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Generate pseudo-frequency data for numbers 1-37
function buildFrequencyData(draws: number = 500) {
  // Seeded pseudo-random heights that look realistic
  const seed = [
    18,22,15,31,27,19,24,30,17,23,
    29,21,16,26,33,20,25,28,14,32,
    18,22,27,19,24,30,17,23,29,21,
    26,33,20,25,28,14,32,
  ];
  return seed.slice(0, 37).map((v, i) => ({ num: i + 1, freq: v }));
}

interface HistoricalChartProps {
  lotteryData?: { numbers: number[] }[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-[#E5E5EA] rounded-lg px-3 py-2 shadow text-sm text-[#1D1D1F]">
        <p className="font-semibold">#{payload[0].payload.num}</p>
        <p className="text-[#6E6E73]">{payload[0].value} draws</p>
      </div>
    );
  }
  return null;
};

const HistoricalChart: React.FC<HistoricalChartProps> = ({ lotteryData }) => {
  const [range, setRange] = useState<'500' | '100'>('500');

  // If real data provided, compute from it; otherwise use mock
  const data = React.useMemo(() => {
    if (lotteryData && lotteryData.length > 0) {
      const counts = Array(37).fill(0);
      const subset = range === '100' ? lotteryData.slice(0, 100) : lotteryData.slice(0, 500);
      subset.forEach(d => d.numbers.forEach(n => { if (n >= 1 && n <= 37) counts[n - 1]++; }));
      return counts.map((c, i) => ({ num: i + 1, freq: c }));
    }
    return buildFrequencyData();
  }, [lotteryData, range]);

  const maxFreq = Math.max(...data.map(d => d.freq));

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="bg-[#5E5CE6] text-white text-xs font-semibold px-3 py-1 rounded-full cursor-pointer select-none" onClick={() => setRange('500')}>
            Last 500
          </span>
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full cursor-pointer select-none transition-colors ${range === '100' ? 'bg-[#5E5CE6] text-white' : 'bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#EEEEFF] hover:text-[#5E5CE6]'}`}
            onClick={() => setRange('100')}
          >
            Last 100
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-[#1D1D1F]">Number Frequency Analysis</p>
          <p className="text-xs text-[#6E6E73]">Relative probability based on the last {range} draws</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-52 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%" margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="num"
              tick={{ fontSize: 10, fill: '#6E6E73' }}
              tickLine={false}
              axisLine={false}
              interval={4}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(94,92,230,0.06)' }} />
            <Bar dataKey="freq" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.freq >= maxFreq * 0.85 ? '#5E5CE6' : '#CCCBF7'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HistoricalChart;
