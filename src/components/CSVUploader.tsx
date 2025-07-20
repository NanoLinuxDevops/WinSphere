import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { IsraeliLotteryAPI } from '../services/israeliLotteryAPI';

interface CSVUploaderProps {
  onDataLoaded: (count: number) => void;
}

const CSVUploader: React.FC<CSVUploaderProps> = ({ onDataLoaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadStatus('error');
      setUploadMessage('Please upload a CSV file');
      return;
    }

    setIsUploading(true);
    setUploadStatus('idle');
    setUploadMessage('Processing CSV data...');

    try {
      const results = await IsraeliLotteryAPI.processUploadedCSV(file);
      
      if (results.length > 0) {
        setUploadStatus('success');
        setUploadMessage(`Successfully loaded ${results.length} lottery results!`);
        onDataLoaded(results.length);
        
        // Store data in localStorage for future use
        localStorage.setItem('israeliLotteryData', JSON.stringify(results));
      } else {
        setUploadStatus('error');
        setUploadMessage('No valid lottery data found in the CSV file');
      }
    } catch (error) {
      setUploadStatus('error');
      setUploadMessage('Failed to process CSV file. Please check the format.');
      console.error('CSV upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const openPaisWebsite = () => {
    window.open('https://www.pais.co.il/lotto/archive.aspx', '_blank');
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <FileText className="h-6 w-6 mr-2 text-blue-400" />
          Real Lottery Data
        </h3>
        <button
          onClick={openPaisWebsite}
          className="flex items-center text-sm text-blue-300 hover:text-blue-200 transition-colors"
        >
          <Download className="h-4 w-4 mr-1" />
          Download from Pais.co.il
        </button>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-blue-200">
          <p className="mb-2">
            Upload real Israeli lottery data from Pais.co.il to improve prediction accuracy:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Visit <span className="text-blue-300">pais.co.il/lotto/archive.aspx</span></li>
            <li>Download the CSV file with historical results</li>
            <li>Upload the CSV file here to train the AI model</li>
          </ol>
        </div>

        <div className="border-2 border-dashed border-white/30 rounded-xl p-6 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          {uploadStatus === 'idle' && !isUploading && (
            <div>
              <Upload className="h-12 w-12 text-blue-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-2">Upload CSV File</p>
              <p className="text-sm text-blue-200 mb-4">
                Drag and drop or click to select your Pais.co.il CSV file
              </p>
              <button
                onClick={handleUploadClick}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300"
              >
                Choose File
              </button>
            </div>
          )}

          {isUploading && (
            <div>
              <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-white font-semibold">Processing...</p>
              <p className="text-sm text-blue-200">{uploadMessage}</p>
            </div>
          )}

          {uploadStatus === 'success' && (
            <div>
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-green-400 font-semibold mb-2">Upload Successful!</p>
              <p className="text-sm text-blue-200">{uploadMessage}</p>
              <button
                onClick={handleUploadClick}
                className="mt-3 text-sm text-blue-300 hover:text-blue-200 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div>
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-400 font-semibold mb-2">Upload Failed</p>
              <p className="text-sm text-blue-200 mb-4">{uploadMessage}</p>
              <button
                onClick={handleUploadClick}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <h4 className="font-semibold text-white mb-2 text-sm">Expected CSV Format:</h4>
          <div className="text-xs text-blue-200 font-mono bg-black/20 p-2 rounded">
            DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Jackpot<br/>
            5234,16/07/2024,3,14,22,25,33,38,5,25000000<br/>
            5233,13/07/2024,1,8,15,19,27,36,3,22000000
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVUploader;