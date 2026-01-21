'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import WaveformCanvas from './WaveformCanvas'
import { getAllClips, getClipById, SignalClip } from '@/lib/storage'

export default function HistoricalPlayback() {
  const [clips, setClips] = useState<SignalClip[]>([])
  const [selectedClip, setSelectedClip] = useState<SignalClip | null>(null)
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(false)
  const [animationProgress, setAnimationProgress] = useState(0)
  const [showRawSignal, setShowRawSignal] = useState(false)
  const animationRef = useRef<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Load all clips on mount
  useEffect(() => {
    const loadClips = async () => {
      try {
        const allClips = await getAllClips()
        setClips(allClips)
      } catch (error) {
        console.error('[v0] Failed to load clips:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClips()
  }, [])

  // Auto-select first clip if available
  useEffect(() => {
    if (clips.length > 0 && !selectedClip) {
      setSelectedClip(clips[0])
    }
  }, [clips, selectedClip])

  /**
   * Animate waveform playback
   */
  const startAnimation = useCallback(() => {
    if (!selectedClip) return

    setIsPlayingAnimation(true)
    const totalFrames = selectedClip.cleanedSignal.length
    let currentFrame = 0

    const animate = () => {
      setAnimationProgress((currentFrame / totalFrames) * 100)
      currentFrame++

      if (currentFrame < totalFrames) {
        animationRef.current = requestAnimationFrame(animate)
      } else {
        setIsPlayingAnimation(false)
        setAnimationProgress(0)
      }
    }

    animationRef.current = requestAnimationFrame(animate)
  }, [selectedClip])

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    setIsPlayingAnimation(false)
    setAnimationProgress(0)
  }, [])

  /**
   * Get animated signal up to current progress
   */
  const getAnimatedSignal = useCallback((): number[] => {
    if (!selectedClip) return []

    const signal = showRawSignal ? selectedClip.rawSignal : selectedClip.cleanedSignal
    const endIdx = Math.floor((animationProgress / 100) * signal.length)
    return signal.slice(0, endIdx)
  }, [selectedClip, animationProgress, showRawSignal])

  /**
   * Format timestamp to readable string
   */
  const formatTime = (ms: number) => {
    const date = new Date(ms)
    return date.toLocaleString()
  }

  /**
   * Format duration in seconds
   */
  const formatDuration = (samples: number, rate: number) => {
    const secs = samples / rate
    return `${secs.toFixed(1)}s`
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ background: 'var(--background)' }}
      >
        <p style={{ color: 'var(--muted-foreground)' }}>Loading clips...</p>
      </div>
    )
  }

  if (clips.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4 p-4"
        style={{ background: 'var(--background)' }}
      >
        <p style={{ color: 'var(--muted-foreground)' }}>No signal clips recorded yet.</p>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Go to Capture tab to record signals
        </p>
      </div>
    )
  }

  const animatedSignal = getAnimatedSignal()

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Waveform Display */}
      <div
        className="flex-1 flex items-center justify-center p-4 border-b overflow-hidden"
        style={{ borderColor: 'var(--border)' }}
      >
        {selectedClip && animatedSignal.length > 0 ? (
          <div className="w-full">
            <WaveformCanvas
              signal={animatedSignal}
              height={200}
              color={showRawSignal ? '#f59e0b' : '#3b82f6'}
              backgroundColor="var(--card)"
              showGrid
            />
            <div className="mt-2 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {showRawSignal ? 'Raw Signal' : 'Filtered Signal'} •{' '}
              {formatDuration(animatedSignal.length, selectedClip.samplingRate)}
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--muted-foreground)' }}>Select a clip to view</p>
        )}
      </div>

      {/* Playback Controls */}
      {selectedClip && (
        <div
          className="p-4 border-b flex flex-col gap-3"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
            <div
              className="h-full transition-all"
              style={{
                width: `${animationProgress}%`,
                background: showRawSignal ? '#f59e0b' : '#3b82f6',
              }}
            />
          </div>

          {/* Control buttons */}
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={isPlayingAnimation ? stopAnimation : startAnimation}
              className="px-4 py-2 rounded font-medium text-sm transition-colors"
              style={{
                background: isPlayingAnimation ? 'var(--accent)' : 'var(--primary)',
                color: isPlayingAnimation ? 'var(--accent-foreground)' : 'var(--primary-foreground)',
              }}
              disabled={!selectedClip}
            >
              {isPlayingAnimation ? '⏸ Pause' : '▶ Play'}
            </button>

            <button
              onClick={() => {
                stopAnimation()
                setShowRawSignal(!showRawSignal)
              }}
              className="px-4 py-2 rounded font-medium text-sm transition-colors"
              style={{
                background: showRawSignal ? 'var(--accent)' : 'var(--muted)',
                color: showRawSignal ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {showRawSignal ? 'Raw' : 'Filtered'}
            </button>
          </div>

          {/* Clip Info */}
          {selectedClip && (
            <div className="text-xs space-y-1" style={{ color: 'var(--muted-foreground)' }}>
              <div>
                <strong>Time:</strong> {formatTime(selectedClip.timestamp)}
              </div>
              <div>
                <strong>Duration:</strong>{' '}
                {formatDuration(selectedClip.rawSignal.length, selectedClip.samplingRate)}
              </div>
              <div>
                <strong>Quality:</strong> SNR {selectedClip.qualityMetrics.snr.toFixed(1)}dB •
                Clip {selectedClip.qualityMetrics.clippingPercentage.toFixed(1)}%
              </div>
              {selectedClip.mlPredictions && (
                <div>
                  <strong>BP Est:</strong> {selectedClip.mlPredictions.systolicBP}/
                  {selectedClip.mlPredictions.diastolicBP} ({(selectedClip.mlPredictions.confidence! * 100).toFixed(0)}%)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-2">
          {clips.map((clip) => (
            <button
              key={clip.id}
              onClick={() => {
                setSelectedClip(clip)
                stopAnimation()
              }}
              className="w-full p-3 rounded text-left transition-colors text-sm"
              style={{
                background: selectedClip?.id === clip.id ? 'var(--primary)' : 'var(--card)',
                color:
                  selectedClip?.id === clip.id ? 'var(--primary-foreground)' : 'var(--foreground)',
                border: `1px solid var(--border)`,
              }}
            >
              <div className="font-medium text-xs mb-1">{formatTime(clip.timestamp)}</div>
              <div className="text-xs opacity-75">
                {formatDuration(clip.rawSignal.length, clip.samplingRate)} •
                {clip.qualityMetrics.validSegment ? '✓ Valid' : '✗ Invalid'}
              </div>
              {clip.mlPredictions && (
                <div className="text-xs mt-1 opacity-75">
                  BP: {clip.mlPredictions.systolicBP}/{clip.mlPredictions.diastolicBP}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
