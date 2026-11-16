/** Test funkcjonalny S3: „Czy zdążę na pociąg?” — punktualny, opóźniony, odwołany, brak kursu. */
import { pickTrain, trainStatus } from '../../src/transit/status';
import { parseDisruptions, PlannedTrain } from '../../src/transit/plk';
import { TrainTrip } from '../../src/transit/types';

const trip: TrainTrip = {
  id: 'dojazd',
  kind: 'train',
  fromId: 1,
  fromName: 'Legionowo',
  toId: 2,
  toName: 'Warszawa Gdańska',
  time: '07:30',
};

const schedule: PlannedTrain[] = [
  { key: 's:1', number: '10401', carrier: 'KM', departure: '07:02', departureDay: 0, platform: '1' },
  { key: 's:2', number: '10403', carrier: 'KM', departure: '07:33', departureDay: 0, platform: '1', track: '2' },
  { key: 's:3', number: '10405', carrier: 'KM', departure: '08:04', departureDay: 0, platform: '1' },
];

const morning = new Date(2026, 10, 10, 6, 45);

describe('S3. Czy zdążę na pociąg?', () => {
  it('wariant A: pociąg punktualny — zielony status z peronem', () => {
    const train = pickTrain(schedule, trip.time)!;
    expect(train.number).toBe('10403'); // najbliższy godz. 07:30

    const s = trainStatus(trip, train, { delayMin: 0, cancelled: false }, [], morning);
    expect(s.headline).toBe('punktualnie');
    expect(s.tone).toBe('ok');
    expect(s.detail).toBe('KM 10403 · peron 1, tor 2 · odjazd 07:33');
  });

  it('wariant B: opóźnienie 7 min — żółty status, przesunięta godzina', () => {
    const train = pickTrain(schedule, trip.time)!;
    const s = trainStatus(trip, train, { delayMin: 7, cancelled: false }, [], morning);
    expect(s.headline).toBe('+7 min');
    expect(s.tone).toBe('late');
    expect(s.detail).toContain('odjazd 07:40 (plan 07:33)');
  });

  it('wariant C: kurs odwołany z komunikatem o awarii — czerwony status', () => {
    const train = pickTrain(schedule, trip.time)!;
    const alerts = parseDisruptions({
      disruptionTypes: { AWR: 'Awaria' },
      disruptions: [
        {
          disruptionId: 1,
          message: 'Awaria rozjazdu — kursy odwołane',
          disruptionTypeCode: 'AWR',
          affectedRoutes: [{ scheduleId: 's', orderId: 2 }],
        },
      ],
    });
    const s = trainStatus(trip, train, { delayMin: null, cancelled: true, status: 'X' }, alerts, morning);
    expect(s.headline).toBe('odwołany');
    expect(s.tone).toBe('bad');
    expect(s.alerts).toEqual(['Awaria rozjazdu — kursy odwołane']);
  });

  it('wariant D: brak kursu o tej porze (np. święto) — czytelny komunikat', () => {
    const s = trainStatus(trip, undefined, undefined, [], morning);
    expect(s.headline).toBe('brak kursu');
    expect(s.detail).toBe('Dziś nie ma pociągu Legionowo → Warszawa Gdańska ok. 07:30');
  });
});
