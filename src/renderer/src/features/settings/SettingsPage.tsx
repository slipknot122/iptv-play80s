import React, { useEffect } from 'react'
import { useSettingsStore } from '../../store/providers.store'
import { toast } from '../../components/ui/ToastContainer'
import { Settings, Zap, RefreshCw, Info } from 'lucide-react'
import { cn } from '../../lib/utils'

// ============================================================
// SettingsPage — Налаштування застосунку
// ============================================================

export function SettingsPage(): React.ReactElement {
  const { settings, loadSettings, updateSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [])

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  const handleUpdate = async (updates: Partial<typeof settings>) => {
    await updateSettings(updates)
    toast.success('Налаштування збережено')
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-6">
      <div className="max-w-lg mx-auto">
        {/* Заголовок */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-text-primary text-xl font-bold">Налаштування</h1>
            <p className="text-text-muted text-sm">Конфігурація IPTV Player</p>
          </div>
        </div>

        {/* Секція плеєра */}
        <SettingsSection icon={<Zap className="w-4 h-4" />} title="Плеєр">
          <SettingsRow
            label="Основний рушій"
            description="MPV — потужний, hls.js — сумісний"
          >
            <div className="flex gap-2">
              {(['mpv', 'hls'] as const).map((engine) => (
                <button
                  key={engine}
                  onClick={() => handleUpdate({ preferredEngine: engine })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    settings.preferredEngine === engine
                      ? 'bg-accent text-white'
                      : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                  )}
                >
                  {engine === 'mpv' ? 'MPV' : 'HLS.js'}
                </button>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow
            label="Формат потоку"
            description="Формат для IPTV потоків"
          >
            <div className="flex gap-2">
              {(['m3u8', 'ts'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleUpdate({ streamFormat: fmt })}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-all font-mono',
                    settings.streamFormat === fmt
                      ? 'bg-accent text-white'
                      : 'bg-bg-hover text-text-secondary hover:text-text-primary'
                  )}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </SettingsRow>

          {settings.preferredEngine === 'mpv' && (
            <SettingsRow
              label="Шлях до mpv.exe"
              description="Залиште порожнім для автовизначення"
            >
              <input
                type="text"
                value={settings.mpvPath || ''}
                onChange={(e) => handleUpdate({ mpvPath: e.target.value || undefined })}
                placeholder="C:\Program Files\mpv\mpv.exe"
                className="input-base text-sm w-full"
              />
            </SettingsRow>
          )}
        </SettingsSection>

        {/* Секція оновлення */}
        <SettingsSection icon={<RefreshCw className="w-4 h-4" />} title="Автооновлення">
          <SettingsRow
            label="Інтервал оновлення"
            description="0 = вимкнено"
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="120"
                step="5"
                value={settings.autoRefreshInterval}
                onChange={(e) => handleUpdate({ autoRefreshInterval: parseInt(e.target.value) })}
                className="w-32"
              />
              <span className="text-text-primary text-sm font-medium w-20">
                {settings.autoRefreshInterval === 0
                  ? 'Вимкнено'
                  : `${settings.autoRefreshInterval} хв`
                }
              </span>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* Секція про застосунок */}
        <SettingsSection icon={<Info className="w-4 h-4" />} title="Про застосунок">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Версія</span>
              <span className="text-text-primary font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Плеєр</span>
              <span className="text-text-primary font-medium">MPV + HLS.js</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Протоколи</span>
              <span className="text-text-primary font-medium">Xtream Codes, M3U</span>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  )
}

// ----- Допоміжні компоненти -----

function SettingsSection({
  icon,
  title,
  children
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="card-base p-5 mb-4">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/20">
        <div className="text-accent">{icon}</div>
        <h3 className="text-text-primary font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function SettingsRow({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-text-primary text-sm font-medium">{label}</p>
        {description && <p className="text-text-muted text-xs mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}
