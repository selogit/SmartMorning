/** Testy integracyjne: plany dnia + AsyncStorage, migracje formatów, uszkodzone dane. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPlans, savePlans, defaultRoutine, emptyRoutine, migrateTiles, planForDate, makeTile } from '../../src/routine/storage';

const storage = AsyncStorage as any;

beforeEach(() => storage.__reset());

describe('savePlans → loadPlans (pełny cykl zapis/odczyt)', () => {
  it('zapisane plany wracają w identycznym kształcie', async () => {
    const plans = [defaultRoutine('Dzień roboczy', [1, 2, 3, 4, 5]), emptyRoutine('Weekend', [0, 6])];
    await savePlans(plans);
    const loaded = await loadPlans();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('Dzień roboczy');
    expect(loaded[0].tiles.map(t => t.kind)).toEqual(['alarm', 'notes', 'gmail', 'weather']);
    expect(loaded[1].days).toEqual([0, 6]);
  });

  it('pusty magazyn → plan domyślny', async () => {
    const loaded = await loadPlans();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Plan dnia');
    expect(loaded[0].tiles[0].kind).toBe('alarm');
  });

  it('uszkodzony JSON nie wywala aplikacji — wraca plan domyślny', async () => {
    await storage.setItem('routines', '{to nie jest json');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loaded = await loadPlans();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Plan dnia');
    warn.mockRestore();
  });

  it('plan z brakującymi polami jest normalizowany', async () => {
    await storage.setItem('routines', JSON.stringify([{ tiles: [{ id: 'x', kind: 'notes', title: 'N' }] }]));
    const [plan] = await loadPlans();
    expect(plan.id).toMatch(/^plan-/);
    expect(plan.name).toBe('Plan dnia');
    expect(plan.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(plan.tiles[0].size).toBe('medium'); // brakujący rozmiar uzupełniony
    expect(plan.startAfterAlarm).toBe(true);
  });

  it('nieprawidłowe dni tygodnia są odfiltrowywane', async () => {
    await storage.setItem('routines', JSON.stringify([{ name: 'P', days: [1, 99, -3, 'wtorek', 5], tiles: [] }]));
    const [plan] = await loadPlans();
    expect(plan.days).toEqual([1, 5]);
  });
});

describe('migracja starego formatu (klucz „routine", kafelki x/y + strzałki)', () => {
  it('pojedynczy stary plan staje się planem na wszystkie dni', async () => {
    await storage.setItem('routine', JSON.stringify({ name: 'Stary', tiles: [{ id: 'a', kind: 'alarm', title: 'Budzik' }] }));
    const loaded = await loadPlans();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Stary');
    expect(loaded[0].days).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('klucz „routines" ma pierwszeństwo przed starym „routine"', async () => {
    await storage.setItem('routine', JSON.stringify({ name: 'Stary', tiles: [] }));
    await storage.setItem('routines', JSON.stringify([{ name: 'Nowy', tiles: [], days: [1] }]));
    const loaded = await loadPlans();
    expect(loaded[0].name).toBe('Nowy');
  });

  it('migrateTiles: łańcuch strzałek wyznacza kolejność, x/y znikają', () => {
    const tiles = [
      { id: 'b', kind: 'notes', title: 'B', size: 'medium', x: 10, y: 20 },
      { id: 'a', kind: 'alarm', title: 'A', size: 'large', x: 0, y: 0 },
      { id: 'c', kind: 'weather', title: 'C', size: 'medium', x: 30, y: 40 },
    ] as any[];
    const links = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ];
    const out = migrateTiles(tiles, links);
    expect(out.map(t => t.id)).toEqual(['a', 'b', 'c']);
    expect((out[0] as any).x).toBeUndefined();
    expect((out[0] as any).y).toBeUndefined();
  });

  it('migrateTiles: kafelki poza łańcuchem trafiają na koniec wg pozycji', () => {
    const tiles = [
      { id: 'luz', kind: 'notes', title: 'L', size: 'medium', x: 0, y: 99 },
      { id: 'a', kind: 'alarm', title: 'A', size: 'large', x: 0, y: 0 },
      { id: 'b', kind: 'gmail', title: 'B', size: 'medium', x: 0, y: 10 },
    ] as any[];
    const out = migrateTiles(tiles, [{ from: 'a', to: 'b' }]);
    expect(out.map(t => t.id)).toEqual(['a', 'b', 'luz']);
  });

  it('migrateTiles: cykl w strzałkach nie zapętla migracji', () => {
    const tiles = [
      { id: 'a', kind: 'alarm', title: 'A', size: 'large', x: 0, y: 0 },
      { id: 'b', kind: 'notes', title: 'B', size: 'medium', x: 0, y: 1 },
    ] as any[];
    const out = migrateTiles(tiles, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ]);
    expect(out).toHaveLength(2);
  });

  it('nowy format (bez x/y i strzałek) przechodzi bez zmian', () => {
    const tiles = [makeTile('alarm'), makeTile('notes')];
    expect(migrateTiles(tiles as any, []).map(t => t.id)).toEqual(tiles.map(t => t.id));
  });
});

describe('planForDate (wybór planu na dziś)', () => {
  it('wybiera plan pasujący do dnia tygodnia', () => {
    const work = emptyRoutine('Praca', [1, 2, 3, 4, 5]);
    const weekend = emptyRoutine('Weekend', [0, 6]);
    const saturday = new Date(2026, 10, 14);
    expect(planForDate([work, weekend], saturday)?.name).toBe('Weekend');
  });

  it('gdy żaden plan nie pasuje — pierwszy z listy', () => {
    const work = emptyRoutine('Praca', [1]);
    const sunday = new Date(2026, 10, 15);
    expect(planForDate([work], sunday)?.name).toBe('Praca');
  });
});
