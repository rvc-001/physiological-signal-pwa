/**
 * IndexedDB storage utilities for signal clips and metadata
 * Stores raw signal, cleaned signal, timestamps, and quality metrics
 */

export interface SignalClip {
  id: string
  timestamp: number
  startTime: number
  endTime: number
  samplingRate: number
  rawSignal: number[]
  cleanedSignal: number[]
  qualityMetrics: {
    snr: number
    clippingPercentage: number
    motionArtifactScore: number
    validSegment: boolean
  }
  mlPredictions?: {
    systolicBP?: number
    diastolicBP?: number
    confidence?: number
  }
}

export interface Settings {
  bandpassLow: number
  bandpassHigh: number
  filterOrder: number
  clipDuration: number
  theme: 'light' | 'dark'
  selectedModelId?: string
}

const DB_NAME = 'PhysiologicalSignalsDB'
const DB_VERSION = 1
const CLIPS_STORE = 'clips'
const SETTINGS_STORE = 'settings'

let db: IDBDatabase | null = null

/**
 * Initialize IndexedDB with required object stores
 */
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create clips store with timestamp index
      if (!database.objectStoreNames.contains(CLIPS_STORE)) {
        const clipsStore = database.createObjectStore(CLIPS_STORE, { keyPath: 'id' })
        clipsStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // Create settings store
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
    }
  })
}

/**
 * Save a signal clip to IndexedDB
 */
export async function saveClip(clip: SignalClip): Promise<string> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CLIPS_STORE], 'readwrite')
    const store = transaction.objectStore(CLIPS_STORE)
    const request = store.add(clip)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as string)
  })
}

/**
 * Get all clips, optionally sorted by timestamp
 */
export async function getAllClips(): Promise<SignalClip[]> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CLIPS_STORE], 'readonly')
    const store = transaction.objectStore(CLIPS_STORE)
    const index = store.index('timestamp')
    const request = index.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const clips = request.result as SignalClip[]
      resolve(clips.sort((a, b) => b.timestamp - a.timestamp))
    }
  })
}

/**
 * Get a specific clip by ID
 */
export async function getClipById(id: string): Promise<SignalClip | undefined> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CLIPS_STORE], 'readonly')
    const store = transaction.objectStore(CLIPS_STORE)
    const request = store.get(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as SignalClip | undefined)
  })
}

/**
 * Update a clip (e.g., to add ML predictions)
 */
export async function updateClip(clip: SignalClip): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CLIPS_STORE], 'readwrite')
    const store = transaction.objectStore(CLIPS_STORE)
    const request = store.put(clip)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Delete a clip by ID
 */
export async function deleteClip(id: string): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CLIPS_STORE], 'readwrite')
    const store = transaction.objectStore(CLIPS_STORE)
    const request = store.delete(id)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Clear all clips (destructive)
 */
export async function clearAllClips(): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([CLIPS_STORE], 'readwrite')
    const store = transaction.objectStore(CLIPS_STORE)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Save settings object
 */
export async function saveSettings(key: string, value: any): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SETTINGS_STORE], 'readwrite')
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.put({ key, value })

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get a settings value
 */
export async function getSetting(key: string): Promise<any> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SETTINGS_STORE], 'readonly')
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.get(key)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const result = request.result as { key: string; value: any } | undefined
      resolve(result?.value)
    }
  })
}

/**
 * Clear all settings
 */
export async function clearSettings(): Promise<void> {
  const database = await initDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([SETTINGS_STORE], 'readwrite')
    const store = transaction.objectStore(SETTINGS_STORE)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

/**
 * Get database size estimate
 */
export async function getDBSizeEstimate(): Promise<{ usage: number; quota: number }> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0 }
  }

  const estimate = await navigator.storage.estimate()
  return {
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
  }
}
