# Israeli Lottery Predictor - LSTM & ARIMA AI

An advanced lottery prediction application using LSTM neural networks and ARIMA time series analysis to predict Israeli lottery numbers (Mifal HaPayis).

## 🧠 Algorithm Implementation

This project implements the lottery prediction methodology described in the Medium article "Cracking the Lottery Code with AI: How ARIMA, LSTM and Machine Learning Could Help You Predict the Numbers".

### Key Features:
- **LSTM Neural Network**: Deep learning model for pattern recognition in lottery sequences
- **ARIMA Time Series**: Statistical model for trend analysis and forecasting
- **Hybrid Ensemble**: Combines both models for improved accuracy
- **Real-time Predictions**: Generate new predictions with confidence scores
- **Model Metrics**: Live tracking of accuracy, precision, recall, and F1-score

### Algorithm Components:

1. **LSTM (Long Short-Term Memory)**
   - Processes sequences of historical lottery draws
   - 50 hidden units with forget, input, and output gates
   - Learns patterns in number sequences over time
   - Generates predictions based on learned patterns

2. **ARIMA (AutoRegressive Integrated Moving Average)**
   - Analyzes time series trends in lottery numbers
   - Implements differencing for stationarity
   - Uses autocorrelation for pattern detection
   - Provides complementary predictions to LSTM

3. **Ensemble Method**
   - Combines LSTM (70%) and ARIMA (30%) predictions
   - Applies pattern validation (consecutive numbers, even/odd balance)
   - Calculates confidence scores based on historical frequency

## 🚀 How to Run the App

### Prerequisites
- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation & Setup

1. **Clone and navigate to the project:**
   ```bash
   git clone <repository-url>
   cd israeli-lottery-predictor
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production version
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint for code quality

## 🎯 Features

- **AI-Powered Predictions**: Uses LSTM + ARIMA ensemble for number generation
- **Real-time Metrics**: Live model performance tracking
- **Interactive UI**: Modern React interface with Tailwind CSS
- **Historical Analysis**: Charts showing prediction patterns and trends
- **Confidence Scoring**: Each prediction includes accuracy confidence
- **Responsive Design**: Works on desktop and mobile devices

## 🔧 Technical Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **ML Libraries**: ml-matrix, simple-statistics
- **Build Tool**: Vite
- **Icons**: Lucide React

## 📊 Model Performance

The hybrid model typically achieves:
- **Accuracy**: 82-95%
- **Precision**: 75-85%
- **Recall**: 78-88%
- **F1-Score**: 76-86%

*Note: These are simulated metrics for demonstration. Real lottery prediction accuracy would be significantly lower due to the random nature of lottery draws.*

## ⚠️ Disclaimer

This application is for educational and demonstration purposes only. Lottery numbers are random, and no algorithm can guarantee winning predictions. Please gamble responsibly and within your means.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

https://www.pais.co.il/lotto/archive.aspx