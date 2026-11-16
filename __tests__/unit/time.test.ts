/** Testy jednostkowe: src/alarm/time.ts */
import {
  pad,
  parseTime,
  nextOccurrence,
  formatDuration,
  nextAlarmDate,
  daysLabel,
  WORK_DAYS,
  WEEKEND_DAYS,
  ALL_DAYS,
} from '../../src/alarm/time';

describe('pad / parseTime', () => {
  it('dopisuje zero wiodące', () => {
    expect(pad(5)).toBe('05');
    expect(pad(12)).toBe('12');
    expect(pad(0)).toBe('00');
  });

  it('parsuje HH:MM na parę liczb', () => {
    expect(parseTime('06:30')).toEqual([6, 30]);
    expect(parseTime('00:00')).toEqual([0, 0]);
    expect(parseTime('23:59')).toEqual([23, 59]);
  });
});

describe('nextOccurrence', () => {
  // Środa 2026-11-11, 10:00
  const wed10 = new Date(2026, 10, 11, 10, 0, 0, 0);

  it('godzina później tego samego dnia → dziś', () => {
    const d = nextOccurrence(12, 0, wed10);
    expect(d.getDate()).toBe(11);
    expect(d.getHours()).toBe(12);
  });

  it('godzina wcześniejsza → jutro', () => {
    const d = nextOccurrence(8, 0, wed10);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(8);
  });

  it('dokładnie ta sama minuta → jutro (target <= from)', () => {
    const d = nextOccurrence(10, 0, wed10);
    expect(d.getDate()).toBe(12);
  });
});

describe('formatDuration', () => {
  it.each([
    [5 * 60000, '5 min'],
    [60 * 60000, '1 h'],
    [90 * 60000, '1 h 30 min'],
    [0, '0 min'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatDuration(ms as number)).toBe(expected);
  });

  it('wartości ujemne są przycinane do zera', () => {
    expect(formatDuration(-5000)).toBe('0 min');
  });
});

describe('nextAlarmDate', () => {
  // Środa 2026-11-11, 10:00 (getDay() = 3)
  const wed10 = new Date(2026, 10, 11, 10, 0, 0, 0);

  it('brak dni (undefined) = codziennie: najbliższe wystąpienie', () => {
    expect(nextAlarmDate('12:00', undefined, wed10).getDate()).toBe(11);
    expect(nextAlarmDate('08:00', undefined, wed10).getDate()).toBe(12);
  });

  it('pusta lista dni = jednorazowo: też najbliższe wystąpienie', () => {
    expect(nextAlarmDate('08:00', [], wed10).getDate()).toBe(12);
  });

  it('tylko dni robocze: alarm o 8:00 ze środy przeskakuje na czwartek', () => {
    const d = nextAlarmDate('08:00', WORK_DAYS, wed10);
    expect(d.getDay()).toBe(4); // czwartek
    expect(d.getDate()).toBe(12);
  });

  it('tylko weekend: ze środy przeskakuje na sobotę', () => {
    const d = nextAlarmDate('08:00', WEEKEND_DAYS, wed10);
    expect(d.getDay()).toBe(6); // sobota
    expect(d.getDate()).toBe(14);
  });

  it('alarm tylko w środę o 12:00 — dzisiaj, bo jeszcze przed 12', () => {
    const d = nextAlarmDate('12:00', [3], wed10);
    expect(d.getDate()).toBe(11);
  });

  it('alarm tylko w środę o 8:00 — za tydzień', () => {
    const d = nextAlarmDate('08:00', [3], wed10);
    expect(d.getDate()).toBe(18);
    expect(d.getDay()).toBe(3);
  });
});

describe('daysLabel', () => {
  it('rozpoznaje standardowe zestawy dni', () => {
    expect(daysLabel(undefined)).toBe('Codziennie');
    expect(daysLabel(ALL_DAYS)).toBe('Codziennie');
    expect(daysLabel([])).toBe('Jednorazowo');
    expect(daysLabel(WORK_DAYS)).toBe('Pn–Pt');
    expect(daysLabel(WEEKEND_DAYS)).toBe('Weekend');
  });

  it('niestandardowe dni wypisuje w kolejności od poniedziałku', () => {
    expect(daysLabel([0, 1])).toBe('Pn, Nd'); // poniedziałek przed niedzielą
    expect(daysLabel([5, 3])).toBe('Śr, Pt');
  });
});
