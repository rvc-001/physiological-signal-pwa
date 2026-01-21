'use client';

import { useEffect, useRef, useCallback } from 'react'
import { getSetting } from '@/lib/storage'

export interface QualityMetrics {
  snr: number
  clippingPercentage: number
  motionArtifactScore: number
  validSegment: boolean
}

export interface ProcessedSignals {
  raw: number[]
  bandpass: number[]
  butterworth: number[]
}

export function useSignalProcessing() {
  const workerRef = useRef<Worker | null>(null)
  const pendingCallbacksRef = useRef<Map<number, Function>>(new Map())
  const messageIdRef = useRef(0)

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      workerRef.current = new Worker('/signalWorker.js')

      workerRef.current.onmessage = (event: MessageEvent) => {
        const { id, result, error } = event.data
        const callback = pendingCallbacksRef.current.get(id)

        if (callback) {
          if (error) {
            callback(null, new Error(error))
          } else {
            callback(result, null)
          }
          pendingCallbacksRef.current.delete(id)
        }
      }

      workerRef.current.onerror = (error: ErrorEvent) => {
        console.error('[v0] Worker error:', error.message)
      }
    } catch (error) {
      console.error('[v0] Failed to initialize Web Worker:', error)
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [])

  /**
   * Process signal chunk with filtering and quality assessment
   */
  const processSignalChunk = useCallback(
    async (
      rawSignal: number[],
      samplingRate: number
    ): Promise<{ signals: ProcessedSignals; qualityMetrics: QualityMetrics }> => {
      return new Promise(async (resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Signal processing worker not initialized'))
          return
        }

        try {
          // Get filter settings
          const bandpassLow = (await getSetting('bandpassLow')) || 0.5
          const bandpassHigh = (await getSetting('bandpassHigh')) || 4.0
          const filterOrder = (await getSetting('filterOrder')) || 4

          const id = messageIdRef.current++

          pendingCallbacksRef.current.set(id, (result: any, error: Error | null) => {
            if (error) {
              reject(error)
            } else {
              resolve(result)
            }
          })

          workerRef.current.postMessage({
            id,
            type: 'processSignal',
            payload: {
              rawSignal,
              samplingRate,
              bandpassLow,
              bandpassHigh,
              filterOrder,
            },
          })
        } catch (error) {
          reject(error)
        }
      })
    },
    []
  )

  /**
   * Compute FFT for frequency analysis
   */
  const computeFFT = useCallback(
    async (signal: number[], samplingRate: number): Promise<number[]> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error('Signal processing worker not initialized'))
          return
        }

        const id = messageIdRef.current++

        pendingCallbacksRef.current.set(id, (result: any, error: Error | null) => {
          if (error) {
            reject(error)
          } else {
            resolve(result)
          }
        })

        workerRef.current.postMessage({
          id,
          type: 'computeFFT',
          payload: { signal, samplingRate },
        })
      })
    },
    []
  )

  return {
    processSignalChunk,
    computeFFT,
  }
}
