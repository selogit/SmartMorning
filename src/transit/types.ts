/** Pociąg z A do B o danej godzinie (dane PKP PLK). */
export interface TrainTrip {
  id: string;
  kind: 'train';
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  /** Planowy odjazd z A, „HH:MM”. */
  time: string;
  label?: string;
}

/** Linia autobusu/tramwaju z przystanku (dane ZTM, dane.um.warszawa.pl). */
export interface ZtmTrip {
  id: string;
  kind: 'ztm';
  /** Zespół przystankowy, np. „7009”. */
  stopId: string;
  /** Słupek, np. „01”. */
  stopNr: string;
  stopName: string;
  /** Kierunek słupka (ulica), do podpowiedzi. */
  stopDir?: string;
  lat?: number;
  lon?: number;
  line: string;
  /** Konkretny odjazd „HH:MM”; brak = najbliższe odjazdy. */
  time?: string;
  label?: string;
}

export type Trip = TrainTrip | ZtmTrip;

export interface TransitSettings {
  plkKey?: string;
  ztmKey?: string;
  trips: Trip[];
}

export type StatusTone = 'ok' | 'late' | 'bad' | 'unknown';

/** Wynik sprawdzenia jednego połączenia. */
export interface TripStatus {
  tripId: string;
  /** Główna informacja, np. „+6 min” albo „planowo”. */
  headline: string;
  tone: StatusTone;
  /** Szczegóły w jednej linii, np. „KM 19123 · peron 3 · odjazd 07:48”. */
  detail: string;
  /** Kolejne odjazdy / dodatkowe linie. */
  extra?: string[];
  /** Komunikaty o utrudnieniach dotyczące połączenia. */
  alerts?: string[];
  checkedAt: number;
  error?: string;
}
