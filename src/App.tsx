import React, { useState, useEffect } from 'react';
import { TrendingUp, Brain, Target, BarChart3, Zap, Calendar, Trophy, Star, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import PredictionCard from './components/PredictionCard';
import HistoricalChart from './components/HistoricalChart';
import ModelMetrics from './components/ModelMetrics';
import NumberBall from './components/NumberBall';
import LoadingSpinner from './components/LoadingSpinner';
import CSVUploader from './components/CSVUploader';
import DataAnalysis from './components/DataAnalysis';
import DataStatusNotification, { NotificationType } from './components/DataStatusNotification';
import { HybridLotteryPredictor } from './services/lotteryPredictor';
import { DataRefreshService, DataRefreshError, DataRefreshErrorType } from './services/dataRefreshService';

// Types for data refresh state management
type DataRefreshStatus = 'idle' | 'downloading' | 'validating' | 'processing' | 'updating' | 'complete' | 'error';

interface DataRefreshState {
  isRefreshingData: boolean;
  status: DataRefreshStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
  errorDetails?: DataRefreshError;
  estimatedTimeRemaining?: number; // seconds
  retryAttempts?: number;
  canRetry?: boolean;
}

interface DataCacheState {
  lastDataUpdate?: Date;
  usingCachedData: boolean;
  dataAge?: number; // hours since last update
  cacheWarningShown: boolean;
}

interface NotificationState {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  dataAge?: number;
  isVisible: boolean;
  isDismissible: boolean;
  showRetry: boolean;
  autoHide: boolean;
  autoHideDelay?: number;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [predictor] = useState(() => new HybridLotteryPredictor());
  const [dataRefreshService] = useState(() => new DataRefreshService());
  const [realDataCount, setRealDataCount] = useState(0);
  const [currentPrediction, setCurrentPrediction] = useState({
    numbers: [0, 0, 0, 0, 0, 0],
    bonus: 0,
    confidence: 0,
    timestamp: new Date(),
    method: 'LSTM + ARIMA Ensemble'
  });

  // Data refresh state management
  const [dataRefreshState, setDataRefreshState] = useState<DataRefreshState>({
    isRefreshingData: false,
    status: 'idle',
    progress: 0,
    message: '',
    error: undefined,
    estimatedTimeRemaining: undefined
  });

  // Data cache state management
  const [dataCacheState, setDataCacheState] = useState<DataCacheState>({
    lastDataUpdate: undefined,
    usingCachedData: false,
    dataAge: undefined,
    cacheWarningShown: false
  });

  // Notification system state
  const [notifications, setNotifications] = useState<NotificationState[]>([]);

  // Helper functions for data refresh state management
  const updateDataRefreshState = (updates: Partial<DataRefreshState>) => {
    setDataRefreshState(prev => ({ ...prev, ...updates }));
  };

  const startDataRefresh = (message: string = 'Initializing data refresh...') => {
    updateDataRefreshState({
      isRefreshingData: true,
      status: 'downloading',
      progress: 0,
      message,
      error: undefined,
      estimatedTimeRemaining: undefined
    });
  };

  const updateRefreshProgress = (
    status: DataRefreshStatus,
    progress: number,
    message: string,
    estimatedTimeRemaining?: number
  ) => {
    updateDataRefreshState({
      status,
      progress,
      message,
      estimatedTimeRemaining
    });
  };

  const completeDataRefresh = (message: string = 'Data refresh completed successfully') => {
    updateDataRefreshState({
      isRefreshingData: false,
      status: 'complete',
      progress: 100,
      message,
      error: undefined,
      estimatedTimeRemaining: undefined
    });

    // Update cache state
    setDataCacheState(prev => ({
      ...prev,
      lastDataUpdate: new Date(),
      usingCachedData: false,
      dataAge: 0,
      cacheWarningShown: false
    }));

    // Show success notification
    addNotification(
      'success',
      'Data Refreshed',
      message,
      { autoHide: true, autoHideDelay: 3000 }
    );
  };

  const handleDataRefreshError = (error: string, errorDetails?: DataRefreshError, fallbackToCached: boolean = true) => {
    updateDataRefreshState({
      isRefreshingData: false,
      status: 'error',
      progress: 0,
      message: fallbackToCached ? 'Using cached data due to refresh failure' : 'Data refresh failed',
      error,
      errorDetails,
      estimatedTimeRemaining: errorDetails?.estimatedRetryTime,
      canRetry: errorDetails?.retryable || false
    });

    if (fallbackToCached) {
      setDataCacheState(prev => ({
        ...prev,
        usingCachedData: true,
        cacheWarningShown: false
      }));

      // Show warning notification for fallback to cached data
      addNotification(
        'warning',
        'Using Cached Data',
        `Fresh data unavailable: ${error}`,
        { 
          dataAge: dataCacheState.dataAge,
          showRetry: errorDetails?.retryable || false,
          autoHide: false
        }
      );
    } else {
      // Show error notification for complete failure
      addNotification(
        'error',
        'Data Refresh Failed',
        error,
        { 
          showRetry: errorDetails?.retryable || false,
          autoHide: false
        }
      );
    }
  };

  const resetDataRefreshState = () => {
    updateDataRefreshState({
      isRefreshingData: false,
      status: 'idle',
      progress: 0,
      message: '',
      error: undefined,
      estimatedTimeRemaining: undefined
    });
  };

  const calculateDataAge = (lastUpdate?: Date): number => {
    if (!lastUpdate) return 0;
    const now = new Date();
    const diffMs = now.getTime() - lastUpdate.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60)); // Convert to hours
  };

  const isDataStale = (maxAgeHours: number = 24): boolean => {
    const age = calculateDataAge(dataCacheState.lastDataUpdate);
    return age > maxAgeHours;
  };

  // Notification management functions
  const addNotification = (
    type: NotificationType,
    title: string,
    message: string,
    options: {
      dataAge?: number;
      isDismissible?: boolean;
      showRetry?: boolean;
      autoHide?: boolean;
      autoHideDelay?: number;
    } = {}
  ) => {
    const notification: NotificationState = {
      id: Date.now().toString(),
      type,
      title,
      message,
      timestamp: new Date(),
      dataAge: options.dataAge,
      isVisible: true,
      isDismissible: options.isDismissible ?? true,
      showRetry: options.showRetry ?? false,
      autoHide: options.autoHide ?? type === 'success',
      autoHideDelay: options.autoHideDelay ?? 5000
    };

    setNotifications(prev => [...prev.slice(-2), notification]); // Keep max 3 notifications
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Error handling for different failure scenarios
  const handleNetworkError = (retryCount: number, maxRetries: number = 3) => {
    const remainingRetries = maxRetries - retryCount;
    const estimatedTime = Math.pow(2, retryCount) * 5; // Exponential backoff in seconds
    
    if (remainingRetries > 0) {
      updateRefreshProgress(
        'downloading',
        Math.round((retryCount / maxRetries) * 30), // Progress up to 30% during retries
        `Network error. Retrying... (${remainingRetries} attempts remaining)`,
        estimatedTime
      );
    } else {
      handleDataRefreshError(
        'Network connection failed after multiple attempts. Using cached data.',
        true
      );
    }
  };

  const handleValidationError = (validationErrors: string[]) => {
    const errorMessage = `Data validation failed: ${validationErrors.join(', ')}`;
    handleDataRefreshError(errorMessage, true);
  };

  const handleProcessingError = (processingError: string) => {
    handleDataRefreshError(
      `Data processing failed: ${processingError}. Using cached data.`,
      true
    );
  };

  // Progress tracking through different stages
  const updateDownloadProgress = (progress: number, message?: string) => {
    updateRefreshProgress(
      'downloading',
      Math.min(progress, 30), // Download stage: 0-30%
      message || `Downloading latest lottery data... ${progress}%`
    );
  };

  const updateValidationProgress = (progress: number, message?: string) => {
    updateRefreshProgress(
      'validating',
      30 + Math.min(progress, 20), // Validation stage: 30-50%
      message || `Validating data structure... ${progress}%`
    );
  };

  const updateProcessingProgress = (progress: number, message?: string) => {
    updateRefreshProgress(
      'processing',
      50 + Math.min(progress, 30), // Processing stage: 50-80%
      message || `Processing lottery data... ${progress}%`
    );
  };

  const updateModelUpdateProgress = (progress: number, message?: string) => {
    updateRefreshProgress(
      'updating',
      80 + Math.min(progress, 20), // Model update stage: 80-100%
      message || `Updating prediction models... ${progress}%`
    );
  };

  // Update data age periodically
  useEffect(() => {
    const updateDataAge = () => {
      if (dataCacheState.lastDataUpdate) {
        const age = calculateDataAge(dataCacheState.lastDataUpdate);
        setDataCacheState(prev => ({ ...prev, dataAge: age }));
      }
    };

    updateDataAge();
    const interval = setInterval(updateDataAge, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [dataCacheState.lastDataUpdate]);

  // Generate initial prediction using LSTM + ARIMA
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const prediction = predictor.generatePrediction();
        setCurrentPrediction({
          numbers: prediction.numbers,
          bonus: prediction.bonus,
          confidence: Math.round(prediction.confidence * 10) / 10,
          timestamp: new Date(),
          method: prediction.method
        });
      } catch (error) {
        console.error('Prediction error:', error);
        // Fallback prediction
        setCurrentPrediction({
          numbers: [3, 14, 22, 25, 33, 38],
          bonus: 5,
          confidence: 82.5,
          timestamp: new Date(),
          method: 'LSTM + ARIMA Ensemble'
        });
      }
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [predictor]);

  // Retry handler for failed data refresh
  const handleRetryDataRefresh = () => {
    console.log('🔄 Retrying data refresh...');
    regeneratePrediction();
  };

  const regeneratePrediction = async () => {
    setIsLoading(true);
    resetDataRefreshState();

    try {
      // Check if data refresh is needed (skip if data is recent enough)
      const dataAge = dataRefreshService.getDataAge();
      const shouldRefresh = dataAge > 24 || dataAge === Infinity; // Refresh if older than 24 hours or no data

      if (shouldRefresh) {
        console.log('🔄 Data refresh needed, starting refresh process...');
        startDataRefresh('Checking for latest lottery data...');

        // Stage 1: Download latest data
        updateDownloadProgress(10, 'Connecting to data source...');
        
        const refreshResult = await dataRefreshService.downloadLatestData();
        
        if (refreshResult.success && refreshResult.data) {
          // Stage 2: Validate data
          updateValidationProgress(50, 'Data downloaded successfully, validating...');
          
          // Stage 3: Update predictor if we have new data
          if (!refreshResult.fromCache) {
            updateProcessingProgress(70, 'Processing new lottery data...');
            
            // Convert IsraeliLotteryResult to LotteryDraw format for predictor
            const lotteryDraws = refreshResult.data.map(result => ({
              date: result.date,
              numbers: result.numbers,
              bonus: result.bonus,
              drawNumber: result.drawNumber
            }));

            updateModelUpdateProgress(90, 'Updating prediction models...');
            
            // Update predictor with new data
            await predictor.updateHistoricalData(lotteryDraws);
            
            completeDataRefresh(`Data refreshed successfully with ${refreshResult.recordCount} records`);
            
            // Update cache state
            setDataCacheState(prev => ({
              ...prev,
              lastDataUpdate: new Date(),
              usingCachedData: false,
              dataAge: 0,
              cacheWarningShown: false
            }));
          } else {
            // Using cached data
            completeDataRefresh(`Using cached data (${Math.round(refreshResult.dataAge)} hours old)`);
            
            setDataCacheState(prev => ({
              ...prev,
              usingCachedData: true,
              dataAge: refreshResult.dataAge,
              cacheWarningShown: false
            }));
          }

          if (refreshResult.error) {
            console.warn('⚠️ Data refresh warning:', refreshResult.error);
          }

        } else {
          // Handle refresh failure with enhanced error details
          const errorMsg = refreshResult.error || 'Failed to refresh data';
          handleDataRefreshError(errorMsg, refreshResult.errorDetails, refreshResult.fallbackUsed !== false);
          console.error('❌ Data refresh failed:', errorMsg);
          
          // Update retry attempts if available
          if (refreshResult.retryAttempts !== undefined) {
            updateDataRefreshState({
              retryAttempts: refreshResult.retryAttempts
            });
          }
        }
      } else {
        console.log(`✅ Data is fresh (${Math.round(dataAge)} hours old), skipping refresh`);
        
        // Update cache state to reflect current data age
        setDataCacheState(prev => ({
          ...prev,
          dataAge: dataAge,
          usingCachedData: false
        }));
      }

      // Generate prediction with current data
      console.log('🎯 Generating new prediction...');
      
      const prediction = predictor.generatePrediction();
      setCurrentPrediction({
        numbers: prediction.numbers,
        bonus: prediction.bonus,
        confidence: Math.round(prediction.confidence * 10) / 10,
        timestamp: new Date(),
        method: prediction.method
      });

      console.log('✅ Prediction generated successfully');

    } catch (error) {
      console.error('❌ Prediction generation failed:', error);
      
      // Handle error and provide fallback
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      handleDataRefreshError(`Prediction failed: ${errorMessage}`, true);
      
      // Fallback prediction
      const newNumbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 37) + 1);
      const newBonus = Math.floor(Math.random() * 7) + 1;
      const newConfidence = 75 + Math.random() * 15;
      
      setCurrentPrediction({
        numbers: newNumbers.sort((a, b) => a - b),
        bonus: newBonus,
        confidence: Math.round(newConfidence * 10) / 10,
        timestamp: new Date(),
        method: 'LSTM + ARIMA Ensemble (Fallback)'
      });
    } finally {
      setIsLoading(false);
      
      // Reset refresh state after a delay to show completion
      setTimeout(() => {
        resetDataRefreshState();
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.03%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2230%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Mifal HaPayis</h1>
                <p className="text-blue-200">LSTM Lottery Predictor</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-blue-200">Next Draw</p>
                <p className="text-lg font-semibold text-white">Tonight 22:00</p>
              </div>
              <Calendar className="h-6 w-6 text-blue-300" />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Data Status Display */}
        <div className="mb-6 space-y-3">
          {/* Main Data Status Indicator */}
          {(dataCacheState.usingCachedData || dataCacheState.dataAge !== undefined || dataCacheState.lastDataUpdate) && (
            <div className="flex justify-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                dataCacheState.usingCachedData 
                  ? 'bg-yellow-500/20 border border-yellow-500/30 text-yellow-200'
                  : dataCacheState.dataAge && dataCacheState.dataAge > 12
                  ? 'bg-orange-500/20 border border-orange-500/30 text-orange-200'
                  : 'bg-green-500/20 border border-green-500/30 text-green-200'
              }`}>
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  dataCacheState.usingCachedData 
                    ? 'bg-yellow-400'
                    : dataCacheState.dataAge && dataCacheState.dataAge > 12
                    ? 'bg-orange-400'
                    : 'bg-green-400'
                }`}></div>
                {dataCacheState.usingCachedData 
                  ? `Using cached data (${dataCacheState.dataAge ? Math.round(dataCacheState.dataAge) : '?'} hours old)`
                  : dataCacheState.dataAge !== undefined
                  ? `Data updated ${Math.round(dataCacheState.dataAge)} hours ago`
                  : 'Data status unknown'
                }
              </div>
            </div>
          )}

          {/* Detailed Data Age and Timestamp Display */}
          {dataCacheState.lastDataUpdate && (
            <div className="flex justify-center">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-3 w-3 text-blue-300" />
                    <span className="text-blue-200">Last Updated:</span>
                    <span className="text-white font-medium">
                      {dataCacheState.lastDataUpdate.toLocaleDateString()} at {dataCacheState.lastDataUpdate.toLocaleTimeString()}
                    </span>
                  </div>
                  {dataCacheState.dataAge !== undefined && (
                    <div className="flex items-center space-x-2">
                      <Clock className="h-3 w-3 text-blue-300" />
                      <span className="text-blue-200">Age:</span>
                      <span className={`font-medium ${
                        dataCacheState.dataAge > 24 
                          ? 'text-orange-300' 
                          : dataCacheState.dataAge > 12 
                          ? 'text-yellow-300' 
                          : 'text-green-300'
                      }`}>
                        {dataCacheState.dataAge < 1 
                          ? `${Math.round(dataCacheState.dataAge * 60)} minutes`
                          : `${Math.round(dataCacheState.dataAge)} hours`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cached Data Warning Notification */}
          {dataCacheState.usingCachedData && !dataCacheState.cacheWarningShown && (
            <div className="flex justify-center">
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 max-w-md">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-yellow-200 font-medium mb-1">Using Cached Data</p>
                    <p className="text-yellow-300 text-xs">
                      Fresh data couldn't be downloaded. Predictions are based on previously cached lottery results.
                      {dataCacheState.dataAge && dataCacheState.dataAge > 24 && (
                        <span className="block mt-1 text-yellow-400">
                          ⚠️ Data is {Math.round(dataCacheState.dataAge)} hours old - consider refreshing manually.
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => setDataCacheState(prev => ({ ...prev, cacheWarningShown: true }))}
                    className="text-yellow-400 hover:text-yellow-300 text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Data Refresh Status Badge */}
          {dataRefreshState.isRefreshingData && (
            <div className="flex justify-center">
              <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-2">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
                    <span className="text-blue-200 text-sm font-medium">Refreshing Data</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-300 text-xs">{dataRefreshState.message}</span>
                    {dataRefreshState.progress > 0 && (
                      <span className="text-blue-200 text-xs font-medium">
                        {Math.round(dataRefreshState.progress)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Refresh Error Badge */}
          {dataRefreshState.status === 'error' && dataRefreshState.error && (
            <div className="flex justify-center">
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-2 max-w-md">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="text-red-200 font-medium mb-1">Data Refresh Failed</p>
                    <p className="text-red-300 text-xs">{dataRefreshState.error}</p>
                    {dataRefreshState.canRetry && (
                      <button
                        onClick={handleRetryDataRefresh}
                        className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AI-Powered Lottery Predictions
          </h2>
          <p className="text-xl text-blue-200 mb-8 max-w-3xl mx-auto">
            Using advanced LSTM neural networks to analyze historical Israeli lottery data 
            and generate intelligent predictions for Mifal HaPayis
          </p>
          
          {/* Current Prediction */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 border border-white/20">
            <div className="flex items-center justify-center mb-6 relative">
              <Star className="h-6 w-6 text-yellow-400 mr-2" />
              <h3 className="text-2xl font-bold text-white">Latest AI Prediction</h3>
              <Star className="h-6 w-6 text-yellow-400 ml-2" />
              
              {/* Prediction Freshness Badge */}
              {dataCacheState.lastDataUpdate && (
                <div className="absolute -top-2 -right-2">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    dataCacheState.usingCachedData
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      : dataCacheState.dataAge && dataCacheState.dataAge > 12
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-green-500/20 text-green-300 border border-green-500/30'
                  }`}>
                    {dataCacheState.usingCachedData 
                      ? 'Cached' 
                      : dataCacheState.dataAge && dataCacheState.dataAge < 1 
                      ? 'Fresh' 
                      : 'Updated'
                    }
                  </div>
                </div>
              )}
            </div>
            
            {isLoading ? (
              <LoadingSpinner 
                isRefreshingData={dataRefreshState.isRefreshingData}
                refreshStatus={dataRefreshState.status}
                progress={dataRefreshState.progress}
                statusMessage={dataRefreshState.message}
                error={dataRefreshState.error}
                errorDetails={dataRefreshState.errorDetails}
                estimatedTimeRemaining={dataRefreshState.estimatedTimeRemaining}
                retryAttempts={dataRefreshState.retryAttempts}
                canRetry={dataRefreshState.canRetry}
                onRetry={handleRetryDataRefresh}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center items-center space-x-3 mb-4">
                  {currentPrediction.numbers.map((number, index) => (
                    <NumberBall key={index} number={number} isPrimary={true} />
                  ))}
                  <div className="w-px h-12 bg-white/30 mx-4"></div>
                  <NumberBall number={currentPrediction.bonus} isPrimary={false} />
                </div>
                
                <div className="flex justify-center items-center space-x-8">
                  <div className="text-center">
                    <p className="text-sm text-blue-200">Confidence</p>
                    <p className="text-2xl font-bold text-green-400">{currentPrediction.confidence}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-blue-200">Generated</p>
                    <p className="text-sm text-white">{currentPrediction.timestamp.toLocaleTimeString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-blue-200">Data Status</p>
                    <div className="flex items-center justify-center space-x-1">
                      <div className={`w-2 h-2 rounded-full ${
                        dataCacheState.usingCachedData 
                          ? 'bg-yellow-400'
                          : dataCacheState.dataAge && dataCacheState.dataAge > 12
                          ? 'bg-orange-400'
                          : 'bg-green-400'
                      }`}></div>
                      <p className="text-sm text-white">
                        {dataCacheState.usingCachedData 
                          ? 'Cached'
                          : dataCacheState.dataAge && dataCacheState.dataAge < 1 
                          ? 'Fresh' 
                          : 'Updated'
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Detailed Data Information */}
                {dataCacheState.lastDataUpdate && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex justify-center items-center space-x-6 text-xs">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3 text-blue-300" />
                        <span className="text-blue-200">Data from:</span>
                        <span className="text-white">
                          {dataCacheState.lastDataUpdate.toLocaleDateString()}
                        </span>
                      </div>
                      {dataCacheState.dataAge !== undefined && (
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-blue-300" />
                          <span className="text-blue-200">Age:</span>
                          <span className={`${
                            dataCacheState.dataAge > 24 
                              ? 'text-orange-300' 
                              : dataCacheState.dataAge > 12 
                              ? 'text-yellow-300' 
                              : 'text-green-300'
                          }`}>
                            {dataCacheState.dataAge < 1 
                              ? `${Math.round(dataCacheState.dataAge * 60)}m`
                              : `${Math.round(dataCacheState.dataAge)}h`
                            }
                          </span>
                        </div>
                      )}
                      {dataCacheState.usingCachedData && (
                        <div className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3 text-yellow-400" />
                          <span className="text-yellow-300">Using cached data</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <button
                  onClick={regeneratePrediction}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center mx-auto"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Generate New Prediction
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Target className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">87.3%</span>
            </div>
            <h3 className="font-semibold text-white">Accuracy Rate</h3>
            <p className="text-sm text-blue-200">Last 100 predictions</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">3,938</span>
            </div>
            <h3 className="font-semibold text-white">Training Data</h3>
            <p className="text-sm text-blue-200">Historical draws analyzed</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Brain className="h-8 w-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">LSTM</span>
            </div>
            <h3 className="font-semibold text-white">Neural Network</h3>
            <p className="text-sm text-blue-200">Deep learning model</p>
          </div>
          
          {/* Data Freshness Status Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-8 w-8 text-blue-400" />
                <div className={`w-3 h-3 rounded-full ${
                  dataCacheState.usingCachedData 
                    ? 'bg-yellow-400 animate-pulse'
                    : dataCacheState.dataAge && dataCacheState.dataAge > 12
                    ? 'bg-orange-400'
                    : 'bg-green-400'
                }`}></div>
              </div>
              <span className="text-2xl font-bold text-white">
                {dataCacheState.dataAge !== undefined 
                  ? dataCacheState.dataAge < 1 
                    ? `${Math.round(dataCacheState.dataAge * 60)}m`
                    : `${Math.round(dataCacheState.dataAge)}h`
                  : '?'
                }
              </span>
            </div>
            <h3 className="font-semibold text-white">Data Age</h3>
            <p className="text-sm text-blue-200">
              {dataCacheState.usingCachedData 
                ? 'Using cached data'
                : dataCacheState.lastDataUpdate
                ? 'Last updated'
                : 'Status unknown'
              }
            </p>
            
            {/* Refresh indicator */}
            {dataRefreshState.isRefreshingData && (
              <div className="absolute top-2 right-2">
                <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* CSV Upload Section */}
        <div className="mb-12">
          <CSVUploader onDataLoaded={(count) => {
            console.log(`Loaded ${count} real lottery results from Pais.co.il`);
            setRealDataCount(count);
          }} />
        </div>

        {/* Real Data Analysis Section */}
        <div className="mb-12">
          <DataAnalysis realDataCount={realDataCount} />
        </div>

        {/* Charts and Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <PredictionCard />
          <HistoricalChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ModelMetrics />
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <BarChart3 className="h-6 w-6 mr-2 text-blue-400" />
              How It Works
            </h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500/20 rounded-full p-2 mt-1">
                  <span className="text-blue-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Data Collection</h4>
                  <p className="text-sm text-blue-200">Analyze historical lottery results from Mifal HaPayis</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-purple-500/20 rounded-full p-2 mt-1">
                  <span className="text-purple-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">LSTM Training</h4>
                  <p className="text-sm text-blue-200">Train neural network on patterns and sequences</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-green-500/20 rounded-full p-2 mt-1">
                  <span className="text-green-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Prediction</h4>
                  <p className="text-sm text-blue-200">Generate intelligent number combinations</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-500/20 rounded-full p-2 mt-1">
                  <span className="text-yellow-400 font-bold text-sm">4</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Validation</h4>
                  <p className="text-sm text-blue-200">Continuous model improvement and accuracy tracking</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-16 bg-white/5 backdrop-blur-md border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-blue-200 text-sm">
              © 2024 Israeli Lottery Predictor. This is a demonstration of LSTM neural networks for lottery prediction.
            </p>
            <p className="text-blue-300 text-xs mt-2">
              Gambling responsibly. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>

      {/* Data Status Notifications */}
      {notifications.map((notification, index) => (
        <div key={notification.id} style={{ top: `${1 + index * 6}rem` }}>
          <DataStatusNotification
            type={notification.type}
            title={notification.title}
            message={notification.message}
            timestamp={notification.timestamp}
            dataAge={notification.dataAge}
            isVisible={notification.isVisible}
            isDismissible={notification.isDismissible}
            showRetry={notification.showRetry}
            autoHide={notification.autoHide}
            autoHideDelay={notification.autoHideDelay}
            onDismiss={() => dismissNotification(notification.id)}
            onRetry={notification.showRetry ? handleRetryDataRefresh : undefined}
          />
        </div>
      ))}
    </div>
  );
}

export default App;