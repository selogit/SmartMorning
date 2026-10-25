import type { Href } from 'expo-router';

export type TileKind =
  | 'alarm'
  | 'notes'
  | 'weather'
  | 'kitchen'
  | 'news'
  | 'gmail'
  | 'calendar'
  | 'music'
  | 'app'
  | 'task';

/** module = moduł tej aplikacji, app = zewnętrzna aplikacja/strona, task = własne zadanie bez akcji. */
export type TileCategory = 'module' | 'app' | 'task';

export interface TileKindInfo {
  kind: TileKind;
  label: string;
  description: string;
  category: TileCategory;
  /** Ekran w tej aplikacji (moduł). Brak trasy przy module = „Wkrótce”. */
  route?: Href;
  /** Domyślny link — linki https otwierają aplikację, jeśli jest zainstalowana (Gmail, Spotify…). */
  url?: string;
  /** Użytkownik podaje własny link. */
  customUrl?: boolean;
}

export const TILE_KINDS: TileKindInfo[] = [
  { kind: 'alarm', label: 'Budzik', description: 'Pobudka z zadaniami', category: 'module', route: '/alarm' },
  { kind: 'notes', label: 'Notatnik', description: 'Notatki i plan dnia', category: 'module', route: '/notes' },
  { kind: 'weather', label: 'Pogoda', description: 'Prognoza na dziś', category: 'module', route: '/weather' },
  { kind: 'kitchen', label: 'Kuchnia AI', description: 'Śniadanie z lodówki', category: 'module' },
  {
    kind: 'news',
    label: 'Wiadomości',
    description: 'Najważniejsze wiadomości dnia',
    category: 'app',
    url: 'https://news.google.com/?hl=pl&gl=PL&ceid=PL:pl',
  },
  { kind: 'gmail', label: 'Gmail', description: 'Przejrzyj pocztę', category: 'app', url: 'https://mail.google.com/' },
  {
    kind: 'calendar',
    label: 'Kalendarz',
    description: 'Spotkania na dziś',
    category: 'app',
    url: 'https://calendar.google.com/',
  },
  { kind: 'music', label: 'Spotify', description: 'Muzyka na start', category: 'app', url: 'https://open.spotify.com/' },
  { kind: 'app', label: 'Własny link', description: 'Dowolna aplikacja lub strona', category: 'app', customUrl: true },
  { kind: 'task', label: 'Własne zadanie', description: 'Np. prysznic, kawa, ćwiczenia', category: 'task' },
];

const BY_KIND = Object.fromEntries(TILE_KINDS.map(k => [k.kind, k])) as Record<TileKind, TileKindInfo>;

export const kindInfo = (kind: TileKind): TileKindInfo => BY_KIND[kind] ?? BY_KIND.task;

export const CATEGORY_LABELS: Record<TileCategory, string> = {
  module: 'Moduły',
  app: 'Aplikacje',
  task: 'Zadania',
};

/** Moduł jeszcze niezbudowany — kafelek działa w planie, ale nie ma czego otworzyć. */
export const isSoon = (info: TileKindInfo) => info.category === 'module' && !info.route;
