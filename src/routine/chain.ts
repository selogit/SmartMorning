import { Routine, RoutineLink, RoutineTile } from './types';

/**
 * Kolejność wykonania: łańcuch od kafelka bez wejścia (preferowany Budzik, potem najwyżej położony).
 * Każdy kafelek ma co najwyżej jedno wyjście i jedno wejście, więc to zawsze prosta ścieżka.
 */
export function orderedChain(r: Routine): RoutineTile[] {
  if (r.tiles.length === 0) return [];
  const byId = new Map(r.tiles.map(t => [t.id, t]));
  const next = new Map(r.links.map(l => [l.from, l.to]));
  const incoming = new Set(r.links.map(l => l.to));

  const heads = r.tiles
    .filter(t => !incoming.has(t.id) && next.has(t.id))
    .sort((a, b) => Number(b.kind === 'alarm') - Number(a.kind === 'alarm') || a.y - b.y || a.x - b.x);

  let start = heads[0];
  if (!start) {
    if (r.links.length > 0) return []; // same pętle — nie powinno się zdarzyć
    start = [...r.tiles].sort(
      (a, b) => Number(b.kind === 'alarm') - Number(a.kind === 'alarm') || a.y - b.y || a.x - b.x
    )[0];
  }

  const out: RoutineTile[] = [];
  const seen = new Set<string>();
  let cur: RoutineTile | undefined = start;
  while (cur && !seen.has(cur.id)) {
    out.push(cur);
    seen.add(cur.id);
    const nid = next.get(cur.id);
    cur = nid ? byId.get(nid) : undefined;
  }
  return out;
}

const reaches = (links: RoutineLink[], from: string, target: string) => {
  const next = new Map(links.map(l => [l.from, l.to]));
  const seen = new Set<string>();
  let cur: string | undefined = from;
  while (cur && !seen.has(cur)) {
    if (cur === target) return true;
    seen.add(cur);
    cur = next.get(cur);
  }
  return false;
};

/** Łączy from → to. Zastępuje dotychczasowe wyjście `from` i wejście `to`. Odrzuca pętle. */
export function connectTiles(r: Routine, from: string, to: string): { routine: Routine } | { error: string } {
  if (from === to) return { error: 'Kafelek nie może prowadzić do samego siebie.' };
  const links = r.links.filter(l => l.from !== from && l.to !== to);
  if (reaches(links, to, from)) {
    return { error: 'To połączenie utworzyłoby pętlę — plan musi mieć początek i koniec.' };
  }
  return { routine: { ...r, links: [...links, { from, to }] } };
}

export const disconnectTile = (r: Routine, id: string): Routine => ({
  ...r,
  links: r.links.filter(l => l.from !== id && l.to !== id),
});

/** Usuwa kafelek; jeśli był w środku łańcucha, sąsiedzi zostają połączeni ze sobą. */
export function removeTile(r: Routine, id: string): Routine {
  const prev = r.links.find(l => l.to === id)?.from;
  const nxt = r.links.find(l => l.from === id)?.to;
  const links = r.links.filter(l => l.from !== id && l.to !== id);
  if (prev && nxt) links.push({ from: prev, to: nxt });
  return { ...r, tiles: r.tiles.filter(t => t.id !== id), links };
}

/** Wylicza godziny kroków: jawna godzina albo poprzednia + czas trwania. */
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
