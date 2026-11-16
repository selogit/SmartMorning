/**
 * Testy INTEGRACYJNE: src/transit/plk.ts (parsowanie) → status.ts (statusy kursów)
 * Przepływ: surowa odpowiedź Portalu Pasażera → utrudnienia → status z alertami.
 */
import { parseDisruptions } from '../../src/transit/plk';
import { pickTrain, trainStatus } from '../../src/transit/status';
import { PlannedTrain } from '../../src/transit/plk';
import { TrainTrip } from '../../src/transit/types';

const trip: TrainTrip = {
  id: 't1',
  kind: 'train',
  fromId: 33605,
  fromName: 'Warszawa Śródmieście',
  toId: 57801,
  toName: 'Pruszków',
  time: '07:30',
};

const planned: PlannedTrain[] = [
  { key: '100:1', number: '91234', carrier: 'KM', departure: '07:12', departureDay: 0, platform: '2', track: '4' },
  { key: '100:2', altKey: '200:9', number: '91236', carrier: 'KM', departure: '07:27', departureDay: 0, platform: '2' },
  { key: '100:3', number: '91238', carrier: 'KM', departure: '07:48', departureDay: 0 },
];

/** Surowa odpowiedź /disruptions w kształcie API Portalu Pasażera. */
const rawDisruptions = {
  disruptionTypes: { AWR: 'Awaria', RMT: 'Remont' },
  disruptions: [
    {
      disruptionId: 7,
      message: '  Opóźnienia na linii skierniewickiej do 20 min  ',
      disruptionTypeCode: 'AWR',
      affectedRoutes: [
        { scheduleId: 200, orderId: 9 },
        { scheduleId: 300, orderId: 1 },
      ],
    },
    { disruptionId: 8, message: '', affectedRoutes: [] }, // pusty komunikat — do odrzucenia
    { disruptionId: 9, message: 'Remont peronu 3', affectedRoutes: [{ scheduleId: 999, orderId: 9 }] },
  ],
};

describe('parseDisruptions → trainStatus (pełny przepływ)', () => {
  const alerts = parseDisruptions(rawDisruptions);

  it('parsuje utrudnienia: przycina komunikat, mapuje typ i klucze tras', () => {
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toEqual({
      id: 7,
      message: 'Opóźnienia na linii skierniewickiej do 20 min',
      type: 'Awaria',
      routes: ['200:9', '300:1'],
    });
  });

  it('alert dopasowany przez altKey trafia do statusu właściwego kursu', () => {
    const train = pickTrain(planned, trip.time); // 07:27, altKey 200:9
    expect(train?.number).toBe('91236');
    const s = trainStatus(trip, train, { delayMin: 12, cancelled: false }, alerts, new Date(2026, 10, 11, 7, 0));
    expect(s.headline).toBe('+12 min');
    expect(s.tone).toBe('bad');
    expect(s.detail).toContain('KM 91236');
    expect(s.detail).toContain('peron 2');
    expect(s.detail).toContain('odjazd 07:39 (plan 07:27)');
    expect(s.alerts).toEqual(['Opóźnienia na linii skierniewickiej do 20 min']);
  });

  it('kurs bez pasującego alertu nie dostaje cudzych komunikatów', () => {
    const train = planned[0]; // key 100:1
    const s = trainStatus(trip, train, { delayMin: 0, cancelled: false }, alerts, new Date(2026, 10, 11, 7, 0));
    expect(s.alerts).toEqual([]);
  });

  it('całkowicie uszkodzona odpowiedź API → brak utrudnień, bez wyjątku', () => {
    expect(parseDisruptions(null)).toEqual([]);
    expect(parseDisruptions({ disruptions: 'nie-tablica' })).toEqual([]);
  });
});
