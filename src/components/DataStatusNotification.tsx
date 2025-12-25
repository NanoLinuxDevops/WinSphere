import React from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Wifi, Server, Shield, X } from 'lucide-react';

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
  autoHideDelay?: number; // milliseconds
}

const DataStatusNotification: React.FC<DataStatusNotificationProps> = ({
  type,
  title,
  message,
  timestamp,
  dataAge,
  isVisible,
  isDismissible = true,
  onDismiss,
  onRetry,
  showRetry = false,
  autoHide = false,
  autoHideDelay = 5000
}) => {
  const [isShowing, setIsShowing] = React.useState(isVisible);

  // Auto-hide functionality
  React.useEffect(() => {
    if (autoHide && isVisible) {
      const timer = setTimeout(() => {
        setIsShowing(false);
        setTimeout(() => onDismiss?.(), 300); // Wait for animation
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay, isVisible, onDismiss]);

  React.useEffect(() => {
    setIsShowing(isVisible);
  }, [isVisible]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case 'info':
        return <RefreshCw className="h-5 w-5 text-blue-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          container: 'bg-green-500/20 border-green-500/30 text-green-200',
          title: 'text-green-100',
          message: 'text-green-200'
        };
      case 'warning':
        return {
          container: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-200',
          title: 'text-yellow-100',
          message: 'text-yellow-200'
        };
      case 'error':
        return {
          container: 'bg-red-500/20 border-red-500/30 text-red-200',
          title: 'text-red-100',
          message: 'text-red-200'
        };
      case 'info':
        return {
          container: 'bg-blue-500/20 border-blue-500/30 text-blue-200',
          title: 'text-blue-100',
          message: 'text-blue-200'
        };
      default:
        return {
          container: 'bg-gray-500/20 border-gray-500/30 text-gray-200',
          title: 'text-gray-100',
          message: 'text-gray-200'
        };
    }
  };

  const styles = getStyles();

  const formatDataAge = (age?: number): string => {
    if (!age) return '';
    if (age < 1) return `${Math.round(age * 60)} minutes ago`;
    if (age < 24) return `${Math.round(age)} hours ago`;
    const days = Math.round(age / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  };

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full
      transform transition-all duration-300 ease-in-out
      ${isShowing ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className={`
        border rounded-lg p-4 backdrop-blur-md shadow-lg
        ${styles.container}
      `}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className={`text-sm font-medium ${styles.title}`}>
                  {title}
                </h4>
                <p className={`text-sm mt-1 ${styles.message}`}>
                  {message}
                </p>
                
                {/* Additional metadata */}
                {(timestamp || dataAge !== undefined) && (
                  <div className="flex items-center space-x-3 mt-2 text-xs opacity-80">
                    {timestamp && (
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{timestamp.toLocaleTimeString()}</span>
                      </div>
                    )}
                    {dataAge !== undefined && (
                      <div className="flex items-center space-x-1">
                        <span>Data: {formatDataAge(dataAge)}</span>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Action buttons */}
                {showRetry && onRetry && (
                  <button
                    onClick={onRetry}
                    className={`
                      mt-3 px-3 py-1 text-xs font-medium rounded
                      ${type === 'error' 
                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }
                      transition-colors duration-200
                    `}
                  >
                    <RefreshCw className="h-3 w-3 inline mr-1" />
                    Retry
                  </button>
                )}
              </div>
              
              {/* Dismiss button */}
              {isDismissible && onDismiss && (
                <button
                  onClick={onDismiss}
                  className="flex-shrink-0 ml-2 text-current opacity-60 hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Auto-hide indicator */}
        {autoHide && (
          <div className="mt-2 flex justify-center">
            <div className="w-2 h-2 bg-current rounded-full animate-pulse opacity-50"></div>
          </div>
        )}
      </div>
      

    </div>
  );
};

export default DataStatusNotification;