'use client'

import React, { useEffect, useRef } from 'react'

interface SignalGraphsProps {
  rawSignal: number[]
  filteredSignal: number[]
  butterworthSignal: number[]
  samplingRate: number
  isRecording: boolean
}

export default function SignalGraphs({
  rawSignal,
  filteredSignal,
  butterworthSignal,
  samplingRate,
  isRecording,
}: SignalGraphsProps) {
  const rawCanvasRef = useRef<HTMLCanvasElement>(null)
  const filteredCanvasRef = useRef<HTMLCanvasElement>(null)
  const butterworthCanvasRef = useRef<HTMLCanvasElement>(null)

  const drawWaveform = (
    canvas: HTMLCanvasElement | null,
    signal: number[],
    color: string,
    title: string
  ) => {
    if (!canvas || signal.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const padding = 20

    // Clear canvas
    ctx.fillStyle = 'var(--background)'
    ctx.fillRect(0, 0, width, height)

    // Draw title
    ctx.fillStyle = 'var(--foreground)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(title, padding, 12)

    // Draw grid
    ctx.strokeStyle = 'var(--border)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 5; i++) {
      const y = padding + ((height - padding * 2) / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()
    }

    // Find min/max for scaling
    const min = Math.min(...signal)
    const max = Math.max(...signal)
    const range = max - min || 1

    // Draw waveform
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.beginPath()

    const pointsToShow = Math.min(signal.length, width - padding * 2)
    const step = Math.max(1, Math.floor(signal.length / pointsToShow))

    for (let i = 0; i < pointsToShow; i++) {
      const dataIndex = i * step
      if (dataIndex >= signal.length) break

      const value = signal[dataIndex]
      const normalized = (value - min) / range
      const x = padding + (i / pointsToShow) * (width - padding * 2)
      const y = height - padding - normalized * (height - padding * 2)

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Draw min/max indicators
    const minVal = Math.min(...signal).toFixed(1)
    const maxVal = Math.max(...signal).toFixed(1)
    const midVal = ((Math.min(...signal) + Math.max(...signal)) / 2).toFixed(1)

    ctx.fillStyle = 'var(--muted-foreground)'
    ctx.font = '9px monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`Max: ${maxVal}`, width - padding, padding + 10)
    ctx.fillText(`Mid: ${midVal}`, width - padding, height / 2)
    ctx.fillText(`Min: ${minVal}`, width - padding, height - padding + 10)
  }

  // Draw all waveforms when signal changes
  useEffect(() => {
    drawWaveform(rawCanvasRef.current, rawSignal, '#ff6b6b', 'Raw PPG Signal')
    drawWaveform(filteredCanvasRef.current, filteredSignal, '#4ecdc4', 'Bandpass Filtered')
    drawWaveform(butterworthCanvasRef.current, butterworthSignal, '#45b7d1', 'Butterworth Filtered')
  }, [rawSignal, filteredSignal, butterworthSignal])

  return (
    <div className="w-full space-y-2">
      {/* Raw PPG */}
      <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <canvas
          ref={rawCanvasRef}
          width={300}
          height={80}
          className="w-full"
          style={{
            background: 'var(--card)',
            display: 'block',
          }}
        />
      </div>

      {/* Bandpass Filtered */}
      <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <canvas
          ref={filteredCanvasRef}
          width={300}
          height={80}
          className="w-full"
          style={{
            background: 'var(--card)',
            display: 'block',
          }}
        />
      </div>

      {/* Butterworth Filtered */}
      <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <canvas
          ref={butterworthCanvasRef}
          width={300}
          height={80}
          className="w-full"
          style={{
            background: 'var(--card)',
            display: 'block',
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs px-2 py-1" style={{ color: 'var(--muted-foreground)' }}>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '12px',
              height: '2px',
              background: '#ff6b6b',
            }}
          />
          <span>PPG</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '12px',
              height: '2px',
              background: '#4ecdc4',
            }}
          />
          <span>Bandpass</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            style={{
              width: '12px',
              height: '2px',
              background: '#45b7d1',
            }}
          />
          <span>Butterworth</span>
        </div>
      </div>
    </div>
  )
}
