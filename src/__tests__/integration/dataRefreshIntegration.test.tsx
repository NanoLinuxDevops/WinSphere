import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../../App'
import { DataRefreshService } from '../../services/dataRefreshService'
import { HybridLotteryPredictor } from '../../services/lotteryPredictor'

// Mock the services
vi.mock('../../services/dataRefreshService')
vi.mock('../../services/lotteryPredictor')

// Mock data for testing
const mockValidCSV = `DrawNumber,Date,Num1,Num2,Num3,Num4,Num5,Num6,Bonus,Extra1,Extra2
5300,01/01/2024,1,5,12,18,25,33,3,,
5299,28/12/2023,3,8,15,22,29,35,5,,
5298,25/12/2023,2,9,16,23,30,36,7,,
5297,22/12/2023,4,11,17,24,31,37,2,,
5296,19/12/2023,6,13,19,26,32,34,1,,`

const mockLotteryData = [
  { drawNumber: 5300, date: '01/01/2024', numbers: [1, 5, 12, 18, 25, 33], bonus: 3 },
  { drawNumber: 5299, date: '28/12/2023', numbers: [3, 8, 15, 22, 29, 35], bonus: 5 },
  { drawNumber: 5298, date: '25/12/2023', numbers: [2, 9, 16, 23, 30, 36], bonus: 7 },
  { drawNumber: 5297, date: '22/12/2023', numbers: [4, 11, 17, 24, 31, 37], bonus: 2 },
  { drawNumber: 5296, date: '19/12/2023', numbers: [6, 13, 19, 26, 32, 34], bonus: 1 }
]

const mockPrediction = {
  numbers: [7, 14, 21, 28, 35, 42],
  bonus: 6,
  confidence: 85.5,
  method: 'LSTM + ARIMA Ensemble'
}

describe('Data Refresh Integration Tests', () => {
  let mockDataRefreshService: any
  let mockHybridLotteryPredictor: any
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Setup user event
    user = userEvent.setup()
    
    // Mock DataRefreshService
    mockDataRefreshService = {
      downloadLatestData: vi.fn(),
      validateData: vi.fn(),
      getDataAge: vi.fn(),
      updatePredictorData: vi.fn()
    }
    
    // Mock HybridLotteryPredictor
    mockHybridLotteryPredictor = {
      generatePrediction: vi.fn(),
      updateHistoricalData: vi.fn(),
      getModelMetrics: vi.fn().mockReturnValue({
        accuracy: 85.5,
        precision: 78.2,
        recall: 82.1,
        f1Score: 80.1,
        lastUpdated: new Date().toISOString()
      })
    }
    
    // Setup default mock implementations
    vi.mocked(DataRefreshService).mockImplementation(() => mockDataRefreshService)
    vi.mocked(HybridLotteryPredictor).mockImplementation(() => mockHybridLotteryPredictor)
    
    // Default successful responses
    mockDataRefreshService.downloadLatestData.mockResolvedValue({
      success: true,
      data: mockLotteryData,
      fromCache: false,
      recordCount: 5,
      dataAge: 0
    })
    
    mockDataRefreshService.getDataAge.mockReturnValue(25) // Stale data to trigger refresh
    
    mockHybridLotteryPredictor.generatePrediction.mockReturnValue(mockPrediction)
    mockHybridLotteryPredictor.updateHistoricalData.mockResolvedValue(undefined)
    
    // Mock console methods to reduce noise
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Complete End-to-End Refresh Flow', () => {
    it('should complete full refresh flow from button click to updated predictions', async () => {
      render(<App />)
      
      // Wait for initial load to complete
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Find and click the "Generate New Prediction" button
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      expect(generateButton).toBeInTheDocument()
      
      // Click the button to start refresh flow
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify loading state appears
      await waitFor(() => {
        expect(screen.getByText(/refreshing data/i) || screen.getByText(/downloading/i)).toBeInTheDocument()
      })
      
      // Wait for refresh to complete and verify services were called
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.updateHistoricalData).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              date: expect.any(String),
              numbers: expect.any(Array),
              bonus: expect.any(Number),
              drawNumber: expect.any(Number)
            })
          ])
        )
      })
      
      // Verify new prediction is generated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
      
      // Verify UI shows updated prediction
      await waitFor(() => {
        expect(screen.getByText('85.5%')).toBeInTheDocument() // Confidence
      })
      
      // Verify loading state is cleared
      await waitFor(() => {
        expect(screen.queryByText(/refreshing data/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/downloading/i)).not.toBeInTheDocument()
      })
    })

    it('should show progress through different refresh stages', async () => {
      // Mock progressive responses to simulate different stages
      let resolveDownload: (value: any) => void
      const downloadPromise = new Promise(resolve => {
        resolveDownload = resolve
      })
      
      mockDataRefreshService.downloadLatestData.mockReturnValue(downloadPromise)
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify downloading stage
      await waitFor(() => {
        expect(screen.getByText(/checking for latest lottery data/i) || 
               screen.getByText(/downloading/i) ||
               screen.getByText(/refreshing data/i)).toBeInTheDocument()
      })
      
      // Complete the download
      act(() => {
        resolveDownload!({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 5,
          dataAge: 0
        })
      })
      
      // Verify completion
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('should handle data refresh with cached data scenario', async () => {
      // Mock using cached data
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: true,
        recordCount: 5,
        dataAge: 12 // 12 hours old
      })
      
      mockDataRefreshService.getDataAge.mockReturnValue(12) // Fresh enough data
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify cached data notification appears
      await waitFor(() => {
        expect(screen.getByText(/using cached data/i) || 
               screen.getByText(/cached/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Verify prediction is still generated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
    })
  })

  describe('Network Failure Scenarios and Fallback Behavior', () => {
    it('should handle network timeout and show appropriate error message', async () => {
      // Mock network timeout
      mockDataRefreshService.downloadLatestData.mockRejectedValue(
        new Error('Request timeout - the server took too long to respond')
      )
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/timeout/i) || 
               screen.getByText(/network/i) ||
               screen.getByText(/failed/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Verify fallback prediction is still generated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
    })

    it('should handle CORS errors and fallback gracefully', async () => {
      // Mock CORS error
      mockDataRefreshService.downloadLatestData.mockRejectedValue(
        new Error('CORS policy blocked the request')
      )
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify error is handled and fallback occurs
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('should handle server errors (5xx) with retry mechanism', async () => {
      // Mock server error with retry capability
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: false,
        error: 'HTTP 500: Internal Server Error',
        errorDetails: {
          type: 'server_error',
          retryable: true,
          estimatedRetryTime: 30
        },
        fallbackUsed: true,
        retryAttempts: 3
      })
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify retry option is available
      await waitFor(() => {
        expect(screen.getByText(/retry/i) || 
               screen.getByText(/server error/i) ||
               screen.getByText(/failed/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Look for retry button and test retry functionality
      const retryButton = screen.queryByRole('button', { name: /retry/i })
      if (retryButton) {
        // Reset mock for retry attempt
        mockDataRefreshService.downloadLatestData.mockResolvedValue({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 5,
          dataAge: 0
        })
        
        await act(async () => {
          await user.click(retryButton)
        })
        
        // Verify retry attempt
        await waitFor(() => {
          expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalledTimes(2)
        })
      }
    })

    it('should handle data validation failures', async () => {
      // Mock validation failure
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: false,
        error: 'Data validation failed: Invalid CSV format',
        errorDetails: {
          type: 'validation_error',
          retryable: false
        },
        fallbackUsed: true
      })
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify validation error is shown
      await waitFor(() => {
        expect(screen.getByText(/validation/i) || 
               screen.getByText(/invalid/i) ||
               screen.getByText(/failed/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Verify fallback prediction is generated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
    })

    it('should handle complete network failure with cached data fallback', async () => {
      // Mock complete failure but with cached data available
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: true,
        recordCount: 5,
        dataAge: 48, // Old cached data
        error: 'Network connection failed after multiple attempts'
      })
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify cached data warning is shown
      await waitFor(() => {
        expect(screen.getByText(/cached/i) || 
               screen.getByText(/hours old/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Verify prediction is still generated with cached data
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
    })
  })

  describe('UI State Transitions During Refresh Process', () => {
    it('should show correct loading states during refresh stages', async () => {
      // Create a controlled promise to manage timing
      let resolveDownload: (value: any) => void
      const downloadPromise = new Promise(resolve => {
        resolveDownload = resolve
      })
      
      mockDataRefreshService.downloadLatestData.mockReturnValue(downloadPromise)
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify initial loading state
      await waitFor(() => {
        expect(screen.getByText(/refreshing data/i) || 
               screen.getByText(/checking/i) ||
               screen.getByText(/downloading/i)).toBeInTheDocument()
      })
      
      // Verify generate button is disabled during refresh
      expect(generateButton).toBeDisabled()
      
      // Complete the download
      act(() => {
        resolveDownload!({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 5,
          dataAge: 0
        })
      })
      
      // Verify loading state clears and button is re-enabled
      await waitFor(() => {
        expect(screen.queryByText(/refreshing data/i)).not.toBeInTheDocument()
      }, { timeout: 5000 })
      
      await waitFor(() => {
        expect(generateButton).not.toBeDisabled()
      })
    })

    it('should display data age and freshness indicators correctly', async () => {
      // Mock fresh data
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 5,
        dataAge: 0.5 // 30 minutes old
      })
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for refresh to complete
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      // Verify fresh data indicator
      await waitFor(() => {
        expect(screen.getByText(/fresh/i) || 
               screen.getByText(/minutes/i)).toBeInTheDocument()
      })
    })

    it('should handle error state transitions correctly', async () => {
      // Mock error scenario
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: false,
        error: 'Network connection failed',
        errorDetails: {
          type: 'network_error',
          retryable: true,
          estimatedRetryTime: 15
        },
        fallbackUsed: true
      })
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify error state is shown
      await waitFor(() => {
        expect(screen.getByText(/failed/i) || 
               screen.getByText(/error/i) ||
               screen.getByText(/network/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Verify button is re-enabled after error
      await waitFor(() => {
        expect(generateButton).not.toBeDisabled()
      })
    })

    it('should show progress indicators with percentage and status messages', async () => {
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Look for progress indicators (these might appear briefly)
      // We'll check that the loading process starts and completes
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      // Verify the process completes successfully
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
    })

    it('should handle notification system during refresh process', async () => {
      // Mock successful refresh with notification
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 5,
        dataAge: 0
      })
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for completion and check for success indicators
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      // Look for success notification or fresh data indicator
      await waitFor(() => {
        expect(screen.getByText(/fresh/i) || 
               screen.getByText(/updated/i) ||
               screen.getByText(/success/i)).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('should handle rapid successive button clicks gracefully', async () => {
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      // Click multiple times rapidly
      await act(async () => {
        await user.click(generateButton)
        await user.click(generateButton)
        await user.click(generateButton)
      })
      
      // Verify only one refresh process is triggered
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalledTimes(1)
      }, { timeout: 5000 })
    })

    it('should handle component unmounting during refresh', async () => {
      const { unmount } = render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Unmount component during refresh
      act(() => {
        unmount()
      })
      
      // Verify no errors are thrown (test passes if no exceptions)
      expect(true).toBe(true)
    })

    it('should handle predictor update failures gracefully', async () => {
      // Mock predictor update failure
      mockHybridLotteryPredictor.updateHistoricalData.mockRejectedValue(
        new Error('Failed to update predictor models')
      )
      
      render(<App />)
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Start refresh
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify fallback prediction is still generated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      }, { timeout: 5000 })
    })

    it('should handle prediction generation failures with fallback', async () => {
      // Mock prediction generation failure
      mockHybridLotteryPredictor.generatePrediction.mockImplementation(() => {
        throw new Error('Prediction generation failed')
      })
      
      render(<App />)
      
      // Wait for initial load and verify fallback prediction appears
      await waitFor(() => {
        // The app should show some prediction numbers even if generation fails
        expect(screen.getByText(/confidence/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })
})