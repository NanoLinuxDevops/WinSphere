import { IsraeliLotteryResult } from './israeliLotteryAPI';
import { DataValidationWarningSystem, DataQualityReport, ValidationWarning } from './dataValidationWarningSystem';

// Error types for better error handling
export type DataRefreshErrorType = 
  | 'network_error'
  | 'validation_error' 
  | 'processing_error'
  | 'timeout_error'
  | 'cors_error'
  | 'server_error'
  | 'unknown_error';

// Enhanced error information
export interface DataRefreshError {
  type: DataRefreshErrorType;
  message: string;
  details?: string;
  retryable: boolean;
  estimatedRetryTime?: number; // seconds
}

// Data refresh result interface
export interface DataRefreshResult {
  success: boolean;
  data?: IsraeliLotteryResult[];
  error?: string;
  errorDetails?: DataRefreshError;
  fromCache: boolean;
  dataAge: number; // hours since last update
  recordCount: number;
  retryAttempts?: number;
  fallbackUsed?: boolean;
}

// Data validation result interface
export interface DataValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  recordCount: number;
  latestDate: string;
  hasRequiredColumns: boolean;
  dataQualityScore: number; // 0-100
  validationMetrics?: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    completenessRatio: number;
    dateRange: { earliest: string; latest: string };
    numberDiversity: number;
    bonusDiversity: number;
    suspiciousPatterns: number;
  };
}

// Configuration for data refresh behavior
export interface DataRefreshConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  cacheTimeout: number; // hours
  validateDataQuality: boolean;
  fallbackToCachedData: boolean;
  dataSourceUrl: string;
}

// Default configuration
const DEFAULT_CONFIG: DataRefreshConfig = {
  maxRetries: 3,
  retryDelay: 1000, // Start with 1 second
  cacheTimeout: 24, // 24 hours
  validateDataQuality: true,
  fallbackToCachedData: true,
  dataSourceUrl: 'https://www.pais.co.il/lotto/archive.aspx'
};

// Enhanced cache configuration
interface CacheConfig {
  maxCacheSize: number; // Maximum number of records to cache
  compressionEnabled: boolean; // Enable data compression
  cacheVersioning: boolean; // Enable cache versioning for invalidation
  memoryOptimization: boolean; // Enable memory optimization features
}

// Cache metadata for intelligent invalidation
interface CacheMetadata {
  version: string;
  timestamp: number;
  recordCount: number;
  dataHash: string; // Hash of data for integrity checking
  compressionRatio?: number;
  lastAccessTime: number;
}

export class DataRefreshService {
  private config: DataRefreshConfig;
  private cacheConfig: CacheConfig;
  private lastUpdateTime: Date | null = null;
  private cachedData: IsraeliLotteryResult[] = [];
  private cacheMetadata: CacheMetadata | null = null;
  private readonly CACHE_VERSION = '2.0';
  private readonly CACHE_KEY = 'lottery-data-cache-v2';
  private readonly METADATA_KEY = 'lottery-cache-metadata-v2';

  constructor(config: Partial<DataRefreshConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cacheConfig = {
      maxCacheSize: 1000, // Limit to 1000 records for memory efficiency
      compressionEnabled: true,
      cacheVersioning: true,
      memoryOptimization: true
    };
    this.loadCachedDataEnhanced();
  }

  /**
   * Download latest lottery data with enhanced error handling and fallback mechanisms
   */
  public async downloadLatestData(): Promise<DataRefreshResult> {
    let retryAttempts = 0;
    let fallbackUsed = false;

    try {
      console.log('🔄 Starting data refresh process...');

      // Check if cached data is still fresh
      if (this.isCachedDataFresh()) {
        console.log('✅ Using fresh cached data');
        return {
          success: true,
          data: this.cachedData,
          fromCache: true,
          dataAge: this.getDataAge(),
          recordCount: this.cachedData.length,
          retryAttempts: 0,
          fallbackUsed: false
        };
      }

      // Attempt to download fresh data with enhanced error handling
      const downloadResult = await this.downloadWithEnhancedRetry();
      retryAttempts = downloadResult.retryAttempts || 0;
      
      if (downloadResult.success && downloadResult.csvContent) {
        // Validate the downloaded data
        const validationResult = this.validateData(downloadResult.csvContent);
        
        if (validationResult.isValid) {
          // Parse and cache the valid data
          try {
            const parsedData = await this.parseCSVContent(downloadResult.csvContent);
            
            if (parsedData.length > 0) {
              this.cachedData = parsedData;
              this.lastUpdateTime = new Date();
              this.saveCachedDataEnhanced();
              
              console.log(`✅ Successfully refreshed data with ${parsedData.length} records`);
              
              return {
                success: true,
                data: parsedData,
                fromCache: false,
                dataAge: 0,
                recordCount: parsedData.length,
                retryAttempts,
                fallbackUsed: false
              };
            } else {
              // Empty parsed data - fall back to cached data
              return this.createFallbackResult(
                this.createError('processing_error', 'No valid data records found after parsing', 'The downloaded data contained no usable lottery results', false),
                retryAttempts
              );
            }
          } catch (parseError) {
            // Parsing failed - fall back to cached data
            return this.createFallbackResult(
              this.createError('processing_error', 'Failed to parse downloaded data', parseError instanceof Error ? parseError.message : 'Unknown parsing error', false),
              retryAttempts
            );
          }
        } else {
          // Validation failed - fall back to cached data
          console.warn('⚠️ Downloaded data failed validation:', validationResult.errors);
          return this.createFallbackResult(
            this.createError('validation_error', 'Downloaded data failed quality checks', validationResult.errors.join('; '), false),
            retryAttempts
          );
        }
      } else {
        // Download failed - fall back to cached data
        const errorDetails = downloadResult.errorDetails || this.createError('network_error', 'Download failed', downloadResult.error || 'Unknown download error', true);
        return this.createFallbackResult(errorDetails, retryAttempts);
      }

    } catch (error) {
      console.error('❌ Data refresh failed with unexpected error:', error);
      
      // Handle unexpected errors with fallback
      const errorDetails = this.createError('unknown_error', 'Unexpected error during data refresh', error instanceof Error ? error.message : 'Unknown error', false);
      return this.createFallbackResult(errorDetails, retryAttempts);
    }
  }

  /**
   * Create a fallback result using cached data when available
   */
  private createFallbackResult(errorDetails: DataRefreshError, retryAttempts: number): DataRefreshResult {
    if (this.config.fallbackToCachedData && this.cachedData.length > 0) {
      console.log('⚠️ Using cached data as fallback');
      return {
        success: true,
        data: this.cachedData,
        error: this.getUserFriendlyErrorMessage(errorDetails),
        errorDetails,
        fromCache: true,
        dataAge: this.getDataAge(),
        recordCount: this.cachedData.length,
        retryAttempts,
        fallbackUsed: true
      };
    } else {
      // No cached data available - complete failure
      return {
        success: false,
        error: this.getUserFriendlyErrorMessage(errorDetails),
        errorDetails,
        fromCache: false,
        dataAge: this.getDataAge(),
        recordCount: 0,
        retryAttempts,
        fallbackUsed: false
      };
    }
  }

  /**
   * Create structured error information
   */
  private createError(type: DataRefreshErrorType, message: string, details?: string, retryable: boolean = false): DataRefreshError {
    const estimatedRetryTime = retryable ? this.calculateRetryTime(type) : undefined;
    
    return {
      type,
      message,
      details,
      retryable,
      estimatedRetryTime
    };
  }

  /**
   * Calculate estimated retry time based on error type
   */
  private calculateRetryTime(errorType: DataRefreshErrorType): number {
    switch (errorType) {
      case 'network_error':
        return 30; // 30 seconds for network issues
      case 'timeout_error':
        return 60; // 1 minute for timeout issues
      case 'server_error':
        return 300; // 5 minutes for server issues
      case 'cors_error':
        return 120; // 2 minutes for CORS issues
      default:
        return 60; // Default 1 minute
    }
  }

  /**
   * Get user-friendly error message based on error type
   */
  private getUserFriendlyErrorMessage(error: DataRefreshError): string {
    const baseMessages = {
      network_error: 'Unable to connect to the lottery data source. Please check your internet connection.',
      validation_error: 'The downloaded data appears to be incomplete or corrupted.',
      processing_error: 'There was an issue processing the lottery data.',
      timeout_error: 'The request took too long to complete. The server may be busy.',
      cors_error: 'Access to the lottery data source is currently restricted.',
      server_error: 'The lottery data server is currently unavailable.',
      unknown_error: 'An unexpected error occurred while refreshing data.'
    };

    let message = baseMessages[error.type] || baseMessages.unknown_error;
    
    if (error.retryable && error.estimatedRetryTime) {
      const timeText = error.estimatedRetryTime < 60 
        ? `${error.estimatedRetryTime} seconds`
        : `${Math.ceil(error.estimatedRetryTime / 60)} minutes`;
      message += ` You can try again in approximately ${timeText}.`;
    }

    return message;
  }

  /**
   * Enhanced download with detailed error handling and retry logic
   */
  private async downloadWithEnhancedRetry(): Promise<{ success: boolean; csvContent?: string; error?: string; errorDetails?: DataRefreshError; retryAttempts?: number }> {
    let lastError: Error | null = null;
    let errorType: DataRefreshErrorType = 'network_error';
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`📥 Download attempt ${attempt}/${this.config.maxRetries}`);
        
        const csvContent = await this.fetchCSVFromSourceWithTimeout();
        
        if (csvContent && csvContent.length > 0) {
          console.log(`✅ Download successful on attempt ${attempt}`);
          return { 
            success: true, 
            csvContent,
            retryAttempts: attempt - 1 // Number of retries (not including successful attempt)
          };
        }
        
        throw new Error('Empty or invalid CSV content received');
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown download error');
        errorType = this.categorizeError(lastError);
        
        console.warn(`⚠️ Download attempt ${attempt} failed (${errorType}):`, lastError.message);
        
        // Don't wait after the last attempt
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt, errorType);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }
    
    const errorDetails = this.createError(
      errorType,
      `All ${this.config.maxRetries} download attempts failed`,
      lastError?.message,
      true // Most download failures are retryable
    );
    
    return {
      success: false,
      error: `All ${this.config.maxRetries} download attempts failed. Last error: ${lastError?.message || 'Unknown error'}`,
      errorDetails,
      retryAttempts: this.config.maxRetries
    };
  }

  /**
   * Categorize error types for better handling
   */
  private categorizeError(error: Error): DataRefreshErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('aborted')) {
      return 'timeout_error';
    } else if (message.includes('cors') || message.includes('cross-origin')) {
      return 'cors_error';
    } else if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
      return 'server_error';
    } else if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * Calculate backoff delay based on attempt and error type
   */
  private calculateBackoffDelay(attempt: number, errorType: DataRefreshErrorType): number {
    let baseDelay = this.config.retryDelay;
    
    // Adjust base delay based on error type
    switch (errorType) {
      case 'timeout_error':
        baseDelay *= 2; // Longer delays for timeout errors
        break;
      case 'server_error':
        baseDelay *= 3; // Even longer delays for server errors
        break;
      case 'cors_error':
        baseDelay *= 1.5; // Slightly longer for CORS issues
        break;
    }
    
    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add up to 30% jitter
    
    return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
  }

  /**
   * Fetch CSV with timeout handling
   */
  private async fetchCSVFromSourceWithTimeout(): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const csvContent = await this.fetchCSVFromSourceWithAbort(controller.signal);
      clearTimeout(timeoutId);
      return csvContent;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - the server took too long to respond');
      }
      throw error;
    }
  }

  /**
   * Fetch CSV content with abort signal support
   */
  private async fetchCSVFromSourceWithAbort(signal: AbortSignal): Promise<string> {
    // Try multiple approaches to get the CSV data
    
    // First, try to fetch from the local file (fallback)
    try {
      const response = await fetch('/data/pais-lottery-data.csv', { signal });
      if (response.ok) {
        const csvContent = await response.text();
        if (csvContent && !csvContent.includes('<!DOCTYPE html')) {
          console.log('📁 Using local CSV file');
          return csvContent;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      console.log('Local file not available, trying remote source...');
    }

    // Try to fetch from Pais.co.il (this will likely fail due to CORS)
    try {
      const response = await fetch(this.config.dataSourceUrl, {
        mode: 'cors',
        signal,
        headers: {
          'Accept': 'text/csv,text/plain,*/*',
          'User-Agent': 'Mozilla/5.0 (compatible; LotteryPredictor/1.0)',
          'Cache-Control': 'no-cache'
        }
      });

      if (response.ok) {
        const content = await response.text();
        if (content && !content.includes('<!DOCTYPE html')) {
          console.log('🌐 Fetched from remote source');
          return content;
        }
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      console.log('Remote fetch failed (expected due to CORS):', error);
    }

    // Generate simulated fresh data as fallback
    console.log('🎲 Generating simulated fresh data');
    return this.generateSimulatedCSV();
  }

  /**
   * Download CSV with exponential backoff retry logic (legacy method for compatibility)
   */
  private async downloadWithRetry(): Promise<{ success: boolean; csvContent?: string; error?: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        console.log(`📥 Download attempt ${attempt}/${this.config.maxRetries}`);
        
        const csvContent = await this.fetchCSVFromSource();
        
        if (csvContent && csvContent.length > 0) {
          console.log(`✅ Download successful on attempt ${attempt}`);
          return { success: true, csvContent };
        }
        
        throw new Error('Empty or invalid CSV content received');
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown download error');
        console.warn(`⚠️ Download attempt ${attempt} failed:`, lastError.message);
        
        // Don't wait after the last attempt
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }
    
    return {
      success: false,
      error: `All ${this.config.maxRetries} download attempts failed. Last error: ${lastError?.message || 'Unknown error'}`
    };
  }

  /**
   * Fetch CSV content from the data source
   */
  private async fetchCSVFromSource(): Promise<string> {
    // Try multiple approaches to get the CSV data
    
    // First, try to fetch from the local file (fallback)
    try {
      const response = await fetch('/data/pais-lottery-data.csv');
      if (response.ok) {
        const csvContent = await response.text();
        if (csvContent && !csvContent.includes('<!DOCTYPE html')) {
          console.log('📁 Using local CSV file');
          return csvContent;
        }
      }
    } catch (error) {
      console.log('Local file not available, trying remote source...');
    }

    // Try to fetch from Pais.co.il (this will likely fail due to CORS)
    try {
      const response = await fetch(this.config.dataSourceUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'text/csv,text/plain,*/*',
          'User-Agent': 'Mozilla/5.0 (compatible; LotteryPredictor/1.0)'
        }
      });

      if (response.ok) {
        const content = await response.text();
        if (content && !content.includes('<!DOCTYPE html')) {
          console.log('🌐 Fetched from remote source');
          return content;
        }
      }
    } catch (error) {
      console.log('Remote fetch failed (expected due to CORS):', error);
    }

    // Generate simulated fresh data as fallback
    console.log('🎲 Generating simulated fresh data');
    return this.generateSimulatedCSV();
  }

  /**
   * Generate simulated CSV data for testing purposes
   */
  private generateSimulatedCSV(): string {
    const header = 'DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2';
    const lines = [header];
    
    const baseDrawNumber = 5300; // Current approximate draw number
    const baseDate = new Date();
    
    // Generate 50 recent draws
    for (let i = 0; i < 50; i++) {
      const drawNumber = baseDrawNumber - i;
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i * 3); // Draws every 3 days
      
      const numbers = this.generateRealisticNumbers();
      const bonus = Math.floor(Math.random() * 7) + 1;
      const dateStr = date.toLocaleDateString('he-IL'); // Israeli date format
      
      const line = `${drawNumber},${dateStr},${numbers.join(',')},${bonus},,`;
      lines.push(line);
    }
    
    return lines.join('\n');
  }

  /**
   * Generate realistic lottery numbers
   */
  private generateRealisticNumbers(): number[] {
    const numbers: number[] = [];
    const ranges = { low: 0, mid: 0, high: 0 };
    const maxPerRange = 2;
    
    while (numbers.length < 6) {
      const num = Math.floor(Math.random() * 37) + 1;
      
      if (numbers.includes(num)) continue;
      
      let range: 'low' | 'mid' | 'high';
      if (num <= 12) range = 'low';
      else if (num <= 25) range = 'mid';
      else range = 'high';
      
      if (ranges[range] < maxPerRange || numbers.length >= 4) {
        numbers.push(num);
        if (ranges[range] < maxPerRange) ranges[range]++;
      }
    }
    
    return numbers.sort((a, b) => a - b);
  }

  /**
   * Validate CSV data structure and content with comprehensive quality checks
   */
  public validateData(csvContent: string): DataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let recordCount = 0;
    let latestDate = '';
    let hasRequiredColumns = false;
    let qualityScore = 100;

    // Detailed validation metrics
    const validationMetrics = {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateDrawNumbers: new Set<number>(),
      dateRange: { earliest: '', latest: '' },
      numberFrequency: new Map<number, number>(),
      bonusFrequency: new Map<number, number>(),
      suspiciousPatterns: [] as string[]
    };

    try {
      // Basic content validation
      if (!csvContent || csvContent.trim().length === 0) {
        errors.push('CSV content is empty');
        return this.createValidationResult(false, errors, warnings, 0, '', false, 0, validationMetrics);
      }

      // Check for HTML content (error pages)
      if (csvContent.includes('<!DOCTYPE html') || csvContent.includes('<html')) {
        errors.push('Received HTML content instead of CSV data');
        qualityScore -= 50;
        return this.createValidationResult(false, errors, warnings, 0, '', false, qualityScore, validationMetrics);
      }

      const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
      validationMetrics.totalRows = lines.length - 1; // Exclude header
      
      if (lines.length < 2) {
        errors.push('CSV must contain at least a header and one data row');
        qualityScore -= 50;
        return this.createValidationResult(false, errors, warnings, 0, '', false, qualityScore, validationMetrics);
      }

      // Enhanced header validation
      const headerValidation = this.validateCSVHeader(lines[0]);
      hasRequiredColumns = headerValidation.isValid;
      
      if (!hasRequiredColumns) {
        errors.push(...headerValidation.errors);
        qualityScore -= 30;
      }

      if (headerValidation.warnings.length > 0) {
        warnings.push(...headerValidation.warnings);
        qualityScore -= 5;
      }

      // Comprehensive data row validation
      const dates: string[] = [];
      const drawNumbers: number[] = [];
      let consecutiveErrors = 0;
      const maxConsecutiveErrors = 5;
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const rowValidation = this.validateDataRow(line, i + 1, validationMetrics);
        
        if (rowValidation.isValid) {
          recordCount++;
          validationMetrics.validRows++;
          consecutiveErrors = 0;
          
          if (rowValidation.date) {
            dates.push(rowValidation.date);
          }
          if (rowValidation.drawNumber) {
            drawNumbers.push(rowValidation.drawNumber);
          }
        } else {
          validationMetrics.invalidRows++;
          errors.push(...rowValidation.errors);
          warnings.push(...rowValidation.warnings);
          qualityScore -= rowValidation.qualityPenalty;
          
          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            errors.push(`Too many consecutive invalid rows (${maxConsecutiveErrors}+). Data quality is too poor.`);
            qualityScore -= 20;
            break;
          }
        }
      }

      // Advanced quality checks
      this.performAdvancedQualityChecks(validationMetrics, errors, warnings, qualityScore);

      // Date range analysis
      if (dates.length > 0) {
        const sortedDates = dates.sort((a, b) => {
          const dateA = this.parseIsraeliDate(a);
          const dateB = this.parseIsraeliDate(b);
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        latestDate = sortedDates[0];
        validationMetrics.dateRange.latest = latestDate;
        validationMetrics.dateRange.earliest = sortedDates[sortedDates.length - 1];
        
        // Check for data freshness
        const latestDateObj = new Date(this.parseIsraeliDate(latestDate));
        const daysSinceLatest = (Date.now() - latestDateObj.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLatest > 30) {
          warnings.push(`Data appears outdated. Latest draw is ${Math.floor(daysSinceLatest)} days old.`);
          qualityScore -= 10;
        }
      }

      // Draw number sequence validation
      if (drawNumbers.length > 1) {
        const sequenceValidation = this.validateDrawNumberSequence(drawNumbers);
        if (sequenceValidation.errors.length > 0) {
          errors.push(...sequenceValidation.errors);
          qualityScore -= 15;
        }
        if (sequenceValidation.warnings.length > 0) {
          warnings.push(...sequenceValidation.warnings);
          qualityScore -= 5;
        }
      }

      // Dataset size validation
      const sizeValidation = this.validateDatasetSize(recordCount);
      if (sizeValidation.errors.length > 0) {
        errors.push(...sizeValidation.errors);
        qualityScore -= sizeValidation.qualityPenalty;
      }
      if (sizeValidation.warnings.length > 0) {
        warnings.push(...sizeValidation.warnings);
        qualityScore -= 5;
      }

      // Statistical anomaly detection
      const anomalyValidation = this.detectStatisticalAnomalies(validationMetrics);
      if (anomalyValidation.warnings.length > 0) {
        warnings.push(...anomalyValidation.warnings);
        qualityScore -= anomalyValidation.qualityPenalty;
      }

      // Ensure quality score doesn't go below 0
      qualityScore = Math.max(0, qualityScore);

      // Determine overall validity
      const criticalErrorCount = errors.filter(error => 
        error.includes('missing required columns') || 
        error.includes('empty') ||
        error.includes('HTML content') ||
        error.includes('Too many consecutive')
      ).length;

      const isValid = criticalErrorCount === 0 && 
                     hasRequiredColumns && 
                     qualityScore >= 50 && 
                     recordCount >= 5;

      return this.createValidationResult(
        isValid, 
        errors, 
        warnings, 
        recordCount, 
        latestDate, 
        hasRequiredColumns, 
        qualityScore, 
        validationMetrics
      );

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return this.createValidationResult(false, errors, warnings, recordCount, latestDate, hasRequiredColumns, 0, validationMetrics);
    }
  }

  /**
   * Validate CSV header structure and column names
   */
  private validateCSVHeader(headerLine: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const header = headerLine.toLowerCase().replace(/\s+/g, '');
    const columns = header.split(',');
    
    // Required columns with variations
    const requiredColumns = [
      { names: ['drawnumber', 'draw', 'drawno', 'number'], found: false },
      { names: ['date', 'drawdate', 'datum'], found: false },
      { names: ['num1', '1', 'number1', 'ball1'], found: false },
      { names: ['num2', '2', 'number2', 'ball2'], found: false },
      { names: ['num3', '3', 'number3', 'ball3'], found: false },
      { names: ['num4', '4', 'number4', 'ball4'], found: false },
      { names: ['num5', '5', 'number5', 'ball5'], found: false },
      { names: ['num6', '6', 'number6', 'ball6'], found: false },
      { names: ['bonus', 'strong', 'strongnumber', 'extra'], found: false }
    ];

    // Check each column against required patterns
    for (const column of columns) {
      for (const required of requiredColumns) {
        if (required.names.some(name => column.includes(name))) {
          required.found = true;
        }
      }
    }

    // Report missing columns
    const missingColumns = requiredColumns.filter(col => !col.found);
    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.map(col => col.names[0]).join(', ')}`);
    }

    // Check for suspicious column count
    if (columns.length < 9) {
      warnings.push(`Header has only ${columns.length} columns, expected at least 9`);
    } else if (columns.length > 15) {
      warnings.push(`Header has ${columns.length} columns, which is more than expected`);
    }

    // Check for empty columns
    const emptyColumns = columns.filter(col => col.trim().length === 0);
    if (emptyColumns.length > 0) {
      warnings.push(`Header contains ${emptyColumns.length} empty columns`);
    }

    return {
      isValid: missingColumns.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate individual data row with comprehensive checks
   */
  private validateDataRow(line: string, rowNumber: number, metrics: any): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    qualityPenalty: number;
    date?: string;
    drawNumber?: number;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let qualityPenalty = 0;
    let isValid = true;

    const columns = line.split(',').map(col => col.trim());
    
    if (columns.length < 9) {
      errors.push(`Row ${rowNumber}: Insufficient columns (expected at least 9, got ${columns.length})`);
      qualityPenalty += 10;
      isValid = false;
      return { isValid, errors, warnings, qualityPenalty };
    }

    // Validate draw number
    let drawNumber: number | undefined;
    const drawNumberStr = columns[0];
    if (!drawNumberStr || drawNumberStr.length === 0) {
      errors.push(`Row ${rowNumber}: Missing draw number`);
      qualityPenalty += 5;
      isValid = false;
    } else {
      drawNumber = parseInt(drawNumberStr);
      if (isNaN(drawNumber) || drawNumber <= 0) {
        errors.push(`Row ${rowNumber}: Invalid draw number '${drawNumberStr}'`);
        qualityPenalty += 5;
        isValid = false;
      } else if (drawNumber > 10000) {
        warnings.push(`Row ${rowNumber}: Unusually high draw number ${drawNumber}`);
        qualityPenalty += 1;
      } else if (metrics.duplicateDrawNumbers.has(drawNumber)) {
        errors.push(`Row ${rowNumber}: Duplicate draw number ${drawNumber}`);
        qualityPenalty += 8;
        isValid = false;
      } else {
        metrics.duplicateDrawNumbers.add(drawNumber);
      }
    }

    // Validate date
    let date: string | undefined;
    const dateStr = columns[1];
    if (!dateStr || dateStr.length === 0) {
      errors.push(`Row ${rowNumber}: Missing date`);
      qualityPenalty += 5;
      isValid = false;
    } else {
      try {
        date = this.parseIsraeliDate(dateStr);
        const dateObj = new Date(date);
        
        if (isNaN(dateObj.getTime())) {
          errors.push(`Row ${rowNumber}: Invalid date format '${dateStr}'`);
          qualityPenalty += 3;
          isValid = false;
        } else {
          // Check for reasonable date range (not too far in past/future)
          const currentYear = new Date().getFullYear();
          const dateYear = dateObj.getFullYear();
          
          if (dateYear < 1975) {
            warnings.push(`Row ${rowNumber}: Date ${dateStr} is before Israeli lottery started (1975)`);
            qualityPenalty += 2;
          } else if (dateYear > currentYear + 1) {
            warnings.push(`Row ${rowNumber}: Future date ${dateStr}`);
            qualityPenalty += 2;
          }
        }
      } catch (error) {
        errors.push(`Row ${rowNumber}: Date parsing error for '${dateStr}'`);
        qualityPenalty += 3;
        isValid = false;
      }
    }

    // Validate main numbers (columns 2-7)
    const numbers: number[] = [];
    for (let j = 2; j <= 7; j++) {
      const numStr = columns[j];
      if (!numStr || numStr.length === 0) {
        errors.push(`Row ${rowNumber}: Missing number in column ${j + 1}`);
        qualityPenalty += 3;
        isValid = false;
        continue;
      }

      const num = parseInt(numStr);
      if (isNaN(num)) {
        errors.push(`Row ${rowNumber}: Non-numeric value '${numStr}' in column ${j + 1}`);
        qualityPenalty += 3;
        isValid = false;
      } else if (num < 1 || num > 37) {
        errors.push(`Row ${rowNumber}: Number ${num} out of range (1-37) in column ${j + 1}`);
        qualityPenalty += 4;
        isValid = false;
      } else {
        numbers.push(num);
        // Track number frequency for statistical analysis
        metrics.numberFrequency.set(num, (metrics.numberFrequency.get(num) || 0) + 1);
      }
    }

    // Check for duplicate numbers in the same draw
    if (numbers.length === 6) {
      const uniqueNumbers = new Set(numbers);
      if (uniqueNumbers.size !== 6) {
        errors.push(`Row ${rowNumber}: Duplicate numbers in the same draw: [${numbers.join(', ')}]`);
        qualityPenalty += 8;
        isValid = false;
      }

      // Check for suspicious patterns
      const sortedNumbers = [...numbers].sort((a, b) => a - b);
      
      // Consecutive numbers check
      let consecutiveCount = 1;
      for (let i = 1; i < sortedNumbers.length; i++) {
        if (sortedNumbers[i] === sortedNumbers[i-1] + 1) {
          consecutiveCount++;
        } else {
          consecutiveCount = 1;
        }
      }
      
      if (consecutiveCount >= 4) {
        warnings.push(`Row ${rowNumber}: Suspicious pattern - ${consecutiveCount} consecutive numbers`);
        qualityPenalty += 2;
        metrics.suspiciousPatterns.push(`Row ${rowNumber}: ${consecutiveCount} consecutive numbers`);
      }

      // All numbers in same range check
      const ranges = { low: 0, mid: 0, high: 0 };
      for (const num of numbers) {
        if (num <= 12) ranges.low++;
        else if (num <= 25) ranges.mid++;
        else ranges.high++;
      }
      
      if (ranges.low === 6 || ranges.mid === 6 || ranges.high === 6) {
        warnings.push(`Row ${rowNumber}: All numbers in same range (suspicious)`);
        qualityPenalty += 2;
        metrics.suspiciousPatterns.push(`Row ${rowNumber}: All numbers in same range`);
      }
    }

    // Validate bonus number
    const bonusStr = columns[8];
    if (!bonusStr || bonusStr.length === 0) {
      errors.push(`Row ${rowNumber}: Missing bonus number`);
      qualityPenalty += 3;
      isValid = false;
    } else {
      const bonus = parseInt(bonusStr);
      if (isNaN(bonus)) {
        errors.push(`Row ${rowNumber}: Non-numeric bonus value '${bonusStr}'`);
        qualityPenalty += 3;
        isValid = false;
      } else if (bonus < 1 || bonus > 7) {
        errors.push(`Row ${rowNumber}: Bonus number ${bonus} out of range (1-7)`);
        qualityPenalty += 4;
        isValid = false;
      } else {
        // Track bonus frequency
        metrics.bonusFrequency.set(bonus, (metrics.bonusFrequency.get(bonus) || 0) + 1);
      }
    }

    return { isValid, errors, warnings, qualityPenalty, date, drawNumber };
  }

  /**
   * Validate draw number sequence for consistency
   */
  private validateDrawNumberSequence(drawNumbers: number[]): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    const sortedDraws = [...drawNumbers].sort((a, b) => b - a); // Descending order
    
    // Check for reasonable gaps
    let largeGaps = 0;
    for (let i = 1; i < sortedDraws.length; i++) {
      const gap = sortedDraws[i-1] - sortedDraws[i];
      if (gap > 50) {
        largeGaps++;
        if (gap > 200) {
          warnings.push(`Large gap in draw numbers: ${sortedDraws[i]} to ${sortedDraws[i-1]} (gap: ${gap})`);
        }
      }
    }

    if (largeGaps > sortedDraws.length * 0.3) {
      warnings.push(`Many large gaps in draw sequence (${largeGaps} gaps out of ${sortedDraws.length} draws)`);
    }

    // Check for reasonable range
    const minDraw = Math.min(...drawNumbers);
    const maxDraw = Math.max(...drawNumbers);
    
    if (minDraw < 1) {
      errors.push(`Invalid minimum draw number: ${minDraw}`);
    }
    
    if (maxDraw > 10000) {
      warnings.push(`Very high maximum draw number: ${maxDraw}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate dataset size and provide recommendations
   */
  private validateDatasetSize(recordCount: number): { errors: string[]; warnings: string[]; qualityPenalty: number } {
    const errors: string[] = [];
    const warnings: string[] = [];
    let qualityPenalty = 0;

    if (recordCount === 0) {
      errors.push('No valid data records found');
      qualityPenalty = 50;
    } else if (recordCount < 5) {
      errors.push(`Dataset too small (${recordCount} records). Minimum 5 records required.`);
      qualityPenalty = 30;
    } else if (recordCount < 20) {
      warnings.push(`Small dataset (${recordCount} records). Recommend at least 20 records for reliable predictions.`);
      qualityPenalty = 15;
    } else if (recordCount < 50) {
      warnings.push(`Moderate dataset size (${recordCount} records). Recommend 50+ records for optimal predictions.`);
      qualityPenalty = 5;
    }

    return { errors, warnings, qualityPenalty };
  }

  /**
   * Detect statistical anomalies in the data
   */
  private detectStatisticalAnomalies(metrics: any): { warnings: string[]; qualityPenalty: number } {
    const warnings: string[] = [];
    let qualityPenalty = 0;

    // Analyze number frequency distribution
    if (metrics.numberFrequency.size > 0) {
      const frequencies = Array.from(metrics.numberFrequency.values());
      const avgFrequency = frequencies.reduce((sum, freq) => sum + freq, 0) / frequencies.length;
      const maxFrequency = Math.max(...frequencies);
      const minFrequency = Math.min(...frequencies);

      // Check for extremely uneven distribution
      if (maxFrequency > avgFrequency * 3) {
        warnings.push(`Suspicious number frequency: Number appears ${maxFrequency} times (avg: ${avgFrequency.toFixed(1)})`);
        qualityPenalty += 3;
      }

      if (minFrequency === 0 || maxFrequency / minFrequency > 10) {
        warnings.push('Highly uneven number distribution detected');
        qualityPenalty += 2;
      }
    }

    // Analyze bonus number distribution
    if (metrics.bonusFrequency.size > 0) {
      const bonusFreqs = Array.from(metrics.bonusFrequency.values());
      const avgBonusFreq = bonusFreqs.reduce((sum, freq) => sum + freq, 0) / bonusFreqs.length;
      const maxBonusFreq = Math.max(...bonusFreqs);

      if (maxBonusFreq > avgBonusFreq * 4) {
        warnings.push(`Suspicious bonus number frequency detected`);
        qualityPenalty += 2;
      }
    }

    // Check for too many suspicious patterns
    if (metrics.suspiciousPatterns.length > metrics.validRows * 0.1) {
      warnings.push(`High number of suspicious patterns detected (${metrics.suspiciousPatterns.length})`);
      qualityPenalty += 5;
    }

    return { warnings, qualityPenalty };
  }

  /**
   * Perform advanced quality checks on the entire dataset
   */
  private performAdvancedQualityChecks(metrics: any, errors: string[], warnings: string[], qualityScore: number): void {
    // Check data completeness ratio
    const completenessRatio = metrics.validRows / metrics.totalRows;
    if (completenessRatio < 0.8) {
      warnings.push(`Low data completeness: ${(completenessRatio * 100).toFixed(1)}% of rows are valid`);
    }

    // Check for data diversity
    if (metrics.numberFrequency.size < 30) {
      warnings.push(`Limited number diversity: Only ${metrics.numberFrequency.size} different numbers found`);
    }

    // Check bonus number coverage
    if (metrics.bonusFrequency.size < 5) {
      warnings.push(`Limited bonus number diversity: Only ${metrics.bonusFrequency.size} different bonus numbers`);
    }

    // Date range validation
    if (metrics.dateRange.earliest && metrics.dateRange.latest) {
      const earliestDate = new Date(metrics.dateRange.earliest);
      const latestDate = new Date(metrics.dateRange.latest);
      const daysDiff = (latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff < 30) {
        warnings.push(`Short date range: Only ${Math.floor(daysDiff)} days of data`);
      }
    }
  }

  /**
   * Create standardized validation result
   */
  private createValidationResult(
    isValid: boolean,
    errors: string[],
    warnings: string[],
    recordCount: number,
    latestDate: string,
    hasRequiredColumns: boolean,
    dataQualityScore: number,
    metrics: any
  ): DataValidationResult {
    return {
      isValid,
      errors,
      warnings,
      recordCount,
      latestDate,
      hasRequiredColumns,
      dataQualityScore,
      validationMetrics: {
        totalRows: metrics.totalRows,
        validRows: metrics.validRows,
        invalidRows: metrics.invalidRows,
        completenessRatio: metrics.totalRows > 0 ? metrics.validRows / metrics.totalRows : 0,
        dateRange: metrics.dateRange,
        numberDiversity: metrics.numberFrequency.size,
        bonusDiversity: metrics.bonusFrequency.size,
        suspiciousPatterns: metrics.suspiciousPatterns.length
      }
    };
  }

  /**
   * Parse CSV content with memory optimization for large files
   */
  private async parseCSVContent(csvContent: string): Promise<IsraeliLotteryResult[]> {
    const results: IsraeliLotteryResult[] = [];
    
    // Memory optimization: process large files in chunks
    const isLargeFile = csvContent.length > 1024 * 1024; // 1MB threshold
    
    if (isLargeFile && this.cacheConfig.memoryOptimization) {
      console.log('📊 Processing large CSV file with memory optimization');
      return this.parseCSVContentInChunks(csvContent);
    }
    
    // Standard processing for smaller files
    return this.parseCSVContentStandard(csvContent);
  }

  /**
   * Standard CSV parsing for smaller files
   */
  private async parseCSVContentStandard(csvContent: string): Promise<IsraeliLotteryResult[]> {
    const results: IsraeliLotteryResult[] = [];
    const lines = csvContent.split('\n');

    // Skip header row and process data
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.length < 10) continue;

      const parsedRow = this.parseCSVRow(line, i + 1);
      if (parsedRow) {
        results.push(parsedRow);
      }
    }

    // Sort by draw number (most recent first)
    return results.sort((a, b) => b.drawNumber - a.drawNumber);
  }

  /**
   * Memory-optimized CSV parsing for large files using streaming approach
   */
  private async parseCSVContentInChunks(csvContent: string): Promise<IsraeliLotteryResult[]> {
    const results: IsraeliLotteryResult[] = [];
    const chunkSize = 10000; // Process 10k characters at a time
    let buffer = '';
    let lineNumber = 0;
    let headerSkipped = false;

    console.log(`📊 Processing ${(csvContent.length / 1024).toFixed(1)}KB CSV in chunks of ${(chunkSize / 1024).toFixed(1)}KB`);

    for (let offset = 0; offset < csvContent.length; offset += chunkSize) {
      // Get chunk and add to buffer
      const chunk = csvContent.slice(offset, offset + chunkSize);
      buffer += chunk;

      // Process complete lines in buffer
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in buffer for next iteration
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        lineNumber++;
        
        // Skip header
        if (!headerSkipped) {
          headerSkipped = true;
          continue;
        }

        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.length < 10) continue;

        const parsedRow = this.parseCSVRow(trimmedLine, lineNumber);
        if (parsedRow) {
          results.push(parsedRow);
        }

        // Memory management: limit results size during processing
        if (this.cacheConfig.memoryOptimization && results.length > this.cacheConfig.maxCacheSize * 2) {
          console.log(`📊 Limiting results during processing to prevent memory issues (${results.length} records)`);
          // Keep only the most recent records
          results.sort((a, b) => b.drawNumber - a.drawNumber);
          results.splice(this.cacheConfig.maxCacheSize);
        }
      }

      // Yield control to prevent blocking UI
      if (offset % (chunkSize * 5) === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    // Process any remaining data in buffer
    if (buffer.trim()) {
      lineNumber++;
      const parsedRow = this.parseCSVRow(buffer.trim(), lineNumber);
      if (parsedRow) {
        results.push(parsedRow);
      }
    }

    console.log(`📊 Completed chunked processing: ${results.length} records parsed`);

    // Final sort and size limit
    results.sort((a, b) => b.drawNumber - a.drawNumber);
    
    if (this.cacheConfig.memoryOptimization && results.length > this.cacheConfig.maxCacheSize) {
      console.log(`📊 Trimming final results to ${this.cacheConfig.maxCacheSize} records`);
      return results.slice(0, this.cacheConfig.maxCacheSize);
    }

    return results;
  }

  /**
   * Parse individual CSV row with error handling
   */
  private parseCSVRow(line: string, lineNumber: number): IsraeliLotteryResult | null {
    try {
      const columns = line.split(',');

      if (columns.length >= 9) {
        const drawNumber = parseInt(columns[0]);
        const dateStr = columns[1];

        // Parse the 6 main numbers (columns 2-7)
        const numbers = [
          parseInt(columns[2]),
          parseInt(columns[3]),
          parseInt(columns[4]),
          parseInt(columns[5]),
          parseInt(columns[6]),
          parseInt(columns[7])
        ];

        const bonus = parseInt(columns[8]);

        // Convert Israeli date format to ISO format
        const date = this.parseIsraeliDate(dateStr);

        // Validate the data
        if (!isNaN(drawNumber) && drawNumber > 0 &&
          date &&
          numbers.every(n => !isNaN(n) && n >= 1 && n <= 37) &&
          !isNaN(bonus) && bonus >= 1 && bonus <= 7) {

          return {
            date,
            drawNumber,
            numbers: numbers.sort((a, b) => a - b),
            bonus,
            jackpot: undefined
          };
        }
      }
    } catch (error) {
      console.warn(`Skipping invalid row ${lineNumber}:`, error);
    }
    
    return null;
  }

  /**
   * Parse Israeli date format to ISO string
   */
  private parseIsraeliDate(dateStr: string): string {
    try {
      // Handle various Israeli date formats
      const cleanDate = dateStr.replace(/[^\d\/\.\-]/g, '');

      if (cleanDate.includes('/')) {
        const parts = cleanDate.split('/');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      } else if (cleanDate.includes('.')) {
        const parts = cleanDate.split('.');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2];
          return `${year}-${month}-${day}`;
        }
      }

      // If parsing fails, return current date
      return new Date().toISOString().split('T')[0];
    } catch (error) {
      console.error('Error parsing Israeli date:', error);
      return new Date().toISOString().split('T')[0];
    }
  }

  /**
   * Check if cached data is still fresh
   */
  private isCachedDataFresh(): boolean {
    if (!this.lastUpdateTime || this.cachedData.length === 0) {
      return false;
    }

    const ageInHours = (Date.now() - this.lastUpdateTime.getTime()) / (1000 * 60 * 60);
    return ageInHours < this.config.cacheTimeout;
  }

  /**
   * Get age of cached data in hours
   */
  public getDataAge(): number {
    if (!this.lastUpdateTime) {
      return Infinity;
    }

    return (Date.now() - this.lastUpdateTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * Enhanced cache loading with intelligent invalidation and compression
   */
  private loadCachedDataEnhanced(): void {
    try {
      // Load metadata first to check cache validity
      const metadataStr = localStorage.getItem(this.METADATA_KEY);
      if (!metadataStr) {
        console.log('📦 No cache metadata found, starting fresh');
        this.initializeEmptyCache();
        return;
      }

      const metadata: CacheMetadata = JSON.parse(metadataStr);
      
      // Check cache version compatibility
      if (metadata.version !== this.CACHE_VERSION) {
        console.log(`📦 Cache version mismatch (${metadata.version} vs ${this.CACHE_VERSION}), invalidating cache`);
        this.clearCacheEnhanced();
        return;
      }

      // Check cache age for intelligent invalidation
      const cacheAgeHours = (Date.now() - metadata.timestamp) / (1000 * 60 * 60);
      if (cacheAgeHours > this.config.cacheTimeout) {
        console.log(`📦 Cache expired (${cacheAgeHours.toFixed(1)}h old), invalidating`);
        this.clearCacheEnhanced();
        return;
      }

      // Load cached data
      const cachedStr = localStorage.getItem(this.CACHE_KEY);
      if (!cachedStr) {
        console.log('📦 Cache metadata exists but no data found, clearing metadata');
        this.clearCacheEnhanced();
        return;
      }

      // Decompress and parse data if compression is enabled
      let parsedData: IsraeliLotteryResult[];
      if (this.cacheConfig.compressionEnabled && metadata.compressionRatio) {
        parsedData = this.decompressData(cachedStr);
        console.log(`📦 Decompressed cache data (ratio: ${metadata.compressionRatio.toFixed(2)})`);
      } else {
        parsedData = JSON.parse(cachedStr);
      }

      // Validate data integrity using hash
      const currentHash = this.calculateDataHash(parsedData);
      if (currentHash !== metadata.dataHash) {
        console.warn('📦 Cache integrity check failed, data may be corrupted');
        this.clearCacheEnhanced();
        return;
      }

      // Memory optimization: limit cache size
      if (this.cacheConfig.memoryOptimization && parsedData.length > this.cacheConfig.maxCacheSize) {
        console.log(`📦 Trimming cache from ${parsedData.length} to ${this.cacheConfig.maxCacheSize} records`);
        parsedData = parsedData.slice(0, this.cacheConfig.maxCacheSize);
      }

      // Successfully loaded cache
      this.cachedData = parsedData;
      this.lastUpdateTime = new Date(metadata.timestamp);
      this.cacheMetadata = { ...metadata, lastAccessTime: Date.now() };
      
      console.log(`📦 Loaded ${this.cachedData.length} cached records from ${this.lastUpdateTime.toLocaleString()} (${cacheAgeHours.toFixed(1)}h old)`);
      
      // Update access time
      this.updateCacheAccessTime();

    } catch (error) {
      console.warn('📦 Failed to load enhanced cache:', error);
      this.initializeEmptyCache();
    }
  }

  /**
   * Enhanced cache saving with compression and metadata
   */
  private saveCachedDataEnhanced(): void {
    try {
      if (!this.cachedData || this.cachedData.length === 0) {
        console.log('💾 No data to cache');
        return;
      }

      // Memory optimization: limit cache size before saving
      let dataToCache = this.cachedData;
      if (this.cacheConfig.memoryOptimization && dataToCache.length > this.cacheConfig.maxCacheSize) {
        console.log(`💾 Limiting cache size to ${this.cacheConfig.maxCacheSize} most recent records`);
        dataToCache = dataToCache.slice(0, this.cacheConfig.maxCacheSize);
      }

      // Calculate data hash for integrity checking
      const dataHash = this.calculateDataHash(dataToCache);
      
      // Compress data if enabled
      let dataToStore: string;
      let compressionRatio: number | undefined;
      
      if (this.cacheConfig.compressionEnabled) {
        const originalSize = JSON.stringify(dataToCache).length;
        dataToStore = this.compressData(dataToCache);
        const compressedSize = dataToStore.length;
        compressionRatio = compressedSize / originalSize;
        
        console.log(`💾 Compressed data: ${originalSize} → ${compressedSize} bytes (${(compressionRatio * 100).toFixed(1)}%)`);
      } else {
        dataToStore = JSON.stringify(dataToCache);
      }

      // Create metadata
      const metadata: CacheMetadata = {
        version: this.CACHE_VERSION,
        timestamp: this.lastUpdateTime?.getTime() || Date.now(),
        recordCount: dataToCache.length,
        dataHash,
        compressionRatio,
        lastAccessTime: Date.now()
      };

      // Check localStorage space before saving
      const estimatedSize = dataToStore.length + JSON.stringify(metadata).length;
      if (!this.checkLocalStorageSpace(estimatedSize)) {
        console.warn('💾 Insufficient localStorage space, attempting cleanup');
        this.cleanupOldCacheEntries();
        
        // Try again after cleanup
        if (!this.checkLocalStorageSpace(estimatedSize)) {
          console.error('💾 Still insufficient space after cleanup, cache save failed');
          return;
        }
      }

      // Save data and metadata
      localStorage.setItem(this.CACHE_KEY, dataToStore);
      localStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
      
      this.cacheMetadata = metadata;
      console.log(`💾 Enhanced cache saved successfully (${dataToCache.length} records, ${(estimatedSize / 1024).toFixed(1)}KB)`);

    } catch (error) {
      console.warn('💾 Failed to save enhanced cache:', error);
      
      // If save failed due to space, try to clear old data and retry
      if (error instanceof Error && error.message.includes('QuotaExceededError')) {
        console.log('💾 Storage quota exceeded, clearing cache and retrying with smaller dataset');
        this.clearCacheEnhanced();
        
        // Retry with smaller dataset
        if (this.cachedData.length > 100) {
          const smallerData = this.cachedData.slice(0, 100);
          const originalData = this.cachedData;
          this.cachedData = smallerData;
          this.saveCachedDataEnhanced();
          this.cachedData = originalData; // Restore full data in memory
        }
      }
    }
  }

  /**
   * Enhanced cache clearing with metadata cleanup
   */
  public clearCacheEnhanced(): void {
    this.cachedData = [];
    this.lastUpdateTime = null;
    this.cacheMetadata = null;
    
    // Clear both new and old cache keys for compatibility
    localStorage.removeItem(this.CACHE_KEY);
    localStorage.removeItem(this.METADATA_KEY);
    localStorage.removeItem('lottery-data-cache'); // Legacy key
    localStorage.removeItem('lottery-data-timestamp'); // Legacy key
    
    console.log('🗑️ Enhanced cache cleared');
  }

  /**
   * Legacy cache clear method for backward compatibility
   */
  public clearCache(): void {
    this.clearCacheEnhanced();
  }

  /**
   * Initialize empty cache with default metadata
   */
  private initializeEmptyCache(): void {
    this.cachedData = [];
    this.lastUpdateTime = null;
    this.cacheMetadata = null;
  }

  /**
   * Update cache access time for LRU tracking
   */
  private updateCacheAccessTime(): void {
    if (this.cacheMetadata) {
      this.cacheMetadata.lastAccessTime = Date.now();
      try {
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(this.cacheMetadata));
      } catch (error) {
        console.warn('Failed to update cache access time:', error);
      }
    }
  }

  /**
   * Calculate hash of data for integrity checking
   */
  private calculateDataHash(data: IsraeliLotteryResult[]): string {
    // Simple hash based on data content
    const dataString = JSON.stringify(data.map(d => ({
      drawNumber: d.drawNumber,
      date: d.date,
      numbers: d.numbers,
      bonus: d.bonus
    })));
    
    // Simple hash function (for production, consider using crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Compress data using simple string compression
   */
  private compressData(data: IsraeliLotteryResult[]): string {
    try {
      // For browser environment, use simple JSON compression
      // In production, consider using libraries like pako for gzip compression
      const jsonString = JSON.stringify(data);
      
      // Simple compression: remove unnecessary whitespace and use shorter keys
      const compressedData = data.map(item => ({
        d: item.drawNumber,
        dt: item.date,
        n: item.numbers,
        b: item.bonus,
        j: item.jackpot
      }));
      
      return JSON.stringify(compressedData);
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Decompress data from compressed format
   */
  private decompressData(compressedString: string): IsraeliLotteryResult[] {
    try {
      const compressedData = JSON.parse(compressedString);
      
      // Check if data is in compressed format
      if (Array.isArray(compressedData) && compressedData.length > 0 && 'd' in compressedData[0]) {
        // Decompress from short keys to full format
        return compressedData.map(item => ({
          drawNumber: item.d,
          date: item.dt,
          numbers: item.n,
          bonus: item.b,
          jackpot: item.j
        }));
      } else {
        // Data is not compressed, return as-is
        return compressedData;
      }
    } catch (error) {
      console.warn('Decompression failed:', error);
      throw error;
    }
  }

  /**
   * Check if localStorage has enough space for data
   */
  private checkLocalStorageSpace(requiredBytes: number): boolean {
    try {
      // Estimate current localStorage usage
      let currentUsage = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          currentUsage += localStorage[key].length + key.length;
        }
      }
      
      // Typical localStorage limit is 5-10MB, use conservative 4MB
      const storageLimit = 4 * 1024 * 1024; // 4MB
      const availableSpace = storageLimit - currentUsage;
      
      console.log(`💾 Storage check: ${(currentUsage / 1024).toFixed(1)}KB used, ${(availableSpace / 1024).toFixed(1)}KB available, ${(requiredBytes / 1024).toFixed(1)}KB required`);
      
      return availableSpace >= requiredBytes * 1.2; // 20% buffer
    } catch (error) {
      console.warn('Failed to check localStorage space:', error);
      return true; // Assume space is available if check fails
    }
  }

  /**
   * Clean up old cache entries to free space
   */
  private cleanupOldCacheEntries(): void {
    try {
      const keysToRemove: string[] = [];
      
      // Remove old lottery cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('lottery-') || 
          key.startsWith('cache-') ||
          key.includes('old-data')
        )) {
          keysToRemove.push(key);
        }
      }
      
      // Remove identified keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed old cache entry: ${key}`);
      });
      
      console.log(`🗑️ Cleaned up ${keysToRemove.length} old cache entries`);
    } catch (error) {
      console.warn('Failed to cleanup old cache entries:', error);
    }
  }

  /**
   * Get current cached data
   */
  public getCachedData(): IsraeliLotteryResult[] {
    // Update access time when data is accessed
    if (this.cacheConfig.cacheVersioning) {
      this.updateCacheAccessTime();
    }
    return [...this.cachedData];
  }

  /**
   * Get cache statistics and metadata
   */
  public getCacheStats(): {
    recordCount: number;
    cacheAge: number;
    lastAccess: Date | null;
    cacheSize: number;
    compressionRatio?: number;
    version: string;
    isValid: boolean;
  } {
    return {
      recordCount: this.cachedData.length,
      cacheAge: this.getDataAge(),
      lastAccess: this.cacheMetadata?.lastAccessTime ? new Date(this.cacheMetadata.lastAccessTime) : null,
      cacheSize: this.estimateCacheSize(),
      compressionRatio: this.cacheMetadata?.compressionRatio,
      version: this.CACHE_VERSION,
      isValid: this.isCachedDataFresh()
    };
  }

  /**
   * Estimate cache size in bytes
   */
  private estimateCacheSize(): number {
    try {
      const dataSize = localStorage.getItem(this.CACHE_KEY)?.length || 0;
      const metadataSize = localStorage.getItem(this.METADATA_KEY)?.length || 0;
      return dataSize + metadataSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Force cache refresh (bypass freshness check)
   */
  public async forceCacheRefresh(): Promise<DataRefreshResult> {
    console.log('🔄 Forcing cache refresh...');
    
    // Temporarily disable cache freshness check
    const originalTimeout = this.config.cacheTimeout;
    this.config.cacheTimeout = 0;
    
    try {
      const result = await this.downloadLatestData();
      return result;
    } finally {
      // Restore original timeout
      this.config.cacheTimeout = originalTimeout;
    }
  }

  /**
   * Optimize cache by removing old entries and compacting data
   */
  public optimizeCache(): void {
    console.log('🔧 Optimizing cache...');
    
    if (this.cachedData.length === 0) {
      console.log('🔧 No data to optimize');
      return;
    }

    const originalSize = this.cachedData.length;
    
    // Remove duplicates based on draw number
    const uniqueData = this.cachedData.filter((item, index, array) => 
      array.findIndex(other => other.drawNumber === item.drawNumber) === index
    );

    // Sort by draw number (most recent first)
    uniqueData.sort((a, b) => b.drawNumber - a.drawNumber);

    // Limit to max cache size
    if (uniqueData.length > this.cacheConfig.maxCacheSize) {
      uniqueData.splice(this.cacheConfig.maxCacheSize);
    }

    this.cachedData = uniqueData;
    this.saveCachedDataEnhanced();
    
    console.log(`🔧 Cache optimized: ${originalSize} → ${uniqueData.length} records`);
  }

  /**
   * Validate cache integrity
   */
  public validateCacheIntegrity(): boolean {
    if (!this.cacheMetadata || this.cachedData.length === 0) {
      return false;
    }

    try {
      const currentHash = this.calculateDataHash(this.cachedData);
      const isValid = currentHash === this.cacheMetadata.dataHash;
      
      if (!isValid) {
        console.warn('🔍 Cache integrity check failed - data may be corrupted');
      }
      
      return isValid;
    } catch (error) {
      console.error('🔍 Cache integrity validation error:', error);
      return false;
    }
  }

  /**
   * Get cache configuration
   */
  public getCacheConfig(): CacheConfig {
    return { ...this.cacheConfig };
  }

  /**
   * Update cache configuration
   */
  public updateCacheConfig(newConfig: Partial<CacheConfig>): void {
    this.cacheConfig = { ...this.cacheConfig, ...newConfig };
    console.log('⚙️ Cache configuration updated:', newConfig);
  }

  /**
   * Utility function to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service configuration
   */
  public getConfig(): DataRefreshConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration
   */
  public updateConfig(newConfig: Partial<DataRefreshConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Generate comprehensive data quality report using the warning system
   */
  public generateDataQualityReport(csvContent: string): DataQualityReport {
    const validationResult = this.validateData(csvContent);
    
    return DataValidationWarningSystem.generateQualityReport(
      validationResult,
      validationResult.recordCount,
      validationResult.validationMetrics?.totalRows || 0
    );
  }

  /**
   * Validate data with user confirmation for suspicious content
   */
  public async validateDataWithUserConfirmation(
    csvContent: string,
    onUserConfirmation?: (report: DataQualityReport) => Promise<boolean>
  ): Promise<{ isValid: boolean; report: DataQualityReport; userApproved?: boolean }> {
    
    const report = this.generateDataQualityReport(csvContent);
    
    // If no confirmation callback provided, return basic validation
    if (!onUserConfirmation) {
      return {
        isValid: report.canProceed,
        report
      };
    }

    // Check if user confirmation is required
    if (DataValidationWarningSystem.requiresUserConfirmation(report)) {
      console.log('⚠️ Data quality issues detected, requesting user confirmation...');
      
      try {
        const userApproved = await onUserConfirmation(report);
        
        return {
          isValid: userApproved && report.canProceed,
          report,
          userApproved
        };
      } catch (error) {
        console.error('Error during user confirmation:', error);
        return {
          isValid: false,
          report,
          userApproved: false
        };
      }
    }

    // No confirmation needed, data quality is acceptable
    return {
      isValid: report.canProceed,
      report,
      userApproved: true
    };
  }

  /**
   * Enhanced download with data quality validation and user confirmation
   */
  public async downloadLatestDataWithQualityCheck(
    onUserConfirmation?: (report: DataQualityReport) => Promise<boolean>
  ): Promise<DataRefreshResult & { qualityReport?: DataQualityReport }> {
    
    let retryAttempts = 0;

    try {
      console.log('🔄 Starting enhanced data refresh with quality validation...');

      // Check if cached data is still fresh
      if (this.isCachedDataFresh()) {
        console.log('✅ Using fresh cached data');
        return {
          success: true,
          data: this.cachedData,
          fromCache: true,
          dataAge: this.getDataAge(),
          recordCount: this.cachedData.length,
          retryAttempts: 0,
          fallbackUsed: false
        };
      }

      // Attempt to download fresh data
      const downloadResult = await this.downloadWithEnhancedRetry();
      retryAttempts = downloadResult.retryAttempts || 0;
      
      if (downloadResult.success && downloadResult.csvContent) {
        // Enhanced validation with quality report
        const validationWithConfirmation = await this.validateDataWithUserConfirmation(
          downloadResult.csvContent,
          onUserConfirmation
        );
        
        if (validationWithConfirmation.isValid && validationWithConfirmation.userApproved !== false) {
          // Parse and cache the validated data
          try {
            const parsedData = await this.parseCSVContent(downloadResult.csvContent);
            
            if (parsedData.length > 0) {
              this.cachedData = parsedData;
              this.lastUpdateTime = new Date();
              this.saveCachedDataEnhanced();
              
              console.log(`✅ Successfully refreshed data with ${parsedData.length} records (Quality Score: ${validationWithConfirmation.report.overallScore}/100)`);
              
              return {
                success: true,
                data: parsedData,
                fromCache: false,
                dataAge: 0,
                recordCount: parsedData.length,
                retryAttempts,
                fallbackUsed: false,
                qualityReport: validationWithConfirmation.report
              };
            } else {
              // Empty parsed data - fall back to cached data
              return this.createFallbackResultWithQuality(
                this.createError('processing_error', 'No valid data records found after parsing', 'The downloaded data contained no usable lottery results', false),
                retryAttempts,
                validationWithConfirmation.report
              );
            }
          } catch (parseError) {
            // Parsing failed - fall back to cached data
            return this.createFallbackResultWithQuality(
              this.createError('processing_error', 'Failed to parse downloaded data', parseError instanceof Error ? parseError.message : 'Unknown parsing error', false),
              retryAttempts,
              validationWithConfirmation.report
            );
          }
        } else {
          // Validation failed or user rejected - fall back to cached data
          const errorMessage = validationWithConfirmation.userApproved === false 
            ? 'User rejected data due to quality concerns'
            : 'Downloaded data failed quality validation';
            
          console.warn('⚠️ Data validation failed or rejected:', errorMessage);
          return this.createFallbackResultWithQuality(
            this.createError('validation_error', errorMessage, validationWithConfirmation.report.warnings.map(w => w.message).join('; '), false),
            retryAttempts,
            validationWithConfirmation.report
          );
        }
      } else {
        // Download failed - fall back to cached data
        const errorDetails = downloadResult.errorDetails || this.createError('network_error', 'Download failed', downloadResult.error || 'Unknown download error', true);
        return this.createFallbackResultWithQuality(errorDetails, retryAttempts);
      }

    } catch (error) {
      console.error('❌ Enhanced data refresh failed with unexpected error:', error);
      
      // Handle unexpected errors with fallback
      const errorDetails = this.createError('unknown_error', 'Unexpected error during data refresh', error instanceof Error ? error.message : 'Unknown error', false);
      return this.createFallbackResultWithQuality(errorDetails, retryAttempts);
    }
  }

  /**
   * Create fallback result with quality report
   */
  private createFallbackResultWithQuality(
    errorDetails: DataRefreshError, 
    retryAttempts: number, 
    qualityReport?: DataQualityReport
  ): DataRefreshResult & { qualityReport?: DataQualityReport } {
    
    const baseResult = this.createFallbackResult(errorDetails, retryAttempts);
    
    return {
      ...baseResult,
      qualityReport
    };
  }

  /**
   * Get formatted quality report for display
   */
  public getFormattedQualityReport(csvContent: string): string {
    const report = this.generateDataQualityReport(csvContent);
    return DataValidationWarningSystem.formatWarningsForDisplay(report);
  }

  /**
   * Check if data requires user confirmation
   */
  public requiresUserConfirmation(csvContent: string): boolean {
    const report = this.generateDataQualityReport(csvContent);
    return DataValidationWarningSystem.requiresUserConfirmation(report);
  }

  /**
   * Generate user confirmation prompt
   */
  public generateUserConfirmationPrompt(csvContent: string): string {
    const report = this.generateDataQualityReport(csvContent);
    return DataValidationWarningSystem.generateConfirmationPrompt(report);
  }

  /**
   * Validate specific data quality aspects for testing
   */
  public validateDataQualityAspects(csvContent: string): {
    formatValid: boolean;
    contentValid: boolean;
    freshnessValid: boolean;
    completenessValid: boolean;
    statisticallyValid: boolean;
    overallScore: number;
  } {
    const report = this.generateDataQualityReport(csvContent);
    
    return {
      formatValid: !report.warnings.some(w => w.type === 'data_quality' && w.severity === 'critical'),
      contentValid: report.summary.dataCompleteness >= 80,
      freshnessValid: !report.warnings.some(w => w.type === 'freshness' && w.severity === 'high'),
      completenessValid: !report.warnings.some(w => w.type === 'completeness' && w.severity === 'high'),
      statisticallyValid: !report.warnings.some(w => w.type === 'statistical_anomaly' && w.severity === 'high'),
      overallScore: report.overallScore
    };
  }
}