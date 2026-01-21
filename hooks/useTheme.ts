'use client';

import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    
    let currentTheme: 'light' | 'dark' = 'light'
    if (savedTheme) {
      currentTheme = savedTheme
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      currentTheme = prefersDark ? 'dark' : 'light'
    }
    
    setTheme(currentTheme)
    // Apply theme immediately to document
    document.documentElement.classList.toggle('dark', currentTheme === 'dark')
    localStorage.setItem('theme', currentTheme)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    // Update localStorage and document class when theme changes
    localStorage.setItem('theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme, mounted }
}
