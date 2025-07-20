// Test script to verify CSV parsing works with real Pais.co.il data
import { IsraeliLotteryAPI } from './israeliLotteryAPI';

export async function testRealData() {
  try {
    console.log('🧪 Testing real Pais.co.il CSV data parsing...');
    
    // Load the real CSV data
    const results = await IsraeliLotteryAPI.loadFromFile();
    
    console.log(`📊 Loaded ${results.length} real lottery results`);
    
    if (results.length > 0) {
      // Show first few results
      console.log('📋 First 5 results:');
      results.slice(0, 5).forEach((result, index) => {
        console.log(`${index + 1}. Draw ${result.drawNumber} (${result.date}): [${result.numbers.join(', ')}] + ${result.bonus}`);
      });
      
      // Analyze frequency
      const frequency = IsraeliLotteryAPI.analyzeFrequency(results);
      const sortedFreq = Array.from(frequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      console.log('🔥 Top 10 most frequent numbers:');
      sortedFreq.forEach(([num, freq], index) => {
        console.log(`${index + 1}. Number ${num}: appeared ${freq} times`);
      });
      
      return results;
    } else {
      console.log('❌ No data loaded - using fallback');
      return [];
    }
  } catch (error) {
    console.error('❌ Test failed:', error);
    return [];
  }
}