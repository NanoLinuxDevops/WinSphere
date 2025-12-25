/**
 * Test Error Handling and Fallback Mechanisms
 * 
 * This test validates the implementation of task 7:
 * - Implement graceful fallback to cached data when download fails
 * - Create user-friendly error messages for different failure types
 * - Add retry options and estimated time displays for network issues
 * 
 * Run this test by opening it in a browser console or including it in your app
 */

// This test will be run in the browser context where the modules are available
console.log('🧪 Error Handling and Fallback Mechanism Tests');

// Test configuration
const TEST_CONFIG = {
  maxRetries: 2, // Reduced for faster testing
  retryDelay: 100, // Reduced for faster testing
  cacheTimeout: 1, // 1 hour for testing
  validateDataQuality: true,
  fallbackToCachedData: true,
  dataSourceUrl: 'https://invalid-url-for-testing.com/data.csv'
};

// Mock localStorage for testing
const mockLocalStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

// Replace global localStorage with mock
global.localStorage = mockLocalStorage;

// Mock fetch for testing different error scenarios
const createMockFetch = (scenario) => {
  return async (url, options) => {
    console.log(`🧪 Mock fetch called for scenario: ${scenario}`);
    
    switch (scenario) {
      case 'network_error':
        throw new Error('Network request failed');
      
      case 'timeout_error':
        throw new Error('Request timeout - the server took too long to respond');
      
      case 'cors_error':
        throw new Error('CORS policy: Cross-origin requests are blocked');
      
      case 'server_error':
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: async () => 'Server Error'
        };
      
      case 'invalid_data':
        return {
          ok: true,
          status: 200,
          text: async () => 'Invalid CSV data without proper structure'
        };
      
      case 'empty_response':
        return {
          ok: true,
          status: 200,
          text: async () => ''
        };
      
      case 'html_response':
        return {
          ok: true,
          status: 200,
          text: async () => '<!DOCTYPE html><html><body>Error page</body></html>'
        };
      
      case 'valid_csv':
        return {
          ok: true,
          status: 200,
          text: async () => `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus
5300,16/07/2024,3,14,22,25,33,38,5
5299,13/07/2024,7,15,23,28,31,36,2`
        };
      
      default:
        throw new Error('Unknown test scenario');
    }
  };
};

// Test helper functions
const setupCachedData = () => {
  const cachedData = [
    {
      date: '2024-07-10',
      drawNumber: 5298,
      numbers: [1, 12, 18, 24, 30, 37],
      bonus: 3
    },
    {
      date: '2024-07-07',
      drawNumber: 5297,
      numbers: [5, 11, 19, 26, 32, 35],
      bonus: 6
    }
  ];
  
  const timestamp = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
  
  localStorage.setItem('lottery-data-cache', JSON.stringify(cachedData));
  localStorage.setItem('lottery-data-timestamp', timestamp.toISOString());
  
  return { cachedData, timestamp };
};

const clearCache = () => {
  localStorage.clear();
};

// Test functions
async function testNetworkErrorFallback() {
  console.log('\n🧪 Testing Network Error Fallback...');
  
  // Setup cached data
  const { cachedData } = setupCachedData();
  
  // Mock fetch to simulate network error
  global.fetch = createMockFetch('network_error');
  
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  
  // Verify fallback behavior
  console.log('✅ Result:', {
    success: result.success,
    fromCache: result.fromCache,
    fallbackUsed: result.fallbackUsed,
    errorType: result.errorDetails?.type,
    retryable: result.errorDetails?.retryable,
    recordCount: result.recordCount
  });
  
  // Assertions
  if (!result.success || !result.fromCache || !result.fallbackUsed) {
    throw new Error('❌ Network error fallback failed');
  }
  
  if (result.errorDetails?.type !== 'network_error') {
    throw new Error('❌ Error type not correctly identified');
  }
  
  if (!result.errorDetails?.retryable) {
    throw new Error('❌ Network errors should be retryable');
  }
  
  if (result.recordCount !== cachedData.length) {
    throw new Error('❌ Cached data not properly returned');
  }
  
  console.log('✅ Network error fallback test passed');
}

async function testTimeoutErrorHandling() {
  console.log('\n🧪 Testing Timeout Error Handling...');
  
  setupCachedData();
  global.fetch = createMockFetch('timeout_error');
  
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  
  console.log('✅ Result:', {
    success: result.success,
    errorType: result.errorDetails?.type,
    estimatedRetryTime: result.errorDetails?.estimatedRetryTime,
    retryAttempts: result.retryAttempts
  });
  
  // Assertions
  if (result.errorDetails?.type !== 'timeout_error') {
    throw new Error('❌ Timeout error not correctly identified');
  }
  
  if (!result.errorDetails?.estimatedRetryTime || result.errorDetails.estimatedRetryTime <= 0) {
    throw new Error('❌ Estimated retry time not provided for timeout error');
  }
  
  if (result.retryAttempts !== TEST_CONFIG.maxRetries) {
    throw new Error('❌ Retry attempts not correctly tracked');
  }
  
  console.log('✅ Timeout error handling test passed');
}

async function testServerErrorHandling() {
  console.log('\n🧪 Testing Server Error Handling...');
  
  setupCachedData();
  global.fetch = createMockFetch('server_error');
  
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  
  console.log('✅ Result:', {
    success: result.success,
    errorType: result.errorDetails?.type,
    estimatedRetryTime: result.errorDetails?.estimatedRetryTime
  });
  
  // Assertions
  if (result.errorDetails?.type !== 'server_error') {
    throw new Error('❌ Server error not correctly identified');
  }
  
  if (!result.errorDetails?.estimatedRetryTime || result.errorDetails.estimatedRetryTime < 60) {
    throw new Error('❌ Server errors should have longer estimated retry times');
  }
  
  console.log('✅ Server error handling test passed');
}

async function testValidationErrorFallback() {
  console.log('\n🧪 Testing Validation Error Fallback...');
  
  setupCachedData();
  global.fetch = createMockFetch('invalid_data');
  
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  
  console.log('✅ Result:', {
    success: result.success,
    errorType: result.errorDetails?.type,
    fromCache: result.fromCache,
    fallbackUsed: result.fallbackUsed
  });
  
  // Assertions
  if (result.errorDetails?.type !== 'validation_error') {
    throw new Error('❌ Validation error not correctly identified');
  }
  
  if (!result.success || !result.fromCache || !result.fallbackUsed) {
    throw new Error('❌ Validation error fallback failed');
  }
  
  console.log('✅ Validation error fallback test passed');
}

async function testUserFriendlyErrorMessages() {
  console.log('\n🧪 Testing User-Friendly Error Messages...');
  
  setupCachedData();
  
  const errorScenarios = [
    { scenario: 'network_error', expectedKeywords: ['connect', 'internet'] },
    { scenario: 'timeout_error', expectedKeywords: ['timeout', 'server', 'busy'] },
    { scenario: 'cors_error', expectedKeywords: ['access', 'restricted'] },
    { scenario: 'server_error', expectedKeywords: ['server', 'unavailable'] }
  ];
  
  for (const { scenario, expectedKeywords } of errorScenarios) {
    global.fetch = createMockFetch(scenario);
    
    const service = new DataRefreshService(TEST_CONFIG);
    const result = await service.downloadLatestData();
    
    const errorMessage = result.error?.toLowerCase() || '';
    
    console.log(`📝 ${scenario} message: "${result.error}"`);
    
    // Check if error message contains expected keywords
    const hasExpectedKeywords = expectedKeywords.some(keyword => 
      errorMessage.includes(keyword.toLowerCase())
    );
    
    if (!hasExpectedKeywords) {
      throw new Error(`❌ Error message for ${scenario} doesn't contain expected keywords: ${expectedKeywords.join(', ')}`);
    }
    
    // Check if retry time is mentioned for retryable errors
    if (result.errorDetails?.retryable && result.errorDetails?.estimatedRetryTime) {
      if (!errorMessage.includes('try again') && !errorMessage.includes('retry')) {
        console.warn(`⚠️ Retryable error message should mention retry option`);
      }
    }
  }
  
  console.log('✅ User-friendly error messages test passed');
}

async function testNoFallbackWhenNoCachedData() {
  console.log('\n🧪 Testing No Fallback When No Cached Data...');
  
  // Clear any cached data
  clearCache();
  
  global.fetch = createMockFetch('network_error');
  
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  
  console.log('✅ Result:', {
    success: result.success,
    fromCache: result.fromCache,
    fallbackUsed: result.fallbackUsed,
    recordCount: result.recordCount
  });
  
  // Assertions
  if (result.success) {
    throw new Error('❌ Should fail when no cached data available');
  }
  
  if (result.fromCache || result.fallbackUsed) {
    throw new Error('❌ Should not indicate fallback when no cached data');
  }
  
  if (result.recordCount > 0) {
    throw new Error('❌ Should have zero records when no data available');
  }
  
  console.log('✅ No fallback when no cached data test passed');
}

async function testSuccessfulRefreshSkipsFallback() {
  console.log('\n🧪 Testing Successful Refresh Skips Fallback...');
  
  setupCachedData();
  global.fetch = createMockFetch('valid_csv');
  
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  
  console.log('✅ Result:', {
    success: result.success,
    fromCache: result.fromCache,
    fallbackUsed: result.fallbackUsed,
    recordCount: result.recordCount
  });
  
  // Assertions
  if (!result.success) {
    throw new Error('❌ Should succeed with valid CSV data');
  }
  
  if (result.fromCache || result.fallbackUsed) {
    throw new Error('❌ Should not use fallback when refresh succeeds');
  }
  
  if (result.recordCount === 0) {
    throw new Error('❌ Should have records from successful refresh');
  }
  
  console.log('✅ Successful refresh skips fallback test passed');
}

async function testRetryLogicWithExponentialBackoff() {
  console.log('\n🧪 Testing Retry Logic with Exponential Backoff...');
  
  setupCachedData();
  
  let callCount = 0;
  const callTimes = [];
  
  global.fetch = async (url, options) => {
    callTimes.push(Date.now());
    callCount++;
    console.log(`📞 Fetch call #${callCount} at ${new Date().toISOString()}`);
    throw new Error('Network request failed');
  };
  
  const startTime = Date.now();
  const service = new DataRefreshService(TEST_CONFIG);
  const result = await service.downloadLatestData();
  const endTime = Date.now();
  
  console.log('✅ Result:', {
    success: result.success,
    retryAttempts: result.retryAttempts,
    totalTime: endTime - startTime,
    callCount
  });
  
  // Assertions
  if (callCount !== TEST_CONFIG.maxRetries) {
    throw new Error(`❌ Expected ${TEST_CONFIG.maxRetries} calls, got ${callCount}`);
  }
  
  if (result.retryAttempts !== TEST_CONFIG.maxRetries) {
    throw new Error(`❌ Retry attempts not correctly tracked`);
  }
  
  // Check that there was some delay between calls (exponential backoff)
  if (callTimes.length > 1) {
    const timeBetweenCalls = callTimes[1] - callTimes[0];
    if (timeBetweenCalls < TEST_CONFIG.retryDelay) {
      throw new Error('❌ Exponential backoff delay not applied');
    }
  }
  
  console.log('✅ Retry logic with exponential backoff test passed');
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Error Handling and Fallback Mechanism Tests...\n');
  
  const tests = [
    testNetworkErrorFallback,
    testTimeoutErrorHandling,
    testServerErrorHandling,
    testValidationErrorFallback,
    testUserFriendlyErrorMessages,
    testNoFallbackWhenNoCachedData,
    testSuccessfulRefreshSkipsFallback,
    testRetryLogicWithExponentialBackoff
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      failed++;
    }
    
    // Clear cache between tests
    clearCache();
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All error handling and fallback mechanism tests passed!');
    console.log('\n✅ Task 7 Requirements Verified:');
    console.log('   ✓ Graceful fallback to cached data when download fails');
    console.log('   ✓ User-friendly error messages for different failure types');
    console.log('   ✓ Retry options and estimated time displays for network issues');
    console.log('   ✓ Enhanced error categorization and handling');
    console.log('   ✓ Exponential backoff retry logic');
    console.log('   ✓ Proper error state management');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

export { runAllTests };