/** Testy jednostkowe: src/routine/checklist.ts */
import { stateForDay, toggleItem, isChecked, weatherItems, ChecklistState } from '../../src/routine/checklist';
import { Forecast } from '../../src/weather/types';

const empty: ChecklistState = { date: '2026-11-11', checked: {} };

describe('stateForDay', () => {
  it('zwraca zapisany stan dla tego samego dnia', () => {
    const s = { date: '2026-11-11', checked: { t1: ['Klucze'] } };
    expect(stateForDay(s, '2026-11-11')).toBe(s);
  });

  it('nowy dzień = czysta lista (odhaczenia nie przechodzą)', () => {
    const s = { date: '2026-11-10', checked: { t1: ['Klucze'] } };
    expect(stateForDay(s, '2026-11-11')).toEqual({ date: '2026-11-11', checked: {} });
  });

  it('null → czysta lista', () => {
    expect(stateForDay(null, '2026-11-11')).toEqual(empty);
  });
});

describe('toggleItem / isChecked', () => {
  it('odhacza i odznacza element', () => {
    const s1 = toggleItem(empty, 't1', 'Klucze');
    expect(isChecked(s1, 't1', 'Klucze')).toBe(true);
    const s2 = toggleItem(s1, 't1', 'Klucze');
    expect(isChecked(s2, 't1', 'Klucze')).toBe(false);
  });

  it('porównanie ignoruje wielkość liter i spacje', () => {
    const s1 = toggleItem(empty, 't1', 'Klucze');
    expect(isChecked(s1, 't1', '  kLuCzE ')).toBe(true);
  });

  it('nie zmienia stanu innych kafelków', () => {
    const s1 = toggleItem(empty, 't1', 'Klucze');
    expect(isChecked(s1, 't2', 'Klucze')).toBe(false);
  });
});

/** Minimalna prognoza z zadanymi godzinami porannymi. */
const forecast = (hours: { temp: number; precipProb: number | null }[]): Forecast => ({
  timezone: 'Europe/Warsaw',
  current: { time: '2026-11-11T06:00', temp: 5, feels: 3, code: 3, wind: 10, isDay: true, precipitation: 0 },
  hourly: hours.map((h, i) => ({ time: `2026-11-11T0${5 + i}:00`, temp: h.temp, precipProb: h.precipProb, code: 3 })),
  daily: [{ date: '2026-11-11', min: 0, max: 10, sunrise: null, sunset: null, precipProbMax: null, code: 3 }],
});

describe('weatherItems', () => {
  it('deszcz ≥ 30% → podpowiada parasol', () => {
    const items = weatherItems(forecast([{ temp: 10, precipProb: 45 }]), ['Klucze']);
    expect(items.some(i => i.includes('Parasol'))).toBe(true);
    expect(items[0]).toContain('45%');
  });

  it('nie dubluje parasola, gdy już jest na liście', () => {
    const items = weatherItems(forecast([{ temp: 10, precipProb: 80 }]), ['Parasol']);
    expect(items.some(i => i.includes('Parasol'))).toBe(false);
  });

  it('mróz → czapka i rękawiczki', () => {
    const items = weatherItems(forecast([{ temp: -2, precipProb: 0 }]), []);
    expect(items).toContain('Czapka i rękawiczki');
  });

  it('brak prognozy → brak podpowiedzi', () => {
    expect(weatherItems(null, [])).toEqual([]);
  });

  it('ładna pogoda → brak podpowiedzi', () => {
    expect(weatherItems(forecast([{ temp: 15, precipProb: 5 }]), [])).toEqual([]);
  });
});
