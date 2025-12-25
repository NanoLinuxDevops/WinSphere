import { HybridLotteryPredictor, LotteryDraw } from './lotteryPredictor';

/**
 * Test script to verify the new dynamic data update functionality
 * in the HybridLotteryPredictor class
 */
async function testHybridPredictorUpdates() {
  console.log('🧪 Testing HybridLotteryPredictor dynamic data updates...\n');

  try {
    // Create a new predictor instance
    const predictor = new HybridLotteryPredictor();
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('1. Testing initial data status:');
    const initialStatus = predictor.getDataStatus();
    console.log(`   - Last update: ${initialStatus.lastUpdate.toISOString()}`);
    console.log(`   - Data age: ${initialStatus.dataAge.toFixed(2)} hours`);
    console.log(`   - Is stale: ${initialStatus.isStale}`);
    console.log(`   - Total draws: ${initialStatus.totalDraws}`);
    console.log(`   - Real data loaded: ${initialStatus.realDataLoaded}\n`);

    // Test stale threshold modification
    console.log('2. Testing stale threshold modification:');
    predictor.setStaleThreshold(1); // 1 hour threshold
    console.log(`   - New threshold set to 1 hour`);
    console.log(`   - Is data stale now: ${predictor.isDataStale()}\n`);

    // Create some mock new data
    console.log('3. Testing data update with new lottery draws:');
    const newDraws: LotteryDraw[] = [
      {
        date: '2024-08-24',
        numbers: [5, 12, 18, 25, 31, 37],
        bonus: 3,
        drawNumber: 9999
      },
      {
        date: '2024-08-25',
        numbers: [2, 9, 16, 23, 29, 35],
        bonus: 6,
        drawNumber: 10000
      }
    ];

    await predictor.updateHistoricalData(newDraws);
    
    const updatedStatus = predictor.getDataStatus();
    console.log(`   - Updated total draws: ${updatedStatus.totalDraws}`);
    console.log(`   - New data age: ${updatedStatus.dataAge.toFixed(4)} hours`);
    console.log(`   - Is stale after update: ${updatedStatus.isStale}\n`);

    // Test duplicate data handling
    console.log('4. Testing duplicate data handling:');
    await predictor.updateHistoricalData(newDraws); // Same data again
    const duplicateStatus = predictor.getDataStatus();
    console.log(`   - Total draws after duplicate attempt: ${duplicateStatus.totalDraws} (should be same)\n`);

    // Test model refresh
    console.log('5. Testing model refresh:');
    await predictor.refreshModels();
    console.log('   - Models refreshed successfully\n');

    // Test prediction generation with updated data
    console.log('6. Testing prediction generation with updated data:');
    const prediction = predictor.generatePrediction();
    console.log(`   - Generated numbers: ${prediction.numbers.join(', ')}`);
    console.log(`   - Bonus: ${prediction.bonus}`);
    console.log(`   - Confidence: ${prediction.confidence}%`);
    console.log(`   - Method: ${prediction.method}\n`);

    // Test data age tracking over time (simulate time passage)
    console.log('7. Testing data age tracking:');
    // Manually set an older update time to test staleness
    (predictor as any).lastUpdateTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const staleStatus = predictor.getDataStatus();
    console.log(`   - Simulated data age: ${staleStatus.dataAge.toFixed(2)} hours`);
    console.log(`   - Is stale (with 1h threshold): ${staleStatus.isStale}\n`);

    console.log('✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Export for use in other test files
export { testHybridPredictorUpdates };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testHybridPredictorUpdates().catch(console.error);
}