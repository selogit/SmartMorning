import { NewsItem, parseRss } from './rss';

/** Tematy Google News; 'top' = najważniejsze wiadomości. */
export type TopicId =
  | 'top'
  | 'NATION'
  | 'WORLD'
  | 'BUSINESS'
  | 'TECHNOLOGY'
  | 'SCIENCE'
  | 'SPORTS'
  | 'HEALTH'
  | 'ENTERTAINMENT';

export const TOPICS: { id: TopicId; label: string }[] = [
  { id: 'top', label: 'Najważniejsze' },
  { id: 'NATION', label: 'Polska' },
  { id: 'WORLD', label: 'Świat' },
  { id: 'BUSINESS', label: 'Biznes' },
  { id: 'TECHNOLOGY', label: 'Technologia' },
  { id: 'SCIENCE', label: 'Nauka' },
  { id: 'SPORTS', label: 'Sport' },
  { id: 'HEALTH', label: 'Zdrowie' },
  { id: 'ENTERTAINMENT', label: 'Rozrywka' },
];

export const topicLabel = (id: TopicId) => TOPICS.find(t => t.id === id)?.label ?? id;

const BASE = 'https://news.google.com/rss';
const LOCALE = 'hl=pl&gl=PL&ceid=PL:pl';
const TIMEOUT_MS = 12000;

/** Klucz kanału: temat albo „q:<hasło>”. */
export type FeedKey = TopicId | `q:${string}`;

export function feedUrl(key: FeedKey) {
  if (key === 'top') return `${BASE}?${LOCALE}`;
  if (key.startsWith('q:')) {
    // Tylko wiadomości z ostatnich 2 dni.
    return `${BASE}/search?q=${encodeURIComponent(`${key.slice(2)} when:2d`)}&${LOCALE}`;
  }
  return `${BASE}/headlines/section/topic/${key}?${LOCALE}`;
}

export async function fetchFeed(key: FeedKey): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(feedUrl(key), { signal: controller.signal });
    if (!res.ok) throw new Error(`Serwer wiadomości odpowiedział błędem (HTTP ${res.status})`);
    const items = parseRss(await res.text());
    return items.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Serwer wiadomości nie odpowiada');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Łączy kilka kanałów w jeden przegląd: bez duplikatów (ten sam tytuł), od najnowszych. */
export function mergeFeeds(feeds: NewsItem[][], limit = 30): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9ąćęłńóśźżäöüéè]+/g, ' ').trim();
  // Przeplatamy kanały, żeby jeden temat nie zdominował przeglądu.
  const max = Math.max(0, ...feeds.map(f => f.length));
  for (let i = 0; i < max; i++) {
    for (const f of feeds) {
      const item = f[i];
      if (!item) continue;
      const k = norm(item.title);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
  }
  return out.slice(0, limit);
}
