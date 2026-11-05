import AsyncStorage from '@react-native-async-storage/async-storage';
import { Routine, RoutineTile } from './types';
import { kindInfo, TileKind } from './tileKinds';

export const newTileId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const makeTile = (kind: TileKind, x: number, y: number, extra: Partial<RoutineTile> = {}): RoutineTile => ({
  id: newTileId(),
  kind,
  title: kindInfo(kind).label,
  x,
  y,
  ...extra,
});

export const newPlanId = () => `plan-${newTileId()}`;

/** Przykładowy plan jak na szkicu: Budzik → Notatnik → Gmail → Pogoda. */
export function defaultRoutine(name = 'Plan dnia', days: number[] = [0, 1, 2, 3, 4, 5, 6]): Routine {
  const alarm = makeTile('alarm', 0.04, 0.04, { time: '06:30', durationMin: 5 });
  const notes = makeTile('notes', 0.96, 0.04, { durationMin: 10 });
  const gmail = makeTile('gmail', 0.96, 0.42, { durationMin: 10 });
  const weather = makeTile('weather', 0.04, 0.42, { durationMin: 5 });
  return {
    id: newPlanId(),
    name,
    days,
    tiles: [alarm, notes, gmail, weather],
    links: [
      { from: alarm.id, to: notes.id },
      { from: notes.id, to: gmail.id },
      { from: gmail.id, to: weather.id },
    ],
    startAfterAlarm: true,
  };
}

/** Pusty plan z samym budzikiem — punkt startowy dla nowego planu. */
export function emptyRoutine(name: string, days: number[] = []): Routine {
  return {
    id: newPlanId(),
    name,
    days,
    tiles: [makeTile('alarm', 0.04, 0.04, { time: '08:00' })],
    links: [],
    startAfterAlarm: true,
  };
}

const normalizePlan = (r: Partial<Routine>, i: number): Routine => ({
  id: typeof r.id === 'string' ? r.id : newPlanId(),
  name: typeof r.name === 'string' && r.name.trim() ? r.name : i === 0 ? 'Plan dnia' : `Plan ${i + 1}`,
  days: Array.isArray(r.days) ? r.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],
  tiles: Array.isArray(r.tiles) ? r.tiles : [],
  links: Array.isArray(r.links) ? r.links : [],
  startAfterAlarm: r.startAfterAlarm ?? true,
});

const PLANS_KEY = 'routines';
const LEGACY_KEY = 'routine';

/** Wczytuje plany; stary pojedynczy plan (klucz „routine”) staje się planem na wszystkie dni. */
export async function loadPlans(): Promise<Routine[]> {
  try {
    const raw = await AsyncStorage.getItem(PLANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(normalizePlan);
    }
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) return [normalizePlan(JSON.parse(legacy), 0)];
  } catch (e) {
    console.warn('Nie udało się wczytać planów', e);
  }
  return [defaultRoutine()];
}

export const savePlans = (plans: Routine[]) => AsyncStorage.setItem(PLANS_KEY, JSON.stringify(plans));

/** Plan obowiązujący w danym dniu: pierwszy z tym dniem tygodnia, a gdy żaden — pierwszy plan. */
export const planForDate = (plans: Routine[], date: Date = new Date()): Routine | undefined =>
  plans.find(p => p.days.includes(date.getDay())) ?? plans[0];
