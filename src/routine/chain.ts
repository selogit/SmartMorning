import { Routine, RoutineTile } from './types';

/** Kolejność wykonania = kolejność kafelków w planie (numery na planszy). */
export const orderedChain = (r: Routine): RoutineTile[] => r.tiles;

/** Przenosi kafelek z pozycji `from` na pozycję `to`. */
export function moveTile<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

export const removeTile = (r: Routine, id: string): Routine => ({ ...r, tiles: r.tiles.filter(t => t.id !== id) });

/** Wylicza godziny kroków: jawna godzina albo poprzednia + minutnik. */
export function scheduleTimes(chain: RoutineTile[]): (string | null)[] {
  let cursor: number | null = null; // minuty od północy
  return chain.map(t => {
    if (t.time) {
      const [h, m] = t.time.split(':').map(Number);
      cursor = h * 60 + m;
    }
    const at = cursor;
    if (cursor !== null && t.durationMin) cursor += t.durationMin;
    if (at === null) return null;
    const mins = ((at % 1440) + 1440) % 1440;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  });
}
