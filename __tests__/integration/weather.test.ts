/**
 * Testy INTEGRACYJNE: src/weather/api.ts (fetch zamockowany) → advice.ts → checklist.ts
 * Pełny przepływ: odpowiedź Open-Meteo → Forecast → porady i podpowiedzi checklisty.
 */
import { fetchForecast, searchPlaces } from '../../src/weather/api';
import { adviceFor, morningWindow } from '../../src/weather/advice';
import { weatherItems } from '../../src/routine/checklist';
import { WeatherPlace } from '../../src/weather/types';

const place: WeatherPlace = {
  id: 1,
  name: 'Warszawa',
  latitude: 52.23,
  longitude: 21.01,
  timezone: 'Europe/Warsaw',
};

/** Odpowiedź Open-Meteo w kształcie z dokumentacji (skrócona). */
const openMeteoResponse = {
  timezone: 'Europe/Warsaw',
  current: {
    time: '2026-11-11T06:15',
    temperature_2m: 2.4,
    apparent_temperature: -1.2,
    weather_code: 71,
    wind_speed_10m: 18.5,
    is_day: 0,
    precipitation: 0.3,
  },
  hourly: {
    time: ['2026-11-11T05:00', '2026-11-11T06:00', '2026-11-11T07:00', '2026-11-11T08:00'],
    temperature_2m: [1.8, 2.4, 2.9, 3.5],
    precipitation_probability: [70, 65, 40, 20],
    weather_code: [71, 71, 3, 3],
  },
  daily: {
    time: ['2026-11-11', '2026-11-12'],
    temperature_2m_max: [5.1, 6.0],
    temperature_2m_min: [0.2, 1.1],
    sunrise: ['2026-11-11T06:58', '2026-11-12T07:00'],
    sunset: ['2026-11-11T15:49', '2026-11-12T15:47'],
    precipitation_probability_max: [70, 30],
    weather_code: [71, 3],
  },
};

const mockFetch = (body: any, ok = true, status = 200) =>
  jest.fn(async () => ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) })) as any;

afterEach(() => {
  (global as any).fetch = undefined;
});

describe('fetchForecast → Forecast', () => {
  it('mapuje odpowiedź API na model aplikacji', async () => {
    global.fetch = mockFetch(openMeteoResponse);
    const f = await fetchForecast(place);

    expect(f.timezone).toBe('Europe/Warsaw');
    expect(f.current.temp).toBe(2.4);
    expect(f.current.isDay).toBe(false);
    expect(f.hourly).toHaveLength(4);
    expect(f.hourly[0]).toEqual({ time: '2026-11-11T05:00', temp: 1.8, precipProb: 70, code: 71 });
    expect(f.daily[0].sunrise).toBe('2026-11-11T06:58');

    const url: string = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain('api.open-meteo.com');
    expect(url).toContain('latitude=52.23');
  });

  it('klucz API przełącza hosta na customer- i dokleja apikey', async () => {
    global.fetch = mockFetch(openMeteoResponse);
    await fetchForecast(place, 'sekret');
    const url: string = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain('https://customer-api.open-meteo.com');
    expect(url).toContain('apikey=sekret');
  });

  it('błąd HTTP → czytelny polski komunikat', async () => {
    global.fetch = mockFetch({ error: true, reason: 'Invalid API key' }, false, 401);
    await expect(fetchForecast(place)).rejects.toThrow('Invalid API key');
  });

  it('błąd bez treści → komunikat z kodem HTTP', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => { throw new Error('x'); } })) as any;
    await expect(fetchForecast(place)).rejects.toThrow('Błąd serwera pogody (HTTP 503)');
  });

  it('braki w danych nie psują modelu (num/numOrNull)', async () => {
    const broken = { ...openMeteoResponse, current: { time: '2026-11-11T06:15' }, hourly: {}, daily: {} };
    global.fetch = mockFetch(broken);
    const f = await fetchForecast(place);
    expect(f.current.temp).toBe(0);
    expect(f.current.code).toBe(-1);
    expect(f.hourly).toEqual([]);
  });
});

describe('API → advice → checklista (przepływ między modułami)', () => {
  it('prognoza ze śniegiem i deszczem daje spójne porady i podpowiedzi', async () => {
    global.fetch = mockFetch(openMeteoResponse);
    const f = await fetchForecast(place);

    const w = morningWindow(f);
    expect(w.label).toBe('Dziś rano');
    expect(w.hours.map(h => h.time)).toEqual(openMeteoResponse.hourly.time);

    const tips = adviceFor(f);
    expect(tips.some(t => t.includes('Śnieg'))).toBe(true); // kod 71 rano
    expect(tips.some(t => t.includes('parasol') && t.includes('70%'))).toBe(true);

    const items = weatherItems(f, ['Klucze', 'Portfel']);
    expect(items.some(i => i.includes('Parasol (70% szans na opady)'))).toBe(true);
  });
});

describe('searchPlaces', () => {
  it('filtruje wyniki bez współrzędnych', async () => {
    global.fetch = mockFetch({
      results: [
        { id: 1, name: 'Warszawa', latitude: 52.2, longitude: 21.0, country: 'Polska' },
        { id: 2, name: 'Zepsute', latitude: 'brak', longitude: null },
      ],
    });
    const places = await searchPlaces('warszawa');
    expect(places).toHaveLength(1);
    expect(places[0].name).toBe('Warszawa');
  });

  it('brak pola results → pusta lista', async () => {
    global.fetch = mockFetch({});
    expect(await searchPlaces('x')).toEqual([]);
  });
});
