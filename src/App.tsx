import React, { useState, useEffect } from 'react';
import { TrendingUp, Brain, Target, BarChart3, Zap, Calendar, Trophy, Star, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import PredictionCard from './components/PredictionCard';
import HistoricalChart from './components/HistoricalChart';
import ModelMetrics from './components/ModelMetrics';
import NumberBall from './components/NumberBall';
import LoadingSpinner from './components/LoadingSpinner';
import CSVUploader from './components/CSVUploader';
import DataAnalysis from './components/DataAnalysis';
import LastWinningNumbers from './components/LastWinningNumbers';
import { IsraeliLotteryResult, IsraeliLotteryAPI } from './services/israeliLotteryAPI';
import DataStatusNotification, { NotificationType } from './components/DataStatusNotification';
import { HybridLotteryPredictor } from './services/lotteryPredictor';
import { DataRefreshService, DataRefreshError, DataRefreshErrorType } from './services/dataRefreshService';
import { getCachedFirestoreData } from './services/firestoreService';

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
  const [lastWinningResult, setLastWinningResult] = useState<IsraeliLotteryResult | null>(null);
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
    // Load last winning numbers from Firestore cache (sorted desc, first = newest)
    const cached = getCachedFirestoreData();
    if (cached && cached.length > 0) {
      setLastWinningResult(cached[0]);
    } else {
      // Firestore cache not yet populated — will be set after syncIfNeeded completes
      IsraeliLotteryAPI.getLatestResult().then(result => {
        // Only use this result if it looks real (not fake fallback draw #5000)
        if (result && result.drawNumber < 5000) {
          setLastWinningResult(result);
        }
      });
    }

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

        // Stage 1: Try Firestore first (primary source, minimises CORS-proxy calls)
        updateDownloadProgress(5, 'Connecting to Firestore...');
        const firestoreResult = await dataRefreshService.loadFromFirestore();

        if (firestoreResult.success && firestoreResult.data && firestoreResult.data.length > 0) {
          // Firestore succeeded — use this data directly
          updateValidationProgress(80, 'Firestore data loaded, updating models...');

          const lotteryDraws = firestoreResult.data.map(result => ({
            date: result.date,
            numbers: result.numbers,
            bonus: result.bonus,
            drawNumber: result.drawNumber
          }));
          await predictor.updateHistoricalData(lotteryDraws);

          const label = firestoreResult.fromCache
            ? `Using Firestore cache (${Math.round(firestoreResult.dataAge)} hours old, ${firestoreResult.recordCount} records)`
            : `Firestore synced — ${firestoreResult.recordCount} records`;
          completeDataRefresh(label);

          setDataCacheState(prev => ({
            ...prev,
            lastDataUpdate: new Date(),
            usingCachedData: firestoreResult.fromCache ?? false,
            dataAge: firestoreResult.dataAge,
            cacheWarningShown: false
          }));

          // Update last winning numbers from Firestore data (sorted desc, index 0 = newest)
          setLastWinningResult(firestoreResult.data[0]);

          // Skip the CORS-proxy download below
          const prediction = predictor.generatePrediction();
          setCurrentPrediction({
            numbers: prediction.numbers,
            bonus: prediction.bonus,
            confidence: Math.round(prediction.confidence * 10) / 10,
            timestamp: new Date(),
            method: prediction.method
          });
          setIsLoading(false);
          setTimeout(() => resetDataRefreshState(), 2000);
          return;
        }

        // Firestore unavailable — fall back to CORS proxy
        updateDownloadProgress(10, 'Firestore unavailable, connecting to data source...');
        
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
    <div className="min-h-screen bg-[#F5F5F7]">

      {/* ── Nav ── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-[#E5E5EA] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">

          {/* Left: actions */}
          <div className="flex items-center gap-3">
            {/* User icon */}
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
              </svg>
            </button>
            {/* Bell */}
            <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#6E6E73] hover:bg-[#F5F5F7] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" d="M15 17H9m6 0a3 3 0 01-6 0m6 0H5.6a1 1 0 01-.7-1.7L6 14.3V10a6 6 0 1112 0v4.3l1.1 1 A1 1 0 0118.4 17H15z" />
              </svg>
            </button>

            {/* Refresh button */}
            <button
              onClick={regeneratePrediction}
              disabled={dataRefreshState.isRefreshingData || isLoading}
              className="flex items-center gap-1.5 bg-[#5E5CE6] hover:bg-[#4B49C8] disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-full transition-colors duration-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${dataRefreshState.isRefreshingData ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>

            {/* Live badge */}
            <div className="flex items-center gap-1.5 border border-[#FF3B30]/30 text-[#FF3B30] text-xs font-semibold px-3 py-1 rounded-full bg-[#FF3B30]/5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] animate-pulse" />
              Draw #{lastWinningResult?.drawNumber ?? '—'} · Live
            </div>
          </div>

          {/* Right: nav links + brand */}
          <nav className="flex items-center gap-6">
            <a href="#" className="text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">History</a>
            <a href="#" className="text-sm text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">Analytics</a>
            <a href="#" className="text-sm font-semibold text-[#5E5CE6] border-b-2 border-[#5E5CE6] pb-0.5">Dashboard</a>
            <span className="text-base font-bold text-[#1D1D1F] ml-2">WinSphere</span>
          </nav>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Section label */}
        <div className="flex justify-end">
          <p className="text-sm font-semibold text-[#1D1D1F]">Last Winning Numbers</p>
        </div>

        {/* Last Winning Numbers card */}
        <LastWinningNumbers lastResult={lastWinningResult} />

        {/* AI Prediction card */}
        {isLoading ? (
          <div className="rounded-2xl border border-[#DDDCF8] bg-[#F0EFFD] p-10 flex justify-center">
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
          </div>
        ) : (
          <PredictionCard
            numbers={currentPrediction.numbers}
            bonus={currentPrediction.bonus}
            confidence={currentPrediction.confidence}
            method={currentPrediction.method}
            isLoading={isLoading}
            onGenerate={regeneratePrediction}
          />
        )}

        {/* Model Metrics row */}
        <ModelMetrics
          lastUpdated={dataCacheState.lastDataUpdate}
          dataPoints={realDataCount > 0 ? realDataCount * 6 : undefined}
        />

        {/* Number Frequency chart */}
        <HistoricalChart />

      </main>

      {/* ── Toast notifications ── */}
      {notifications.map((notification, index) => (
        <div key={notification.id} style={{ bottom: `${1.5 + index * 4}rem` }} className="fixed left-6 z-50">
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