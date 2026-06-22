import { invoke } from '@tauri-apps/api/core';
import { fetch } from '@tauri-apps/plugin-http';
import * as store from './store';
import { fetchAndParseM3U } from './m3u';

// Helper to format provider URL
function getProviderBaseUrl(p: import('./types').XtreamProvider): string {
  let baseUrl = p.host.trim();
  while (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }
  if (!baseUrl.toLowerCase().startsWith('http://') && !baseUrl.toLowerCase().startsWith('https://')) {
    baseUrl = `http://${baseUrl}`;
  }
  if (p.port && !baseUrl.includes(`:${p.port}`)) {
    return `${baseUrl}:${p.port}`;
  }
  return baseUrl;
}

// Helper to make requests to Xtream API
async function xtreamFetch(provider: any, action: string, params: Record<string, string> = {}) {
  const p = provider as import('./types').XtreamProvider;
  
  const finalUrlStr = getProviderBaseUrl(p);
  const url = new URL(`${finalUrlStr}/player_api.php`);
  url.searchParams.append('username', p.username);
  url.searchParams.append('password', p.password);
  url.searchParams.append('action', action);
  
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.append(k, String(v));
    }
  }

  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.error('xtreamFetch error:', err, 'url:', url.toString());
    throw err;
  }
}

export const api = {
  mpv: {
    check: async () => {
      try {
        const data = await invoke('mpv_check');
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
    state: async () => {
      try {
        const data = await invoke('mpv_state');
        return { success: true, data };
      } catch (e: any) {
        return { success: false, error: e?.message || String(e) };
      }
    },
    load: async (url: string) => {
      await invoke('mpv_load', { url });
      return { success: true, error: undefined as string | undefined };
    },
    play: async (url: string) => {
      await invoke('mpv_play', { url });
      return { success: true, error: undefined as string | undefined };
    },
    stop: () => invoke('mpv_stop'),
    pause: (paused: boolean) => invoke('mpv_pause', { paused }),
    seek: (position: number) => invoke('mpv_seek', { position }),
    volume: (volume: number) => invoke('mpv_volume', { volume }),
    geometry: (rect: { x: number; y: number; width: number; height: number }) => invoke('mpv_geometry', { ...rect }),
    onEvent: (callback: any) => {
      // Stub for now.
      return () => {};
    }
  },
  epg: {
    short: async (providerId: string, channelId: string, epgId?: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p || p.type !== 'xtream') return { success: false, error: 'Provider not found or not Xtream' };
      try {
        const data = await xtreamFetch(p, 'get_short_epg', { stream_id: channelId });
        return { success: true, data: data.epg_listings || [] };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    full: async (providerId: string, channelId: string, epgId?: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p || p.type !== 'xtream') return { success: false, error: 'Provider not found or not Xtream' };
      try {
        const data = await xtreamFetch(p, 'get_simple_data_table', { stream_id: channelId });
        return { success: true, data: data.epg_listings || [] };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    onProgress: (callback: any) => {
      return () => {};
    }
  },
  live: {
    categories: async (providerId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p) return { success: false, error: 'Provider not found' };
      if (p.type === 'xtream') {
        try {
          const raw = await xtreamFetch(p, 'get_live_categories');
          const data = raw.map((c: any) => ({
            id: String(c.category_id),
            name: c.category_name
          }));
          return { success: true, data };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      } else if (p.type === 'm3u') {
        try {
          const m3uProvider = p as import('./types').M3UProvider;
          const parsed = await fetchAndParseM3U(m3uProvider.url!);
          const groups = Array.from(new Set(parsed.channels.map(c => c.group || 'Uncategorized')));
          const data = groups.map((g, i) => ({ id: String(i), name: g }));
          return { success: true, data };
        } catch (err: any) {
          console.error('M3U parse error:', err);
          return { success: false, error: err?.message || String(err) };
        }
      }
      return { success: true, data: [] };
    },
    channels: async (providerId: string, categoryId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p) return { success: false, error: 'Provider not found' };
      if (p.type === 'xtream') {
        try {
          const raw = await xtreamFetch(p, 'get_live_streams', { category_id: categoryId });
          const baseUrl = getProviderBaseUrl(p as import('./types').XtreamProvider);
          const data = raw.map((c: any) => ({
            id: String(c.stream_id),
            providerId: p.id,
            name: c.name,
            logo: c.stream_icon,
            categoryId: String(c.category_id),
            streamUrl: `${baseUrl}/live/${(p as import('./types').XtreamProvider).username}/${(p as import('./types').XtreamProvider).password}/${c.stream_id}.m3u8`,
            epgId: c.epg_channel_id
          }));
          return { success: true, data };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      } else if (p.type === 'm3u') {
        try {
          const m3uProvider = p as import('./types').M3UProvider;
          const parsed = await fetchAndParseM3U(m3uProvider.url!);
          // Find the category name for this ID (based on our generation above)
          const groups = Array.from(new Set(parsed.channels.map(c => c.group || 'Uncategorized')));
          const categoryName = groups[parseInt(categoryId)] || 'Uncategorized';
          
          const data = parsed.channels
            .filter(c => (c.group || 'Uncategorized') === categoryName)
            .map(c => ({
              id: String(c.id || Math.random()),
              providerId: p.id,
              name: c.name,
              logo: c.logo || '',
              categoryId: categoryId,
              streamUrl: c.url,
              epgId: c.epgId || ''
            }));
          return { success: true, data };
        } catch (err: any) {
          console.error('M3U parse error:', err);
          return { success: false, error: err?.message || String(err) };
        }
      }
      return { success: true, data: [] };
    },
    catchupUrl: async (providerId: string, channelId: string, startTimeMs: number, durationMinutes: number) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p || p.type !== 'xtream') return { success: false, error: 'Provider not found or not Xtream' };
      
      const xp = p as import('./types').XtreamProvider;
      const startObj = new Date(startTimeMs);
      const startStr = `${startObj.getFullYear()}-${String(startObj.getMonth() + 1).padStart(2, '0')}-${String(startObj.getDate()).padStart(2, '0')}:${String(startObj.getHours()).padStart(2, '0')}-${String(startObj.getMinutes()).padStart(2, '0')}`;
      
      const baseUrl = getProviderBaseUrl(xp);
      const url = `${baseUrl}/streaming/timeshift.php?username=${xp.username}&password=${xp.password}&stream=${channelId}&start=${startStr}&duration=${durationMinutes}`;
      return { success: true, data: url };
    }
  },
  vod: {
    categories: async (providerId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p) return { success: false, error: 'Provider not found' };
      if (p.type === 'xtream') {
        try {
          const raw = await xtreamFetch(p, 'get_vod_categories');
          const data = raw.map((c: any) => ({
            id: String(c.category_id),
            name: c.category_name
          }));
          return { success: true, data };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      }
      return { success: true, data: [] };
    },
    movies: async (providerId: string, categoryId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p) return { success: false, error: 'Provider not found' };
      if (p.type === 'xtream') {
        try {
          const raw = await xtreamFetch(p, 'get_vod_streams', { category_id: categoryId });
          const baseUrl = getProviderBaseUrl(p as import('./types').XtreamProvider);
          const data = raw.map((c: any) => ({
            id: String(c.stream_id),
            providerId: p.id,
            name: c.name,
            poster: c.stream_icon,
            categoryId: String(c.category_id),
            streamUrl: `${baseUrl}/movie/${(p as import('./types').XtreamProvider).username}/${(p as import('./types').XtreamProvider).password}/${c.stream_id}.${c.container_extension || 'mp4'}`,
            rating: String(c.rating || c.rating_5based || '')
          }));
          return { success: true, data };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      }
      return { success: true, data: [] };
    },
    info: async (providerId: string, movieId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p || p.type !== 'xtream') return { success: false, error: 'Provider not found or not Xtream' };
      try {
        const data = await xtreamFetch(p, 'get_vod_info', { vod_id: movieId });
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  },
  series: {
    categories: async (providerId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p) return { success: false, error: 'Provider not found' };
      if (p.type === 'xtream') {
        try {
          const raw = await xtreamFetch(p, 'get_series_categories');
          const data = raw.map((c: any) => ({
            id: String(c.category_id),
            name: c.category_name
          }));
          return { success: true, data };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      }
      return { success: true, data: [] };
    },
    list: async (providerId: string, categoryId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p) return { success: false, error: 'Provider not found' };
      if (p.type === 'xtream') {
        try {
          const raw = await xtreamFetch(p, 'get_series', { category_id: categoryId });
          const data = raw.map((s: any) => ({
            id: String(s.series_id),
            providerId: p.id,
            name: s.name,
            cover: s.cover,
            categoryId: String(s.category_id),
            rating: String(s.rating || s.rating_5based || '')
          }));
          return { success: true, data };
        } catch (err: any) {
          return { success: false, error: err?.message || String(err) };
        }
      }
      return { success: true, data: [] };
    },
    info: async (providerId: string, seriesId: string) => {
      const providers = await store.getProviders();
      const p = providers.find(p => p.id === providerId);
      if (!p || p.type !== 'xtream') return { success: false, error: 'Provider not found or not Xtream' };
      try {
        const data = await xtreamFetch(p, 'get_series_info', { series_id: seriesId });
        return { success: true, data };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
  },
  favorites: {
    get: async () => await store.getFavorites(),
    toggle: async (type: 'channels' | 'movies' | 'series', id: string) => await store.toggleFavorite(type, id)
  },
  resume: {
    get: async (id: string) => await store.getResume(id),
    save: async (id: string, position: number, duration: number) => {
      await store.saveResume(id, position, duration);
      return { success: true };
    }
  },
  lastPlayed: {
    set: async (data: any) => {
      await store.setLastPlayed(data);
      return { success: true };
    },
    get: async () => await store.getLastPlayed()
  },
  providers: {
    list: () => store.getProviders(),
    addXtream: async (data: any) => {
      try {
        const id = crypto.randomUUID();
        const newProvider = { ...data, id, type: 'xtream', isActive: true, createdAt: Date.now() };
        
        // Test connection
        await xtreamFetch(newProvider, 'get_live_categories');
        
        await store.addProvider(newProvider);
        return { success: true };
      } catch (err: any) {
        console.error('addXtream error:', err);
        const errMsg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
        return { success: false, error: errMsg };
      }
    },
    addM3U: async (data: any) => {
      try {
        const id = crypto.randomUUID();
        const newProvider = { ...data, id, type: 'm3u', isActive: true, createdAt: Date.now() };
        
        // Test connection
        await fetchAndParseM3U(newProvider.url);
        
        await store.addProvider(newProvider);
        return { success: true };
      } catch (err: any) {
        console.error('addM3U error:', err);
        const errMsg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
        return { success: false, error: errMsg };
      }
    },
    delete: async (id: string) => {
      await store.deleteProvider(id);
      return { success: true };
    },
    update: async (id: string, updates: any) => {
      await store.updateProvider(id, updates);
      return { success: true };
    }
  },
  settings: {
    get: () => store.getSettings(),
    set: async (updates: any) => {
      await store.saveSettings(updates);
      return { success: true };
    }
  },
  window: {
    minimize: () => invoke('window_minimize'),
    maximize: () => invoke('window_maximize'),
    close: () => invoke('window_close'),
    setFullscreen: (fullscreen: boolean) => invoke('window_fullscreen', { fullscreen })
  }
};

// Polyfill window.api for old electron components
(window as any).api = api;
