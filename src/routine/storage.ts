import AsyncStorage from '@react-native-async-storage/async-storage';
import { Routine, RoutineTile } from './types';
import { kindInfo, TileKind } from './tileKinds';

const KEY = 'routine';

export const newTileId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const makeTile = (kind: TileKind, x: number, y: number, extra: Partial<RoutineTile> = {}): RoutineTile => ({
  id: newTileId(),
  kind,
  title: kindInfo(kind).label,
  x,
  y,
  ...extra,
});

/** Przykładowy plan jak na szkicu: Budzik → Notatnik → Gmail → Pogoda. */
export function defaultRoutine(): Routine {
  const alarm = makeTile('alarm', 0.04, 0.04, { time: '06:30', durationMin: 5 });
  const notes = makeTile('notes', 0.96, 0.04, { durationMin: 10 });
  const gmail = makeTile('gmail', 0.96, 0.42, { durationMin: 10 });
  const weather = makeTile('weather', 0.04, 0.42, { durationMin: 5 });
  return {
    tiles: [alarm, notes, gmail, weather],
    links: [
      { from: alarm.id, to: notes.id },
      { from: notes.id, to: gmail.id },
      { from: gmail.id, to: weather.id },
    ],
    startAfterAlarm: true,
  };
}

export async function loadRoutine(): Promise<Routine> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const r = JSON.parse(raw) as Partial<Routine>;
      return {
        tiles: Array.isArray(r.tiles) ? r.tiles : [],
        links: Array.isArray(r.links) ? r.links : [],
        startAfterAlarm: r.startAfterAlarm ?? true,
      };
    }
  } catch (e) {
    console.warn('Nie udało się wczytać planu', e);
  }
  return defaultRoutine();
}

export const saveRoutine = (r: Routine) => AsyncStorage.setItem(KEY, JSON.stringify(r));
