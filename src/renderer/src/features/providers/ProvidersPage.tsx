import React, { useState } from 'react'
import { useProvidersStore } from '../../store/providers.store'
import { useUIStore } from '../../store/player.store'
import { toast } from '../../components/ui/ToastContainer'
import { Plus, Trash2, Check, X, Wifi, FileText, Eye, EyeOff } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Provider } from '../../lib/types'

// ============================================================
// ProvidersPage — Управління провайдерами
// ============================================================

type AddMode = 'none' | 'xtream' | 'm3u'

export function ProvidersPage(): React.ReactElement {
  const { providers, deleteProvider, addXtreamProvider, addM3UProvider } = useProvidersStore()
  const { setActiveProvider } = useUIStore()
  const [addMode, setAddMode] = useState<AddMode>('none')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Xtream форма
  const [xtreamForm, setXtreamForm] = useState({
    name: '',
    host: '',
    port: 80,
    username: '',
    password: '',
    epgUrl: ''
  })

  // M3U форма
  const [m3uForm, setM3uForm] = useState({
    name: '',
    url: '',
    filePath: '',
    epgUrl: ''
  })

  const handleDeleteProvider = async (id: string) => {
    await deleteProvider(id)
    toast.info('Провайдера видалено')
  }

  const handleAddXtream = async () => {
    if (!xtreamForm.host || !xtreamForm.username || !xtreamForm.password) {
      toast.error('Заповніть всі обов\'язкові поля')
      return
    }

    // Очищаємо host від пробілів та зайвих слешів
    const cleanHost = xtreamForm.host.trim().replace(/\/+$/, '')

    setIsLoading(true)
    const result = await addXtreamProvider({
      ...xtreamForm,
      host: cleanHost,
      epgUrl: xtreamForm.epgUrl.trim() || undefined,
      type: 'xtream',
      isActive: true
    })
    setIsLoading(false)

    if (result.success) {
      toast.success('Провайдера додано успішно!')
      setAddMode('none')
      setXtreamForm({ name: '', host: '', port: 80, username: '', password: '', epgUrl: '' })
    } else {
      toast.error(result.error || 'Помилка підключення')
    }
  }

  const handleAddM3U = async () => {
    if (!m3uForm.name || (!m3uForm.url && !m3uForm.filePath)) {
      toast.error('Вкажіть назву та URL або файл')
      return
    }

    setIsLoading(true)
    const result = await addM3UProvider({
      name: m3uForm.name,
      url: m3uForm.url || undefined,
      filePath: m3uForm.filePath || undefined,
      epgUrl: m3uForm.epgUrl.trim() || undefined,
      type: 'm3u',
      isActive: true
    })
    setIsLoading(false)

    if (result.success) {
      toast.success('M3U плейлист додано!')
      setAddMode('none')
      setM3uForm({ name: '', url: '', filePath: '', epgUrl: '' })
    } else {
      toast.error(result.error || 'Помилка завантаження плейлиста')
    }
  }

  const handleBrowseFile = async () => {
    const filePath = await window.api.providers.browseM3U()
    if (filePath) {
      setM3uForm((prev) => ({ ...prev, filePath, name: prev.name || filePath.split('\\').pop() || '' }))
    }
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar p-6">
      <div className="max-w-2xl mx-auto">
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-text-primary text-xl font-bold">Провайдери</h1>
            <p className="text-text-muted text-sm mt-0.5">Управління IPTV акаунтами та плейлистами</p>
          </div>
          {addMode === 'none' && (
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode('xtream')}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                <Plus className="w-4 h-4" />
                Xtream Codes
              </button>
              <button
                onClick={() => setAddMode('m3u')}
                className="btn-ghost border border-border/40 flex items-center gap-2 text-sm"
              >
                <FileText className="w-4 h-4" />
                M3U
              </button>
            </div>
          )}
        </div>

        {/* Форма Xtream */}
        {addMode === 'xtream' && (
          <div className="card-base p-5 mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Wifi className="w-4 h-4 text-accent" />
              <h3 className="text-text-primary font-semibold">Додати Xtream Codes</h3>
              <button onClick={() => setAddMode('none')} className="ml-auto btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-text-secondary text-xs font-medium mb-1 block">Назва *</label>
                <input
                  type="text"
                  value={xtreamForm.name}
                  onChange={(e) => setXtreamForm({ ...xtreamForm, name: e.target.value })}
                  placeholder="Мій провайдер"
                  className="input-base w-full"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-text-secondary text-xs font-medium mb-1 block">Host *</label>
                  <input
                    type="text"
                    value={xtreamForm.host}
                    onChange={(e) => setXtreamForm({ ...xtreamForm, host: e.target.value })}
                    placeholder="http://example.com"
                    className="input-base w-full"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-xs font-medium mb-1 block">Port</label>
                  <input
                    type="number"
                    value={xtreamForm.port}
                    onChange={(e) => setXtreamForm({ ...xtreamForm, port: parseInt(e.target.value) || 80 })}
                    className="input-base w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-text-secondary text-xs font-medium mb-1 block">Логін *</label>
                  <input
                    type="text"
                    value={xtreamForm.username}
                    onChange={(e) => setXtreamForm({ ...xtreamForm, username: e.target.value })}
                    placeholder="username"
                    className="input-base w-full"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-xs font-medium mb-1 block">Пароль *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={xtreamForm.password}
                      onChange={(e) => setXtreamForm({ ...xtreamForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="input-base w-full pr-9"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-text-secondary text-xs font-medium mb-1 block">
                  Посилання на EPG (XMLTV) <span className="text-text-muted font-normal text-[10px] ml-1">(опціонально)</span>
                </label>
                <input
                  type="url"
                  value={xtreamForm.epgUrl}
                  onChange={(e) => setXtreamForm({ ...xtreamForm, epgUrl: e.target.value })}
                  placeholder="http://s02.wsbof.com:8080/xml/ff72df57.gz"
                  className="input-base w-full"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddXtream}
                  disabled={isLoading}
                  className="btn-primary flex items-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isLoading ? 'Перевірка...' : 'Додати'}
                </button>
                <button onClick={() => setAddMode('none')} className="btn-ghost">Скасувати</button>
              </div>
            </div>
          </div>
        )}

        {/* Форма M3U */}
        {addMode === 'm3u' && (
          <div className="card-base p-5 mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-accent" />
              <h3 className="text-text-primary font-semibold">Додати M3U плейлист</h3>
              <button onClick={() => setAddMode('none')} className="ml-auto btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-text-secondary text-xs font-medium mb-1 block">Назва *</label>
                <input
                  type="text"
                  value={m3uForm.name}
                  onChange={(e) => setM3uForm({ ...m3uForm, name: e.target.value })}
                  placeholder="Мій плейлист"
                  className="input-base w-full"
                />
              </div>
              <div>
                <label className="text-text-secondary text-xs font-medium mb-1 block">URL плейлиста</label>
                <input
                  type="url"
                  value={m3uForm.url}
                  onChange={(e) => setM3uForm({ ...m3uForm, url: e.target.value, filePath: '' })}
                  placeholder="http://example.com/playlist.m3u8"
                  className="input-base w-full"
                />
              </div>
              <div className="text-text-muted text-xs text-center">— або —</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={m3uForm.filePath}
                  onChange={(e) => setM3uForm({ ...m3uForm, filePath: e.target.value, url: '' })}
                  placeholder="Шлях до файлу..."
                  className="input-base flex-1"
                  readOnly
                />
                <button onClick={handleBrowseFile} className="btn-ghost border border-border/40 text-sm">
                  Огляд...
                </button>
              </div>
              <div>
                <label className="text-text-secondary text-xs font-medium mb-1 block">
                  Посилання на EPG (XMLTV) <span className="text-text-muted font-normal text-[10px] ml-1">(опціонально)</span>
                </label>
                <input
                  type="url"
                  value={m3uForm.epgUrl}
                  onChange={(e) => setM3uForm({ ...m3uForm, epgUrl: e.target.value })}
                  placeholder="http://example.com/epg.xml.gz"
                  className="input-base w-full"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleAddM3U}
                  disabled={isLoading}
                  className="btn-primary flex items-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Check className="w-4 h-4" />}
                  {isLoading ? 'Завантаження...' : 'Додати'}
                </button>
                <button onClick={() => setAddMode('none')} className="btn-ghost">Скасувати</button>
              </div>
            </div>
          </div>
        )}

        {/* Список провайдерів */}
        <div className="space-y-3">
          {providers.length === 0 ? (
            <div className="card-base p-10 text-center">
              <div className="w-16 h-16 rounded-full bg-bg-hover flex items-center justify-center mx-auto mb-3">
                <Wifi className="w-8 h-8 text-text-muted" />
              </div>
              <p className="text-text-secondary font-medium">Провайдери відсутні</p>
              <p className="text-text-muted text-sm mt-1">Додайте Xtream Codes або M3U плейлист</p>
            </div>
          ) : (
            providers.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onDelete={() => handleDeleteProvider(provider.id)}
                onSelect={() => {
                  setActiveProvider(provider.id)
                  toast.info(`Активний провайдер: ${provider.name}`)
                }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ----- ProviderCard -----

interface ProviderCardProps {
  provider: Provider
  onDelete: () => void
  onSelect: () => void
}

function ProviderCard({ provider, onDelete, onSelect }: ProviderCardProps): React.ReactElement {
  const { activeProviderId } = useUIStore()
  const isActive = activeProviderId === provider.id

  return (
    <div
      className={cn(
        'card-hover p-4 flex items-center gap-4 border',
        isActive && 'border-accent/40 bg-accent/5'
      )}
      onClick={onSelect}
    >
      {/* Іконка */}
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        provider.type === 'xtream' ? 'bg-accent/20' : 'bg-success/20'
      )}>
        {provider.type === 'xtream'
          ? <Wifi className={cn('w-5 h-5', isActive ? 'text-accent' : 'text-text-muted')} />
          : <FileText className={cn('w-5 h-5', isActive ? 'text-success' : 'text-text-muted')} />
        }
      </div>

      {/* Інфо */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-text-primary font-semibold text-sm truncate">{provider.name}</p>
          {isActive && <span className="badge badge-success">Активний</span>}
        </div>
        <p className="text-text-muted text-xs mt-0.5">
          {provider.type === 'xtream' ? 'Xtream Codes API' : 'M3U Playlist'}
        </p>
        {provider.lastUpdated && (
          <p className="text-text-muted text-[10px] mt-0.5">
            Оновлено: {new Date(provider.lastUpdated).toLocaleString('uk')}
          </p>
        )}
      </div>

      {/* Дії */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="btn-icon hover:bg-error/10 hover:text-error flex-shrink-0"
        title="Видалити"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
