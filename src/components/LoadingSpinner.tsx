import React from 'react';
import { Brain } from 'lucide-react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Brain className="h-6 w-6 text-blue-500 animate-pulse" />
        </div>
      </div>
      <p className="text-white mt-4 font-medium">AI is analyzing patterns...</p>
      <p className="text-blue-200 text-sm mt-1">Generating optimal number combinations</p>
    </div>
  );
};

export default LoadingSpinner;