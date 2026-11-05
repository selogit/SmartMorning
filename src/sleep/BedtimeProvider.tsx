import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { useAlarms } from '../alarm/AlarmProvider';
import { BedtimeSettings, DEFAULT_BEDTIME, hm, nightId, sleepLabel, upcomingNights } from './bedtime';

const KEY = 'bedtime';
const CHANNEL = 'bedtime';
const PREFIX = 'bedtime-';

interface BedtimeContextValue {
  settings: BedtimeSettings;
  setSettings: (s: BedtimeSettings) => void;
}

const BedtimeContext = createContext<BedtimeContextValue | null>(null);

export function useBedtime() {
  const ctx = useContext(BedtimeContext);
  if (!ctx) throw new Error('useBedtime musi być użyte wewnątrz <BedtimeProvider>');
  return ctx;
}

/**
 * Przypomnienia o pójściu spać: liczone od pierwszego alarmu każdego dnia,
 * planowane od razu na 7 najbliższych nocy (działają bez otwierania aplikacji).
 */
export function BedtimeProvider({ children }: { children: React.ReactNode }) {
  const { alarms, loaded: alarmsLoaded } = useAlarms();
  const [settings, setSettingsState] = useState<BedtimeSettings>(DEFAULT_BEDTIME);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  const lastPlan = useRef('');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => {
        if (raw) setSettingsState({ ...DEFAULT_BEDTIME, ...JSON.parse(raw) });
      })
      .catch(e => console.warn('Nie udało się wczytać ustawień snu', e))
      .finally(() => setLoaded(true));
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') setTick(t => t + 1);
    });
    return () => sub.remove();
  }, []);

  const setSettings = (s: BedtimeSettings) => {
    setSettingsState(s);
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(e => console.warn('Nie udało się zapisać ustawień snu', e));
  };

  useEffect(() => {
    if (!loaded || !alarmsLoaded) return;
    const nights = settings.enabled ? upcomingNights(alarms, settings) : [];
    // Nie planuj ponownie, jeśli nic się nie zmieniło.
    const signature = nights.map(n => `${nightId(n)}@${n.remindAt.getTime()}`).join('|');
    if (signature === lastPlan.current) return;

    (async () => {
      try {
        const existing = (await notifee.getTriggerNotificationIds()).filter(id => id.startsWith(PREFIX));
        const wanted = new Set(nights.map(nightId));
        await Promise.all(existing.filter(id => !wanted.has(id)).map(id => notifee.cancelTriggerNotification(id)));
        if (nights.length === 0) {
          lastPlan.current = signature;
          return;
        }
        const channelId = await notifee.createChannel({
          id: CHANNEL,
          name: 'Pora snu',
          importance: AndroidImportance.DEFAULT,
        });
        for (const n of nights) {
          await notifee.createTriggerNotification(
            {
              id: nightId(n),
              title: `Pora szykować się do snu — połóż się o ${hm(n.bedtime)}`,
              body: `Pobudka o ${hm(n.wake)} (${n.alarm.label}). Tak prześpisz ${sleepLabel(settings.sleepMinutes)}.`,
              data: { type: 'bedtime' },
              android: { channelId, pressAction: { id: 'default' } },
            },
            { type: TriggerType.TIMESTAMP, timestamp: n.remindAt.getTime(), alarmManager: { allowWhileIdle: true } }
          );
        }
        lastPlan.current = signature;
      } catch (e) {
        console.warn('Nie udało się zaplanować przypomnień o śnie', e);
      }
    })();
  }, [alarms, settings, loaded, alarmsLoaded, tick]);

  return <BedtimeContext.Provider value={{ settings, setSettings }}>{children}</BedtimeContext.Provider>;
}
