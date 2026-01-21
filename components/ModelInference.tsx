'use client'

import React, { useState, useRef, useEffect } from 'react'
import { getAllClips, getClipById, updateClip, SignalClip } from '@/lib/storage'

interface StoredModel {
  id: string
  name: string
  uploadedAt: number
  type: 'tf.js' | 'onnx' | 'pkl' | 'pth'
  size: number
}

export default function ModelInference() {
  const [models, setModels] = useState<StoredModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [clips, setClips] = useState<SignalClip[]>([])
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Ready')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load models and clips on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load stored models from localStorage
        const storedModels = localStorage.getItem('models')
        if (storedModels) {
          setModels(JSON.parse(storedModels))
        }

        // Load clips
        const allClips = await getAllClips()
        setClips(allClips)
      } catch (error) {
        console.error('[v0] Failed to load data:', error)
      }
    }

    loadData()
  }, [])

  /**
   * Handle model upload
   * Supports TF.js, ONNX, PyTorch (.pth), and Pickle (.pkl) formats
   */
  const handleModelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setStatusMessage('Uploading model...')

      const fileName = file.name.toLowerCase()
      let fileType: 'tf.js' | 'onnx' | 'pkl' | 'pth' = 'tf.js'
      
      if (fileName.endsWith('.onnx')) {
        fileType = 'onnx'
      } else if (fileName.endsWith('.pth') || fileName.endsWith('.pt')) {
        fileType = 'pth'
      } else if (fileName.endsWith('.pkl') || fileName.endsWith('.pickle')) {
        fileType = 'pkl'
      }

      const buffer = await file.arrayBuffer()

      const newModel: StoredModel = {
        id: `model-${Date.now()}`,
        name: fileName,
        uploadedAt: Date.now(),
        type: fileType,
        size: file.size,
      }

      // In production, store model binary in IndexedDB or cloud storage
      // For now, store metadata and reference
      const updatedModels = [...models, newModel]
      setModels(updatedModels)
      localStorage.setItem('models', JSON.stringify(updatedModels))

      setStatusMessage(`Model loaded: ${fileName} (${fileType.toUpperCase()})`)
      setSelectedModelId(newModel.id)
    } catch (error) {
      console.error('[v0] Upload error:', error)
      setStatusMessage('Model upload failed')
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * Run inference on selected clip
   * Outputs: systolic BP, diastolic BP, confidence
   */
  const runInference = async () => {
    if (!selectedClipId || !selectedModelId) {
      setStatusMessage('Select model and clip')
      return
    }

    try {
      setIsProcessing(true)
      setStatusMessage('Running inference...')

      const clip = await getClipById(selectedClipId)
      if (!clip) {
        setStatusMessage('Clip not found')
        return
      }

      // Simulate inference - in production, load and run actual model
      // This would use TensorFlow.js or ONNX Runtime
      const predictions = await simulateModelInference(
        clip.cleanedSignal,
        clip.qualityMetrics.snr
      )

      // Update clip with predictions
      clip.mlPredictions = predictions
      await updateClip(clip)

      // Refresh clips
      const allClips = await getAllClips()
      setClips(allClips)

      setStatusMessage(`Prediction: ${predictions.systolicBP}/${predictions.diastolicBP} mmHg`)
    } catch (error) {
      console.error('[v0] Inference error:', error)
      setStatusMessage('Inference failed')
    } finally {
      setIsProcessing(false)
    }
  }

  /**
   * Simulate model inference
   * In production, replace with actual TF.js or ONNX inference
   */
  const simulateModelInference = async (
    signal: number[],
    snr: number
  ): Promise<{ systolicBP?: number; diastolicBP?: number; confidence?: number }> => {
    return new Promise((resolve) => {
      // Simulate processing delay
      setTimeout(() => {
        // Extract signal features (amplitude, frequency characteristics)
        const mean = signal.reduce((a, b) => a + b, 0) / signal.length
        const std = Math.sqrt(
          signal.reduce((a, b) => a + (b - mean) ** 2, 0) / signal.length
        )

        // Simple heuristic-based prediction (for demonstration)
        // In production, use trained ML model
        const amplitude = std / 128 // Normalized amplitude (0-1 scale)

        // Estimate systolic BP based on signal characteristics
        // Typical range: 100-180 mmHg
        const systolicBP = Math.round(100 + amplitude * 80 + Math.random() * 20)

        // Diastolic is typically 60-70% of systolic
        const diastolicBP = Math.round(systolicBP * 0.65 + Math.random() * 10)

        // Confidence based on SNR and signal quality
        const confidence = Math.min(1, Math.max(0, (snr - 5) / 20))

        resolve({
          systolicBP,
          diastolicBP,
          confidence,
        })
      }, 1500) // Simulate processing time
    })
  }

  /**
   * Delete a model
   */
  const deleteModel = (modelId: string) => {
    const updatedModels = models.filter((m) => m.id !== modelId)
    setModels(updatedModels)
    localStorage.setItem('models', JSON.stringify(updatedModels))

    if (selectedModelId === modelId) {
      setSelectedModelId(null)
    }

    setStatusMessage('Model deleted')
  }

  /**
   * Format file size
   */
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--background)' }}
    >
      {/* Status Message */}
      <div
        className="p-3 text-center text-sm border-b"
        style={{
          color: 'var(--foreground)',
          borderColor: 'var(--border)',
          background: 'var(--card)',
        }}
      >
        {statusMessage}
      </div>

      {/* Model Upload Section */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          Upload Model
        </h3>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleModelUpload}
          accept=".onnx,.pb,.zip,.h5,.pth,.pt,.pkl,.pickle"
          style={{ display: 'none' }}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-2 rounded font-medium text-sm transition-colors"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
          }}
        >
          Choose Model File (.onnx, .pb, .h5, .zip)
        </button>

        <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
          Supported: TensorFlow.js, ONNX, PyTorch (exported)
        </p>
      </div>

      {/* Models List */}
      {models.length > 0 && (
        <div className="p-4 border-b overflow-y-auto flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
            Available Models
          </h3>
          <div className="space-y-2">
            {models.map((model) => (
              <div
                key={model.id}
                className="p-3 rounded border transition-colors cursor-pointer"
                style={{
                  borderColor: 'var(--border)',
                  background: selectedModelId === model.id ? 'var(--primary)' : 'var(--card)',
                  color: selectedModelId === model.id ? 'var(--primary-foreground)' : 'var(--foreground)',
                }}
                onClick={() => setSelectedModelId(model.id)}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="text-sm font-medium">{model.name}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteModel(model.id)
                    }}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: selectedModelId === model.id ? 'rgba(0,0,0,0.2)' : 'var(--muted)',
                      color: selectedModelId === model.id ? 'inherit' : 'var(--muted-foreground)',
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="text-xs opacity-75">
                  {model.type.toUpperCase()} • {formatFileSize(model.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clips for Inference */}
      <div className="p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          Select Clip
        </h3>
        <div className="max-h-32 overflow-y-auto space-y-2">
          {clips.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              No clips available
            </p>
          ) : (
            clips
              .filter((c) => c.qualityMetrics.validSegment)
              .map((clip) => (
                <button
                  key={clip.id}
                  onClick={() => setSelectedClipId(clip.id)}
                  className="w-full p-2 rounded text-left text-xs transition-colors"
                  style={{
                    background: selectedClipId === clip.id ? 'var(--primary)' : 'var(--card)',
                    color: selectedClipId === clip.id ? 'var(--primary-foreground)' : 'var(--foreground)',
                    border: `1px solid var(--border)`,
                  }}
                >
                  <div>{new Date(clip.timestamp).toLocaleTimeString()}</div>
                  {clip.mlPredictions && (
                    <div className="text-xs opacity-75">
                      Predicted: {clip.mlPredictions.systolicBP}/{clip.mlPredictions.diastolicBP}
                    </div>
                  )}
                </button>
              ))
          )}
        </div>
      </div>

      {/* Run Inference Button */}
      <div className="p-4 flex-1 flex items-center justify-center">
        <button
          onClick={runInference}
          disabled={!selectedModelId || !selectedClipId || isProcessing}
          className="px-8 py-3 rounded font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isProcessing ? 'var(--muted)' : 'var(--accent)',
            color: isProcessing ? 'var(--muted-foreground)' : 'var(--accent-foreground)',
          }}
        >
          {isProcessing ? 'Processing...' : 'Run Inference'}
        </button>
      </div>
    </div>
  )
}
