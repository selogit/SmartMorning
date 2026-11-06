import { PlannedTrain, PlkDisruption, TrainLive } from './plk';
import { ZtmDeparture, ZtmVehicle } from './ztm';
import { StatusTone, TrainTrip, TripStatus, ZtmTrip } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const fmt = (min: number) => `${pad(Math.floor((((min % 1440) + 1440) % 1440) / 60))}:${pad(((min % 60) + 60) % 60)}`;
export const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

/** Pociąg z rozkładu najbliższy zapisanej godzinie (najwyżej 20 min różnicy). */
export function pickTrain(trains: PlannedTrain[], time: string): PlannedTrain | undefined {
  const target = toMin(time);
  let best: PlannedTrain | undefined;
  let bestDiff = Infinity;
  for (const t of trains) {
    if (t.departureDay !== 0) continue;
    const diff = Math.abs(toMin(t.departure) - target);
    if (diff < bestDiff) {
      best = t;
      bestDiff = diff;
    }
  }
  return bestDiff <= 20 ? best : undefined;
}

const CARRIERS: Record<string, string> = { KM: 'KM', KS: 'SKM', SKM: 'SKM', KD: 'WKD', WKD: 'WKD', IC: 'IC', PR: 'PolRegio', LS: 'ŁKA' };
export const carrierLabel = (code?: string) => (code ? CARRIERS[code] ?? code : '');

export function trainStatus(
  trip: TrainTrip,
  train: PlannedTrain | undefined,
  live: TrainLive | undefined,
  alerts: PlkDisruption[],
  now = new Date()
): TripStatus {
  const base = { tripId: trip.id, checkedAt: now.getTime() };
  if (!train) {
    return {
      ...base,
      headline: 'brak kursu',
      tone: 'bad',
      detail: `Dziś nie ma pociągu ${trip.fromName} → ${trip.toName} ok. ${trip.time}`,
    };
  }
  const name = [carrierLabel(train.carrier), train.number, train.name].filter(Boolean).join(' ');
  const platform = train.platform ? `peron ${train.platform}${train.track ? `, tor ${train.track}` : ''}` : '';
  const relevant = alerts.filter(a => a.routes.includes(train.key) || (train.altKey && a.routes.includes(train.altKey)));

  let headline = 'planowo';
  let tone: StatusTone = 'unknown';
  let when = train.departure;
  if (live?.cancelled) {
    headline = live.status === 'Q' ? 'częściowo odwołany' : 'odwołany';
    tone = 'bad';
  } else if (live && live.delayMin !== null) {
    when = fmt(toMin(train.departure) + Math.max(0, live.delayMin));
    if (live.delayMin <= 0) {
      headline = live.delayMin < 0 ? `${live.delayMin} min` : 'punktualnie';
      tone = 'ok';
    } else {
      headline = `+${live.delayMin} min`;
      tone = live.delayMin >= 10 ? 'bad' : 'late';
    }
  } else if (live) {
    headline = 'jeszcze bez danych';
  } else {
    // Brak w wykonaniu: albo jeszcze nie ruszył, albo kurs już minął.
    headline = toMin(train.departure) < nowMin(now) - 30 ? 'odjechał' : 'wg rozkładu';
  }

  return {
    ...base,
    headline,
    tone,
    detail: [name, platform, `odjazd ${when}${when !== train.departure ? ` (plan ${train.departure})` : ''}`]
      .filter(Boolean)
      .join(' · '),
    alerts: relevant.map(a => a.message),
  };
}

/** Odjazdy do pokazania: konkretny (gdy zapisano godzinę) albo dwa najbliższe. */
export function pickDepartures(deps: ZtmDeparture[], time: string | undefined, now = new Date()) {
  const cur = nowMin(now);
  const withMin = deps.map(d => ({ d, m: toMin(d.time) }));
  if (time) {
    const target = toMin(time);
    const best = withMin.reduce<{ d: ZtmDeparture; m: number } | null>(
      (b, x) => (!b || Math.abs(x.m - target) < Math.abs(b.m - target) ? x : b),
      null
    );
    return best ? [best] : [];
  }
  return withMin.filter(x => x.m >= cur - 1).slice(0, 2);
}

/** Odległość w km (wzór haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const stripZeros = (s: string) => s.replace(/^0+(?=\d)/, '');

/**
 * Szacunek z GPS: pojazd tej samej linii i brygady co odjazd → odległość od przystanku
 * i czas dojazdu przy średniej prędkości miejskiej. To przybliżenie, nie oficjalne opóźnienie.
 */
export function gpsEstimate(dep: ZtmDeparture, vehicles: ZtmVehicle[], trip: ZtmTrip, now = new Date()) {
  if (trip.lat === undefined || trip.lon === undefined || !dep.brigade) return null;
  const v = vehicles.find(x => stripZeros(x.brigade) === stripZeros(dep.brigade));
  if (!v) return null;
  const km = distanceKm(v.lat, v.lon, trip.lat, trip.lon);
  const ageMin = (now.getTime() - v.at) / 60000;
  if (ageMin > 5 || km > 12) return null; // nieaktualny albo daleko (np. na innym kursie)
  const speedKmh = 17; // średnia prędkość w mieście wraz z przystankami
  const etaMin = Math.round((km / speedKmh) * 60);
  return { km, etaMin };
}

export function ztmStatus(
  trip: ZtmTrip,
  deps: ZtmDeparture[],
  vehicles: ZtmVehicle[] | null,
  now = new Date()
): TripStatus {
  const base = { tripId: trip.id, checkedAt: now.getTime() };
  const picked = pickDepartures(deps, trip.time, now);
  if (picked.length === 0) {
    return { ...base, headline: 'brak odjazdów', tone: 'bad', detail: `${trip.line} · ${trip.stopName} — dziś bez kolejnych kursów` };
  }
  const cur = nowMin(now);
  const lines = picked.map(({ d, m }) => {
    const inMin = m - cur;
    const est = vehicles ? gpsEstimate(d, vehicles, trip, now) : null;
    const when = `${d.time.slice(0, 5)}${inMin >= 0 && inMin <= 90 ? ` (za ${inMin} min)` : ''}`;
    const gps = est ? ` · GPS: ${est.km.toFixed(1).replace('.', ',')} km, ≈${est.etaMin} min` : '';
    return { d, inMin, est, text: `${when} → ${d.direction}${gps}` };
  });
  const first = lines[0];
  let headline = first.inMin >= 0 ? `za ${first.inMin} min` : `${first.d.time.slice(0, 5)}`;
  let tone: StatusTone = 'unknown';
  if (first.est) {
    const late = first.est.etaMin - first.inMin;
    if (late >= 3) {
      headline = `≈ +${late} min`;
      tone = late >= 8 ? 'bad' : 'late';
    } else {
      tone = 'ok';
    }
  }
  return {
    ...base,
    headline,
    tone,
    detail: `${trip.line} · ${trip.stopName}${trip.stopNr ? ` ${trip.stopNr}` : ''}`,
    extra: lines.map(l => l.text),
  };
}
