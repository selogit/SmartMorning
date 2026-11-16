/** Testy jednostkowe: src/routine/chain.ts */
import { moveTile, removeTile, scheduleTimes } from '../../src/routine/chain';
import { Routine, RoutineTile } from '../../src/routine/types';

const tile = (id: string, extra: Partial<RoutineTile> = {}): RoutineTile =>
  ({ id, kind: 'notes', title: id, size: 'medium', ...extra }) as RoutineTile;

describe('moveTile', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('przesuwa element do przodu', () => {
    expect(moveTile(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('przesuwa element do tyłu', () => {
    expect(moveTile(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('from === to → ta sama referencja (brak zmiany)', () => {
    expect(moveTile(list, 1, 1)).toBe(list);
  });

  it('indeks spoza zakresu → brak zmiany', () => {
    expect(moveTile(list, -1, 2)).toBe(list);
    expect(moveTile(list, 9, 2)).toBe(list);
  });

  it('cel poza końcem listy jest przycinany', () => {
    expect(moveTile(list, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('nie modyfikuje oryginalnej tablicy', () => {
    moveTile(list, 0, 2);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('removeTile', () => {
  it('usuwa kafelek po id', () => {
    const r: Routine = { id: 'p', name: 'Plan', days: [], tiles: [tile('x'), tile('y')], startAfterAlarm: true };
    expect(removeTile(r, 'x').tiles.map(t => t.id)).toEqual(['y']);
  });
});

describe('scheduleTimes', () => {
  it('jawna godzina + minutniki przesuwają kursor', () => {
    const chain = [
      tile('alarm', { time: '06:30', durationMin: 5 }),
      tile('notes', { durationMin: 10 }),
      tile('weather', { durationMin: 5 }),
    ];
    expect(scheduleTimes(chain)).toEqual(['06:30', '06:35', '06:45']);
  });

  it('kroki przed pierwszą godziną dostają null', () => {
    const chain = [tile('notes', { durationMin: 10 }), tile('alarm', { time: '07:00' })];
    expect(scheduleTimes(chain)).toEqual([null, '07:00']);
  });

  it('kolejna jawna godzina nadpisuje kursor', () => {
    const chain = [
      tile('a', { time: '06:00', durationMin: 30 }),
      tile('b', { time: '08:15', durationMin: 15 }),
      tile('c', { durationMin: 5 }),
    ];
    expect(scheduleTimes(chain)).toEqual(['06:00', '08:15', '08:30']);
  });

  it('przekroczenie północy zawija się do 00:xx', () => {
    const chain = [tile('a', { time: '23:50', durationMin: 20 }), tile('b', { durationMin: 5 })];
    expect(scheduleTimes(chain)).toEqual(['23:50', '00:10']);
  });

  it('krok bez minutnika nie przesuwa kursora', () => {
    const chain = [tile('a', { time: '07:00' }), tile('b', { durationMin: 10 }), tile('c')];
    expect(scheduleTimes(chain)).toEqual(['07:00', '07:00', '07:10']);
  });
});
