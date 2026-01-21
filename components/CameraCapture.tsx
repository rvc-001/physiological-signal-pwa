'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import WaveformCanvas from './WaveformCanvas'
import SignalGraphs from './SignalGraphs'
import { useSignalProcessing } from '@/hooks/useSignalProcessing'
import { saveClip } from '@/lib/storage'

interface CaptureState {
  isCapturing: boolean
  isPaused: boolean
  frameCount: number
  samplingRate: number
  signalBuffer: number[]
  flashEnabled: boolean
  cameraPermission: 'granted' | 'denied' | 'prompt' | null
  heartRate: number | null
}

export default function CameraCapture() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)

  const [state, setState] = useState<CaptureState>({
    isCapturing: false,
    isPaused: false,
    frameCount: 0,
    samplingRate: 30,
    signalBuffer: [],
    flashEnabled: false,
    cameraPermission: null,
    heartRate: null,
  })

  const [statusMessage, setStatusMessage] = useState('')
  const [elapsedTime, setElapsedTime] = useState(0)
  const [clipsSaved, setClipsSaved] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [rawSignalBuffer, setRawSignalBuffer] = useState<number[]>([])
  const [bandpassBuffer, setBandpassBuffer] = useState<number[]>([])
  const [butterworthBuffer, setButterworthBuffer] = useState<number[]>([])

  const { processSignalChunk } = useSignalProcessing()

  // Estimate heart rate from signal using FFT-like approach
  const estimateHeartRate = useCallback((signal: number[]) => {
    if (signal.length < state.samplingRate * 5) return null // Need at least 5 seconds

    // Simple peak detection approach for HR estimation
    let peaks = 0
    const threshold = signal.reduce((a, b) => a + b, 0) / signal.length
    let wasBelowThreshold = true

    for (let i = 1; i < signal.length; i++) {
      if (signal[i] > threshold && wasBelowThreshold) {
        peaks++
        wasBelowThreshold = false
      } else if (signal[i] <= threshold) {
        wasBelowThreshold = true
      }
    }

    // Convert peaks to BPM
    const secondsElapsed = signal.length / state.samplingRate
    const hr = Math.round((peaks / secondsElapsed) * 60)
    return hr > 40 && hr < 200 ? hr : null
  }, [state.samplingRate])

  const requestCamera = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => setStatusMessage('Video play failed'))
      }

      setState((prev) => ({ ...prev, cameraPermission: 'granted' }))
      setCameraReady(true)
    } catch (error) {
      const err = error as Error
      setState((prev) => ({ ...prev, cameraPermission: 'denied' }))
      setStatusMessage(`Camera access denied: ${err.message}`)
    }
  }, [])

  const startCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const clipDuration = 10
    const maxFrames = state.samplingRate * clipDuration
    let frameBuffer: number[] = []

    const captureFrame = () => {
      if (!state.isCapturing || state.isPaused) {
        animationRef.current = requestAnimationFrame(captureFrame)
        return
      }

      try {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)

        const imageData = ctx.getImageData(
          Math.floor(canvas.width * 0.25),
          Math.floor(canvas.height * 0.25),
          Math.floor(canvas.width * 0.5),
          Math.floor(canvas.height * 0.5)
        )

        const data = imageData.data
        let redSum = 0
        let pixelCount = 0

        for (let i = 0; i < data.length; i += 4) {
          redSum += data[i]
          pixelCount++
        }

        const redMean = redSum / pixelCount
        frameBuffer.push(redMean)

        const newBuffer = frameBuffer.slice(-300)
        const estimatedHR = estimateHeartRate(newBuffer)

        setState((prev) => ({
          ...prev,
          frameCount: prev.frameCount + 1,
          signalBuffer: newBuffer,
          heartRate: estimatedHR,
        }))

        if (frameBuffer.length >= maxFrames) {
          saveSignalClip(frameBuffer)
          frameBuffer = []
          setState((prev) => ({ ...prev, frameCount: 0 }))
        }
      } catch (err) {
        console.error('[v0] Frame capture error:', err)
      }

      animationRef.current = requestAnimationFrame(captureFrame)
    }

    setState((prev) => ({ ...prev, isCapturing: true }))
    setStatusMessage('Recording signal...')
    animationRef.current = requestAnimationFrame(captureFrame)
  }, [state.isCapturing, state.isPaused, state.samplingRate, estimateHeartRate])

  const pauseCapture = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
    setStatusMessage(state.isPaused ? 'Recording resumed...' : 'Recording paused')
  }, [state.isPaused])

  const saveSignalClip = async (rawSignal: number[]) => {
    try {
      const { signals, qualityMetrics } = await processSignalChunk(
        rawSignal,
        state.samplingRate
      )

      // Update display buffers for real-time visualization
      setRawSignalBuffer(signals.raw.slice(-300))
      setBandpassBuffer(signals.bandpass.slice(-300))
      setButterworthBuffer(signals.butterworth.slice(-300))

      const clip = {
        id: `clip-${Date.now()}`,
        timestamp: Date.now(),
        startTime: Date.now() - (rawSignal.length / state.samplingRate) * 1000,
        endTime: Date.now(),
        samplingRate: state.samplingRate,
        rawSignal,
        cleanedSignal: signals.butterworth,
        qualityMetrics,
      }

      await saveClip(clip)
      setClipsSaved((prev) => prev + 1)
      setStatusMessage(`Clip saved (${rawSignal.length} frames)`)
      setTimeout(() => setStatusMessage('Recording signal...'), 2000)
    } catch (error) {
      console.error('[v0] Save error:', error)
      setStatusMessage('Failed to save clip')
    }
  }

  const toggleFlash = useCallback(async () => {
    if (!streamRef.current) return

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      const capabilities = (videoTrack as any).getCapabilities?.()

      if (capabilities?.torch) {
        const settings = videoTrack.getSettings()
        const currentTorch = (settings as any).torch || false
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: !currentTorch }],
        })
        setState((prev) => ({ ...prev, flashEnabled: !prev.flashEnabled }))
      }
    } catch (error) {
      console.error('[v0] Flash toggle error:', error)
    }
  }, [state.flashEnabled])

  const stopCapture = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setState((prev) => ({
      ...prev,
      isCapturing: false,
      isPaused: false,
      frameCount: 0,
      signalBuffer: [],
      heartRate: null,
    }))
    setStatusMessage('')
    setElapsedTime(0)
  }, [])

  useEffect(() => {
    if (!state.isCapturing || state.isPaused) return

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [state.isCapturing, state.isPaused])

  useEffect(() => {
    requestCamera()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      setState((prev) => ({
        ...prev,
        isCapturing: false,
        isPaused: false,
        frameCount: 0,
        signalBuffer: [],
        heartRate: null,
      }))
      setStatusMessage('')
      setElapsedTime(0)
    }
  }, [requestCamera])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getSignalQuality = () => {
    if (!state.signalBuffer || state.signalBuffer.length === 0) return 0
    const mean = state.signalBuffer.reduce((a, b) => a + b, 0) / state.signalBuffer.length
    const variance = state.signalBuffer.reduce((a, x) => a + Math.pow(x - mean, 2), 0) / state.signalBuffer.length
    return parseFloat((Math.sqrt(variance) / mean).toFixed(2))
  }

  const getSignalRange = () => {
    if (!state.signalBuffer || state.signalBuffer.length === 0) {
      return { min: 0, max: 0 }
    }
    return {
      min: Math.min(...state.signalBuffer),
      max: Math.max(...state.signalBuffer),
    }
  }

  return (
    <main
      className="w-full h-full flex flex-col"
      style={{ background: 'var(--background)' }}
      role="main"
    >
      {/* Pre-Recording State - Initial Call to Action */}
      {!state.cameraPermission && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-4">
          <div className="text-center max-w-sm mx-auto">
            <h1
              className="text-2xl font-bold mb-2"
              style={{ color: 'var(--foreground)' }}
            >
              PPG Signal Capture
            </h1>
            <p
              className="text-sm mb-6"
              style={{ color: 'var(--muted-foreground)' }}
            >
              Record photoplethysmograph (PPG) signals using your device camera
            </p>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
              How to use:
            </h2>
            <ol className="text-xs space-y-2" style={{ color: 'var(--muted-foreground)' }}>
              <li>1. Position your fingertip over the rear camera</li>
              <li>2. Enable flashlight for better signal quality</li>
              <li>3. Keep finger steady for 10-second recordings</li>
              <li>4. Wait for signal quality assessment</li>
            </ol>
          </div>

          <button
            onClick={requestCamera}
            className="w-full max-w-xs px-6 py-3 rounded-lg font-semibold text-base transition-all hover:shadow-lg active:scale-95"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
            }}
            aria-label="Request camera access"
          >
            Enable Camera
          </button>

          {statusMessage && (
            <p
              className="text-xs text-center"
              style={{ color: 'var(--destructive)' }}
              role="alert"
            >
              {statusMessage}
            </p>
          )}
        </div>
      )}

      {/* Recording State */}
      {state.cameraPermission === 'granted' && (
        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black min-h-0">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            aria-label="Camera feed"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Status Bar - Top */}
          <div
            className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/70 via-black/50 to-transparent"
            role="status"
            aria-live="polite"
          >
            <div
              className="text-sm font-semibold text-white text-center"
              style={{ color: 'var(--primary)' }}
            >
              {state.isCapturing
                ? `Recording: ${formatTime(elapsedTime)}`
                : 'Position finger on camera'}
            </div>

            {state.isCapturing && (
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-white/80 text-center">
                <div>
                  <div className="text-xs opacity-70">Frames</div>
                  <div className="font-mono text-sm">{state.frameCount}</div>
                </div>
                <div>
                  <div className="text-xs opacity-70">Quality</div>
                  <div
                    className="font-mono text-sm"
                    style={{
                      color:
                        getSignalQuality() < 0.5
                          ? '#22c55e'
                          : getSignalQuality() < 1.0
                            ? '#eab308'
                            : '#ef4444',
                    }}
                  >
                    {getSignalQuality().toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-70">Clips</div>
                  <div className="font-mono text-sm">{clipsSaved}</div>
                </div>
              </div>
            )}
          </div>

          {/* Real-Time Waveform Graph */}
          {state.signalBuffer.length > 0 && (
            <div
              className="absolute bottom-28 left-4 right-4 z-10 p-3 rounded-lg border backdrop-blur-md"
              style={{
                background: 'rgba(0, 0, 0, 0.6)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-semibold text-white/90">Signal Waveform</h3>
                {state.heartRate && (
                  <span
                    className="text-xs font-mono px-2 py-1 rounded"
                    style={{
                      background: 'rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                    }}
                  >
                    {state.heartRate} BPM
                  </span>
                )}
              </div>

              <div className="overflow-x-auto">
                <WaveformCanvas
                  signal={state.signalBuffer}
                  height={80}
                  width={Math.min(window.innerWidth - 32, 400)}
                  color={state.isCapturing ? '#ef4444' : '#3b82f6'}
                  backgroundColor="rgba(0, 0, 0, 0.3)"
                  showGrid={true}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-2 text-xs text-white/70">
                <div>
                  <span className="opacity-75">Min:</span>
                  <span className="ml-1 font-mono">{getSignalRange().min.toFixed(0)}</span>
                </div>
                <div>
                  <span className="opacity-75">Range:</span>
                  <span className="ml-1 font-mono">
                    {(getSignalRange().max - getSignalRange().min).toFixed(0)}
                  </span>
                </div>
                <div>
                  <span className="opacity-75">Max:</span>
                  <span className="ml-1 font-mono">{getSignalRange().max.toFixed(0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Signal Graph Display */}
          {state.isCapturing && (rawSignalBuffer.length > 0 || bandpassBuffer.length > 0) && (
            <div
              className="absolute left-4 right-4 z-10 p-3 rounded-lg border backdrop-blur-md"
              style={{
                bottom: state.signalBuffer.length > 0 ? '240px' : '100px',
                background: 'rgba(0, 0, 0, 0.6)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              <h3 className="text-xs font-semibold text-white/90 mb-2">Signal Processing</h3>
              <SignalGraphs
                rawSignal={rawSignalBuffer}
                filteredSignal={bandpassBuffer}
                butterworthSignal={butterworthBuffer}
                samplingRate={state.samplingRate}
                isRecording={state.isCapturing}
              />
            </div>
          )}

          {/* Instruction Overlay - Before Recording */}
          {!state.isCapturing && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-5 bg-black/40 backdrop-blur-sm"
              aria-live="polite"
            >
              <div className="text-center space-y-4">
                <div>
                  <div className="text-base text-white/90 font-medium mb-2">
                    Ready to Record
                  </div>
                  <div className="text-xs text-white/60 mb-4">
                    Cover the rear camera lens completely with your fingertip
                  </div>
                </div>

                <button
                  onClick={() => {
                    setState((prev) => ({ ...prev, isCapturing: true }))
                    startCapture()
                  }}
                  className="px-8 py-3 rounded-lg font-semibold text-base transition-all hover:shadow-lg active:scale-95 min-w-[200px]"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                  }}
                  aria-label="Start recording PPG signal"
                >
                  Start Recording
                </button>
              </div>
            </div>
          )}

          {/* Controls Footer */}
          {state.isCapturing && (
            <div className="absolute bottom-0 left-0 right-0 flex justify-center items-center gap-4 p-4" style={{ background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(10px)' }}>
              <button
                onClick={pauseCapture}
                className="px-6 py-3 rounded-lg font-semibold text-base transition-all hover:shadow-lg active:scale-95"
                style={{
                  background: state.isPaused ? 'var(--primary)' : 'var(--secondary)',
                  color: state.isPaused ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
                }}
                aria-label={state.isPaused ? 'Resume recording' : 'Pause recording'}
              >
                {state.isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopCapture}
                className="px-6 py-3 rounded-lg font-semibold text-base transition-all hover:shadow-lg active:scale-95"
                style={{
                  background: 'var(--destructive)',
                  color: 'var(--destructive-foreground)',
                }}
                aria-label="Stop recording PPG signal"
              >
                Stop
              </button>
              <button
                onClick={toggleFlash}
                className="px-6 py-3 rounded-lg font-semibold text-base transition-all hover:shadow-lg active:scale-95"
                style={{
                  background: state.flashEnabled ? 'var(--primary)' : 'var(--secondary)',
                  color: state.flashEnabled ? 'var(--primary-foreground)' : 'var(--secondary-foreground)',
                }}
                aria-label="Toggle flashlight"
              >
                {state.flashEnabled ? 'Disable Flash' : 'Enable Flash'}
              </button>
              <button
                onClick={() => {}}
                className="px-4 py-3 rounded-lg font-semibold text-sm transition-all hover:shadow-lg active:scale-95 ml-auto"
                style={{
                  background: 'var(--muted)',
                  color: 'var(--muted-foreground)',
                }}
                aria-label="Recording settings and options"
                title="View recording options"
              >
                ⋮ More
              </button>
            </div>
          )}
        </div>
      )}

      {/* Camera Access Denied */}
      {state.cameraPermission === 'denied' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          <div className="text-center max-w-sm">
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: 'var(--foreground)' }}
            >
              Camera Access Required
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: 'var(--muted-foreground)' }}
            >
              This application requires camera access to capture PPG signals. Please grant permission and reload.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-all"
              style={{
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )}
    </main>
  )
}
