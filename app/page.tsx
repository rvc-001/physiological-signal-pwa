'use client'

import React, { useState, useEffect } from 'react'
import CameraCapture from '@/components/CameraCapture'
import HistoricalPlayback from '@/components/HistoricalPlayback'
import Settings from '@/components/Settings'
import ModelInference from '@/components/ModelInference'
import { useTheme } from '@/hooks/useTheme'

type TabType = 'capture' | 'history' | 'models' | 'settings'

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('capture')
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator && typeof window !== 'undefined') {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => console.log('Service worker registration failed'))
    }
  }, [])

  return (
    <div className={`${theme === 'dark' ? 'dark' : ''}`}>
      <div
        style={{
          background: 'var(--background)',
          color: 'var(--foreground)',
        }}
        className="min-h-screen w-screen flex flex-col"
      >
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-40 border-b" style={{ borderColor: 'var(--border)' }}>
          
        </header>

        {/* Main Content */}
        <main className="flex-1 pt-16 pb-20 overflow-hidden">
          {activeTab === 'capture' && <CameraCapture />}
          {activeTab === 'history' && <HistoricalPlayback />}
          {activeTab === 'models' && <ModelInference />}
          {activeTab === 'settings' && <Settings />}
        </main>

        {/* Bottom Navigation */}
        <nav
          className="fixed bottom-0 left-0 right-0 border-t flex justify-around items-center h-16 z-40"
          style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
        >
          {[
            { id: 'capture' as TabType, label: 'Capture', icon: '◉' },
            { id: 'history' as TabType, label: 'History', icon: '◆' },
            { id: 'models' as TabType, label: 'Models', icon: '◈' },
            { id: 'settings' as TabType, label: 'Settings', icon: '⚙' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-2 transition-colors text-xs font-medium"
              style={{
                background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              }}
              aria-label={tab.label}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              <span className="text-xl">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
