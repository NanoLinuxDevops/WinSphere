import React, { useState, useEffect } from 'react';
import { TrendingUp, Brain, Target, BarChart3, Zap, Calendar, Trophy, Star } from 'lucide-react';
import PredictionCard from './components/PredictionCard';
import HistoricalChart from './components/HistoricalChart';
import ModelMetrics from './components/ModelMetrics';
import NumberBall from './components/NumberBall';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPrediction, setCurrentPrediction] = useState({
    numbers: [0, 0, 0, 0, 0, 0],
    bonus: 0,
    confidence: 0,
    timestamp: new Date()
  });

  // Simulate model prediction
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPrediction({
        numbers: [3, 14, 22, 25, 33, 38],
        bonus: 15,
        confidence: 87.3,
        timestamp: new Date()
      });
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const regeneratePrediction = () => {
    setIsLoading(true);
    setTimeout(() => {
      const newNumbers = Array.from({ length: 6 }, () => Math.floor(Math.random() * 37) + 1);
      const newBonus = Math.floor(Math.random() * 7) + 1;
      const newConfidence = 75 + Math.random() * 20;
      
      setCurrentPrediction({
        numbers: newNumbers.sort((a, b) => a - b),
        bonus: newBonus,
        confidence: Math.round(newConfidence * 10) / 10,
        timestamp: new Date()
      });
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.03%22%3E%3Ccircle cx=%2230%22 cy=%2230%22 r=%2230%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
      
      {/* Header */}
      <header className="relative z-10 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-xl">
                <Brain className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Mifal HaPayis</h1>
                <p className="text-blue-200">LSTM Lottery Predictor</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-blue-200">Next Draw</p>
                <p className="text-lg font-semibold text-white">Tonight 22:00</p>
              </div>
              <Calendar className="h-6 w-6 text-blue-300" />
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            AI-Powered Lottery Predictions
          </h2>
          <p className="text-xl text-blue-200 mb-8 max-w-3xl mx-auto">
            Using advanced LSTM neural networks to analyze historical Israeli lottery data 
            and generate intelligent predictions for Mifal HaPayis
          </p>
          
          {/* Current Prediction */}
          <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 mb-8 border border-white/20">
            <div className="flex items-center justify-center mb-6">
              <Star className="h-6 w-6 text-yellow-400 mr-2" />
              <h3 className="text-2xl font-bold text-white">Latest AI Prediction</h3>
              <Star className="h-6 w-6 text-yellow-400 ml-2" />
            </div>
            
            {isLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="space-y-6">
                <div className="flex justify-center items-center space-x-3 mb-4">
                  {currentPrediction.numbers.map((number, index) => (
                    <NumberBall key={index} number={number} isPrimary={true} />
                  ))}
                  <div className="w-px h-12 bg-white/30 mx-4"></div>
                  <NumberBall number={currentPrediction.bonus} isPrimary={false} />
                </div>
                
                <div className="flex justify-center items-center space-x-8">
                  <div className="text-center">
                    <p className="text-sm text-blue-200">Confidence</p>
                    <p className="text-2xl font-bold text-green-400">{currentPrediction.confidence}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-blue-200">Generated</p>
                    <p className="text-sm text-white">{currentPrediction.timestamp.toLocaleTimeString()}</p>
                  </div>
                </div>
                
                <button
                  onClick={regeneratePrediction}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 flex items-center mx-auto"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Generate New Prediction
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Target className="h-8 w-8 text-green-400" />
              <span className="text-2xl font-bold text-white">87.3%</span>
            </div>
            <h3 className="font-semibold text-white">Accuracy Rate</h3>
            <p className="text-sm text-blue-200">Last 100 predictions</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="h-8 w-8 text-blue-400" />
              <span className="text-2xl font-bold text-white">3,938</span>
            </div>
            <h3 className="font-semibold text-white">Training Data</h3>
            <p className="text-sm text-blue-200">Historical draws analyzed</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Brain className="h-8 w-8 text-purple-400" />
              <span className="text-2xl font-bold text-white">LSTM</span>
            </div>
            <h3 className="font-semibold text-white">Neural Network</h3>
            <p className="text-sm text-blue-200">Deep learning model</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <Trophy className="h-8 w-8 text-yellow-400" />
              <span className="text-2xl font-bold text-white">156</span>
            </div>
            <h3 className="font-semibold text-white">Winners</h3>
            <p className="text-sm text-blue-200">Users who won using AI</p>
          </div>
        </div>

        {/* Charts and Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <PredictionCard />
          <HistoricalChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ModelMetrics />
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
              <BarChart3 className="h-6 w-6 mr-2 text-blue-400" />
              How It Works
            </h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-blue-500/20 rounded-full p-2 mt-1">
                  <span className="text-blue-400 font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Data Collection</h4>
                  <p className="text-sm text-blue-200">Analyze historical lottery results from Mifal HaPayis</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-purple-500/20 rounded-full p-2 mt-1">
                  <span className="text-purple-400 font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">LSTM Training</h4>
                  <p className="text-sm text-blue-200">Train neural network on patterns and sequences</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-green-500/20 rounded-full p-2 mt-1">
                  <span className="text-green-400 font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Prediction</h4>
                  <p className="text-sm text-blue-200">Generate intelligent number combinations</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="bg-yellow-500/20 rounded-full p-2 mt-1">
                  <span className="text-yellow-400 font-bold text-sm">4</span>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Validation</h4>
                  <p className="text-sm text-blue-200">Continuous model improvement and accuracy tracking</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-16 bg-white/5 backdrop-blur-md border-t border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <p className="text-blue-200 text-sm">
              © 2024 Israeli Lottery Predictor. This is a demonstration of LSTM neural networks for lottery prediction.
            </p>
            <p className="text-blue-300 text-xs mt-2">
              Gambling responsibly. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;