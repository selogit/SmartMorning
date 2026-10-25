import { Forecast, WeatherPlace } from './types';

const TIMEOUT_MS = 10000;

/** Z kluczem API Open-Meteo wymaga hosta z prefiksem „customer-”. */
const host = (base: string, apiKey?: string) => (apiKey ? `https://customer-${base}` : `https://${base}`);
const keyParam = (apiKey?: string) => (apiKey ? `&apikey=${encodeURIComponent(apiKey)}` : '');

async function getJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.error) {
      throw new Error(json?.reason ?? `Błąd serwera pogody (HTTP ${res.status})`);
    }
    return json;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('Serwer pogody nie odpowiada');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchPlaces(query: string, apiKey?: string): Promise<WeatherPlace[]> {
  const url =
    `${host('geocoding-api.open-meteo.com', apiKey)}/v1/search` +
    `?name=${encodeURIComponent(query.trim())}&count=8&language=pl&format=json${keyParam(apiKey)}`;
  const json = await getJson(url);
  const results: any[] = Array.isArray(json?.results) ? json.results : [];
  return results
    .filter(r => typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .map(r => ({
      id: r.id,
      name: r.name,
      admin1: r.admin1,
      country: r.country,
      latitude: r.latitude,
      longitude: r.longitude,
      timezone: r.timezone,
    }));
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export async function fetchForecast(place: WeatherPlace, apiKey?: string): Promise<Forecast> {
  const url =
    `${host('api.open-meteo.com', apiKey)}/v1/forecast` +
    `?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,precipitation' +
    '&hourly=temperature_2m,precipitation_probability,weather_code' +
    '&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,weather_code' +
    `&timezone=auto&forecast_days=3${keyParam(apiKey)}`;
  const j = await getJson(url);

  const c = j?.current ?? {};
  const h = j?.hourly ?? {};
  const d = j?.daily ?? {};
  const hTimes: string[] = Array.isArray(h.time) ? h.time : [];
  const dTimes: string[] = Array.isArray(d.time) ? d.time : [];

  return {
    timezone: j?.timezone ?? place.timezone ?? 'auto',
    current: {
      time: typeof c.time === 'string' ? c.time : '',
      temp: num(c.temperature_2m),
      feels: num(c.apparent_temperature, num(c.temperature_2m)),
      code: num(c.weather_code, -1),
      wind: num(c.wind_speed_10m),
      isDay: c.is_day !== 0,
      precipitation: num(c.precipitation),
    },
    hourly: hTimes.map((time, i) => ({
      time,
      temp: num(h.temperature_2m?.[i]),
      precipProb: numOrNull(h.precipitation_probability?.[i]),
      code: num(h.weather_code?.[i], -1),
    })),
    daily: dTimes.map((date, i) => ({
      date,
      min: num(d.temperature_2m_min?.[i]),
      max: num(d.temperature_2m_max?.[i]),
      sunrise: d.sunrise?.[i] ?? null,
      sunset: d.sunset?.[i] ?? null,
      precipProbMax: numOrNull(d.precipitation_probability_max?.[i]),
      code: num(d.weather_code?.[i], -1),
    })),
  };
}
