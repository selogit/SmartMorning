import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Forecast, WeatherPlace } from './types';
import { fetchForecast } from './api';

const KEY = 'weather';
/** Starsze dane odświeżamy przy otwarciu aplikacji. */
const STALE_MS = 30 * 60 * 1000;

interface Stored {
  place: WeatherPlace | null;
  apiKey?: string;
  forecast: Forecast | null;
  fetchedAt: number | null;
}

interface WeatherContextValue extends Stored {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  refresh: (force?: boolean) => Promise<void>;
  setPlace: (place: WeatherPlace) => void;
  setApiKey: (key: string) => void;
}

const WeatherContext = createContext<WeatherContextValue | null>(null);

export function useWeather() {
  const ctx = useContext(WeatherContext);
  if (!ctx) throw new Error('useWeather musi być użyte wewnątrz <WeatherProvider>');
  return ctx;
}

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Stored>({ place: null, forecast: null, fetchedAt: null });
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const inFlight = useRef(false);

  const persist = (next: Stored) => {
    dataRef.current = next;
    setData(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(e => console.warn('Nie udało się zapisać pogody', e));
  };

  const refresh = useCallback(async (force = false) => {
    const { place, apiKey, fetchedAt } = dataRef.current;
    if (!place || inFlight.current) return;
    if (!force && fetchedAt && Date.now() - fetchedAt < STALE_MS) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const forecast = await fetchForecast(place, apiKey);
      // Miasto mogło zmienić się w trakcie pobierania — zapisujemy tylko aktualne.
      if (dataRef.current.place === place) {
        persist({ ...dataRef.current, forecast, fetchedAt: Date.now() });
        setError(null);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Nie udało się pobrać pogody');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
    // Zmiana miasta w trakcie pobierania — pobierz dla nowego.
    if (dataRef.current.place && dataRef.current.place !== place && !dataRef.current.forecast) {
      refreshRef.current(true);
    }
  }, []);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (raw) {
          const parsed = JSON.parse(raw) as Stored;
          dataRef.current = parsed;
          setData(parsed);
        }
      })
      .catch(e => console.warn('Nie udało się wczytać pogody', e))
      .finally(() => {
        setLoaded(true);
        refresh();
      });

    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const setPlace = (place: WeatherPlace) => {
    persist({ ...dataRef.current, place, forecast: null, fetchedAt: null });
    setError(null);
    refresh(true);
  };

  const setApiKey = (key: string) => {
    persist({ ...dataRef.current, apiKey: key.trim() || undefined });
    refresh(true);
  };

  return (
    <WeatherContext.Provider value={{ ...data, loaded, loading, error, refresh, setPlace, setApiKey }}>
      {children}
    </WeatherContext.Provider>
  );
}
