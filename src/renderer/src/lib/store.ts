import { Store, load } from '@tauri-apps/plugin-store'
import type { Provider, AppSettings } from './types'

let storeInstance: Store | null = null

export async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load('store.json')
  }
  return storeInstance
}

// ----------------------------------------------------
// Providers
// ----------------------------------------------------

export async function getProviders(): Promise<Provider[]> {
  const store = await getStore()
  const providers = await store.get<Provider[]>('providers')
  return providers || []
}

export async function saveProviders(providers: Provider[]): Promise<void> {
  const store = await getStore()
  await store.set('providers', providers)
  await store.save()
}

export async function addProvider(provider: Provider): Promise<void> {
  const providers = await getProviders()
  providers.push(provider)
  await saveProviders(providers)
}

export async function deleteProvider(id: string): Promise<void> {
  let providers = await getProviders()
  providers = providers.filter((p) => p.id !== id)
  await saveProviders(providers)
}

export async function updateProvider(id: string, updates: Partial<Provider>): Promise<void> {
  const providers = await getProviders()
  const index = providers.findIndex((p) => p.id === id)
  if (index !== -1) {
    providers[index] = { ...providers[index], ...updates }
    await saveProviders(providers)
  }
}

// ----------------------------------------------------
// Settings
// ----------------------------------------------------

export async function getSettings(): Promise<AppSettings> {
  const store = await getStore()
  const settings = await store.get<AppSettings>('settings')
  return settings || {
    preferredEngine: 'mpv',
    streamFormat: 'm3u8',
    autoRefreshInterval: 0,
    theme: 'dark',
    language: 'uk'
  }
}

export async function saveSettings(updates: Partial<AppSettings>): Promise<void> {
  const settings = await getSettings()
  const newSettings = { ...settings, ...updates }
  const store = await getStore()
  await store.set('settings', newSettings)
  await store.save()
}

// ----------------------------------------------------
// Favorites
// ----------------------------------------------------

export interface Favorites {
  channels: string[]
  movies: string[]
  series: string[]
}

export async function getFavorites(): Promise<Favorites> {
  const store = await getStore()
  const favs = await store.get<Favorites>('favorites')
  return favs || { channels: [], movies: [], series: [] }
}

export async function toggleFavorite(type: 'channels' | 'movies' | 'series', id: string): Promise<{ success: boolean; isFavorite: boolean }> {
  const favs = await getFavorites()
  const index = favs[type].indexOf(id)
  let isFavorite = false
  if (index === -1) {
    favs[type].push(id)
    isFavorite = true
  } else {
    favs[type].splice(index, 1)
  }
  const store = await getStore()
  await store.set('favorites', favs)
  await store.save()
  return { success: true, isFavorite }
}

// ----------------------------------------------------
// Resume / Watch History
// ----------------------------------------------------

export interface ResumeData {
  position: number
  duration: number
  updatedAt: number
}

export async function getResume(id: string): Promise<ResumeData | null> {
  const store = await getStore()
  const allResume = (await store.get<Record<string, ResumeData>>('resume')) || {}
  return allResume[id] || null
}

export async function saveResume(id: string, position: number, duration: number): Promise<void> {
  const store = await getStore()
  const allResume = (await store.get<Record<string, ResumeData>>('resume')) || {}
  allResume[id] = { position, duration, updatedAt: Date.now() }
  await store.set('resume', allResume)
  await store.save()
}

// ----------------------------------------------------
// Last Played
// ----------------------------------------------------

export interface LastPlayedData {
  type?: string
  providerId?: string
  itemId?: string
}

export async function getLastPlayed(): Promise<LastPlayedData> {
  const store = await getStore()
  const lp = await store.get<LastPlayedData>('lastPlayed')
  return lp || {}
}

export async function setLastPlayed(data: LastPlayedData): Promise<void> {
  const store = await getStore()
  await store.set('lastPlayed', data)
  await store.save()
}

