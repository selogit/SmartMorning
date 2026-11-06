import { Forecast } from '../weather/types';
import { morningWindow } from '../weather/advice';

export const DEFAULT_CHECKLIST = ['Klucze', 'Portfel', 'Telefon i ładowarka', 'Dokumenty', 'Słuchawki'];

/** Odhaczone rzeczy na dany dzień: id kafelka → nazwy rzeczy. Nowy dzień = czysta lista. */
export interface ChecklistState {
  date: string;
  checked: Record<string, string[]>;
}

export const norm = (s: string) => s.trim().toLowerCase();

/** Stan na dziś — wczorajsze odhaczenia nie przechodzą na kolejny dzień. */
export function stateForDay(stored: ChecklistState | null, day: string): ChecklistState {
  return stored && stored.date === day ? stored : { date: day, checked: {} };
}

export function toggleItem(state: ChecklistState, tileId: string, item: string): ChecklistState {
  const list = state.checked[tileId] ?? [];
  const has = list.some(i => norm(i) === norm(item));
  const next = has ? list.filter(i => norm(i) !== norm(item)) : [...list, item];
  return { ...state, checked: { ...state.checked, [tileId]: next } };
}

export function isChecked(state: ChecklistState, tileId: string, item: string) {
  return (state.checked[tileId] ?? []).some(i => norm(i) === norm(item));
}

/** Rzeczy podpowiadane przez prognozę na poranek (tylko te, których nie ma już na liście). */
export function weatherItems(f: Forecast | null, items: string[]): string[] {
  if (!f) return [];
  const { hours } = morningWindow(f);
  if (hours.length === 0) return [];
  const out: string[] = [];
  const rain = Math.max(...hours.map(h => h.precipProb ?? 0));
  const minTemp = Math.min(...hours.map(h => h.temp));
  const has = (word: string) => items.some(i => norm(i).includes(word));
  if (rain >= 30 && !has('parasol')) out.push(`☂ Parasol (${rain}% szans na opady)`);
  if (minTemp <= 0 && !has('rękawicz') && !has('czapk')) out.push('Czapka i rękawiczki');
  return out;
}
