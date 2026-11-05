import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FeedKey, TopicId, fetchFeed, mergeFeeds } from './api';
import { NewsItem } from './rss';

const KEY = 'news';
const STALE_MS = 30 * 60 * 1000;
export const MAX_KEYWORDS = 5;

export interface NewsSettings {
  /** Tematy w przeglądzie „Dla mnie”. */
  digestTopics: TopicId[];
  /** Własne hasła (wyszukiwanie z ostatnich 2 dni), też w przeglądzie. */
  keywords: string[];
}

interface Feed {
  items: NewsItem[];
  fetchedAt: number;
}

interface NewsContextValue {
  settings: NewsSettings;
  setSettings: (s: NewsSettings) => void;
  feeds: Partial<Record<FeedKey, Feed>>;
  loading: Partial<Record<FeedKey, boolean>>;
  errors: Partial<Record<FeedKey, string>>;
  refresh: (key: FeedKey, force?: boolean) => Promise<void>;
  /** Przegląd „Dla mnie”: wybrane tematy + hasła, bez duplikatów. */
  digest: NewsItem[];
  digestKeys: FeedKey[];
  refreshDigest: (force?: boolean) => Promise<void>;
}

const DEFAULT_SETTINGS: NewsSettings = { digestTopics: ['top', 'NATION', 'WORLD'], keywords: [] };

const NewsContext = createContext<NewsContextValue | null>(null);

export function useNews() {
  const ctx = useContext(NewsContext);
  if (!ctx) throw new Error('useNews musi być użyte wewnątrz <NewsProvider>');
  return ctx;
}

export const digestKeysOf = (s: NewsSettings): FeedKey[] => [
  ...s.digestTopics,
  ...s.keywords.map(k => `q:${k}` as FeedKey),
];

export function NewsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = useState<NewsSettings>(DEFAULT_SETTINGS);
  const [feeds, setFeeds] = useState<Partial<Record<FeedKey, Feed>>>({});
  const [loading, setLoading] = useState<Partial<Record<FeedKey, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<FeedKey, string>>>({});
  const [loaded, setLoaded] = useState(false);
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const inFlight = useRef(new Set<FeedKey>());

  const persist = (s: NewsSettings, f: Partial<Record<FeedKey, Feed>>) => {
    // W pamięci trzymamy tylko kanały, które są w przeglądzie (reszta pobierze się na żądanie).
    const keep = new Set(digestKeysOf(s));
    const cached = Object.fromEntries(Object.entries(f).filter(([k]) => keep.has(k as FeedKey)));
    AsyncStorage.setItem(KEY, JSON.stringify({ settings: s, feeds: cached })).catch(e =>
      console.warn('Nie udało się zapisać wiadomości', e)
    );
  };

  const refresh = useCallback(async (key: FeedKey, force = false) => {
    const current = feedsRef.current[key];
    if (!force && current && Date.now() - current.fetchedAt < STALE_MS) return;
    if (inFlight.current.has(key)) return;
    inFlight.current.add(key);
    setLoading(l => ({ ...l, [key]: true }));
    try {
      const items = await fetchFeed(key);
      setFeeds(prev => {
        const next = { ...prev, [key]: { items, fetchedAt: Date.now() } };
        persist(settingsRef.current, next);
        return next;
      });
      setErrors(e => ({ ...e, [key]: undefined }));
    } catch (e: any) {
      setErrors(er => ({ ...er, [key]: e?.message ?? 'Nie udało się pobrać wiadomości' }));
    } finally {
      inFlight.current.delete(key);
      setLoading(l => ({ ...l, [key]: false }));
    }
  }, []);

  const refreshDigest = useCallback(
    async (force = false) => {
      await Promise.all(digestKeysOf(settingsRef.current).map(k => refresh(k, force)));
    },
    [refresh]
  );

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed?.settings) {
          const s = { ...DEFAULT_SETTINGS, ...parsed.settings };
          settingsRef.current = s;
          setSettingsState(s);
        }
        if (parsed?.feeds) {
          feedsRef.current = parsed.feeds;
          setFeeds(parsed.feeds);
        }
      })
      .catch(e => console.warn('Nie udało się wczytać wiadomości', e))
      .finally(() => {
        setLoaded(true);
        refreshDigest();
      });
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') refreshDigest();
    });
    return () => sub.remove();
  }, [refreshDigest]);

  const setSettings = (s: NewsSettings) => {
    settingsRef.current = s;
    setSettingsState(s);
    persist(s, feedsRef.current);
    if (loaded) refreshDigest();
  };

  const digestKeys = digestKeysOf(settings);
  const digest = mergeFeeds(digestKeys.map(k => feeds[k]?.items ?? []));

  return (
    <NewsContext.Provider
      value={{ settings, setSettings, feeds, loading, errors, refresh, digest, digestKeys, refreshDigest }}
    >
      {children}
    </NewsContext.Provider>
  );
}
