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
