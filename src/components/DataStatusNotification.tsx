import React from 'react';
import { X, Bell, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface DataStatusNotificationProps {
  type: NotificationType;
  title: string;
  message: string;
  timestamp?: Date;
  dataAge?: number;
  isVisible: boolean;
  isDismissible?: boolean;
  onDismiss?: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
}

const DataStatusNotification: React.FC<DataStatusNotificationProps> = ({
  type,
  message,
  dataAge,
  isVisible,
  isDismissible = true,
  onDismiss,
  onRetry,
  showRetry = false,
  autoHide = false,
  autoHideDelay = 5000,
}) => {
  const [isShowing, setIsShowing] = React.useState(isVisible);

  React.useEffect(() => {
    if (autoHide && isVisible) {
      const timer = setTimeout(() => {
        setIsShowing(false);
        setTimeout(() => onDismiss?.(), 300);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, isVisible, onDismiss]);

  React.useEffect(() => { setIsShowing(isVisible); }, [isVisible]);

  if (!isVisible) return null;

  const formatAge = (age?: number) => {
    if (age == null) return '';
    if (age < 1) return `${Math.round(age * 60)} minutes old`;
    return `${Math.round(age)} hours old`;
  };

  const label = dataAge != null
    ? `Using cached data · ${formatAge(dataAge)}`
    : message;

  return (
    <div
      className={`
        fixed bottom-6 left-6 z-50
        transition-all duration-300 ease-in-out
        ${isShowing ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
    >
      <div className="flex items-center gap-2 bg-[#1D1D1F] text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
        {isDismissible && onDismiss && (
          <button onClick={onDismiss} className="text-white/60 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <span>{label}</span>
        <Bell className="h-3.5 w-3.5 text-amber-400" />
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className="ml-1 bg-white/10 hover:bg-white/20 text-white px-2 py-0.5 rounded-lg text-xs transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default DataStatusNotification;
