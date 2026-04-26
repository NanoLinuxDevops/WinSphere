import React from 'react';
import { RefreshCw, Database, BarChart2 } from 'lucide-react';
import type { TrainingStatus, BacktestResult } from '../services/lotteryPredictor';

interface ModelMetricsProps {
  lastUpdated?: Date | null;
  dataPoints?: number;
  trainingStatus?: TrainingStatus;
  backtestResult?: BacktestResult | null;
}

const ModelMetrics: React.FC<ModelMetricsProps> = ({
  lastUpdated,
  dataPoints,
  trainingStatus,
  backtestResult,
}) => {
  const formatLastUpdated = (date?: Date | null) => {
    if (!date) return 'Now';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    return `${diffHrs}h ago`;
  };

  // Show real backtested avg-hits, or training progress, or a pending state
  const avgHitsLabel = (): string => {
    if (trainingStatus?.isTraining) {
      return `Training… ${trainingStatus.epoch}/${trainingStatus.totalEpochs}`;
    }
    if (backtestResult && backtestResult.testDrawsUsed > 0) {
      return `${backtestResult.avgHits.toFixed(2)} / 6`;
    }
    return '—';
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
      value: `+${(dataPoints ?? 0).toLocaleString()}`,
      icon: <Database className="h-5 w-5 text-[#5E5CE6]" />,
      iconBg: 'bg-[#EEEEFF]',
    },
    {
      label: 'AVG HITS / DRAW',
      value: avgHitsLabel(),
      icon: <BarChart2 className="h-5 w-5 text-[#34C759]" />,
      iconBg: 'bg-[#E8F9EE]',
    },
  ];

  const trainingProgress =
    trainingStatus?.isTraining && trainingStatus.totalEpochs > 0
      ? Math.round((trainingStatus.epoch / trainingStatus.totalEpochs) * 100)
      : null;

  return (
    <div className="flex flex-col gap-3">
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

      {trainingProgress !== null && (
        <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-sm px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6E6E73]">
              LSTM Training
            </p>
            <p className="text-xs font-bold text-[#5E5CE6]">{trainingProgress}%</p>
          </div>
          <div className="w-full bg-[#F2F2F7] rounded-full h-1.5">
            <div
              className="bg-[#5E5CE6] h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${trainingProgress}%` }}
            />
          </div>
          {trainingStatus && trainingStatus.loss > 0 && (
            <p className="text-[10px] text-[#6E6E73] mt-1.5">
              loss: {trainingStatus.loss.toFixed(4)} · val_loss: {trainingStatus.valLoss.toFixed(4)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelMetrics;
