// Signal Processing Web Worker
// Runs off-main-thread for filtering and quality assessment

/**
 * Butterworth Bandpass Filter Implementation
 * IIR filter using difference equations
 */
class ButterworthFilter {
  constructor(samplingRate, lowCutoff, highCutoff, order) {
    this.samplingRate = samplingRate
    this.lowCutoff = lowCutoff
    this.highCutoff = highCutoff
    this.order = order

    // Precompute filter coefficients
    this.computeCoefficients()
  }

  computeCoefficients() {
    const fs = this.samplingRate
    const low = this.lowCutoff / (fs / 2)
    const high = this.highCutoff / (fs / 2)

    if (low <= 0 || high >= 1 || low >= high) {
      throw new Error('Invalid filter frequencies')
    }

    // Simplified IIR coefficient calculation for bandpass
    const wc = Math.sqrt(low * high)
    const bw = high - low

    // Butterworth pole placement
    const a = Math.tan((Math.PI * bw) / 2)
    const b = Math.cos((Math.PI * (low + high)) / 2)

    // Numerator
    this.b = [a, 0, -a]

    // Denominator - order 2 Butterworth
    const q = 1
    this.a = [1, -2 * (1 - a) / (1 + a), (1 - a) / (1 + a)]

    // Initialize state
    this.x = [0, 0, 0]
    this.y = [0, 0, 0]
  }

  filter(x) {
    const out =
      (this.b[0] * x + this.b[1] * this.x[1] + this.b[2] * this.x[2]) / this.a[0] -
      (this.a[1] * this.y[1] + this.a[2] * this.y[2]) / this.a[0]

    this.x[2] = this.x[1]
    this.x[1] = x
    this.y[2] = this.y[1]
    this.y[1] = out

    return out
  }
}

/**
 * Process signal with filtering and quality assessment
 */
function processSignal(rawSignal, samplingRate, bandpassLow, bandpassHigh, filterOrder) {
  try {
    // Detrending: remove mean and linear trend
    const mean = rawSignal.reduce((a, b) => a + b, 0) / rawSignal.length
    let detrended = rawSignal.map((x) => x - mean)

    const n = detrended.length
    const xMean = detrended.reduce((a, b) => a + b, 0) / n
    const yMean = 0
    let numerator = 0
    let denominator = 0

    for (let i = 0; i < n; i++) {
      numerator += (i - n / 2) * (detrended[i] - yMean)
      denominator += Math.pow(i - n / 2, 2)
    }

    if (denominator !== 0) {
      const slope = numerator / denominator
      detrended = detrended.map((x, i) => x - slope * (i - n / 2))
    }

    // Bandpass filtering (first pass)
    const filter1 = new ButterworthFilter(samplingRate, bandpassLow, bandpassHigh, filterOrder)
    const bandpassFiltered = detrended.map((x) => filter1.filter(x))

    // Butterworth filtering (second pass for additional smoothing)
    const filter2 = new ButterworthFilter(samplingRate, bandpassLow, bandpassHigh, filterOrder)
    const butterworthFiltered = bandpassFiltered.map((x) => filter2.filter(x))

    // Outlier detection: remove extreme values (beyond 3 std)
    const mean_clean = butterworthFiltered.reduce((a, b) => a + b, 0) / butterworthFiltered.length
    const variance = butterworthFiltered.reduce((a, x) => a + Math.pow(x - mean_clean, 2), 0) / butterworthFiltered.length
    const std = Math.sqrt(variance)
    const cleanedNoOutliers = butterworthFiltered.map((x) =>
      Math.abs(x - mean_clean) > 3 * std ? mean_clean : x
    )

    // Quality metrics
    const qualityMetrics = {
      snr: calculateSNR(cleanedNoOutliers, detrended),
      clippingPercentage: calculateClipping(rawSignal),
      motionArtifactScore: calculateMotionArtifacts(butterworthFiltered),
      validSegment: isValidSegment(butterworthFiltered, std),
    }

    return {
      raw: rawSignal,
      bandpass: bandpassFiltered,
      butterworth: cleanedNoOutliers,
      qualityMetrics,
    }
  } catch (error) {
    throw new Error(`Signal processing failed: ${error.message}`)
  }
}

function calculateSNR(signal, noise) {
  const signalPower = signal.reduce((a, x) => a + x * x, 0) / signal.length
  const noisePower = noise.reduce((a, x) => a + x * x, 0) / noise.length
  return noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : 0
}

function calculateClipping(signal) {
  const threshold = Math.max(...signal) * 0.95
  const clipped = signal.filter((x) => x >= threshold).length
  return (clipped / signal.length) * 100
}

function calculateMotionArtifacts(signal) {
  const diffs = []
  for (let i = 1; i < signal.length; i++) {
    diffs.push(Math.abs(signal[i] - signal[i - 1]))
  }
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const variance = diffs.reduce((a, x) => a + Math.pow(x - mean, 2), 0) / diffs.length
  return Math.sqrt(variance)
}

function isValidSegment(signal, std) {
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length
  const nonZero = signal.filter((x) => Math.abs(x - mean) > 0.1 * std).length
  return nonZero > signal.length * 0.5
}

/**
 * Compute FFT for frequency analysis
 */
function computeFFT(signal, samplingRate) {
  // Cooley-Tukey FFT implementation
  const n = signal.length
  if (n === 1) return signal

  if (n % 2 !== 0) {
    return naiveFFT(signal)
  }

  const even = computeFFT(signal.filter((_, i) => i % 2 === 0), samplingRate)
  const odd = computeFFT(signal.filter((_, i) => i % 2 === 1), samplingRate)

  const result = new Array(n).fill(0)

  for (let k = 0; k < n / 2; k++) {
    const t = -2 * Math.PI * k / n
    const re = Math.cos(t)
    const im = Math.sin(t)

    result[k] = even[k] + (re * odd[k] - im * 0)
    result[k + n / 2] = even[k] - (re * odd[k] - im * 0)
  }

  return result
}

function naiveFFT(signal) {
  const n = signal.length
  const result = new Array(n).fill(0)

  for (let k = 0; k < n; k++) {
    let realPart = 0
    let imagPart = 0

    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n
      realPart += signal[t] * Math.cos(angle)
      imagPart += signal[t] * Math.sin(angle)
    }

    result[k] = Math.sqrt(realPart * realPart + imagPart * imagPart) / n
  }

  return result
}

// Message handling
self.onmessage = (event) => {
  const { id, type, payload } = event.data

  try {
    let result

    if (type === 'processSignal') {
      const { rawSignal, samplingRate, bandpassLow, bandpassHigh, filterOrder } = payload
      result = processSignal(rawSignal, samplingRate, bandpassLow, bandpassHigh, filterOrder)
    } else if (type === 'computeFFT') {
      const { signal, samplingRate } = payload
      result = computeFFT(signal, samplingRate)
    } else {
      throw new Error(`Unknown message type: ${type}`)
    }

    self.postMessage({ id, result, error: null })
  } catch (error) {
    self.postMessage({ id, result: null, error: error.message })
  }
}
