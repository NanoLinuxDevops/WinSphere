import React from 'react';
import { Brain, Download, CheckCircle, Cog, Database, AlertCircle, Clock, RefreshCw, Wifi, Shield, Server } from 'lucide-react';
import { DataRefreshError } from '../services/dataRefreshService';

type DataRefreshStatus = 'idle' | 'downloading' | 'validating' | 'processing' | 'updating' | 'complete' | 'error';

interface LoadingSpinnerProps {
  // Enhanced props for data refresh progress
  isRefreshingData?: boolean;
  refreshStatus?: DataRefreshStatus;
  progress?: number; // 0-100
  statusMessage?: string;
  error?: string;
  errorDetails?: DataRefreshError;
  estimatedTimeRemaining?: number; // seconds
  retryAttempts?: number;
  canRetry?: boolean;
  onRetry?: () => void;
  // Original props for backward compatibility
  message?: string;
  subMessage?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  isRefreshingData = false,
  refreshStatus = 'idle',
  progress = 0,
  statusMessage,
  error,
  errorDetails,
  estimatedTimeRemaining,
  retryAttempts = 0,
  canRetry = false,
  onRetry,
  message = "AI is analyzing patterns...",
  subMessage = "Generating optimal number combinations"
}) => {
  // Get stage-specific icon and styling
  const getStageIcon = (status: DataRefreshStatus) => {
    switch (status) {
      case 'downloading':
        return <Download className="h-6 w-6 text-blue-500 animate-bounce" />;
      case 'validating':
        return <CheckCircle className="h-6 w-6 text-green-500 animate-pulse" />;
      case 'processing':
        return <Cog className="h-6 w-6 text-purple-500 animate-spin" />;
      case 'updating':
        return <Database className="h-6 w-6 text-orange-500 animate-pulse" />;
      case 'complete':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return <Brain className="h-6 w-6 text-blue-500 animate-pulse" />;
    }
  };

  // Get stage-specific messages
  const getStageMessages = (status: DataRefreshStatus) => {
    const messages = {
      downloading: {
        title: "Downloading Latest Data",
        subtitle: "Fetching fresh lottery results from Pais.co.il"
      },
      validating: {
        title: "Validating Data",
        subtitle: "Checking data structure and integrity"
      },
      processing: {
        title: "Processing Data",
        subtitle: "Parsing and organizing lottery results"
      },
      updating: {
        title: "Updating Models",
        subtitle: "Refreshing AI prediction algorithms"
      },
      complete: {
        title: "Refresh Complete",
        subtitle: "Data successfully updated"
      },
      error: {
        title: "Refresh Failed",
        subtitle: error || "An error occurred during data refresh"
      },
      idle: {
        title: message,
        subtitle: subMessage
      }
    };
    return messages[status] || messages.idle;
  };

  // Format estimated time remaining
  const formatTimeRemaining = (seconds?: number): string => {
    if (!seconds) return '';
    if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`;
    const minutes = Math.ceil(seconds / 60);
    return `~${minutes}m remaining`;
  };

  // Get progress bar color based on status
  const getProgressColor = (status: DataRefreshStatus): string => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-500';
      case 'validating':
        return 'bg-green-500';
      case 'processing':
        return 'bg-purple-500';
      case 'updating':
        return 'bg-orange-500';
      case 'complete':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Get error-specific icon
  const getErrorIcon = (errorType?: string) => {
    switch (errorType) {
      case 'network_error':
        return <Wifi className="h-5 w-5 text-red-400" />;
      case 'timeout_error':
        return <Clock className="h-5 w-5 text-red-400" />;
      case 'server_error':
        return <Server className="h-5 w-5 text-red-400" />;
      case 'cors_error':
        return <Shield className="h-5 w-5 text-red-400" />;
      case 'validation_error':
        return <CheckCircle className="h-5 w-5 text-red-400" />;
      case 'processing_error':
        return <Cog className="h-5 w-5 text-red-400" />;
      default:
        return <AlertCircle className="h-5 w-5 text-red-400" />;
    }
  };

  // Get error-specific title
  const getErrorTitle = (errorType?: string): string => {
    switch (errorType) {
      case 'network_error':
        return 'Network Connection Error';
      case 'timeout_error':
        return 'Request Timeout';
      case 'server_error':
        return 'Server Error';
      case 'cors_error':
        return 'Access Restricted';
      case 'validation_error':
        return 'Data Validation Failed';
      case 'processing_error':
        return 'Data Processing Error';
      default:
        return 'Refresh Error';
    }
  };

  const stageMessages = getStageMessages(refreshStatus);
  const showProgress = isRefreshingData && progress > 0;
  const showTimeRemaining = estimatedTimeRemaining && estimatedTimeRemaining > 0;

  return (
    <div className="flex flex-col items-center justify-center py-12">
      {/* Main spinner/icon container */}
      <div className="relative mb-6">
        <div className={`w-16 h-16 border-4 rounded-full ${
          refreshStatus === 'error' 
            ? 'border-red-200 border-t-red-500' 
            : refreshStatus === 'complete'
            ? 'border-green-200 border-t-green-500'
            : 'border-blue-200 border-t-blue-500'
        } ${refreshStatus !== 'complete' && refreshStatus !== 'error' ? 'animate-spin' : ''}`}></div>
        <div className="absolute inset-0 flex items-center justify-center">
          {getStageIcon(refreshStatus)}
        </div>
      </div>

      {/* Progress bar for data refresh */}
      {showProgress && (
        <div className="w-64 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-blue-200">Progress</span>
            <span className="text-sm text-white font-medium">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(refreshStatus)}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Status messages */}
      <div className="text-center max-w-md">
        <p className="text-white text-lg font-medium mb-2">
          {statusMessage || stageMessages.title}
        </p>
        <p className="text-blue-200 text-sm mb-3">
          {stageMessages.subtitle}
        </p>

        {/* Time remaining indicator */}
        {showTimeRemaining && (
          <div className="flex items-center justify-center text-blue-300 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            <span>{formatTimeRemaining(estimatedTimeRemaining)}</span>
          </div>
        )}

        {/* Enhanced error details with retry options */}
        {refreshStatus === 'error' && (
          <div className="mt-4 space-y-3">
            {/* Main error message */}
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {getErrorIcon(errorDetails?.type)}
                </div>
                <div className="flex-1 text-left">
                  <h4 className="text-red-200 font-medium text-sm mb-1">
                    {getErrorTitle(errorDetails?.type)}
                  </h4>
                  <p className="text-red-200 text-sm mb-2">
                    {error || 'An unexpected error occurred'}
                  </p>
                  
                  {/* Additional error details */}
                  {errorDetails?.details && (
                    <p className="text-red-300 text-xs opacity-80">
                      Details: {errorDetails.details}
                    </p>
                  )}
                  
                  {/* Retry attempts info */}
                  {retryAttempts > 0 && (
                    <p className="text-red-300 text-xs mt-1">
                      Failed after {retryAttempts} retry attempt{retryAttempts !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Retry section */}
            {canRetry && onRetry && (
              <div className="flex flex-col items-center space-y-2">
                <button
                  onClick={onRetry}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Try Again</span>
                </button>
                
                {errorDetails?.estimatedRetryTime && (
                  <p className="text-blue-300 text-xs">
                    Recommended wait time: {formatTimeRemaining(errorDetails.estimatedRetryTime)}
                  </p>
                )}
              </div>
            )}

            {/* Fallback info */}
            {!canRetry && (
              <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-yellow-400" />
                  <p className="text-yellow-200 text-sm">
                    Using cached data to ensure predictions are still available
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stage indicators for multi-stage process */}
      {isRefreshingData && refreshStatus !== 'error' && (
        <div className="flex items-center space-x-2 mt-6">
          {['downloading', 'validating', 'processing', 'updating'].map((stage, index) => {
            const isActive = refreshStatus === stage;
            const isCompleted = ['downloading', 'validating', 'processing', 'updating'].indexOf(refreshStatus) > index;
            const isUpcoming = ['downloading', 'validating', 'processing', 'updating'].indexOf(refreshStatus) < index;
            
            return (
              <div key={stage} className="flex items-center">
                <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  isCompleted 
                    ? 'bg-green-500' 
                    : isActive 
                    ? 'bg-blue-500 animate-pulse' 
                    : isUpcoming
                    ? 'bg-white/20'
                    : 'bg-white/20'
                }`}></div>
                {index < 3 && (
                  <div className={`w-8 h-0.5 transition-all duration-300 ${
                    isCompleted ? 'bg-green-500' : 'bg-white/20'
                  }`}></div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LoadingSpinner;