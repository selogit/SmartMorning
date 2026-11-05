export const pad = (n: number) => n.toString().padStart(2, '0');

export const parseTime = (time: string): [number, number] => {
  const [h, m] = time.split(':').map(Number);
  return [h, m];
};

/** Najbliższe wystąpienie godziny hh:mm (dziś albo jutro). */
export const nextOccurrence = (hours: number, minutes: number, from: Date = new Date()) => {
  const target = new Date(from);
  target.setHours(hours, minutes, 0, 0);
  if (target <= from) target.setDate(target.getDate() + 1);
  return target;
};

export const formatDuration = (ms: number) => {
  const diffMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
};

export const timeUntil = (hours: number, minutes: number) =>
  `Zadzwoni za ${formatDuration(nextOccurrence(hours, minutes).getTime() - Date.now())}`;

/** Dni tygodnia jak w Date.getDay(): 0 = niedziela … 6 = sobota. */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WORK_DAYS = [1, 2, 3, 4, 5];
export const WEEKEND_DAYS = [0, 6];
/** Kolejność wyświetlania (od poniedziałku). */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

const sameDays = (a: number[], b: number[]) => a.length === b.length && b.every(d => a.includes(d));

/**
 * Najbliższe dzwonienie alarmu po `from`.
 * days: brak = codziennie (stare alarmy), [] = jednorazowo, inaczej wybrane dni tygodnia.
 */
export function nextAlarmDate(time: string, days: number[] | undefined, from: Date = new Date()): Date {
  const [h, m] = parseTime(time);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    d.setHours(h, m, 0, 0);
    if (d <= from) continue;
    if (!days || days.length === 0 || days.includes(d.getDay())) return d;
  }
  return nextOccurrence(h, m, from);
}

export function daysLabel(days: number[] | undefined): string {
  if (!days || sameDays(days, ALL_DAYS)) return 'Codziennie';
  if (days.length === 0) return 'Jednorazowo';
  if (sameDays(days, WORK_DAYS)) return 'Pn–Pt';
  if (sameDays(days, WEEKEND_DAYS)) return 'Weekend';
  return DAY_ORDER.filter(d => days.includes(d))
    .map(d => DAY_SHORT[d])
    .join(', ');
}

export const alarmTimeUntil = (time: string, days: number[] | undefined) =>
  `Zadzwoni za ${formatDuration(nextAlarmDate(time, days).getTime() - Date.now())}`;
