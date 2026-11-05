import { Alarm } from '../alarm/types';
import { nextAlarmDate, pad, parseTime } from '../alarm/time';

export interface BedtimeSettings {
  enabled: boolean;
  /** Ile snu chcesz mieć (minuty). */
  sleepMinutes: number;
  /** Ile minut przed pójściem spać przypomnieć. */
  remindBefore: number;
}

export const DEFAULT_BEDTIME: BedtimeSettings = { enabled: true, sleepMinutes: 8 * 60, remindBefore: 30 };

export interface Night {
  /** Pierwszy alarm danego dnia. */
  wake: Date;
  alarm: Alarm;
  /** Kiedy położyć się spać. */
  bedtime: Date;
  /** Kiedy wysłać przypomnienie. */
  remindAt: Date;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Pierwszy alarm każdego z najbliższych dni (po `from`), najwyżej `count` dni. */
export function upcomingWakeTimes(alarms: Alarm[], from: Date = new Date(), count = 7): { wake: Date; alarm: Alarm }[] {
  const out: { wake: Date; alarm: Alarm }[] = [];
  for (let i = 0; i <= count + 1 && out.length < count; i++) {
    const day = new Date(from);
    day.setDate(from.getDate() + i);
    let best: { wake: Date; alarm: Alarm } | null = null;
    for (const a of alarms) {
      if (!a.enabled) continue;
      const [h, m] = parseTime(a.time);
      const at = new Date(day);
      at.setHours(h, m, 0, 0);
      if (at <= from) continue;
      const rings =
        !a.days || a.days.includes(at.getDay())
          ? true
          : a.days.length === 0 && dayKey(nextAlarmDate(a.time, [], from)) === dayKey(at); // jednorazowy
      if (rings && (!best || at < best.wake)) best = { wake: at, alarm: a };
    }
    if (best) out.push(best);
  }
  return out;
}

/** Noce, dla których przypomnienie jeszcze ma sens (przypomnienie w przyszłości). */
export function upcomingNights(alarms: Alarm[], s: BedtimeSettings, now: Date = new Date(), count = 7): Night[] {
  return upcomingWakeTimes(alarms, now, count + 1)
    .map(({ wake, alarm }) => {
      const bedtime = new Date(wake.getTime() - s.sleepMinutes * 60000);
      const remindAt = new Date(bedtime.getTime() - s.remindBefore * 60000);
      return { wake, alarm, bedtime, remindAt };
    })
    .filter(n => n.remindAt > now)
    .slice(0, count);
}

/** Najbliższa noc do pokazania w aplikacji (także gdy przypomnienie już minęło, ale pora snu nie). */
export function currentNight(alarms: Alarm[], s: BedtimeSettings, now: Date = new Date()): Night | null {
  const first = upcomingWakeTimes(alarms, now, 1)[0];
  if (!first) return null;
  const bedtime = new Date(first.wake.getTime() - s.sleepMinutes * 60000);
  return { ...first, bedtime, remindAt: new Date(bedtime.getTime() - s.remindBefore * 60000) };
}

export const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export const sleepLabel = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

export const nightId = (n: Night) => `bedtime-${dayKey(n.wake)}`;
