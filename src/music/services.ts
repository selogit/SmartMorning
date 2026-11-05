import { Linking } from 'react-native';

export type ServiceId = 'spotify' | 'ytmusic' | 'youtube' | 'apple' | 'tidal' | 'deezer' | 'soundcloud' | 'other';

export interface MusicService {
  id: ServiceId;
  label: string;
  /** Strona główna — otwiera aplikację serwisu, jeśli jest zainstalowana. */
  home: string;
  match: RegExp;
}

export const SERVICES: MusicService[] = [
  { id: 'spotify', label: 'Spotify', home: 'https://open.spotify.com/', match: /(^spotify:|open\.spotify\.com|spotify\.link)/i },
  { id: 'ytmusic', label: 'YouTube Music', home: 'https://music.youtube.com/', match: /music\.youtube\.com/i },
  { id: 'youtube', label: 'YouTube', home: 'https://www.youtube.com/', match: /(youtube\.com|youtu\.be)/i },
  { id: 'apple', label: 'Apple Music', home: 'https://music.apple.com/', match: /music\.apple\.com/i },
  { id: 'tidal', label: 'Tidal', home: 'https://listen.tidal.com/', match: /tidal\.com/i },
  { id: 'deezer', label: 'Deezer', home: 'https://www.deezer.com/', match: /(deezer\.com|deezer\.page\.link|dzr\.page\.link)/i },
  { id: 'soundcloud', label: 'SoundCloud', home: 'https://soundcloud.com/', match: /(soundcloud\.com|on\.soundcloud\.com)/i },
];

/** Serwisy do wyboru jako „mój serwis” (bez zwykłego YouTube). */
export const PICKABLE = SERVICES.filter(s => s.id !== 'youtube');

export const serviceInfo = (id: ServiceId) => SERVICES.find(s => s.id === id);
export const serviceLabel = (id: ServiceId) => serviceInfo(id)?.label ?? 'Link';

/** Rozpoznaje serwis po linku (YouTube Music przed zwykłym YouTube). */
export function detectService(url: string): ServiceId {
  return SERVICES.find(s => s.match.test(url))?.id ?? 'other';
}

export const isValidMusicUrl = (url: string) => /^(https?:\/\/\S+|spotify:\S+)$/i.test(url.trim());

/**
 * Link Spotify z przeglądarki → adres aplikacji (spotify:playlist:ID), który otwiera Spotify bez przeglądarki.
 * Pozostałe serwisy otwierają się z linków https (App Links), jeśli aplikacja jest zainstalowana.
 */
export function toAppUrl(url: string): string {
  const m = /open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/i.exec(url);
  return m ? `spotify:${m[1].toLowerCase()}:${m[2]}` : url;
}

/** Otwiera muzykę w aplikacji serwisu; gdy się nie da — link w przeglądarce. */
export async function openMusic(url: string) {
  const app = toAppUrl(url.trim());
  try {
    await Linking.openURL(app);
  } catch {
    if (app !== url) await Linking.openURL(url.trim());
    else throw new Error('Nie udało się otworzyć linku');
  }
}
