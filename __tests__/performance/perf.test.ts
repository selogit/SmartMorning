/**
 * Testy wydajnościowe: mediana z 30 przebiegów po rozgrzewce.
 * Budżet: klatka 16 ms; dla funkcji wywoływanych przy renderze ×10 zapasu (1,6 ms).
 */
import { layoutGrid } from '../../src/routine/grid';
import { parseRss } from '../../src/news/rss';
import { parseLine, parseInline, toggleLinePrefix } from '../../src/notes/markdown';
import { scheduleTimes } from '../../src/routine/chain';
import { upcomingNights, DEFAULT_BEDTIME } from '../../src/sleep/bedtime';
import { adviceFor } from '../../src/weather/advice';
import { TileSize, RoutineTile } from '../../src/routine/types';
import { Alarm } from '../../src/alarm/types';
import { Forecast } from '../../src/weather/types';

/** Mediana czasu [ms] jednego wykonania `fn` (po rozgrzewce). */
function bench(fn: () => void, runs = 30): number {
  for (let i = 0; i < 5; i++) fn(); // rozgrzewka
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const results: [string, string, number, number][] = [];
const record = (name: string, data: string, ms: number, budget: number) => {
  results.push([name, data, ms, budget]);
  expect(ms).toBeLessThan(budget);
};

afterAll(() => {
  const rows = results
    .map(([n, d, ms, b]) => `| ${n} | ${d} | ${ms.toFixed(3)} ms | ${b} ms | ${ms < b ? 'OK' : 'PRZEKROCZONY'} |`)
    .join('\n');
  console.log(
    `\n=== WYNIKI BENCHMARKÓW ===\n| Funkcja | Dane | Mediana | Budżet | Status |\n|---|---|---|---|---|\n${rows}\n`
  );
});

describe('P1. layoutGrid — układanie planszy kafelków', () => {
  const sizes = (n: number): TileSize[] =>
    Array.from({ length: n }, (_, i) => (['small', 'medium', 'large'] as TileSize[])[i % 3]);

  it('typowy plan (12 kafelków) < 1.6 ms', () => {
    record('layoutGrid', '12 kafelków', bench(() => layoutGrid(sizes(12))), 1.6);
  });

  it('absurdalnie duży plan (200 kafelków) < 16 ms', () => {
    record('layoutGrid', '200 kafelków', bench(() => layoutGrid(sizes(200))), 16);
  });

  it('skalowanie bliskie liniowemu (200 vs 50 kafelków < 12×)', () => {
    const t50 = bench(() => layoutGrid(sizes(50)));
    const t200 = bench(() => layoutGrid(sizes(200)));
    results.push(['layoutGrid skala', '50→200 kaf.', t200 / Math.max(t50, 0.001), 12]);
    expect(t200 / Math.max(t50, 0.0001)).toBeLessThan(12); // 4× dane → < 12× czasu
  });
});

describe('P2. parseRss — parser kanału wiadomości', () => {
  const item = (i: number) =>
    `<item><title><![CDATA[Wiadomość numer ${i} o czymś ważnym - Źródło${i % 7}]]></title>` +
    `<link>https://example.com/${i}</link><guid>g${i}</guid>` +
    `<pubDate>Thu, 05 Nov 2026 ${String(i % 24).padStart(2, '0')}:13:00 GMT</pubDate></item>`;
  const feed = (n: number) => `<rss><channel>${Array.from({ length: n }, (_, i) => item(i)).join('')}</channel></rss>`;

  it('typowy feed Google News (100 pozycji) < 16 ms', () => {
    const xml = feed(100);
    record('parseRss', '100 pozycji', bench(() => parseRss(xml)), 16);
  });

  it('bardzo duży feed (2000 pozycji) < 160 ms', () => {
    const xml = feed(2000);
    record('parseRss', '2000 pozycji', bench(() => parseRss(xml), 10), 160);
  });
});

describe('P3. markdown — parsowanie notatki przy każdym renderze', () => {
  const longNote = Array.from(
    { length: 500 },
    (_, i) => (i % 5 === 0 ? `# Sekcja ${i}` : `- [ ] zadanie ${i} z **pogrubieniem** i *kursywą* w treści`)
  ).join('\n');

  it('parsowanie 500-liniowej notatki (parseLine + parseInline) < 16 ms', () => {
    record(
      'markdown parse',
      '500 linii',
      bench(() => longNote.split('\n').map(l => parseInline(parseLine(l).content))),
      16
    );
  });

  it('toggleLinePrefix na zaznaczeniu całej notatki < 16 ms', () => {
    const sel = { start: 0, end: longNote.length };
    record('toggleLinePrefix', '500 linii', bench(() => toggleLinePrefix(longNote, sel, 'bullet')), 16);
  });
});

describe('P4. logika planu i snu', () => {
  it('scheduleTimes dla 100 kroków < 1.6 ms', () => {
    const chain = Array.from({ length: 100 }, (_, i) => ({
      id: `t${i}`,
      kind: 'task',
      title: `Krok ${i}`,
      size: 'medium',
      time: i % 10 === 0 ? '06:30' : undefined,
      durationMin: 5,
    })) as unknown as RoutineTile[];
    record('scheduleTimes', '100 kroków', bench(() => scheduleTimes(chain)), 1.6);
  });

  it('upcomingNights dla 50 alarmów × 7 dni < 16 ms', () => {
    const alarms: Alarm[] = Array.from({ length: 50 }, (_, i) => ({
      id: `a${i}`,
      time: `${String(5 + (i % 5)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
      enabled: i % 3 !== 0,
      label: `Alarm ${i}`,
      days: i % 2 ? [1, 2, 3, 4, 5] : undefined,
    }));
    const now = new Date(2026, 10, 10, 20, 0);
    record('upcomingNights', '50 alarmów', bench(() => upcomingNights(alarms, DEFAULT_BEDTIME, now)), 16);
  });

  it('adviceFor na prognozie 72 h < 1.6 ms', () => {
    const f: Forecast = {
      timezone: 'Europe/Warsaw',
      current: { time: '2026-11-10T06:00', temp: 4, feels: 1, code: 61, wind: 20, isDay: true, precipitation: 0 },
      hourly: Array.from({ length: 72 }, (_, i) => ({
        time: `2026-11-${String(10 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00`,
        temp: 3 + (i % 10),
        precipProb: (i * 13) % 100,
        code: i % 7 === 0 ? 61 : 3,
      })),
      daily: [],
    };
    record('adviceFor', '72 h prognozy', bench(() => adviceFor(f)), 1.6);
  });
});
