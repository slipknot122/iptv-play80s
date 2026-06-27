import { fetch } from '@tauri-apps/plugin-http'

export interface M3UChannel {
  id: string
  name: string
  logo?: string
  group?: string
  url: string
  epgId?: string
}

export interface ParsedM3U {
  channels: M3UChannel[]
}

/**
 * Парсинг M3U плейлиста з URL
 */
export async function fetchAndParseM3U(url: string): Promise<ParsedM3U> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP error ${res.status}`)
  const text = await res.text()
  return parseM3UString(text)
}

/**
 * Парсинг рядка M3U
 */
export function parseM3UString(content: string): ParsedM3U {
  const lines = content.split(/\r?\n/)
  const channels: M3UChannel[] = []
  
  let currentChannel: Partial<M3UChannel> | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (line.startsWith('#EXTINF:')) {
      // Приклад: #EXTINF:-1 tvg-id="id1" tvg-logo="url" group-title="Group", Channel Name
      currentChannel = {}
      
      // Парсимо атрибути
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/)
      if (tvgIdMatch) currentChannel.epgId = tvgIdMatch[1]
      
      const tvgLogoMatch = line.match(/tvg-logo="([^"]+)"/)
      if (tvgLogoMatch) currentChannel.logo = tvgLogoMatch[1]
      
      const groupMatch = line.match(/group-title="([^"]+)"/)
      if (groupMatch) currentChannel.group = groupMatch[1]
      
      // Назва каналу знаходиться після останньої коми
      const splitByComma = line.split(',')
      if (splitByComma.length > 1) {
        currentChannel.name = splitByComma[splitByComma.length - 1].trim()
      } else {
        currentChannel.name = 'Unknown Channel'
      }
    } else if (line.startsWith('#EXTGRP:')) {
      if (currentChannel) {
        currentChannel.group = line.replace('#EXTGRP:', '').trim()
      }
    } else if (line && !line.startsWith('#')) {
      // Це URL
      if (currentChannel && currentChannel.name) {
        currentChannel.url = line
        currentChannel.id = currentChannel.epgId || crypto.randomUUID()
        channels.push(currentChannel as M3UChannel)
      }
      currentChannel = null // скидаємо
    }
  }

  return { channels }
}
