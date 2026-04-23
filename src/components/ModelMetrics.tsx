import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, CheckCircle } from 'lucide-react';
import { HybridLotteryPredictor } from '../services/lotteryPredictor';

interface ModelMetricsProps {
  lastUpdated?: Date | null;
  dataPoints?: number;
}

const ModelMetrics: React.FC<ModelMetricsProps> = ({ lastUpdated, dataPoints }) => {
  const [accuracy, setAccuracy] = useState(89);

  useEffect(() => {
    const predictor = new HybridLotteryPredictor();
    const metrics = predictor.getModelMetrics();
    setAccuracy(Math.round(metrics.accuracy));
  }, []);

  const formatLastUpdated = (date?: Date | null) => {
    if (!date) return 'Now';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    return `${diffHrs}h ago`;
  };

  const stats = [
    {
      label: 'LAST UPDATED',
      value: formatLastUpdated(lastUpdated),
      icon: <RefreshCw className="h-5 w-5 text-[#5E5CE6]" />,
      iconBg: 'bg-[#EEEEFF]',
    },
    {
      label: 'DATA POINTS',
      value: `+${(dataPoints ?? 12482).toLocaleString()}`,
      icon: <Database className="h-5 w-5 text-[#5E5CE6]" />,
      iconBg: 'bg-[#EEEEFF]',
    },
    {
      label: 'ACCURACY',
      value: `${accuracy}%`,
      icon: <CheckCircle className="h-5 w-5 text-[#34C759]" />,
      iconBg: 'bg-[#E8F9EE]',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((s, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E5E5EA] shadow-sm px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73] mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-[#1D1D1F]">{s.value}</p>
          </div>
          <div className={`${s.iconBg} rounded-xl p-2.5`}>
            {s.icon}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ModelMetrics;
