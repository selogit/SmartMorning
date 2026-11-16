/** Testy jednostkowe: src/transit/status.ts (pociągi) */
import { pickTrain, trainStatus, carrierLabel } from '../../src/transit/status';
import { PlannedTrain, TrainLive } from '../../src/transit/plk';
import { TrainTrip } from '../../src/transit/types';

const train = (departure: string, extra: Partial<PlannedTrain> = {}): PlannedTrain => ({
  key: 'k1',
  number: '12345',
  carrier: 'KM',
  departure,
  departureDay: 0,
  ...extra,
});

const trip: TrainTrip = {
  id: 't1',
  kind: 'train',
  fromId: 1,
  fromName: 'Warszawa Wsch.',
  toId: 2,
  toName: 'Warszawa Zach.',
  time: '07:30',
};

const live = (extra: Partial<TrainLive> = {}): TrainLive => ({ delayMin: null, cancelled: false, ...extra });

describe('pickTrain', () => {
  const trains = [train('07:05'), train('07:28'), train('08:10')];

  it('wybiera kurs najbliższy zapisanej godzinie', () => {
    expect(pickTrain(trains, '07:30')?.departure).toBe('07:28');
  });

  it('różnica ponad 20 minut → brak kursu', () => {
    expect(pickTrain([train('09:00')], '07:30')).toBeUndefined();
  });

  it('kursy z innej doby (departureDay ≠ 0) są pomijane', () => {
    expect(pickTrain([train('07:30', { departureDay: 1 })], '07:30')).toBeUndefined();
  });
});

describe('trainStatus', () => {
  const now = new Date(2026, 10, 11, 7, 0);

  it('brak kursu → komunikat „brak kursu" i ton bad', () => {
    const s = trainStatus(trip, undefined, undefined, [], now);
    expect(s.headline).toBe('brak kursu');
    expect(s.tone).toBe('bad');
    expect(s.detail).toContain('Warszawa Wsch.');
  });

  it('punktualny (delayMin = 0) → „punktualnie", ton ok', () => {
    const s = trainStatus(trip, train('07:28'), live({ delayMin: 0 }), [], now);
    expect(s.headline).toBe('punktualnie');
    expect(s.tone).toBe('ok');
  });

  it('małe opóźnienie → „+5 min", ton late; detail z nową godziną', () => {
    const s = trainStatus(trip, train('07:28'), live({ delayMin: 5 }), [], now);
    expect(s.headline).toBe('+5 min');
    expect(s.tone).toBe('late');
    expect(s.detail).toContain('odjazd 07:33 (plan 07:28)');
  });

  it('opóźnienie ≥ 10 min → ton bad', () => {
    const s = trainStatus(trip, train('07:28'), live({ delayMin: 15 }), [], now);
    expect(s.tone).toBe('bad');
  });

  it('odwołany → „odwołany"; status Q → „częściowo odwołany"', () => {
    expect(trainStatus(trip, train('07:28'), live({ cancelled: true, status: 'X' }), [], now).headline).toBe('odwołany');
    expect(trainStatus(trip, train('07:28'), live({ cancelled: true, status: 'Q' }), [], now).headline).toBe(
      'częściowo odwołany'
    );
  });

  it('brak danych live: kurs sprzed >30 min → „odjechał", przyszły → „wg rozkładu"', () => {
    const later = new Date(2026, 10, 11, 9, 0);
    expect(trainStatus(trip, train('07:28'), undefined, [], later).headline).toBe('odjechał');
    expect(trainStatus(trip, train('07:28'), undefined, [], now).headline).toBe('wg rozkładu');
  });

  it('dołącza tylko alerty dotyczące tego kursu', () => {
    const alerts = [
      { id: 1, message: 'Awaria sieci', routes: ['k1'] },
      { id: 2, message: 'Inna linia', routes: ['inny'] },
    ];
    const s = trainStatus(trip, train('07:28'), live({ delayMin: 0 }), alerts, now);
    expect(s.alerts).toEqual(['Awaria sieci']);
  });
});

describe('carrierLabel', () => {
  it('mapuje kody przewoźników', () => {
    expect(carrierLabel('KM')).toBe('KM');
    expect(carrierLabel('KS')).toBe('SKM');
    expect(carrierLabel('XX')).toBe('XX');
    expect(carrierLabel()).toBe('');
  });
});
