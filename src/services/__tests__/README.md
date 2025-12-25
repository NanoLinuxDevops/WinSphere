# DataRefreshService Unit Tests

This test suite provides comprehensive coverage for the DataRefreshService class, testing all major functionality as required by task 11.

## Test Coverage

### CSV Download Functionality (7 tests)
- ✅ Successful download and parsing of valid CSV data
- ✅ Network error handling with retry logic
- ✅ Timeout error handling
- ✅ CORS error handling  
- ✅ Server error (5xx) handling
- ✅ Exponential backoff for retries
- ✅ Fallback to cached data when download fails

### Data Validation (10 tests)
- ✅ Validation of correct CSV format
- ✅ Rejection of CSV with missing required columns
- ✅ Rejection of empty CSV content
- ✅ Rejection of HTML content instead of CSV
- ✅ Handling of incomplete data rows
- ✅ Validation of number ranges (1-37 for main, 1-7 for bonus)
- ✅ Detection of duplicate numbers in a draw
- ✅ Validation of date formats
- ✅ Calculation of data quality score
- ✅ Provision of validation metrics

### Error Handling Scenarios (5 tests)
- ✅ Categorization of different error types
- ✅ User-friendly error messages
- ✅ Estimated retry times for retryable errors
- ✅ Processing error handling
- ✅ Unexpected error handling during validation

### Retry Logic (3 tests)
- ✅ Respect for maxRetries configuration
- ✅ Non-retry behavior for non-retryable errors
- ✅ Success on retry after initial failure

### Cache Management (3 tests)
- ✅ Use of fresh cached data when available
- ✅ Refresh of stale cached data
- ✅ Saving data to cache after successful download

### Configuration Options (2 tests)
- ✅ Respect for custom configuration
- ✅ Use of default configuration when none provided

### Edge Cases (4 tests)
- ✅ Handling of very large CSV files (1000+ records)
- ✅ Handling of CSV with extra whitespace and formatting issues
- ✅ Handling of CSV with mixed line endings
- ✅ Handling of concurrent download requests

## Key Testing Features

### Mock Network Responses
- Uses Vitest mocking to simulate various network conditions
- Tests both successful and failed HTTP requests
- Validates retry behavior and error categorization

### Data Validation Edge Cases
- Tests various CSV formats and malformed data
- Validates number ranges and duplicate detection
- Tests date parsing and validation logic

### Error Handling
- Comprehensive error type categorization
- User-friendly error message generation
- Fallback mechanism testing

### Performance Testing
- Large dataset handling (1000+ records)
- Concurrent request handling
- Memory usage optimization validation

## Requirements Validation

All tests validate the requirements specified in the auto-data-refresh spec:

- **Requirement 1.1-1.5**: Automatic data download and error handling
- **Requirement 2.1-2.4**: User feedback and loading states
- **Requirement 3.1-3.5**: Network failure handling and fallback mechanisms
- **Requirement 4.1-4.5**: Data validation and quality checks

## Running the Tests

```bash
# Run all DataRefreshService tests
npm run test src/services/__tests__/dataRefreshService.test.ts

# Run tests in watch mode
npm run test -- --watch src/services/__tests__/dataRefreshService.test.ts

# Run tests with UI
npm run test:ui
```