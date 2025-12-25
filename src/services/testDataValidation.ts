// Comprehensive test suite for data validation and quality checks
import { DataRefreshService, DataValidationResult } from './dataRefreshService';
import { DataValidationWarningSystem, DataQualityReport } from './dataValidationWarningSystem';

export class DataValidationTestSuite {
  private service: DataRefreshService;

  constructor() {
    this.service = new DataRefreshService();
  }

  /**
   * Run all validation tests
   */
  public async runAllTests(): Promise<{ passed: number; failed: number; results: any[] }> {
    console.log('🧪 Starting comprehensive data validation test suite...\n');

    const tests = [
      { name: 'Test Valid CSV Data', test: () => this.testValidCSVData() },
      { name: 'Test Empty CSV Content', test: () => this.testEmptyCSVContent() },
      { name: 'Test HTML Content Instead of CSV', test: () => this.testHTMLContent() },
      { name: 'Test Missing Required Columns', test: () => this.testMissingRequiredColumns() },
      { name: 'Test Invalid Data Types', test: () => this.testInvalidDataTypes() },
      { name: 'Test Out of Range Numbers', test: () => this.testOutOfRangeNumbers() },
      { name: 'Test Duplicate Numbers in Draw', test: () => this.testDuplicateNumbers() },
      { name: 'Test Invalid Date Formats', test: () => this.testInvalidDateFormats() },
      { name: 'Test Duplicate Draw Numbers', test: () => this.testDuplicateDrawNumbers() },
      { name: 'Test Insufficient Data Rows', test: () => this.testInsufficientDataRows() },
      { name: 'Test Suspicious Patterns', test: () => this.testSuspiciousPatterns() },
      { name: 'Test Data Freshness Validation', test: () => this.testDataFreshness() },
      { name: 'Test Statistical Anomalies', test: () => this.testStatisticalAnomalies() },
      { name: 'Test Warning System Integration', test: () => this.testWarningSystemIntegration() },
      { name: 'Test Quality Score Calculation', test: () => this.testQualityScoreCalculation() },
      { name: 'Test User Confirmation Requirements', test: () => this.testUserConfirmationRequirements() }
    ];

    const results = [];
    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        console.log(`🔍 Running: ${test.name}`);
        const result = await test.test();
        if (result.success) {
          console.log(`✅ PASSED: ${test.name}`);
          passed++;
        } else {
          console.log(`❌ FAILED: ${test.name} - ${result.message}`);
          failed++;
        }
        results.push({ name: test.name, ...result });
      } catch (error) {
        console.log(`💥 ERROR: ${test.name} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
        results.push({ name: test.name, success: false, message: error instanceof Error ? error.message : 'Unknown error' });
      }
      console.log(''); // Empty line for readability
    }

    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    return { passed, failed, results };
  }

  /**
   * Test validation with valid CSV data
   */
  private testValidCSVData(): { success: boolean; message: string; details?: any } {
    const validCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,37,5,,
5299,13/07/2024,1,8,15,28,31,36,2,,
5298,10/07/2024,7,12,19,24,29,35,4,,`;

    const result = this.service.validateData(validCSV);

    if (!result.isValid) {
      return { success: false, message: `Valid CSV marked as invalid: ${result.errors.join(', ')}` };
    }

    if (result.recordCount !== 3) {
      return { success: false, message: `Expected 3 records, got ${result.recordCount}` };
    }

    if (!result.hasRequiredColumns) {
      return { success: false, message: 'Required columns not detected in valid CSV' };
    }

    if (result.dataQualityScore < 80) {
      return { success: false, message: `Quality score too low for valid data: ${result.dataQualityScore}` };
    }

    return { success: true, message: 'Valid CSV data correctly validated', details: result };
  }

  /**
   * Test validation with empty CSV content
   */
  private testEmptyCSVContent(): { success: boolean; message: string; details?: any } {
    const emptyCSV = '';
    const result = this.service.validateData(emptyCSV);

    if (result.isValid) {
      return { success: false, message: 'Empty CSV incorrectly marked as valid' };
    }

    if (!result.errors.some(error => error.includes('empty'))) {
      return { success: false, message: 'Empty CSV error not properly detected' };
    }

    if (result.dataQualityScore !== 0) {
      return { success: false, message: `Expected quality score 0 for empty CSV, got ${result.dataQualityScore}` };
    }

    return { success: true, message: 'Empty CSV correctly rejected', details: result };
  }

  /**
   * Test validation with HTML content instead of CSV
   */
  private testHTMLContent(): { success: boolean; message: string; details?: any } {
    const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body><h1>404 Not Found</h1></body>
</html>`;

    const result = this.service.validateData(htmlContent);

    if (result.isValid) {
      return { success: false, message: 'HTML content incorrectly marked as valid CSV' };
    }

    if (!result.errors.some(error => error.includes('HTML'))) {
      return { success: false, message: 'HTML content error not properly detected' };
    }

    return { success: true, message: 'HTML content correctly rejected', details: result };
  }

  /**
   * Test validation with missing required columns
   */
  private testMissingRequiredColumns(): { success: boolean; message: string; details?: any } {
    const invalidHeaderCSV = `Draw,Numbers,Extra
5300,3-14-22-25-33-37,5
5299,1-8-15-28-31-36,2`;

    const result = this.service.validateData(invalidHeaderCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with missing columns incorrectly marked as valid' };
    }

    if (result.hasRequiredColumns) {
      return { success: false, message: 'Missing columns not properly detected' };
    }

    if (!result.errors.some(error => error.includes('Missing required columns'))) {
      return { success: false, message: 'Missing columns error not in error list' };
    }

    return { success: true, message: 'Missing required columns correctly detected', details: result };
  }

  /**
   * Test validation with invalid data types
   */
  private testInvalidDataTypes(): { success: boolean; message: string; details?: any } {
    const invalidDataCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
ABC,16/07/2024,3,14,22,25,33,37,5,,
5299,invalid-date,X,8,15,28,31,36,Y,,
5298,10/07/2024,7,12,19,24,29,35,4.5,,`;

    const result = this.service.validateData(invalidDataCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with invalid data types incorrectly marked as valid' };
    }

    const hasDrawNumberError = result.errors.some(error => error.includes('Invalid draw number'));
    const hasNumberError = result.errors.some(error => error.includes('Non-numeric'));
    const hasBonusError = result.errors.some(error => error.includes('Non-numeric bonus'));

    if (!hasDrawNumberError || !hasNumberError || !hasBonusError) {
      return { success: false, message: 'Not all invalid data type errors detected' };
    }

    return { success: true, message: 'Invalid data types correctly detected', details: result };
  }

  /**
   * Test validation with out of range numbers
   */
  private testOutOfRangeNumbers(): { success: boolean; message: string; details?: any } {
    const outOfRangeCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,0,14,22,25,33,38,5,,
5299,13/07/2024,1,8,15,28,31,36,8,,
5298,10/07/2024,-1,12,19,24,29,40,0,,`;

    const result = this.service.validateData(outOfRangeCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with out of range numbers incorrectly marked as valid' };
    }

    const hasNumberRangeError = result.errors.some(error => error.includes('out of range (1-37)'));
    const hasBonusRangeError = result.errors.some(error => error.includes('out of range (1-7)'));

    if (!hasNumberRangeError || !hasBonusRangeError) {
      return { success: false, message: 'Out of range errors not properly detected' };
    }

    return { success: true, message: 'Out of range numbers correctly detected', details: result };
  }

  /**
   * Test validation with duplicate numbers in same draw
   */
  private testDuplicateNumbers(): { success: boolean; message: string; details?: any } {
    const duplicateNumbersCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,25,37,5,,
5299,13/07/2024,1,1,15,28,31,36,2,,`;

    const result = this.service.validateData(duplicateNumbersCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with duplicate numbers incorrectly marked as valid' };
    }

    const hasDuplicateError = result.errors.some(error => error.includes('Duplicate numbers in the same draw'));

    if (!hasDuplicateError) {
      return { success: false, message: 'Duplicate numbers error not detected' };
    }

    return { success: true, message: 'Duplicate numbers correctly detected', details: result };
  }

  /**
   * Test validation with invalid date formats
   */
  private testInvalidDateFormats(): { success: boolean; message: string; details?: any } {
    const invalidDatesCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,,3,14,22,25,33,37,5,,
5299,not-a-date,1,8,15,28,31,36,2,,
5298,32/13/2024,7,12,19,24,29,35,4,,`;

    const result = this.service.validateData(invalidDatesCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with invalid dates incorrectly marked as valid' };
    }

    const hasMissingDateError = result.errors.some(error => error.includes('Missing or invalid date'));
    const hasDateParsingError = result.errors.some(error => error.includes('Date parsing error'));

    if (!hasMissingDateError && !hasDateParsingError) {
      return { success: false, message: 'Invalid date errors not properly detected' };
    }

    return { success: true, message: 'Invalid dates correctly detected', details: result };
  }

  /**
   * Test validation with duplicate draw numbers
   */
  private testDuplicateDrawNumbers(): { success: boolean; message: string; details?: any } {
    const duplicateDrawsCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,37,5,,
5300,13/07/2024,1,8,15,28,31,36,2,,
5298,10/07/2024,7,12,19,24,29,35,4,,`;

    const result = this.service.validateData(duplicateDrawsCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with duplicate draw numbers incorrectly marked as valid' };
    }

    const hasDuplicateDrawError = result.errors.some(error => error.includes('Duplicate draw number'));

    if (!hasDuplicateDrawError) {
      return { success: false, message: 'Duplicate draw number error not detected' };
    }

    return { success: true, message: 'Duplicate draw numbers correctly detected', details: result };
  }

  /**
   * Test validation with insufficient data rows
   */
  private testInsufficientDataRows(): { success: boolean; message: string; details?: any } {
    const smallDatasetCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,37,5,,`;

    const result = this.service.validateData(smallDatasetCSV);

    if (result.isValid) {
      return { success: false, message: 'CSV with insufficient data incorrectly marked as valid' };
    }

    const hasSmallDatasetError = result.errors.some(error => error.includes('too small') || error.includes('Minimum 5 records'));

    if (!hasSmallDatasetError) {
      return { success: false, message: 'Small dataset error not detected' };
    }

    return { success: true, message: 'Insufficient data correctly detected', details: result };
  }

  /**
   * Test validation with suspicious patterns
   */
  private testSuspiciousPatterns(): { success: boolean; message: string; details?: any } {
    const suspiciousCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,1,2,3,4,5,6,1,,
5299,13/07/2024,7,8,9,10,11,12,2,,
5298,10/07/2024,13,14,15,16,17,18,3,,
5297,07/07/2024,19,20,21,22,23,24,4,,
5296,04/07/2024,25,26,27,28,29,30,5,,
5295,01/07/2024,31,32,33,34,35,36,6,,`;

    const result = this.service.validateData(suspiciousCSV);

    const hasConsecutiveWarning = (result.warnings || []).some(warning => 
      warning.includes('consecutive numbers') || warning.includes('suspicious pattern')
    );

    if (!hasConsecutiveWarning) {
      return { success: false, message: 'Suspicious consecutive patterns not detected' };
    }

    if (result.dataQualityScore > 80) {
      return { success: false, message: 'Quality score should be reduced for suspicious patterns' };
    }

    return { success: true, message: 'Suspicious patterns correctly detected', details: result };
  }

  /**
   * Test data freshness validation
   */
  private testDataFreshness(): { success: boolean; message: string; details?: any } {
    const oldDataCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5000,16/07/2020,3,14,22,25,33,37,5,,
4999,13/07/2020,1,8,15,28,31,36,2,,
4998,10/07/2020,7,12,19,24,29,35,4,,
4997,07/07/2020,11,16,21,26,32,34,1,,
4996,04/07/2020,2,9,18,23,30,37,3,,
4995,01/07/2020,5,13,20,27,31,35,6,,`;

    const result = this.service.validateData(oldDataCSV);

    const hasOutdatedWarning = (result.warnings || []).some(warning => 
      warning.includes('outdated') || warning.includes('days old')
    );

    if (!hasOutdatedWarning) {
      return { success: false, message: 'Outdated data warning not detected' };
    }

    return { success: true, message: 'Data freshness correctly validated', details: result };
  }

  /**
   * Test statistical anomaly detection
   */
  private testStatisticalAnomalies(): { success: boolean; message: string; details?: any } {
    // Create data with limited number diversity (only uses numbers 1-10)
    const limitedDiversityCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,1,2,3,4,5,6,1,,
5299,13/07/2024,2,3,4,5,6,7,1,,
5298,10/07/2024,3,4,5,6,7,8,1,,
5297,07/07/2024,4,5,6,7,8,9,1,,
5296,04/07/2024,5,6,7,8,9,10,1,,
5295,01/07/2024,1,3,5,7,9,10,1,,`;

    const result = this.service.validateData(limitedDiversityCSV);

    const hasLowDiversityWarning = (result.warnings || []).some(warning => 
      warning.includes('diversity') || warning.includes('different numbers')
    );

    if (!hasLowDiversityWarning) {
      return { success: false, message: 'Low number diversity warning not detected' };
    }

    return { success: true, message: 'Statistical anomalies correctly detected', details: result };
  }

  /**
   * Test warning system integration
   */
  private testWarningSystemIntegration(): { success: boolean; message: string; details?: any } {
    const testCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,37,5,,
5299,13/07/2024,1,8,15,28,31,36,2,,`;

    const report = this.service.generateDataQualityReport(testCSV);

    if (!report.overallScore || report.overallScore < 0 || report.overallScore > 100) {
      return { success: false, message: 'Invalid overall score in quality report' };
    }

    if (!Array.isArray(report.warnings)) {
      return { success: false, message: 'Warnings array not properly initialized' };
    }

    if (!Array.isArray(report.recommendations)) {
      return { success: false, message: 'Recommendations array not properly initialized' };
    }

    if (typeof report.canProceed !== 'boolean') {
      return { success: false, message: 'canProceed flag not properly set' };
    }

    return { success: true, message: 'Warning system integration working correctly', details: report };
  }

  /**
   * Test quality score calculation
   */
  private testQualityScoreCalculation(): { success: boolean; message: string; details?: any } {
    // Test with perfect data
    const perfectCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,37,5,,
5299,13/07/2024,1,8,15,28,31,36,2,,
5298,10/07/2024,7,12,19,24,29,35,4,,
5297,07/07/2024,11,16,21,26,32,34,1,,
5296,04/07/2024,2,9,18,23,30,37,3,,
5295,01/07/2024,5,13,20,27,31,35,6,,`;

    const perfectResult = this.service.validateData(perfectCSV);

    if (perfectResult.dataQualityScore < 80) {
      return { success: false, message: `Perfect data should have high quality score, got ${perfectResult.dataQualityScore}` };
    }

    // Test with poor data
    const poorCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
ABC,invalid,X,Y,Z,A,B,C,9,,`;

    const poorResult = this.service.validateData(poorCSV);

    if (poorResult.dataQualityScore > 20) {
      return { success: false, message: `Poor data should have low quality score, got ${poorResult.dataQualityScore}` };
    }

    return { success: true, message: 'Quality score calculation working correctly' };
  }

  /**
   * Test user confirmation requirements
   */
  private testUserConfirmationRequirements(): { success: boolean; message: string; details?: any } {
    // Test data that should require confirmation
    const suspiciousCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2020,1,2,3,4,5,6,8,,`;

    const requiresConfirmation = this.service.requiresUserConfirmation(suspiciousCSV);

    if (!requiresConfirmation) {
      return { success: false, message: 'Suspicious data should require user confirmation' };
    }

    const prompt = this.service.generateUserConfirmationPrompt(suspiciousCSV);

    if (!prompt || prompt.length === 0) {
      return { success: false, message: 'User confirmation prompt not generated' };
    }

    // Test good data that shouldn't require confirmation
    const goodCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,16/07/2024,3,14,22,25,33,37,5,,
5299,13/07/2024,1,8,15,28,31,36,2,,
5298,10/07/2024,7,12,19,24,29,35,4,,
5297,07/07/2024,11,16,21,26,32,34,1,,
5296,04/07/2024,2,9,18,23,30,37,3,,
5295,01/07/2024,5,13,20,27,31,35,6,,`;

    const goodRequiresConfirmation = this.service.requiresUserConfirmation(goodCSV);

    if (goodRequiresConfirmation) {
      return { success: false, message: 'Good quality data should not require confirmation' };
    }

    return { success: true, message: 'User confirmation requirements working correctly' };
  }

  /**
   * Generate test report for display
   */
  public generateTestReport(results: any[]): string {
    let report = '📋 Data Validation Test Report\n';
    report += '================================\n\n';

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    report += `📊 Summary: ${passed} passed, ${failed} failed\n\n`;

    if (failed > 0) {
      report += '❌ Failed Tests:\n';
      results.filter(r => !r.success).forEach(result => {
        report += `  • ${result.name}: ${result.message}\n`;
      });
      report += '\n';
    }

    if (passed > 0) {
      report += '✅ Passed Tests:\n';
      results.filter(r => r.success).forEach(result => {
        report += `  • ${result.name}\n`;
      });
    }

    return report;
  }
}

// Export test runner function
export async function runDataValidationTests(): Promise<void> {
  const testSuite = new DataValidationTestSuite();
  const { passed, failed, results } = await testSuite.runAllTests();
  
  console.log('\n' + testSuite.generateTestReport(results));
  
  if (failed > 0) {
    throw new Error(`${failed} tests failed. See details above.`);
  }
}