import { Forecast, HourPoint } from './types';
import { codeInfo, isFreezing, isSnow, isStorm } from './codes';

const MORNING_FROM = 5;
const MORNING_TO = 11;

const hourOf = (t: string) => Number(t.slice(11, 13));
const dateOf = (t: string) => t.slice(0, 10);
export const hhmm = (t: string | null) => (t ? t.slice(11, 16) : '—');
export const round = (n: number) => Math.round(n);

/**
 * Godziny poranne do pokazania: dzisiejszy poranek, a po 11:00 (czasu miejsca) — jutrzejszy,
 * żeby wieczorem dało się sprawdzić pogodę na pobudkę.
 */
export function morningWindow(f: Forecast): { label: string; date: string; hours: HourPoint[] } {
  const nowTime = f.current.time || f.hourly[0]?.time || '';
  const today = dateOf(nowTime);
  const tomorrow = f.daily.find(d => d.date > today)?.date ?? today;
  const useTomorrow = nowTime !== '' && hourOf(nowTime) >= MORNING_TO;
  const date = useTomorrow ? tomorrow : today;
  const hours = f.hourly.filter(
    h => dateOf(h.time) === date && hourOf(h.time) >= MORNING_FROM && hourOf(h.time) <= MORNING_TO
  );
  return { label: useTomorrow ? 'Jutro rano' : 'Dziś rano', date, hours };
}

/** Krótkie, praktyczne podpowiedzi na poranek (najważniejsza pierwsza). */
export function adviceFor(f: Forecast): string[] {
  const { hours } = morningWindow(f);
  const tips: string[] = [];
  if (hours.length === 0) return ['Brak prognozy godzinowej'];

  const wettest = hours.reduce<HourPoint | null>(
    (best, h) => ((h.precipProb ?? 0) > (best?.precipProb ?? -1) ? h : best),
    null
  );
  const rain = wettest?.precipProb ?? 0;
  const minTemp = Math.min(...hours.map(h => h.temp));
  const maxTemp = Math.max(...hours.map(h => h.temp));

  if (hours.some(h => isStorm(h.code))) tips.push('Możliwa burza — lepiej zostań pod dachem');
  if (hours.some(h => isFreezing(h.code))) tips.push('Marznące opady — ślisko na drogach i chodnikach');
  else if (hours.some(h => isSnow(h.code))) tips.push('Śnieg — zarezerwuj więcej czasu na dojazd');

  if (rain >= 60) tips.push(`Weź parasol — ${rain}% szans na opady ok. ${hhmm(wettest!.time)}`);
  else if (rain >= 30) tips.push(`Możliwe opady (${rain}%) — parasol się przyda`);

  if (minTemp <= 0) tips.push(`Mróz rano (${round(minTemp)}°) — czapka i rękawiczki`);
  else if (minTemp <= 8) tips.push(`Chłodno rano (${round(minTemp)}°) — ciepła kurtka`);
  else if (maxTemp >= 24) tips.push(`Ciepło (${round(maxTemp)}°) — lekkie ubranie i woda`);

  if (f.current.wind >= 40) tips.push(`Silny wiatr (${round(f.current.wind)} km/h)`);

  if (tips.length === 0) tips.push('Bez niespodzianek — dobra pogoda na start');
  return tips;
}

/** Jedna linijka, np. na ekran pobudki: „6° · Pochmurno · Weź parasol…”. */
export function weatherLine(f: Forecast) {
  const info = codeInfo(f.current.code, f.current.isDay);
  return `${info.icon} ${round(f.current.temp)}° · ${info.label} · ${adviceFor(f)[0]}`;
}
