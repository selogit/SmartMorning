/**
 * Klient Otwartych Danych Kolejowych PKP PLK (https://pdp-api.plk-sa.pl).
 * Rozkład (/schedules) daje numer, przewoźnika i peron; wykonanie (/operations) daje opóźnienia.
 * Łączymy je po parze (scheduleId, orderId). Czasy są lokalne (Europe/Warsaw) bez strefy.
 */

const BASE = 'https://pdp-api.plk-sa.pl/api/v1';
const TIMEOUT_MS = 15000;

export interface PlkStation {
  id: number;
  name: string;
}

export interface PlannedTrain {
  key: string;
  altKey?: string;
  number: string;
  name?: string;
  carrier?: string;
  /** Odjazd z A „HH:MM” i offset doby. */
  departure: string;
  departureDay: number;
  platform?: string;
  track?: string;
  /** Przyjazd do B „HH:MM”. */
  arrival?: string;
}

export interface TrainLive {
  delayMin: number | null;
  plannedDeparture?: string;
  actualDeparture?: string;
  cancelled: boolean;
  /** S = nie wyjechał, P = w drodze, C = zakończył, X = odwołany, Q = częściowo odwołany. */
  status?: string;
  operatingDate?: string;
}

export interface PlkDisruption {
  id: number;
  message: string;
  type?: string;
  /** Klucze kursów (scheduleId:orderId), których dotyczy. */
  routes: string[];
}

export class PlkError extends Error {}

async function get(path: string, params: Record<string, string | number | boolean | undefined>, key: string) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      headers: { 'X-API-Key': key.trim(), Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) throw new PlkError('Klucz PLK jest nieprawidłowy albo nieaktywny');
    if (res.status === 429) throw new PlkError('Wyczerpany limit zapytań PLK — spróbuj za chwilę');
    if (!res.ok) throw new PlkError(`PLK odpowiedziało błędem (HTTP ${res.status})`);
    return await res.json();
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new PlkError('Serwer PLK nie odpowiada');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** „07:42:00” → „07:42”. */
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : undefined);
export const routeKey = (scheduleId: number, orderId: number) => `${scheduleId}:${orderId}`;

export async function searchStations(query: string, key: string): Promise<PlkStation[]> {
  const j = await get('/dictionaries/stations', { search: query.trim(), page: 1, pageSize: 30 }, key);
  const list: any[] = Array.isArray(j?.stations) ? j.stations : [];
  return list
    .filter(s => typeof s?.id === 'number' && typeof s?.name === 'string')
    .map(s => ({ id: s.id, name: s.name }));
}

export function parseSchedules(j: any, fromId: number, toId: number): PlannedTrain[] {
  const routes: any[] = Array.isArray(j?.routes) ? j.routes : [];
  const out: PlannedTrain[] = [];
  for (const r of routes) {
    const stations: any[] = Array.isArray(r?.stations) ? r.stations : [];
    const from = stations.find(s => s?.stationId === fromId);
    const to = stations.find(s => s?.stationId === toId);
    if (!from?.departureTime) continue;
    out.push({
      key: routeKey(r.scheduleId, r.orderId),
      altKey: r.trainOrderId ? routeKey(r.scheduleId, r.trainOrderId) : undefined,
      number: from.departureTrainNumber || r.nationalNumber || r.internationalDepartureNumber || '',
      name: r.name || undefined,
      carrier: r.carrierCode || undefined,
      departure: hhmm(from.departureTime)!,
      departureDay: from.departureDay ?? 0,
      platform: from.departurePlatform || undefined,
      track: from.departureTrack || undefined,
      arrival: hhmm(to?.arrivalTime),
    });
  }
  return out.sort((a, b) => a.departureDay - b.departureDay || a.departure.localeCompare(b.departure));
}

/** Pociągi z A do B w danym dniu (RRRR-MM-DD). */
export async function trainsBetween(fromId: number, toId: number, date: string, key: string) {
  const j = await get(
    '/schedules',
    { dateFrom: date, dateTo: date, fromStations: fromId, toStations: toId, dictionaries: false },
    key
  );
  return parseSchedules(j, fromId, toId);
}

export function parseOperations(j: any, stationId: number): Map<string, TrainLive> {
  const map = new Map<string, TrainLive>();
  const trains: any[] = Array.isArray(j?.trains) ? j.trains : [];
  for (const t of trains) {
    const st = (Array.isArray(t?.stations) ? t.stations : []).find((s: any) => s?.stationId === stationId);
    if (!st) continue;
    const live: TrainLive = {
      delayMin: typeof st.departureDelayMinutes === 'number' ? st.departureDelayMinutes : typeof st.arrivalDelayMinutes === 'number' ? st.arrivalDelayMinutes : null,
      plannedDeparture: st.plannedDeparture ?? undefined,
      actualDeparture: st.actualDeparture ?? undefined,
      cancelled: !!st.isCancelled || t.trainStatus === 'X',
      status: t.trainStatus ?? undefined,
      operatingDate: t.operatingDate ?? undefined,
    };
    for (const k of [routeKey(t.scheduleId, t.orderId), t.trainOrderId ? routeKey(t.scheduleId, t.trainOrderId) : null]) {
      if (!k) continue;
      const prev = map.get(k);
      // Przy kilku dniach kursowania zostaw najnowszy.
      if (!prev || (live.operatingDate ?? '') >= (prev.operatingDate ?? '')) map.set(k, live);
    }
  }
  return map;
}

/** Wykonanie (opóźnienia) wszystkich pociągów przez stację. */
export async function liveAtStation(stationId: number, key: string) {
  const j = await get('/operations', { stations: stationId, withPlanned: true, pageSize: 2000 }, key);
  return parseOperations(j, stationId);
}

export function parseDisruptions(j: any): PlkDisruption[] {
  const types: Record<string, string> = j?.disruptionTypes ?? {};
  const list: any[] = Array.isArray(j?.disruptions) ? j.disruptions : [];
  return list
    .filter(d => typeof d?.message === 'string' && d.message.trim())
    .map(d => ({
      id: d.disruptionId,
      message: d.message.trim(),
      type: d.disruptionTypeCode ? types[d.disruptionTypeCode] : undefined,
      routes: (Array.isArray(d.affectedRoutes) ? d.affectedRoutes : []).map((r: any) => routeKey(r.scheduleId, r.orderId)),
    }));
}

export async function disruptionsAt(stationIds: number[], key: string) {
  const j = await get('/disruptions', { stations: stationIds.join(',') }, key);
  return parseDisruptions(j);
}
