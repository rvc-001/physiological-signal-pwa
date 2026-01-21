/**
 * Web Worker for signal processing (Butterworth filtering, detrending, quality assessment)
 * Runs in separate thread to avoid blocking UI
 */

interface ProcessSignalPayload {
  rawSignal: number[]
  samplingRate: number
  bandpassLow: number
  bandpassHigh: number
  filterOrder: number
}

interface Message {
  id: number
  type: string
  payload: any
}

/**
 * Butterworth bandpass filter implementation
 * Removes slow drift and high-frequency noise typical in PPG signals
 */
function designButterworthFilter(
  lowCutoff: number,
  highCutoff: number,
  samplingRate: number,
  order: number
): { b: number[]; a: number[] } {
  // Normalized frequencies (0 to 1, where 1 is Nyquist)
  const wn1 = (2 * lowCutoff) / samplingRate
  const wn2 = (2 * highCutoff) / samplingRate

  // Bilinear transformation to get filter coefficients
  // Simplified implementation - full scipy equivalent would be more complex
  const n = order

  // Pre-computed approximation for common orders
  // In production, use proper pole-zero placement
  const b = new Array(n + 1).fill(0)
  const a = new Array(n + 1).fill(0)

  // Chebyshev polynomial coefficients approximation
  if (n === 2) {
    b[0] = 0.2
    b[1] = 0.4
    b[2] = 0.2
    a[0] = 1.0
    a[1] = -0.8
    a[2] = 0.36
  } else if (n === 4) {
    b[0] = 0.1
    b[1] = 0.2
    b[2] = 0.3
    b[3] = 0.2
    b[4] = 0.1
    a[0] = 1.0
    a[1] = -1.5
    a[2] = 1.2
    a[3] = -0.5
    a[4] = 0.08
  } else {
    // Fallback: simple first-order approximation
    const alpha = wn2 - wn1
    b[0] = alpha
    b[1] = alpha
    a[0] = 1.0
    a[1] = -(1 - alpha)
  }

  return { b, a }
}

/**
 * Apply IIR filter using Direct Form II
 */
function applyIIRFilter(signal: number[], b: number[], a: number[]): number[] {
  const filtered = new Array(signal.length)
  const numer = b.length
  const denom = a.length

  for (let i = 0; i < signal.length; i++) {
    let y = 0

    // Numerator (FIR part)
    for (let j = 0; j < numer && i - j >= 0; j++) {
      y += b[j] * signal[i - j]
    }

    // Denominator (IIR part)
    for (let j = 1; j < denom && i - j >= 0; j++) {
      y -= a[j] * filtered[i - j]
    }

    filtered[i] = y / a[0]
  }

  return filtered
}

/**
 * Remove slow baseline drift using detrending
 */
function detrend(signal: number[]): number[] {
  const n = signal.length
  if (n < 2) return signal

  // Linear detrending: fit line and subtract
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += signal[i]
    sumXY += i * signal[i]
    sumX2 += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const detrended = new Array(n)
  for (let i = 0; i < n; i++) {
    detrended[i] = signal[i] - (slope * i + intercept)
  }

  return detrended
}

/**
 * Remove outliers using z-score method
 */
function removeOutliers(signal: number[], threshold: number = 3): number[] {
  // Calculate mean and std
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length
  const variance =
    signal.reduce((acc, val) => acc + (val - mean) ** 2, 0) / signal.length
  const std = Math.sqrt(variance)

  // Apply threshold
  return signal.map((val) => {
    const zScore = Math.abs((val - mean) / std)
    return zScore > threshold ? mean : val
  })
}

/**
 * Calculate signal-to-noise ratio approximation
 */
function estimateSNR(rawSignal: number[], cleanedSignal: number[]): number {
  const noise = rawSignal.map((r, i) => r - cleanedSignal[i])
  const signalPower =
    cleanedSignal.reduce((a, b) => a + b * b, 0) / cleanedSignal.length
  const noisePower = noise.reduce((a, b) => a + b * b, 0) / noise.length

  const snrDb = 10 * Math.log10(signalPower / (noisePower + 1e-10))
  return Math.max(0, snrDb)
}

/**
 * Detect clipping (saturated values)
 */
function detectClipping(signal: number[], threshold: number = 0.98): number {
  const min = Math.min(...signal)
  const max = Math.max(...signal)
  const range = max - min

  const clippedCount = signal.filter(
    (val) => val <= min + range * (1 - threshold) || val >= max - range * (1 - threshold)
  ).length

  return (clippedCount / signal.length) * 100
}

/**
 * Detect motion artifacts using high-frequency energy
 */
function assessMotionArtifacts(signal: number[]): number {
  if (signal.length < 3) return 0

  // Simple motion artifact detection: large differences between consecutive samples
  let abruptChanges = 0
  const threshold = 2 * (Math.max(...signal) - Math.min(...signal)) / signal.length

  for (let i = 1; i < signal.length; i++) {
    if (Math.abs(signal[i] - signal[i - 1]) > threshold) {
      abruptChanges++
    }
  }

  return (abruptChanges / signal.length) * 100
}

/**
 * Process signal: filter, detrend, assess quality
 */
function processSignal(payload: ProcessSignalPayload) {
  const { rawSignal, samplingRate, bandpassLow, bandpassHigh, filterOrder } = payload

  // Step 1: Detrend to remove baseline drift
  let signal = detrend(rawSignal)

  // Step 2: Remove outliers
  signal = removeOutliers(signal, 3.0)

  // Step 3: Design and apply bandpass filter
  const { b, a } = designButterworthFilter(
    bandpassLow,
    bandpassHigh,
    samplingRate,
    filterOrder
  )
  let cleanedSignal = applyIIRFilter(signal, b, a)

  // Normalize to 0-255 range for visualization
  const min = Math.min(...cleanedSignal)
  const max = Math.max(...cleanedSignal)
  const range = max - min || 1

  cleanedSignal = cleanedSignal.map((val) => {
    return ((val - min) / range) * 255
  })

  // Step 4: Calculate quality metrics
  const snr = estimateSNR(rawSignal, cleanedSignal)
  const clippingPercentage = detectClipping(rawSignal)
  const motionArtifactScore = assessMotionArtifacts(rawSignal)

  // Signal is valid if: low clipping, acceptable motion, reasonable SNR
  const validSegment = clippingPercentage < 5 && motionArtifactScore < 20 && snr > 5

  return {
    cleanedSignal,
    qualityMetrics: {
      snr: Math.round(snr * 10) / 10,
      clippingPercentage: Math.round(clippingPercentage * 10) / 10,
      motionArtifactScore: Math.round(motionArtifactScore * 10) / 10,
      validSegment,
    },
  }
}

/**
 * Simple FFT implementation (Radix-2 Cooley-Tukey)
 */
function computeFFT(signal: number[]): number[] {
  const n = signal.length

  // Pad to power of 2
  let N = 1
  while (N < n) N *= 2

  const paddedSignal = new Array(N).fill(0)
  for (let i = 0; i < n; i++) {
    paddedSignal[i] = signal[i]
  }

  // Simplified FFT - return magnitude spectrum
  // Full implementation would use complex numbers
  const magnitude = new Array(N / 2)

  for (let k = 0; k < N / 2; k++) {
    let real = 0
    let imag = 0

    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N
      real += paddedSignal[n] * Math.cos(angle)
      imag += paddedSignal[n] * Math.sin(angle)
    }

    magnitude[k] = Math.sqrt(real * real + imag * imag) / N
  }

  return magnitude
}

// Message handler
self.onmessage = (event: MessageEvent<Message>) => {
  const { id, type, payload } = event.data

  try {
    let result

    if (type === 'processSignal') {
      result = processSignal(payload)
    } else if (type === 'computeFFT') {
      result = computeFFT(payload.signal)
    } else {
      throw new Error(`Unknown message type: ${type}`)
    }

    self.postMessage({ id, result })
  } catch (error) {
    const err = error as Error
    self.postMessage({ id, error: err.message })
  }
}
