/**
 * Test suite for caching and performance optimizations in DataRefreshService
 */

import { DataRefreshService } from './dataRefreshService';
import { IsraeliLotteryResult } from './israeliLotteryAPI';

// Mock localStorage for testing
class MockLocalStorage {
  private storage: { [key: string]: string } = {};
  private quota = 5 * 1024 * 1024; // 5MB limit
  private used = 0;

  getItem(key: string): string | null {
    return this.storage[key] || null;
  }

  setItem(key: string, value: string): void {
    const size = key.length + value.length;
    if (this.used + size > this.quota) {
      throw new Error('QuotaExceededError: localStorage quota exceeded');
    }
    
    if (this.storage[key]) {
      this.used -= (key.length + this.storage[key].length);
    }
    
    this.storage[key] = value;
    this.used += size;
  }

  removeItem(key: string): void {
    if (this.storage[key]) {
      this.used -= (key.length + this.storage[key].length);
      delete this.storage[key];
    }
  }

  clear(): void {
    this.storage = {};
    this.used = 0;
  }

  get length(): number {
    return Object.keys(this.storage).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.storage);
    return keys[index] || null;
  }

  hasOwnProperty(key: string): boolean {
    return key in this.storage;
  }

  getUsage(): number {
    return this.used;
  }

  setQuota(quota: number): void {
    this.quota = quota;
  }
}

// Test data generator
function generateTestData(count: number): IsraeliLotteryResult[] {
  const results: IsraeliLotteryResult[] = [];
  const baseDate = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i * 3);
    
    const numbers = [];
    while (numbers.length < 6) {
      const num = Math.floor(Math.random() * 37) + 1;
      if (!numbers.includes(num)) {
        numbers.push(num);
      }
    }
    numbers.sort((a, b) => a - b);
    
    results.push({
      drawNumber: 5000 + i,
      date: date.toISOString().split('T')[0],
      numbers,
      bonus: Math.floor(Math.random() * 7) + 1,
      jackpot: undefined
    });
  }
  
  return results;
}

// Generate large CSV content for testing
function generateLargeCSV(recordCount: number): string {
  const header = 'DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2';
  const lines = [header];
  
  const testData = generateTestData(recordCount);
  
  for (const record of testData) {
    const dateStr = new Date(record.date).toLocaleDateString('he-IL');
    const line = `${record.drawNumber},${dateStr},${record.numbers.join(',')},${record.bonus},,`;
    lines.push(line);
  }
  
  return lines.join('\n');
}

// Test suite
export class CachingOptimizationsTest {
  private mockLocalStorage: MockLocalStorage;
  private originalLocalStorage: Storage;

  constructor() {
    this.mockLocalStorage = new MockLocalStorage();
    this.originalLocalStorage = global.localStorage;
  }

  private setupMockStorage(): void {
    // Replace global localStorage with mock
    (global as any).localStorage = this.mockLocalStorage;
  }

  private restoreStorage(): void {
    (global as any).localStorage = this.originalLocalStorage;
  }

  /**
   * Test 1: Enhanced localStorage caching
   */
  async testEnhancedCaching(): Promise<void> {
    console.log('🧪 Testing enhanced localStorage caching...');
    
    this.setupMockStorage();
    
    try {
      const service = new DataRefreshService();
      
      // Generate test data
      const testData = generateTestData(100);
      
      // Simulate caching data
      (service as any).cachedData = testData;
      (service as any).lastUpdateTime = new Date();
      (service as any).saveCachedDataEnhanced();
      
      // Verify data was cached
      const cacheStats = service.getCacheStats();
      console.log('📊 Cache stats after save:', cacheStats);
      
      // Create new service instance to test loading
      const newService = new DataRefreshService();
      const loadedData = newService.getCachedData();
      
      console.log(`✅ Cached ${testData.length} records, loaded ${loadedData.length} records`);
      
      // Verify data integrity
      const isIntegrityValid = newService.validateCacheIntegrity();
      console.log(`🔍 Cache integrity: ${isIntegrityValid ? 'VALID' : 'INVALID'}`);
      
      // Test cache optimization
      newService.optimizeCache();
      const optimizedStats = newService.getCacheStats();
      console.log('🔧 Cache stats after optimization:', optimizedStats);
      
    } catch (error) {
      console.error('❌ Enhanced caching test failed:', error);
    } finally {
      this.restoreStorage();
    }
  }

  /**
   * Test 2: Intelligent cache invalidation
   */
  async testCacheInvalidation(): Promise<void> {
    console.log('🧪 Testing intelligent cache invalidation...');
    
    this.setupMockStorage();
    
    try {
      // Test with short cache timeout
      const service = new DataRefreshService({ cacheTimeout: 0.001 }); // 0.001 hours = 3.6 seconds
      
      // Cache some data
      const testData = generateTestData(50);
      (service as any).cachedData = testData;
      (service as any).lastUpdateTime = new Date(Date.now() - 10000); // 10 seconds ago
      (service as any).saveCachedDataEnhanced();
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create new service - should invalidate cache due to age
      const newService = new DataRefreshService({ cacheTimeout: 0.001 });
      const loadedData = newService.getCachedData();
      
      console.log(`📅 Cache invalidation test: ${loadedData.length === 0 ? 'PASSED' : 'FAILED'}`);
      
      // Test version mismatch invalidation
      this.mockLocalStorage.setItem('lottery-cache-metadata-v2', JSON.stringify({
        version: '1.0', // Old version
        timestamp: Date.now(),
        recordCount: 50,
        dataHash: 'test-hash',
        lastAccessTime: Date.now()
      }));
      
      const versionTestService = new DataRefreshService();
      const versionTestData = versionTestService.getCachedData();
      
      console.log(`🔄 Version invalidation test: ${versionTestData.length === 0 ? 'PASSED' : 'FAILED'}`);
      
    } catch (error) {
      console.error('❌ Cache invalidation test failed:', error);
    } finally {
      this.restoreStorage();
    }
  }

  /**
   * Test 3: Memory optimization during large CSV processing
   */
  async testMemoryOptimization(): Promise<void> {
    console.log('🧪 Testing memory optimization for large CSV processing...');
    
    this.setupMockStorage();
    
    try {
      const service = new DataRefreshService();
      
      // Generate large CSV (2MB+)
      const largeCSV = generateLargeCSV(5000);
      console.log(`📄 Generated CSV: ${(largeCSV.length / 1024).toFixed(1)}KB`);
      
      // Test chunked parsing
      const startTime = Date.now();
      const parsedData = await (service as any).parseCSVContent(largeCSV);
      const parseTime = Date.now() - startTime;
      
      console.log(`⚡ Parsed ${parsedData.length} records in ${parseTime}ms`);
      
      // Test memory limits
      const cacheConfig = service.getCacheConfig();
      console.log(`🎯 Max cache size: ${cacheConfig.maxCacheSize}`);
      console.log(`📊 Actual parsed: ${parsedData.length}`);
      
      if (parsedData.length <= cacheConfig.maxCacheSize) {
        console.log('✅ Memory optimization: PASSED (within limits)');
      } else {
        console.log('⚠️ Memory optimization: WARNING (exceeded limits)');
      }
      
      // Test compression
      (service as any).cachedData = parsedData.slice(0, 100); // Limit for testing
      (service as any).lastUpdateTime = new Date();
      (service as any).saveCachedDataEnhanced();
      
      const cacheStats = service.getCacheStats();
      console.log(`🗜️ Compression ratio: ${cacheStats.compressionRatio?.toFixed(3) || 'N/A'}`);
      
    } catch (error) {
      console.error('❌ Memory optimization test failed:', error);
    } finally {
      this.restoreStorage();
    }
  }

  /**
   * Test 4: Storage quota handling
   */
  async testStorageQuotaHandling(): Promise<void> {
    console.log('🧪 Testing storage quota handling...');
    
    this.setupMockStorage();
    
    try {
      // Set very small quota
      this.mockLocalStorage.setQuota(50 * 1024); // 50KB
      
      const service = new DataRefreshService();
      
      // Try to cache large amount of data
      const largeData = generateTestData(1000);
      (service as any).cachedData = largeData;
      (service as any).lastUpdateTime = new Date();
      
      // This should trigger quota handling
      (service as any).saveCachedDataEnhanced();
      
      // Check if service handled quota gracefully
      const cacheStats = service.getCacheStats();
      console.log(`💾 Storage usage after quota handling: ${(cacheStats.cacheSize / 1024).toFixed(1)}KB`);
      
      // Verify data is still accessible (even if reduced)
      const cachedData = service.getCachedData();
      console.log(`📦 Records available after quota handling: ${cachedData.length}`);
      
      if (cachedData.length > 0 && cachedData.length <= largeData.length) {
        console.log('✅ Storage quota handling: PASSED');
      } else {
        console.log('❌ Storage quota handling: FAILED');
      }
      
    } catch (error) {
      console.error('❌ Storage quota test failed:', error);
    } finally {
      this.restoreStorage();
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting caching and performance optimization tests...\n');
    
    await this.testEnhancedCaching();
    console.log('');
    
    await this.testCacheInvalidation();
    console.log('');
    
    await this.testMemoryOptimization();
    console.log('');
    
    await this.testStorageQuotaHandling();
    console.log('');
    
    console.log('✨ All caching optimization tests completed!');
  }
}

// Export test runner function
export async function runCachingOptimizationTests(): Promise<void> {
  const testSuite = new CachingOptimizationsTest();
  await testSuite.runAllTests();
}

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined' && (window as any).runCachingTests) {
  runCachingOptimizationTests().catch(console.error);
}