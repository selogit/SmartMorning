/**
 * Testy jednostkowe: ztmStatus / pickDepartures (src/transit/status.ts)
 *
 * Test regresyjny defektu D2 znalezionego podczas testów ręcznych (16.11.2026):
 * kurs 520 o 09:22 sprawdzany o 21:37 pokazywał „≈ +743 min”. Szacunek z GPS
 * był liczony dla kursu, który już odjechał — pojazd tej samej brygady jechał
 * wtedy zupełnie innym kursem, a „opóźnienie” = 8 min dojazdu − (−735 min).
 */
import { ztmStatus } from '../../src/transit/status';
import { ZtmDeparture, ZtmVehicle } from '../../src/transit/ztm';
import { ZtmTrip } from '../../src/transit/types';

const trip: ZtmTrip = {
  id: 'z520',
  kind: 'ztm',
  stopId: '7000',
  stopNr: '02',
  stopName: 'Dw. Centralny',
  lat: 52.2287,
  lon: 21.0035,
  line: '520',
  time: '09:22',
};

const deps: ZtmDeparture[] = [
  { time: '09:22:00', direction: 'Dw. Centralny', brigade: '5' },
  { time: '21:50:00', direction: 'Dw. Centralny', brigade: '5' },
];

/** Pojazd brygady 5 ok. 2,3 km od przystanku, raport świeży. */
const vehicle = (now: Date): ZtmVehicle => ({
  line: '520',
  brigade: '5',
  lat: 52.2287 + 0.0207, // ≈ 2,3 km na północ
  lon: 21.0035,
  at: now.getTime() - 30_000,
});

describe('ztmStatus — szacunek GPS tylko dla kursów, które jeszcze nie odjechały', () => {
  it('D2: kurs z rana sprawdzany wieczorem nie dostaje absurdalnego opóźnienia', () => {
    const now = new Date(2026, 10, 16, 21, 37);
    const s = ztmStatus(trip, deps, [vehicle(now)], now);
    expect(s.headline).not.toMatch(/\+\d+ min/);
    expect(s.headline).toBe('09:22');
    expect(s.tone).toBe('unknown');
    expect(s.extra?.[0]).not.toContain('GPS');
  });

  it('nadjeżdżający kurs nadal dostaje szacunek z GPS', () => {
    const now = new Date(2026, 10, 16, 9, 20); // 2 min przed odjazdem, pojazd 8 min drogi
    const s = ztmStatus(trip, deps, [vehicle(now)], now);
    expect(s.headline).toBe('≈ +6 min');
    expect(s.tone).toBe('late');
    expect(s.extra?.[0]).toContain('GPS: 2,3 km');
  });

  it('kurs punktualny według GPS → ton ok', () => {
    const now = new Date(2026, 10, 16, 9, 10); // 12 min do odjazdu, pojazd 8 min drogi
    const s = ztmStatus(trip, deps, [vehicle(now)], now);
    expect(s.headline).toBe('za 12 min');
    expect(s.tone).toBe('ok');
  });
});
