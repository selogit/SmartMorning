/**
 * Klient ZTM na nowym portalu miasta dane.um.warszawa.pl (od X 2026; stare api.um.warszawa.pl wygasa).
 * POST /api/action/<akcja>, nagłówek Authorization: <token JWT „eyJ…”> (bez „Bearer”), body JSON.
 * Odpowiedzi to tablice wierszy {key, value} — czasem gołe, czasem w { values } lub { result }.
 */

const BASE = 'https://dane.um.warszawa.pl/api/action/';
const TIMEOUT_MS = 15000;

export class ZtmError extends Error {}

export interface ZtmStop {
  id: string;
  nr: string;
  name: string;
  lat?: number;
  lon?: number;
  dir?: string;
}

export interface ZtmDeparture {
  /** „HH:MM:SS”, godzina może przekraczać 24 (kursy po północy). */
  time: string;
  direction: string;
  brigade: string;
  route?: string;
}

export interface ZtmVehicle {
  line: string;
  brigade: string;
  lat: number;
  lon: number;
  /** Czas raportu (ms). */
  at: number;
}

async function call(action: string, token: string, body?: object): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(BASE + action, {
      method: 'POST',
      headers: { Authorization: token.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) throw new ZtmError('Klucz ZTM jest nieprawidłowy (potrzebny klucz z dane.um.warszawa.pl)');
    if (!res.ok) throw new ZtmError(`Serwer miasta odpowiedział błędem (HTTP ${res.status})`);
    const j = await res.json();
    // Zły token: 200 z { result: "false", error: ... }.
    if (j && !Array.isArray(j) && (j.result === 'false' || j.result === false) && j.error) {
      throw new ZtmError(`Serwer miasta: ${String(j.error)}`);
    }
    return j;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new ZtmError('Serwer miasta nie odpowiada');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Zamienia odpowiedź „wiersze klucz–wartość” na zwykłe obiekty. */
export function rowsToRecords(body: any): Record<string, string | null>[] {
  const rows: any[] = Array.isArray(body) ? body : Array.isArray(body?.result) ? body.result : body?.values ? [body] : [];
  return rows
    .map(row => (Array.isArray(row) ? row : Array.isArray(row?.values) ? row.values : null))
    .filter((v): v is any[] => Array.isArray(v))
    .map(values => {
      const rec: Record<string, string | null> = {};
      for (const kv of values) if (kv && typeof kv.key === 'string') rec[kv.key] = kv.value ?? null;
      return rec;
    });
}

const num = (v: string | null | undefined) => {
  const n = v == null ? NaN : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

export function parseStops(body: any): ZtmStop[] {
  return rowsToRecords(body)
    .filter(r => r.zespol && r.slupek && r.nazwa_zespolu)
    .map(r => ({
      id: r.zespol!,
      nr: r.slupek!,
      name: r.nazwa_zespolu!,
      lat: num(r.szer_geo),
      lon: num(r.dlug_geo),
      dir: r.kierunek ?? undefined,
    }));
}

/** Wszystkie przystanki (kilka tysięcy słupków) — pobierać rzadko i trzymać w pamięci. */
export async function fetchStops(token: string) {
  return parseStops(await call('get_ztm_przystanki_komunikacji_miejskiej', token));
}

export function parseLines(body: any): string[] {
  return rowsToRecords(body)
    .map(r => r.linia)
    .filter((l): l is string => !!l)
    .sort((a, b) => {
      const na = /^\d+$/.test(a) ? +a : NaN;
      const nb = /^\d+$/.test(b) ? +b : NaN;
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      if (!isNaN(na)) return -1;
      if (!isNaN(nb)) return 1;
      return a.localeCompare(b);
    });
}

export async function linesAtStop(stopId: string, stopNr: string, token: string) {
  return parseLines(await call('get_ztm_lista_linii_na_przystanku', token, { busstopId: stopId, busstopNr: stopNr }));
}

export function parseDepartures(body: any): ZtmDeparture[] {
  return rowsToRecords(body)
    .filter(r => r.czas)
    .map(r => ({ time: r.czas!, direction: r.kierunek ?? '', brigade: r.brygada ?? '', route: r.trasa ?? undefined }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/** Rozkład linii z przystanku na dziś. */
export async function departures(stopId: string, stopNr: string, line: string, token: string) {
  return parseDepartures(await call('get_ztm_odjazdy_linii_z_przystanku', token, { busstopId: stopId, busstopNr: stopNr, line }));
}

/** „2026-10-17 16:09:38” (czas lokalny) → ms. */
export function localDateTimeToMs(s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s);
  if (!m) return NaN;
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
}

export function parseVehicles(body: any): ZtmVehicle[] {
  const rows: any[] = Array.isArray(body) ? body : Array.isArray(body?.result) ? body.result : [];
  const out: ZtmVehicle[] = [];
  for (const r of rows) {
    if (typeof r?.Lat !== 'number' || typeof r?.Lon !== 'number' || typeof r?.Lines !== 'string') continue;
    const at = localDateTimeToMs(String(r.Time ?? ''));
    if (Number.isNaN(at)) continue;
    out.push({ line: r.Lines.trim(), brigade: String(r.Brigade ?? '').trim(), lat: r.Lat, lon: r.Lon, at });
  }
  return out;
}

/** Tramwaje mają numery 1–2-cyfrowe; reszta (3 cyfry, N, E, L, Z…) to autobusy. */
export const isTramLine = (line: string) => /^\d{1,2}$/.test(line.trim());

/** Pozycje GPS pojazdów (autobusy: type 1, tramwaje: type 2), odświeżane przez miasto co ~10 s. */
export async function vehicles(line: string, token: string) {
  return parseVehicles(await call('get_ztm_lokalizacja_pojazdow', token, { type: isTramLine(line) ? 2 : 1 })).filter(
    v => v.line === line.trim()
  );
}
