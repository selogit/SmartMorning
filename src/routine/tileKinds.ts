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
  | 'transit'
  | 'checklist'
  | 'youtube'
  | 'maps'
  | 'jakdojade'
  | 'outlook'
  | 'teams'
  | 'slack'
  | 'whatsapp'
  | 'messenger'
  | 'sms'
  | 'todoist'
  | 'duolingo'
  | 'strava'
  | 'linkedin'
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
  /** Link do aplikacji (np. „slack://open”) próbowany przed `url`; gdy aplikacji nie ma — otwiera się `url`. */
  appUrl?: string;
  /** Użytkownik podaje własny link. */
  customUrl?: boolean;
  /** Moduł działa w całości w kroku planu (bez osobnego ekranu). */
  inline?: boolean;
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
    category: 'module',
    route: '/news',
  },
  { kind: 'gmail', label: 'Gmail', description: 'Przejrzyj pocztę', category: 'app', url: 'https://mail.google.com/' },
  {
    kind: 'calendar',
    label: 'Kalendarz',
    description: 'Spotkania na dziś',
    category: 'app',
    url: 'https://calendar.google.com/',
  },
  { kind: 'transit', label: 'Dojazd', description: 'Opóźnienia pociągów, autobusy i tramwaje', category: 'module', route: '/transit' },
  {
    kind: 'checklist',
    label: 'Przed wyjściem',
    description: 'Odhacz, czy wszystko masz',
    category: 'module',
    inline: true,
  },
  { kind: 'music', label: 'Muzyka', description: 'Playlista na start dnia', category: 'module', route: '/music' },
  { kind: 'outlook', label: 'Outlook', description: 'Poczta służbowa', category: 'app', appUrl: 'ms-outlook://', url: 'https://outlook.office.com/mail/' },
  { kind: 'teams', label: 'Teams', description: 'Czat i spotkania w pracy', category: 'app', appUrl: 'msteams://', url: 'https://teams.microsoft.com/' },
  { kind: 'slack', label: 'Slack', description: 'Wiadomości z zespołu', category: 'app', appUrl: 'slack://open', url: 'https://app.slack.com/client' },
  { kind: 'todoist', label: 'Todoist', description: 'Zadania na dziś', category: 'app', appUrl: 'todoist://', url: 'https://app.todoist.com/' },
  { kind: 'whatsapp', label: 'WhatsApp', description: 'Odpisz na wiadomości', category: 'app', appUrl: 'whatsapp://send', url: 'https://web.whatsapp.com/' },
  { kind: 'messenger', label: 'Messenger', description: 'Odpisz znajomym', category: 'app', appUrl: 'fb-messenger://', url: 'https://www.messenger.com/' },
  { kind: 'sms', label: 'SMS', description: 'Wiadomości tekstowe', category: 'app', url: 'sms:' },
  { kind: 'maps', label: 'Mapy Google', description: 'Korki i dojazd autem', category: 'app', url: 'https://www.google.com/maps' },
  { kind: 'jakdojade', label: 'Jakdojade', description: 'Trasa komunikacją i bilety', category: 'app', url: 'https://jakdojade.pl/' },
  { kind: 'duolingo', label: 'Duolingo', description: 'Codzienna lekcja języka', category: 'app', url: 'https://www.duolingo.com/learn' },
  { kind: 'strava', label: 'Strava', description: 'Poranny bieg lub rower', category: 'app', appUrl: 'strava://', url: 'https://www.strava.com/dashboard' },
  { kind: 'youtube', label: 'YouTube', description: 'Ćwiczenia, joga, podcast wideo', category: 'app', url: 'https://www.youtube.com/' },
  { kind: 'linkedin', label: 'LinkedIn', description: 'Wiadomości zawodowe', category: 'app', url: 'https://www.linkedin.com/feed/' },
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
export const isSoon = (info: TileKindInfo) => info.category === 'module' && !info.route && !info.inline;
