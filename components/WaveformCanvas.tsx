'use client'

import React, { useEffect, useRef, useState } from 'react'

interface WaveformCanvasProps {
  signal: number[]
  height?: number
  width?: number
  color?: string
  backgroundColor?: string
  showGrid?: boolean
}

/**
 * Responsive, clinical-grade canvas-based waveform renderer
 * Optimized for real-time PPG signal visualization with no UI thread blocking
 */
export default function WaveformCanvas({
  signal,
  height = 120,
  width = 300,
  color = '#3b82f6',
  backgroundColor = 'transparent',
  showGrid = false,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerWidth, setContainerWidth] = useState(width)

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current?.parentElement) {
        setContainerWidth(canvasRef.current.parentElement.offsetWidth)
      }
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const finalWidth = Math.min(containerWidth, width)

    // Set device pixel ratio for crisp rendering on high-DPI displays
    canvas.width = finalWidth * dpr
    canvas.height = height * dpr

    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, finalWidth, height)

    // Draw background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, finalWidth, height)

    if (signal.length === 0) return

    // Draw grid if enabled
    if (showGrid) {
      ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)'
      ctx.lineWidth = 0.5

      // Horizontal grid lines (5 divisions)
      for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(finalWidth, y)
        ctx.stroke()
      }

      // Vertical grid lines (8 divisions)
      for (let i = 0; i <= 8; i++) {
        const x = (finalWidth / 8) * i
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
    }

    // Calculate statistics
    const min = Math.min(...signal)
    const max = Math.max(...signal)
    const range = max - min || 1
    const verticalPadding = height * 0.15

    // Draw waveform with anti-aliasing
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const visibleSamples = Math.min(signal.length, Math.floor(finalWidth / 2))
    const startIdx = Math.max(0, signal.length - visibleSamples)

    // Draw connecting line from previous point if scrolling
    if (startIdx > 0 && signal.length > visibleSamples) {
      const prevSignal = signal[startIdx - 1]
      const currSignal = signal[startIdx]
      const prevX = -1
      const prevY = height - verticalPadding - ((prevSignal - min) / range) * (height - 2 * verticalPadding)
      const currX = 0
      const currY = height - verticalPadding - ((currSignal - min) / range) * (height - 2 * verticalPadding)

      ctx.strokeStyle = color
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(prevX, prevY)
      ctx.lineTo(currX, currY)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.beginPath()

    for (let i = startIdx; i < signal.length; i++) {
      const x = ((i - startIdx) / Math.max(visibleSamples - 1, 1)) * (finalWidth - 1)
      const y = height - verticalPadding - ((signal[i] - min) / range) * (height - 2 * verticalPadding)

      if (i === startIdx) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }

    ctx.stroke()

    // Draw filled area under curve for better visual feedback
    ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba').replace('hsl', 'hsla')
    ctx.lineTo(finalWidth, height - verticalPadding)
    ctx.lineTo(0, height - verticalPadding)
    ctx.closePath()
    ctx.fill()

    // Draw min/max reference lines
    const minVal = Math.min(...signal)
    const maxVal = Math.max(...signal)
    const midVal = (minVal + maxVal) / 2

    // Max indicator line
    const maxY = height - verticalPadding - ((maxVal - min) / range) * (height - 2 * verticalPadding)
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(0, maxY)
    ctx.lineTo(finalWidth, maxY)
    ctx.stroke()

    // Mid indicator line
    const midY = height - verticalPadding - ((midVal - min) / range) * (height - 2 * verticalPadding)
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.15)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, midY)
    ctx.lineTo(finalWidth, midY)
    ctx.stroke()

    // Min indicator line
    const minY = height - verticalPadding - ((minVal - min) / range) * (height - 2 * verticalPadding)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, minY)
    ctx.lineTo(finalWidth, minY)
    ctx.stroke()

    ctx.setLineDash([])

    // Draw current value indicator (rightmost point)
    if (signal.length > 0) {
      const lastValue = signal[signal.length - 1]
      const lastX = finalWidth - 2
      const lastY = height - verticalPadding - ((lastValue - min) / range) * (height - 2 * verticalPadding)

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [signal, height, width, color, backgroundColor, showGrid, containerWidth])

  return (
    <canvas
      ref={canvasRef}
      className="w-full border rounded transition-opacity duration-200"
      style={{
        background: backgroundColor,
        borderColor: 'var(--border)',
        height: `${height}px`,
      }}
    />
  )
}
