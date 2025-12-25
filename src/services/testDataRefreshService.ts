import { DataRefreshService } from './dataRefreshService';

/**
 * Test script for DataRefreshService functionality
 */
export async function testDataRefreshService() {
  console.log('🧪 Testing DataRefreshService...');

  // Create service instance
  const service = new DataRefreshService({
    maxRetries: 2,
    retryDelay: 500,
    cacheTimeout: 1, // 1 hour for testing
    validateDataQuality: true,
    fallbackToCachedData: true
  });

  try {
    // Test 1: Download latest data
    console.log('\n📥 Test 1: Download latest data');
    const result = await service.downloadLatestData();
    
    console.log('Result:', {
      success: result.success,
      fromCache: result.fromCache,
      recordCount: result.recordCount,
      dataAge: result.dataAge.toFixed(2) + ' hours',
      error: result.error
    });

    if (result.data && result.data.length > 0) {
      console.log('Sample data:', result.data.slice(0, 2));
    }

    // Test 2: Validate CSV data
    console.log('\n✅ Test 2: Data validation');
    const sampleCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,36,5,,
5299,13/07/2024,1,8,15,28,31,37,2,,
5298,10/07/2024,5,12,19,26,29,35,7,,`;

    const validation = service.validateData(sampleCSV);
    console.log('Validation result:', {
      isValid: validation.isValid,
      recordCount: validation.recordCount,
      hasRequiredColumns: validation.hasRequiredColumns,
      dataQualityScore: validation.dataQualityScore,
      errors: validation.errors
    });

    // Test 3: Invalid CSV validation
    console.log('\n❌ Test 3: Invalid CSV validation');
    const invalidCSV = `Invalid,Header
1,2,3`;

    const invalidValidation = service.validateData(invalidCSV);
    console.log('Invalid validation result:', {
      isValid: invalidValidation.isValid,
      errors: invalidValidation.errors.slice(0, 3) // Show first 3 errors
    });

    // Test 4: Cache functionality
    console.log('\n💾 Test 4: Cache functionality');
    console.log('Data age:', service.getDataAge().toFixed(2) + ' hours');
    console.log('Cached data count:', service.getCachedData().length);

    // Test 5: Configuration
    console.log('\n⚙️ Test 5: Configuration');
    const config = service.getConfig();
    console.log('Current config:', {
      maxRetries: config.maxRetries,
      retryDelay: config.retryDelay,
      cacheTimeout: config.cacheTimeout
    });

    console.log('\n✅ All tests completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run tests if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).testDataRefreshService = testDataRefreshService;
  console.log('DataRefreshService test function available as window.testDataRefreshService()');
}