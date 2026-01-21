/**
 * Export utilities for signal clips
 * Supports CSV and JSON formats (MIMIC-III style schema)
 */

import { SignalClip } from './storage'

/**
 * Export single clip or session to CSV
 * Format: timestamp, raw_value, cleaned_value, heart_rate_estimate
 */
export function exportClipToCSV(clip: SignalClip): string {
  const headers = ['timestamp_ms', 'sample_index', 'raw_signal', 'cleaned_signal', 'quality_valid']
  const rows: string[] = [headers.join(',')]

  for (let i = 0; i < clip.rawSignal.length; i++) {
    const time = clip.startTime + (i / clip.samplingRate) * 1000
    const row = [
      time.toFixed(0),
      i.toString(),
      clip.rawSignal[i].toFixed(4),
      clip.cleanedSignal[i].toFixed(4),
      clip.qualityMetrics.validSegment ? '1' : '0',
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n')
}

/**
 * Export clip metadata as CSV
 * One row per clip with quality and prediction metrics
 */
export function exportClipsMetadataToCSV(clips: SignalClip[]): string {
  const headers = [
    'clip_id',
    'timestamp',
    'duration_s',
    'sampling_rate',
    'snr_db',
    'clipping_percent',
    'motion_artifact_score',
    'valid_segment',
    'systolic_bp_est',
    'diastolic_bp_est',
    'prediction_confidence',
  ]
  const rows: string[] = [headers.join(',')]

  for (const clip of clips) {
    const duration = clip.rawSignal.length / clip.samplingRate
    const row = [
      clip.id,
      new Date(clip.timestamp).toISOString(),
      duration.toFixed(1),
      clip.samplingRate.toString(),
      clip.qualityMetrics.snr.toFixed(1),
      clip.qualityMetrics.clippingPercentage.toFixed(1),
      clip.qualityMetrics.motionArtifactScore.toFixed(1),
      clip.qualityMetrics.validSegment ? '1' : '0',
      clip.mlPredictions?.systolicBP?.toString() || '',
      clip.mlPredictions?.diastolicBP?.toString() || '',
      clip.mlPredictions?.confidence ? (clip.mlPredictions.confidence * 100).toFixed(1) : '',
    ]
    rows.push(row.join(','))
  }

  return rows.join('\n')
}

/**
 * Export clip to JSON (MIMIC-III inspired schema)
 */
export function exportClipToJSON(clip: SignalClip): string {
  const data = {
    metadata: {
      clipId: clip.id,
      captureTimestamp: new Date(clip.timestamp).toISOString(),
      startTime: new Date(clip.startTime).toISOString(),
      endTime: new Date(clip.endTime).toISOString(),
      samplingRate: clip.samplingRate,
      durationSeconds: clip.rawSignal.length / clip.samplingRate,
    },
    signals: {
      raw: {
        values: clip.rawSignal,
        unit: 'normalized_intensity_0_255',
        description: 'Red channel mean intensity from camera frames',
      },
      cleaned: {
        values: clip.cleanedSignal,
        unit: 'normalized_intensity_0_255',
        description: 'Bandpass filtered and detrended signal',
      },
    },
    qualityMetrics: {
      snrDecibels: clip.qualityMetrics.snr,
      clippingPercentage: clip.qualityMetrics.clippingPercentage,
      motionArtifactScore: clip.qualityMetrics.motionArtifactScore,
      validSegment: clip.qualityMetrics.validSegment,
    },
    mlPredictions: clip.mlPredictions
      ? {
          systolicBPmmHg: clip.mlPredictions.systolicBP,
          diastolicBPmmHg: clip.mlPredictions.diastolicBP,
          confidenceScore: clip.mlPredictions.confidence,
        }
      : null,
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Export multiple clips as JSON array
 */
export function exportClipsToJSON(clips: SignalClip[]): string {
  const data = {
    exportMetadata: {
      exportTimestamp: new Date().toISOString(),
      clipCount: clips.length,
      totalDurationSeconds: clips.reduce(
        (sum, clip) => sum + clip.rawSignal.length / clip.samplingRate,
        0
      ),
    },
    clips: clips.map((clip) => ({
      metadata: {
        clipId: clip.id,
        captureTimestamp: new Date(clip.timestamp).toISOString(),
        startTime: new Date(clip.startTime).toISOString(),
        endTime: new Date(clip.endTime).toISOString(),
        samplingRate: clip.samplingRate,
        durationSeconds: clip.rawSignal.length / clip.samplingRate,
      },
      signals: {
        raw: clip.rawSignal,
        cleaned: clip.cleanedSignal,
      },
      qualityMetrics: clip.qualityMetrics,
      mlPredictions: clip.mlPredictions || null,
    })),
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Trigger browser download of data
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export single clip with default naming
 */
export function exportSingleClip(clip: SignalClip, format: 'csv' | 'json' = 'csv') {
  const timestamp = new Date(clip.timestamp).toISOString().replace(/[:.]/g, '-')
  const filename =
    format === 'csv'
      ? `signal_${timestamp}.csv`
      : `signal_${timestamp}.json`

  const content = format === 'csv' ? exportClipToCSV(clip) : exportClipToJSON(clip)
  downloadFile(content, filename, format === 'csv' ? 'text/csv' : 'application/json')
}

/**
 * Export all clips with default naming
 */
export function exportAllClips(clips: SignalClip[], format: 'csv' | 'json' = 'json') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename =
    format === 'csv'
      ? `physiological_signals_metadata_${timestamp}.csv`
      : `physiological_signals_${timestamp}.json`

  const content =
    format === 'csv' ? exportClipsMetadataToCSV(clips) : exportClipsToJSON(clips)
  downloadFile(content, filename, format === 'csv' ? 'text/csv' : 'application/json')
}
