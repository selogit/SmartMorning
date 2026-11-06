import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlannedTrain, PlkDisruption, TrainLive, disruptionsAt, liveAtStation, trainsBetween } from './plk';
import { ZtmDeparture, ZtmStop, ZtmVehicle, departures, fetchStops, vehicles } from './ztm';
import { pickTrain, trainStatus, ztmStatus } from './status';
import { TransitSettings, Trip, TripStatus } from './types';

const KEY = 'transit';
const CACHE_KEY = 'transit-cache';
const STOPS_KEY = 'transit-stops';
/** Limit PLK (pakiet Basic) to 100 zapytań/h — opóźnienia odświeżamy najwyżej co 2 min, utrudnienia co 10 min. */
const LIVE_MIN_MS = 2 * 60 * 1000;
const ALERTS_MIN_MS = 10 * 60 * 1000;
const STOPS_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Rozkłady na dziś (PLK i ZTM) trzymamy w pamięci telefonu — pobierane raz na dzień. */
interface DayCache {
  date: string;
  trains: Record<string, PlannedTrain[]>;
  ztm: Record<string, ZtmDeparture[]>;
}

interface TransitContextValue {
  settings: TransitSettings;
  setKeys: (keys: { plkKey?: string; ztmKey?: string }) => void;
  addTrip: (trip: Trip) => void;
  removeTrip: (id: string) => void;
  statuses: Record<string, TripStatus>;
  refreshing: boolean;
  lastRefresh: number | null;
  refresh: (force?: boolean) => Promise<void>;
  /** Lista przystanków ZTM (z pamięci albo pobrana). */
  loadStops: () => Promise<ZtmStop[]>;
}

const TransitContext = createContext<TransitContextValue | null>(null);

export function useTransit() {
  const ctx = useContext(TransitContext);
  if (!ctx) throw new Error('useTransit musi być użyte wewnątrz <TransitProvider>');
  return ctx;
}

export const newTripId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function TransitProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<TransitSettings>({ trips: [] });
  const [statuses, setStatuses] = useState<Record<string, TripStatus>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const cache = useRef<DayCache>({ date: today(), trains: {}, ztm: {} });
  const live = useRef<{ at: number; byStation: Record<number, Map<string, TrainLive>> }>({ at: 0, byStation: {} });
  const alerts = useRef<{ at: number; key: string; list: PlkDisruption[] }>({ at: 0, key: '', list: [] });
  const stopsMemo = useRef<ZtmStop[] | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(KEY), AsyncStorage.getItem(CACHE_KEY)])
      .then(([s, c]) => {
        if (s) setSettings({ trips: [], ...JSON.parse(s) });
        if (c) {
          const parsed: DayCache = JSON.parse(c);
          if (parsed.date === today()) cache.current = parsed;
        }
      })
      .catch(e => console.warn('Nie udało się wczytać ustawień dojazdu', e));
  }, []);

  const persist = (next: TransitSettings) => {
    settingsRef.current = next;
    setSettings(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(e => console.warn('Nie udało się zapisać dojazdu', e));
  };

  const saveCache = () => AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache.current)).catch(() => {});

  const refresh = useCallback(async (force = false) => {
    if (busy.current) return;
    const { trips, plkKey, ztmKey } = settingsRef.current;
    if (trips.length === 0) return;
    busy.current = true;
    setRefreshing(true);
    const now = new Date();
    if (cache.current.date !== today(now)) cache.current = { date: today(now), trains: {}, ztm: {} };
    const result: Record<string, TripStatus> = {};
    const fail = (trip: Trip, error: string) => {
      result[trip.id] = { tripId: trip.id, headline: '—', tone: 'unknown', detail: error, error, checkedAt: now.getTime() };
    };

    // --- Pociągi (PLK)
    const trainTrips = trips.filter(t => t.kind === 'train');
    if (trainTrips.length && !plkKey) trainTrips.forEach(t => fail(t, 'Dodaj klucz PLK w ustawieniach dojazdu'));
    else if (trainTrips.length && plkKey) {
      const liveFresh = !force && now.getTime() - live.current.at < LIVE_MIN_MS;
      if (!liveFresh) live.current = { at: now.getTime(), byStation: {} };
      const stationIds = [...new Set(trainTrips.flatMap(t => (t.kind === 'train' ? [t.fromId, t.toId] : [])))];
      const alertKey = stationIds.sort().join(',');
      if (force || alertKey !== alerts.current.key || now.getTime() - alerts.current.at > ALERTS_MIN_MS) {
        try {
          alerts.current = { at: now.getTime(), key: alertKey, list: await disruptionsAt(stationIds, plkKey) };
        } catch (e) {
          console.warn('Utrudnienia PLK niedostępne', e);
        }
      }
      for (const trip of trainTrips) {
        if (trip.kind !== 'train') continue;
        try {
          const ck = `${trip.fromId}-${trip.toId}`;
          if (!cache.current.trains[ck]) {
            cache.current.trains[ck] = await trainsBetween(trip.fromId, trip.toId, cache.current.date, plkKey);
            saveCache();
          }
          if (!live.current.byStation[trip.fromId]) {
            live.current.byStation[trip.fromId] = await liveAtStation(trip.fromId, plkKey);
          }
          const train = pickTrain(cache.current.trains[ck], trip.time);
          const l = train
            ? live.current.byStation[trip.fromId].get(train.key) ?? (train.altKey ? live.current.byStation[trip.fromId].get(train.altKey) : undefined)
            : undefined;
          result[trip.id] = trainStatus(trip, train, l, alerts.current.list, now);
        } catch (e: any) {
          fail(trip, e?.message ?? 'Nie udało się sprawdzić pociągu');
        }
      }
    }

    // --- Autobusy i tramwaje (ZTM)
    const ztmTrips = trips.filter(t => t.kind === 'ztm');
    if (ztmTrips.length && !ztmKey) ztmTrips.forEach(t => fail(t, 'Dodaj klucz ZTM (dane.um.warszawa.pl) w ustawieniach dojazdu'));
    else if (ztmTrips.length && ztmKey) {
      const byLine: Record<string, ZtmVehicle[] | null> = {};
      for (const trip of ztmTrips) {
        if (trip.kind !== 'ztm') continue;
        try {
          const ck = `${trip.stopId}-${trip.stopNr}-${trip.line}`;
          if (!cache.current.ztm[ck]) {
            cache.current.ztm[ck] = await departures(trip.stopId, trip.stopNr, trip.line, ztmKey);
            saveCache();
          }
          if (!(trip.line in byLine)) {
            try {
              byLine[trip.line] = await vehicles(trip.line, ztmKey);
            } catch {
              byLine[trip.line] = null; // bez GPS pokazujemy sam rozkład
            }
          }
          result[trip.id] = ztmStatus(trip, cache.current.ztm[ck], byLine[trip.line], now);
        } catch (e: any) {
          fail(trip, e?.message ?? 'Nie udało się sprawdzić odjazdów');
        }
      }
    }

    setStatuses(prev => ({ ...prev, ...result }));
    setLastRefresh(now.getTime());
    setRefreshing(false);
    busy.current = false;
  }, []);

  const loadStops = useCallback(async () => {
    if (stopsMemo.current) return stopsMemo.current;
    try {
      const raw = await AsyncStorage.getItem(STOPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number; stops: [string, string, string, number?, number?, string?][] };
        if (Date.now() - parsed.at < STOPS_MAX_AGE_MS && parsed.stops.length) {
          stopsMemo.current = parsed.stops.map(([id, nr, name, lat, lon, dir]) => ({ id, nr, name, lat, lon, dir }));
          return stopsMemo.current;
        }
      }
    } catch {
      // brak pamięci podręcznej — pobierzemy
    }
    const key = settingsRef.current.ztmKey;
    if (!key) throw new Error('Najpierw dodaj klucz ZTM');
    const stops = await fetchStops(key);
    stopsMemo.current = stops;
    // Zwięzły zapis (tablice zamiast obiektów) — kilka tysięcy słupków mieści się w limicie AsyncStorage.
    AsyncStorage.setItem(
      STOPS_KEY,
      JSON.stringify({ at: Date.now(), stops: stops.map(s => [s.id, s.nr, s.name, s.lat, s.lon, s.dir]) })
    ).catch(() => {});
    return stops;
  }, []);

  const value: TransitContextValue = {
    settings,
    setKeys: keys => {
      persist({ ...settingsRef.current, ...keys });
      live.current = { at: 0, byStation: {} };
    },
    addTrip: trip => persist({ ...settingsRef.current, trips: [...settingsRef.current.trips, trip] }),
    removeTrip: id => {
      persist({ ...settingsRef.current, trips: settingsRef.current.trips.filter(t => t.id !== id) });
      setStatuses(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    statuses,
    refreshing,
    lastRefresh,
    refresh,
    loadStops,
  };

  return <TransitContext.Provider value={value}>{children}</TransitContext.Provider>;
}

