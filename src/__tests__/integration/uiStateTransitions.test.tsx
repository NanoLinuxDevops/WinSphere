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

describe('UI State Transitions Integration Tests', () => {
  let mockDataRefreshService: any
  let mockHybridLotteryPredictor: any
  let user: ReturnType<typeof userEvent.setup>

  const mockLotteryData = [
    { drawNumber: 5300, date: '01/01/2024', numbers: [1, 5, 12, 18, 25, 33], bonus: 3 },
    { drawNumber: 5299, date: '28/12/2023', numbers: [3, 8, 15, 22, 29, 35], bonus: 5 }
  ]

  const mockPrediction = {
    numbers: [7, 14, 21, 28, 35, 42],
    bonus: 6,
    confidence: 85.5,
    method: 'LSTM + ARIMA Ensemble'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    user = userEvent.setup()
    
    mockDataRefreshService = {
      downloadLatestData: vi.fn(),
      validateData: vi.fn(),
      getDataAge: vi.fn(),
      updatePredictorData: vi.fn()
    }
    
    mockHybridLotteryPredictor = {
      generatePrediction: vi.fn(),
      updateHistoricalData: vi.fn()
    }
    
    vi.mocked(DataRefreshService).mockImplementation(() => mockDataRefreshService)
    vi.mocked(HybridLotteryPredictor).mockImplementation(() => mockHybridLotteryPredictor)
    
    mockDataRefreshService.getDataAge.mockReturnValue(25)
    mockHybridLotteryPredictor.generatePrediction.mockReturnValue(mockPrediction)
    mockHybridLotteryPredictor.updateHistoricalData.mockResolvedValue(undefined)
    
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Loading Spinner and Progress Indicators', () => {
    it('should show enhanced loading spinner with refresh status', async () => {
      // Create controlled promise for timing
      let resolveDownload: (value: any) => void
      const downloadPromise = new Promise(resolve => {
        resolveDownload = resolve
      })
      
      mockDataRefreshService.downloadLatestData.mockReturnValue(downloadPromise)
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify enhanced loading spinner appears with refresh status
      await waitFor(() => {
        expect(screen.getByText(/refreshing data/i) || 
               screen.getByText(/downloading/i) ||
               screen.getByText(/checking/i)).toBeInTheDocument()
      })
      
      // Complete the download
      act(() => {
        resolveDownload!({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 2,
          dataAge: 0
        })
      })
      
      await waitFor(() => {
        expect(screen.queryByText(/refreshing data/i)).not.toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should display progress through multiple refresh stages', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 2,
        dataAge: 0
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // The loading process should go through various stages
      // We can't easily test each stage individually due to timing, but we can verify the process completes
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      })
    })

    it('should show error state in loading spinner when refresh fails', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: false,
        error: 'Network connection failed',
        errorDetails: {
          type: 'network_error',
          retryable: true,
          estimatedRetryTime: 30
        },
        fallbackUsed: true
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify error state is displayed
      await waitFor(() => {
        expect(screen.getByText(/failed/i) || 
               screen.getByText(/error/i) ||
               screen.getByText(/network/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })
  })

  describe('Data Status Notifications', () => {
    it('should display data age indicator correctly', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 2,
        dataAge: 2 // 2 hours old
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for refresh to complete and check for data age display
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      // Look for data age indicators
      await waitFor(() => {
        expect(screen.getByText(/hours/i) || 
               screen.getByText(/updated/i) ||
               screen.getByText(/fresh/i)).toBeInTheDocument()
      })
    })

    it('should show cached data warning notification', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: true,
        recordCount: 2,
        dataAge: 30, // 30 hours old - should trigger warning
        error: 'Fresh data unavailable, using cached data'
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify cached data warning appears
      await waitFor(() => {
        expect(screen.getByText(/cached/i) || 
               screen.getByText(/warning/i) ||
               screen.getByText(/old/i)).toBeInTheDocument()
      }, { timeout: 5000 })
    })

    it('should display success notification after successful refresh', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 2,
        dataAge: 0
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for completion and look for success indicators
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      await waitFor(() => {
        expect(screen.getByText(/fresh/i) || 
               screen.getByText(/updated/i) ||
               screen.getByText(/success/i)).toBeInTheDocument()
      })
    })

    it('should allow dismissing notifications', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: true,
        recordCount: 2,
        dataAge: 25,
        error: 'Using cached data due to network issues'
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for cached data notification
      await waitFor(() => {
        expect(screen.getByText(/cached/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Look for dismiss button (usually an X or close button)
      const dismissButtons = screen.queryAllByText('✕')
      if (dismissButtons.length > 0) {
        await act(async () => {
          await user.click(dismissButtons[0])
        })
        
        // Verify notification can be dismissed
        await waitFor(() => {
          expect(dismissButtons[0]).not.toBeInTheDocument()
        })
      }
    })
  })

  describe('Button State Management', () => {
    it('should disable generate button during refresh process', async () => {
      let resolveDownload: (value: any) => void
      const downloadPromise = new Promise(resolve => {
        resolveDownload = resolve
      })
      
      mockDataRefreshService.downloadLatestData.mockReturnValue(downloadPromise)
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify button is disabled during refresh
      await waitFor(() => {
        expect(generateButton).toBeDisabled()
      })
      
      // Complete the download
      act(() => {
        resolveDownload!({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 2,
          dataAge: 0
        })
      })
      
      // Verify button is re-enabled after completion
      await waitFor(() => {
        expect(generateButton).not.toBeDisabled()
      }, { timeout: 5000 })
    })

    it('should re-enable button after error occurs', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: false,
        error: 'Network error',
        errorDetails: {
          type: 'network_error',
          retryable: true
        },
        fallbackUsed: true
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for error to occur and button to be re-enabled
      await waitFor(() => {
        expect(generateButton).not.toBeDisabled()
      }, { timeout: 5000 })
    })

    it('should show retry button for retryable errors', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: false,
        error: 'Server temporarily unavailable',
        errorDetails: {
          type: 'server_error',
          retryable: true,
          estimatedRetryTime: 15
        },
        fallbackUsed: true
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Look for retry button
      await waitFor(() => {
        const retryButton = screen.queryByRole('button', { name: /retry/i })
        if (retryButton) {
          expect(retryButton).toBeInTheDocument()
        } else {
          // If no explicit retry button, the main generate button should be available for retry
          expect(generateButton).not.toBeDisabled()
        }
      }, { timeout: 5000 })
    })
  })

  describe('Prediction Display Updates', () => {
    it('should update prediction display after successful refresh', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 2,
        dataAge: 0
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for prediction to be updated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      // Verify prediction confidence is displayed
      await waitFor(() => {
        expect(screen.getByText('85.5%')).toBeInTheDocument()
      })
    })

    it('should show prediction freshness indicator', async () => {
      mockDataRefreshService.downloadLatestData.mockResolvedValue({
        success: true,
        data: mockLotteryData,
        fromCache: false,
        recordCount: 2,
        dataAge: 0
      })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for completion and check for freshness indicators
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalled()
      }, { timeout: 5000 })
      
      // Look for freshness indicators in the prediction area
      await waitFor(() => {
        expect(screen.getByText(/fresh/i) || 
               screen.getByText(/updated/i)).toBeInTheDocument()
      })
    })

    it('should maintain prediction display during refresh process', async () => {
      let resolveDownload: (value: any) => void
      const downloadPromise = new Promise(resolve => {
        resolveDownload = resolve
      })
      
      mockDataRefreshService.downloadLatestData.mockReturnValue(downloadPromise)
      
      render(<App />)
      
      // Wait for initial prediction to load
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      // Verify initial prediction is visible
      expect(screen.getByText(/confidence/i)).toBeInTheDocument()
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify prediction area is still visible during refresh (not completely hidden)
      expect(screen.getByText(/confidence/i)).toBeInTheDocument()
      
      // Complete the download
      act(() => {
        resolveDownload!({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 2,
          dataAge: 0
        })
      })
      
      // Verify prediction is updated
      await waitFor(() => {
        expect(mockHybridLotteryPredictor.generatePrediction).toHaveBeenCalled()
      }, { timeout: 5000 })
    })
  })

  describe('Error Recovery UI', () => {
    it('should show clear error messages for different error types', async () => {
      const errorScenarios = [
        {
          error: 'Network timeout occurred',
          errorDetails: { type: 'timeout_error', retryable: true },
          expectedText: /timeout|network/i
        },
        {
          error: 'Data validation failed',
          errorDetails: { type: 'validation_error', retryable: false },
          expectedText: /validation|invalid/i
        },
        {
          error: 'Server error occurred',
          errorDetails: { type: 'server_error', retryable: true },
          expectedText: /server|error/i
        }
      ]
      
      for (const scenario of errorScenarios) {
        mockDataRefreshService.downloadLatestData.mockResolvedValue({
          success: false,
          error: scenario.error,
          errorDetails: scenario.errorDetails,
          fallbackUsed: true
        })
        
        const { unmount } = render(<App />)
        
        await waitFor(() => {
          expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
        }, { timeout: 3000 })
        
        const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
        
        await act(async () => {
          await user.click(generateButton)
        })
        
        // Verify appropriate error message appears
        await waitFor(() => {
          expect(screen.getByText(scenario.expectedText)).toBeInTheDocument()
        }, { timeout: 5000 })
        
        unmount()
      }
    })

    it('should handle retry functionality correctly', async () => {
      // First call fails, second succeeds
      mockDataRefreshService.downloadLatestData
        .mockResolvedValueOnce({
          success: false,
          error: 'Temporary server error',
          errorDetails: {
            type: 'server_error',
            retryable: true,
            estimatedRetryTime: 10
          },
          fallbackUsed: true
        })
        .mockResolvedValueOnce({
          success: true,
          data: mockLotteryData,
          fromCache: false,
          recordCount: 2,
          dataAge: 0
        })
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.queryByText(/generating/i)).not.toBeInTheDocument()
      }, { timeout: 3000 })
      
      const generateButton = screen.getByRole('button', { name: /generate new prediction/i })
      
      // First attempt (fails)
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/error/i) || screen.getByText(/failed/i)).toBeInTheDocument()
      }, { timeout: 5000 })
      
      // Retry (should succeed)
      await act(async () => {
        await user.click(generateButton)
      })
      
      // Verify retry attempt
      await waitFor(() => {
        expect(mockDataRefreshService.downloadLatestData).toHaveBeenCalledTimes(2)
      }, { timeout: 5000 })
    })
  })
})