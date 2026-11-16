/**
 * Testy jednostkowe: src/weather/advice.ts
 * Okno poranka i podpowiedzi pogodowe.
 */
import { morningWindow, adviceFor, weatherLine } from '../../src/weather/advice';
import { Forecast, HourPoint } from '../../src/weather/types';

const hour = (time: string, temp: number, precipProb: number | null = 0, code = 3): HourPoint => ({
  time,
  temp,
  precipProb,
  code,
});

const base = (currentTime: string, hourly: HourPoint[], extra: Partial<Forecast['current']> = {}): Forecast => ({
  timezone: 'Europe/Warsaw',
  current: { time: currentTime, temp: 5, feels: 3, code: 3, wind: 10, isDay: true, precipitation: 0, ...extra },
  hourly,
  daily: [
    { date: '2026-11-11', min: 0, max: 10, sunrise: null, sunset: null, precipProbMax: null, code: 3 },
    { date: '2026-11-12', min: 0, max: 10, sunrise: null, sunset: null, precipProbMax: null, code: 3 },
  ],
});

const morningHours = (date: string, temp = 5, rain = 0) =>
  [5, 6, 7, 8, 9, 10, 11].map(h => hour(`${date}T${String(h).padStart(2, '0')}:00`, temp, rain));

describe('morningWindow', () => {
  it('rano pokazuje dzisiejszy poranek (5–11)', () => {
    const f = base('2026-11-11T06:00', [...morningHours('2026-11-11'), hour('2026-11-11T15:00', 9)]);
    const w = morningWindow(f);
    expect(w.label).toBe('Dziś rano');
    expect(w.date).toBe('2026-11-11');
    expect(w.hours).toHaveLength(7);
  });

  it('po 11:00 przełącza się na jutrzejszy poranek', () => {
    const f = base('2026-11-11T18:00', [...morningHours('2026-11-11'), ...morningHours('2026-11-12')]);
    const w = morningWindow(f);
    expect(w.label).toBe('Jutro rano');
    expect(w.date).toBe('2026-11-12');
  });
});

describe('adviceFor', () => {
  it('duża szansa deszczu → parasol z godziną szczytu opadów', () => {
    const f = base('2026-11-11T06:00', morningHours('2026-11-11', 10, 70));
    const tips = adviceFor(f);
    expect(tips.some(t => t.includes('parasol') && t.includes('70%'))).toBe(true);
  });

  it('mróz → czapka i rękawiczki', () => {
    const tips = adviceFor(base('2026-11-11T06:00', morningHours('2026-11-11', -3)));
    expect(tips.some(t => t.includes('Mróz'))).toBe(true);
  });

  it('burza ma najwyższy priorytet (pierwsza na liście)', () => {
    const hours = morningHours('2026-11-11', 10, 80);
    hours[2] = { ...hours[2], code: 95 };
    const tips = adviceFor(base('2026-11-11T06:00', hours));
    expect(tips[0]).toContain('burza');
  });

  it('spokojna pogoda → komunikat pozytywny', () => {
    const tips = adviceFor(base('2026-11-11T06:00', morningHours('2026-11-11', 15, 0)));
    expect(tips).toEqual(['Bez niespodzianek — dobra pogoda na start']);
  });

  it('brak godzin porannych → informacja o braku prognozy', () => {
    const tips = adviceFor(base('2026-11-11T06:00', []));
    expect(tips).toEqual(['Brak prognozy godzinowej']);
  });

  it('silny wiatr dopisuje ostrzeżenie', () => {
    const f = base('2026-11-11T06:00', morningHours('2026-11-11', 15), { wind: 45 });
    expect(adviceFor(f).some(t => t.includes('wiatr'))).toBe(true);
  });
});

describe('weatherLine', () => {
  it('składa jedną linijkę: ikona, temperatura, opis, pierwsza rada', () => {
    const f = base('2026-11-11T06:00', morningHours('2026-11-11', 15), { temp: 6.4, code: 3 });
    expect(weatherLine(f)).toBe('☁️ 6° · Pochmurno · Bez niespodzianek — dobra pogoda na start');
  });
});
