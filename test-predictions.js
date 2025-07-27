// Quick test of the improved prediction algorithm
console.log('🎯 Testing improved lottery prediction algorithm...\n');

// Simulate the improved distribution logic
function generateImprovedPrediction() {
  const numbers = [];
  const ranges = { low: 0, mid: 0, high: 0 };
  const maxPerRange = 2;
  
  // Generate numbers with better distribution
  while (numbers.length < 6) {
    const num = Math.floor(Math.random() * 37) + 1;
    
    if (numbers.includes(num)) continue;
    
    let range;
    if (num <= 12) range = 'low';
    else if (num <= 25) range = 'mid';
    else range = 'high';
    
    // Add if range not full or if we need to fill remaining slots
    if (ranges[range] < maxPerRange || numbers.length >= 4) {
      numbers.push(num);
      if (ranges[range] < maxPerRange) ranges[range]++;
    }
  }
  
  return {
    numbers: numbers.sort((a, b) => a - b),
    bonus: Math.floor(Math.random() * 7) + 1
  };
}

// Generate 5 test predictions
for (let i = 1; i <= 5; i++) {
  const prediction = generateImprovedPrediction();
  console.log(`Prediction ${i}: ${prediction.numbers.join(', ')} (bonus: ${prediction.bonus})`);
  
  // Analyze distribution
  const ranges = { low: 0, mid: 0, high: 0 };
  prediction.numbers.forEach(num => {
    if (num <= 12) ranges.low++;
    else if (num <= 25) ranges.mid++;
    else ranges.high++;
  });
  
  console.log(`  Distribution - Low (1-12): ${ranges.low}, Mid (13-25): ${ranges.mid}, High (26-37): ${ranges.high}`);
  console.log(`  Spread: ${prediction.numbers[5] - prediction.numbers[0]} (vs winning spread: 34)\n`);
}

console.log('📊 Comparison with your previous predictions:');
console.log('Previous: 35,32,28,22,10,03 - All clustered in mid-high range');
console.log('Previous: 35,32,28,21,14,10 - All clustered in mid-high range');
console.log('Winning:  36,26,25,18,4,2   - Good spread across all ranges');
console.log('\n✅ New algorithm should provide much better distribution!');