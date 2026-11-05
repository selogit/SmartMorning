import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceId, detectService } from './services';

export interface MusicItem {
  id: string;
  name: string;
  url: string;
  service: ServiceId;
}

interface Stored {
  /** Serwis, z którego zwykle korzystasz. */
  service: ServiceId;
  items: MusicItem[];
  /** Playlista domyślna na poranek (★). */
  defaultId?: string;
}

interface MusicContextValue extends Stored {
  setService: (s: ServiceId) => void;
  addItem: (name: string, url: string) => MusicItem;
  removeItem: (id: string) => void;
  setDefault: (id: string) => void;
}

const KEY = 'music';
const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusic() {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic musi być użyte wewnątrz <MusicProvider>');
  return ctx;
}

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Stored>({ service: 'spotify', items: [] });

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (raw) setData(d => ({ ...d, ...JSON.parse(raw) }));
      })
      .catch(e => console.warn('Nie udało się wczytać muzyki', e));
  }, []);

  const update = (fn: (d: Stored) => Stored) =>
    setData(prev => {
      const next = fn(prev);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(e => console.warn('Nie udało się zapisać muzyki', e));
      return next;
    });

  const addItem = (name: string, url: string) => {
    const item: MusicItem = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      url: url.trim(),
      service: detectService(url),
    };
    // Pierwsza dodana playlista od razu staje się domyślną na poranek.
    update(d => ({ ...d, items: [...d.items, item], defaultId: d.defaultId ?? item.id }));
    return item;
  };

  const removeItem = (id: string) =>
    update(d => {
      const items = d.items.filter(i => i.id !== id);
      return { ...d, items, defaultId: d.defaultId === id ? items[0]?.id : d.defaultId };
    });

  return (
    <MusicContext.Provider
      value={{
        ...data,
        setService: service => update(d => ({ ...d, service })),
        addItem,
        removeItem,
        setDefault: id => update(d => ({ ...d, defaultId: id })),
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}
