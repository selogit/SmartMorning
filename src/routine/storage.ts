import AsyncStorage from '@react-native-async-storage/async-storage';
import { Routine, RoutineTile, TileSize } from './types';
import { kindInfo, TileKind } from './tileKinds';

export const newTileId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const makeTile = (kind: TileKind, extra: Partial<RoutineTile> = {}): RoutineTile => ({
  id: newTileId(),
  kind,
  title: kindInfo(kind).label,
  size: 'medium',
  ...extra,
});

export const newPlanId = () => `plan-${newTileId()}`;

/** Przykładowy plan: Budzik → Notatnik → Gmail → Pogoda. */
export function defaultRoutine(name = 'Plan dnia', days: number[] = [0, 1, 2, 3, 4, 5, 6]): Routine {
  return {
    id: newPlanId(),
    name,
    days,
    tiles: [
      makeTile('alarm', { time: '06:30', durationMin: 5, size: 'large' }),
      makeTile('notes', { durationMin: 10 }),
      makeTile('gmail', { durationMin: 10 }),
      makeTile('weather', { durationMin: 5, size: 'large' }),
    ],
    startAfterAlarm: true,
  };
}

/** Pusty plan z samym budzikiem — punkt startowy dla nowego planu. */
export function emptyRoutine(name: string, days: number[] = []): Routine {
  return { id: newPlanId(), name, days, tiles: [makeTile('alarm', { time: '08:00', size: 'large' })], startAfterAlarm: true };
}

type LegacyTile = RoutineTile & { x?: number; y?: number };
type LegacyLink = { from: string; to: string };
const SIZES: TileSize[] = ['small', 'medium', 'large'];

/**
 * Stara plansza (kafelki w dowolnym miejscu + strzałki) → kafelki w kolejności.
 * Najpierw połączony łańcuch, potem pozostałe kafelki od góry do dołu.
 */
export function migrateTiles(tiles: LegacyTile[], links: LegacyLink[]): RoutineTile[] {
  const isLegacy = links.length > 0 || tiles.some(t => t.x !== undefined || t.y !== undefined);
  const strip = ({ x: _x, y: _y, ...t }: LegacyTile): RoutineTile => ({
    ...t,
    size: t.size && SIZES.includes(t.size) ? t.size : 'medium',
  });
  if (!isLegacy) return tiles.map(strip);

  const pos = (t: LegacyTile) => [Number(t.kind === 'alarm'), t.y ?? 0, t.x ?? 0] as const;
  const byPos = (a: LegacyTile, b: LegacyTile) => pos(b)[0] - pos(a)[0] || pos(a)[1] - pos(b)[1] || pos(a)[2] - pos(b)[2];
  const byId = new Map(tiles.map(t => [t.id, t]));
  const next = new Map(links.map(l => [l.from, l.to]));
  const incoming = new Set(links.map(l => l.to));
  const head = tiles.filter(t => !incoming.has(t.id) && next.has(t.id)).sort(byPos)[0];

  const out: LegacyTile[] = [];
  const seen = new Set<string>();
  let cur: LegacyTile | undefined = head;
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    const nid = next.get(cur.id);
    cur = nid ? byId.get(nid) : undefined;
  }
  out.push(...tiles.filter(t => !seen.has(t.id)).sort(byPos));
  return out.map(strip);
}

const normalizePlan = (r: Partial<Routine> & { links?: LegacyLink[] }, i: number): Routine => ({
  id: typeof r.id === 'string' ? r.id : newPlanId(),
  name: typeof r.name === 'string' && r.name.trim() ? r.name : i === 0 ? 'Plan dnia' : `Plan ${i + 1}`,
  days: Array.isArray(r.days) ? r.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6) : [0, 1, 2, 3, 4, 5, 6],
  tiles: migrateTiles(Array.isArray(r.tiles) ? r.tiles : [], Array.isArray(r.links) ? r.links : []),
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
