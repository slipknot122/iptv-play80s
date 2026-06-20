import { create } from 'zustand'
import type {
  Provider,
  XtreamProvider,
  M3UProvider,
  AppSettings
} from '../lib/types'

// ============================================================
// Store провайдерів (акаунтів)
// ============================================================

interface ProvidersState {
  providers: Provider[]
  isLoading: boolean
  error: string | null
  // Дії
  loadProviders: () => Promise<void>
  addXtreamProvider: (data: Omit<XtreamProvider, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>
  addM3UProvider: (data: Omit<M3UProvider, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>
  deleteProvider: (id: string) => Promise<void>
  updateProvider: (id: string, updates: Partial<Provider>) => Promise<void>
}

export const useProvidersStore = create<ProvidersState>((set) => ({
  providers: [],
  isLoading: false,
  error: null,

  loadProviders: async () => {
    set({ isLoading: true, error: null })
    try {
      const providers = await window.api.providers.list()
      set({ providers, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  addXtreamProvider: async (data) => {
    const result = await window.api.providers.addXtream(data)
    if (result.success) {
      const providers = await window.api.providers.list()
      set({ providers })
    }
    return result
  },

  addM3UProvider: async (data) => {
    const result = await window.api.providers.addM3U(data)
    if (result.success) {
      const providers = await window.api.providers.list()
      set({ providers })
    }
    return result
  },

  deleteProvider: async (id) => {
    await window.api.providers.delete(id)
    set((state) => ({
      providers: state.providers.filter((p) => p.id !== id)
    }))
  },

  updateProvider: async (id, updates) => {
    await window.api.providers.update(id, updates)
    set((state) => ({
      providers: state.providers.map((p) => (p.id === id ? { ...p, ...updates } : p))
    }))
  }
}))

// ============================================================
// Store налаштувань
// ============================================================

interface SettingsState {
  settings: AppSettings | null
  isLoading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true })
    const settings = await window.api.settings.get()
    set({ settings, isLoading: false })
  },

  updateSettings: async (updates) => {
    await window.api.settings.set(updates)
    set((state) => ({
      settings: state.settings ? { ...state.settings, ...updates } : null
    }))
  }
}))
