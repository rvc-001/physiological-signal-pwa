'use client'

import React, { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { getSetting, saveSettings, clearAllClips, getDBSizeEstimate } from '@/lib/storage'

interface SettingsState {
  bandpassLow: number
  bandpassHigh: number
  filterOrder: number
  clipDuration: number
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme()
  
  const [settings, setSettings] = useState<SettingsState>({
    bandpassLow: 0.5,
    bandpassHigh: 4.0,
    filterOrder: 4,
    clipDuration: 10,
  })

  const [dbSize, setDbSize] = useState<{ usage: number; quota: number }>({
    usage: 0,
    quota: 0,
  })

  const [statusMessage, setStatusMessage] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const bandpassLow = (await getSetting('bandpassLow')) ?? 0.5
        const bandpassHigh = (await getSetting('bandpassHigh')) ?? 4.0
        const filterOrder = (await getSetting('filterOrder')) ?? 4
        const clipDuration = (await getSetting('clipDuration')) ?? 10

        setSettings({
          bandpassLow,
          bandpassHigh,
          filterOrder,
          clipDuration,
        })

        // Check DB size
        const size = await getDBSizeEstimate()
        setDbSize(size)
      } catch (error) {
        console.error('[v0] Failed to load settings:', error)
      }
    }

    loadSettings()
  }, [])

  /**
   * Save setting and update state
   */
  const updateSetting = async (key: keyof SettingsState, value: number) => {
    try {
      await saveSettings(key, value)
      setSettings((prev) => ({ ...prev, [key]: value }))
      setStatusMessage('Setting saved')
      setTimeout(() => setStatusMessage(''), 2000)
    } catch (error) {
      console.error('[v0] Save error:', error)
      setStatusMessage('Failed to save')
    }
  }

  /**
   * Clear all data
   */
  const handleClearData = async () => {
    try {
      setStatusMessage('Clearing data...')
      await clearAllClips()
      const size = await getDBSizeEstimate()
      setDbSize(size)
      setStatusMessage('All clips deleted')
      setShowClearConfirm(false)
      setTimeout(() => setStatusMessage(''), 3000)
    } catch (error) {
      console.error('[v0] Clear error:', error)
      setStatusMessage('Failed to clear data')
    }
  }

  /**
   * Format bytes to human readable
   */
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: 'var(--background)' }}
    >
      {/* Status Message */}
      {statusMessage && (
        <div
          className="sticky top-0 p-3 text-center text-sm border-b z-10 animate-pulse"
          style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            borderColor: 'var(--border)',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Signal Processing Settings */}
      <section className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          Signal Processing
        </h2>

        <div className="space-y-4">
          {/* Bandpass Low */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Bandpass Low Cutoff (Hz)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="2"
              value={settings.bandpassLow}
              onChange={(e) => updateSetting('bandpassLow', parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded border text-sm"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Removes slow baseline drift (0.4-0.8 Hz typical for PPG)
            </p>
          </div>

          {/* Bandpass High */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Bandpass High Cutoff (Hz)
            </label>
            <input
              type="number"
              step="0.1"
              min="2"
              max="10"
              value={settings.bandpassHigh}
              onChange={(e) => updateSetting('bandpassHigh', parseFloat(e.target.value))}
              className="w-full px-3 py-2 rounded border text-sm"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
              }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Removes high-frequency noise and artifacts (4-5 Hz typical)
            </p>
          </div>

          {/* Filter Order */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Filter Order
            </label>
            <select
              value={settings.filterOrder}
              onChange={(e) => updateSetting('filterOrder', parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded border text-sm"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
              }}
            >
              <option value="2">2nd Order (Fast)</option>
              <option value="4">4th Order (Standard)</option>
              <option value="6">6th Order (Steep)</option>
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Higher order = steeper rolloff, more phase distortion
            </p>
          </div>

          {/* Clip Duration */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--foreground)' }}>
              Clip Duration (seconds)
            </label>
            <select
              value={settings.clipDuration}
              onChange={(e) => updateSetting('clipDuration', parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded border text-sm"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
              }}
            >
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="20">20 seconds</option>
              <option value="30">30 seconds</option>
            </select>
            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
              Auto-segments signal into clips of this duration
            </p>
          </div>
        </div>
      </section>

      {/* Display & UI */}
      <section className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          Display & Theme
        </h2>

        <div>
          <label className="text-xs font-medium block mb-3" style={{ color: 'var(--foreground)' }}>
            Color Mode
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (theme === 'dark') toggleTheme()
              }}
              className="flex-1 px-3 py-2 rounded font-medium text-sm transition-all border"
              style={{
                background: theme === 'light' ? 'var(--primary)' : 'var(--muted)',
                color: theme === 'light' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                borderColor: theme === 'light' ? 'var(--primary)' : 'var(--border)',
                transform: theme === 'light' ? 'scale(1.02)' : 'scale(1)',
              }}
              aria-pressed={theme === 'light'}
            >
              Light
            </button>
            <button
              onClick={() => {
                if (theme === 'light') toggleTheme()
              }}
              className="flex-1 px-3 py-2 rounded font-medium text-sm transition-all border"
              style={{
                background: theme === 'dark' ? 'var(--primary)' : 'var(--muted)',
                color: theme === 'dark' ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                borderColor: theme === 'dark' ? 'var(--primary)' : 'var(--border)',
                transform: theme === 'dark' ? 'scale(1.02)' : 'scale(1)',
              }}
              aria-pressed={theme === 'dark'}
            >
              Dark
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>
            Current mode: {theme === 'dark' ? 'Dark' : 'Light'}
          </p>
        </div>
      </section>

      {/* Storage & Data */}
      <section className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          Storage & Data
        </h2>

        <div className="mb-4 p-3 rounded" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-xs mb-2" style={{ color: 'var(--foreground)' }}>
            <strong>Database Usage</strong>
          </div>
          <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
            <span>{formatBytes(dbSize.usage)}</span>
            <span>/ {formatBytes(dbSize.quota)}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1 mt-2 overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${(dbSize.usage / dbSize.quota) * 100}%`,
                background: 'var(--accent)',
              }}
            />
          </div>
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
          All signal clips and metadata are stored locally in IndexedDB. Data persists offline.
        </p>

        {/* Clear Data Button */}
        {!showClearConfirm ? (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full px-4 py-2 rounded font-medium text-sm transition-colors"
            style={{
              background: 'var(--destructive)',
              color: 'var(--destructive-foreground)',
            }}
          >
            Clear All Clips
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>
              Delete all recorded signal clips? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClearData}
                className="flex-1 px-3 py-2 rounded font-medium text-sm"
                style={{
                  background: 'var(--destructive)',
                  color: 'var(--destructive-foreground)',
                }}
              >
                Delete
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-3 py-2 rounded font-medium text-sm"
                style={{
                  background: 'var(--muted)',
                  color: 'var(--muted-foreground)',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* App Info */}
      <section className="p-4" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
          About
        </h2>

        <div className="space-y-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          <div>
            <strong>Physiological Signals PWA</strong>
          </div>
          <div>Research-grade signal acquisition and analysis</div>
          <div className="mt-3">
            <strong>Features:</strong>
            <ul className="mt-1 space-y-1 ml-2">
              <li>• Camera-based PPG signal capture</li>
              <li>• Real-time Butterworth filtering</li>
              <li>• Clip-based storage with quality metrics</li>
              <li>• ML/DL model inference support</li>
              <li>• Full offline operation</li>
              <li>• Light/Dark theme support</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
