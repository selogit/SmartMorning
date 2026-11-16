/** Test funkcjonalny S1: poranek w dzień roboczy (sen → alarm → plan → checklista). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nextAlarmDate, daysLabel, WORK_DAYS } from '../../src/alarm/time';
import { savePlans, loadPlans, planForDate, makeTile } from '../../src/routine/storage';
import { scheduleTimes } from '../../src/routine/chain';
import { stateForDay, toggleItem, isChecked, weatherItems, DEFAULT_CHECKLIST } from '../../src/routine/checklist';
import { currentNight, DEFAULT_BEDTIME, hm } from '../../src/sleep/bedtime';
import { Alarm } from '../../src/alarm/types';
import { Forecast } from '../../src/weather/types';
import { Routine } from '../../src/routine/types';

const storage = AsyncStorage as any;
beforeEach(() => storage.__reset());

const mondayEvening = new Date(2026, 10, 9, 21, 30); // poniedziałek 21:30
const alarm: Alarm = { id: 'praca', time: '06:30', enabled: true, label: 'Praca', days: WORK_DAYS };

/** Dane testowe: deszczowa prognoza na wtorkowy poranek. */
const rainyMorning: Forecast = {
  timezone: 'Europe/Warsaw',
  current: { time: '2026-11-10T06:00', temp: 4, feels: 1, code: 61, wind: 20, isDay: false, precipitation: 0.5 },
  hourly: [5, 6, 7, 8, 9].map(h => ({
    time: `2026-11-10T0${h}:00`,
    temp: 4,
    precipProb: 55,
    code: 61,
  })),
  daily: [{ date: '2026-11-10', min: 3, max: 8, sunrise: null, sunset: null, precipProbMax: 55, code: 61 }],
};

describe('S1. Poranek w dzień roboczy', () => {
  it('krok 1: wieczorem aplikacja wylicza porę snu i przypomnienie', () => {
    // GIVEN: poniedziałek 21:30, alarm 06:30 Pn–Pt, sen 8 h, przypomnienie 30 min
    const night = currentNight([alarm], DEFAULT_BEDTIME, mondayEvening)!;
    // THEN: pobudka jutro 06:30, spać o 22:30, przypomnienie 22:00
    expect(hm(night.wake)).toBe('06:30');
    expect(night.wake.getDay()).toBe(2); // wtorek
    expect(hm(night.bedtime)).toBe('22:30');
    expect(hm(night.remindAt)).toBe('22:00');
  });

  it('krok 2: alarm dzwoni następnego dnia roboczego o 06:30', () => {
    const next = nextAlarmDate(alarm.time, alarm.days, mondayEvening);
    expect(next.getDay()).toBe(2);
    expect(next.getHours()).toBe(6);
    expect(next.getMinutes()).toBe(30);
    expect(daysLabel(alarm.days)).toBe('Pn–Pt');
  });

  it('krok 3: po pobudce ładuje się właściwy plan, a kroki mają godziny', async () => {
    // GIVEN: zapisane dwa plany — roboczy i weekendowy
    const workPlan: Routine = {
      id: 'plan-praca',
      name: 'Dzień roboczy',
      days: WORK_DAYS,
      tiles: [
        makeTile('alarm', { time: '06:30', durationMin: 5, size: 'large' }),
        makeTile('checklist', { title: 'Do zabrania', durationMin: 5 }),
        makeTile('weather', { durationMin: 5 }),
        makeTile('notes', { durationMin: 10 }),
      ],
      startAfterAlarm: true,
    };
    const weekendPlan: Routine = {
      id: 'plan-weekend',
      name: 'Weekend',
      days: [0, 6],
      tiles: [makeTile('alarm', { time: '09:00', size: 'large' })],
      startAfterAlarm: true,
    };
    await savePlans([workPlan, weekendPlan]);

    // WHEN: wtorek rano — aplikacja wczytuje plany i wybiera plan dnia
    const tuesday = new Date(2026, 10, 10, 6, 30);
    const plans = await loadPlans();
    const plan = planForDate(plans, tuesday)!;

    // THEN: wybrany plan roboczy, kroki mają wyliczone godziny
    expect(plan.name).toBe('Dzień roboczy');
    expect(scheduleTimes(plan.tiles)).toEqual(['06:30', '06:35', '06:40', '06:45']);
  });

  it('krok 4: checklista na nowy dzień jest czysta i podpowiada parasol', () => {
    // GIVEN: wczoraj odhaczono „Klucze"
    const yesterday = { date: '2026-11-09', checked: { chk: ['Klucze'] } };

    // WHEN: nowy dzień
    const today = stateForDay(yesterday, '2026-11-10');

    // THEN: odhaczenia wyzerowane
    expect(isChecked(today, 'chk', 'Klucze')).toBe(false);

    // AND: prognoza z 55% deszczu podpowiada parasol (nie ma go na liście domyślnej)
    const hints = weatherItems(rainyMorning, DEFAULT_CHECKLIST);
    expect(hints).toEqual(['☂ Parasol (55% szans na opady)']);

    // WHEN: użytkownik odhacza elementy
    let s = toggleItem(today, 'chk', 'Klucze');
    s = toggleItem(s, 'chk', 'Portfel');
    expect(isChecked(s, 'chk', 'Klucze')).toBe(true);
    expect(isChecked(s, 'chk', 'Portfel')).toBe(true);
    expect(isChecked(s, 'chk', 'Telefon i ładowarka')).toBe(false);
  });

  it('krok 5: w sobotę ten sam zestaw planów daje plan weekendowy bez wczesnego alarmu', async () => {
    await savePlans([
      { id: 'p1', name: 'Dzień roboczy', days: WORK_DAYS, tiles: [makeTile('alarm', { time: '06:30' })], startAfterAlarm: true },
      { id: 'p2', name: 'Weekend', days: [0, 6], tiles: [makeTile('alarm', { time: '09:00' })], startAfterAlarm: true },
    ]);
    const saturday = new Date(2026, 10, 14, 9, 0);
    const plan = planForDate(await loadPlans(), saturday)!;
    expect(plan.name).toBe('Weekend');
    expect(plan.tiles[0].time).toBe('09:00');

    // Alarm Pn–Pt w sobotę nie dzwoni — najbliższy termin to poniedziałek
    const fridayNight = new Date(2026, 10, 13, 23, 0);
    expect(nextAlarmDate('06:30', WORK_DAYS, fridayNight).getDay()).toBe(1);
  });
});
