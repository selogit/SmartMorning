import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  TriggerType,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  TimestampTrigger,
  AndroidCategory,
} from '@notifee/react-native';
import { Alarm, AlarmDraft } from './types';
import { nextAlarmDate } from './time';
import WakeScreen from './WakeScreen';
import { router } from 'expo-router';
import { loadPlans, planForDate } from '../routine/storage';
import { orderedChain } from '../routine/chain';
import { useRoutine } from '../routine/RoutineProvider';
import {
  createAlarmChannel,
  createSilentChannel,
  deleteChannel,
  isAlarmChannelAvailable,
  startAlarmSound,
  stopAlarmSound,
} from '../../modules/alarm-channel';

const STORAGE_KEY = 'alarms';
const ALARM_SOUND = 'wake_alarm';
/** Kanał z dźwiękiem na strumieniu ALARMU (moduł natywny modules/alarm-channel). */
const ALARM_CHANNEL = 'wake_alarm_v3';
/** Stary kanał notifee (strumień powiadomień — milknie przy wyciszonym telefonie). */
const LEGACY_CHANNEL = 'wake_alarm_v2';
const CHANNEL_FLAG_KEY = 'alarmChannel';
/** Cichy kanał dla powiadomienia trwającego alarmu — dźwięk gra wtedy w aplikacji. */
const RINGING_CHANNEL = 'wake_alarm_ringing';
export const SNOOZE_MINUTES = 5;

interface AlarmContextValue {
  alarms: Alarm[];
  /** Czy alarmy zostały już wczytane z pamięci. */
  loaded: boolean;
  /** Zwraca id nowego alarmu. */
  addAlarm: (draft: AlarmDraft) => Promise<string>;
  updateAlarm: (id: string, draft: AlarmDraft) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
}

const AlarmContext = createContext<AlarmContextValue | null>(null);

export function useAlarms() {
  const ctx = useContext(AlarmContext);
  if (!ctx) throw new Error('useAlarms musi być użyte wewnątrz <AlarmProvider>');
  return ctx;
}

/**
 * Kanał alarmu: najpierw natywny (dźwięk jako alarm), a jeśli moduł nie jest wbudowany
 * w aplikację (stary build) — dotychczasowy kanał notifee.
 */
async function ensureAlarmChannel(): Promise<string> {
  if (createAlarmChannel(ALARM_CHANNEL, 'Budzik', ALARM_SOUND)) return ALARM_CHANNEL;
  return notifee.createChannel({
    id: LEGACY_CHANNEL,
    name: 'Budzik',
    importance: AndroidImportance.HIGH,
    sound: ALARM_SOUND,
    vibration: true,
    vibrationPattern: [400, 600, 400, 600],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });
}

async function scheduleAt(timestamp: number, label: string, alarmId: string) {
  try {
    const channelId = await ensureAlarmChannel();

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp,
      alarmManager: { allowWhileIdle: true },
    };

    await notifee.createTriggerNotification(
      {
        id: alarmId,
        title: label || 'Pobudka!',
        body: 'Kliknij, aby wyłączyć',
        data: { alarmId },
        android: {
          channelId,
          category: AndroidCategory.ALARM,
          autoCancel: false,
          ongoing: true,
          loopSound: true,
          lightUpScreen: true,
          fullScreenAction: { id: 'default', launchActivity: 'default' },
          pressAction: { id: 'default' },
        },
      },
      trigger
    );
  } catch (error: any) {
    if (error.message && error.message.includes('exact_alarm_not_permitted')) {
      Alert.alert(
        'Wymagane uprawnienia',
        'Aby budzik wybudzał ekran punktualnie, musisz zezwolić aplikacji na "Ustawianie dokładnych alarmów" w ustawieniach systemu.',
        [
          { text: 'Anuluj' },
          { text: 'Otwórz Ustawienia', onPress: async () => await notifee.openAlarmPermissionSettings() },
        ]
      );
    } else {
      console.error('Błąd tworzenia alarmu:', error);
    }
  }
}

const scheduleNotification = (time: string, label: string, alarmId: string, days?: number[]) =>
  scheduleAt(nextAlarmDate(time, days).getTime(), label, alarmId);

/**
 * Trzyma stan alarmów i ekran pobudki na poziomie całej aplikacji,
 * więc alarm przejmuje ekran niezależnie od otwartego modułu.
 */
export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const [loaded, setLoaded] = useState(false);
  const alarmsRef = useRef<Alarm[]>([]);
  const { updateAllPlans, loaded: routineLoaded } = useRoutine();

  const triggerAlarmScreen = (alarmId: string) => {
    const triggered = alarmsRef.current.find(a => a.id === alarmId);
    setActiveAlarm(prev =>
      prev?.id === alarmId
        ? prev
        : triggered ?? { id: alarmId, time: '??:??', enabled: true, label: 'Pobudka!' }
    );
  };

  const checkActiveAlarms = async () => {
    const displayed = await notifee.getDisplayedNotifications();
    const alarmNotif = displayed.find(n => n.notification.data?.alarmId);
    if (alarmNotif?.notification.data?.alarmId) {
      triggerAlarmScreen(alarmNotif.notification.data.alarmId as string);
    }
  };

  const checkIfOpenedByAlarm = async () => {
    const initial = await notifee.getInitialNotification();
    if (initial?.notification?.data?.alarmId) {
      triggerAlarmScreen(initial.notification.data.alarmId as string);
    }
  };

  const loadAlarms = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: Alarm[] = JSON.parse(stored);
        alarmsRef.current = parsed;
        setAlarms(parsed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoaded(true);
    }
  };

  /**
   * Jednorazowo przenosi włączone alarmy na nowy kanał (dźwięk jako alarm) i usuwa stary kanał.
   * Pomijane, gdy moduł natywny nie jest wbudowany albo alarm właśnie dzwoni.
   */
  const migrateChannel = async () => {
    if (!isAlarmChannelAvailable) return;
    if ((await AsyncStorage.getItem(CHANNEL_FLAG_KEY)) === ALARM_CHANNEL) return;
    const displayed = await notifee.getDisplayedNotifications();
    if (displayed.some(n => n.notification.data?.alarmId)) return;
    for (const a of alarmsRef.current.filter(x => x.enabled)) {
      await scheduleNotification(a.time, a.label, a.id, a.days);
    }
    deleteChannel(LEGACY_CHANNEL);
    await AsyncStorage.setItem(CHANNEL_FLAG_KEY, ALARM_CHANNEL);
  };

  /**
   * Każdy włączony alarm musi mieć zaplanowane powiadomienie. Naprawia alarmy, które już raz zadzwoniły
   * (wcześniej planowane jednorazowo) i takie, których system nie dostarczył.
   */
  const ensureScheduled = async () => {
    const pending = new Set(await notifee.getTriggerNotificationIds());
    const displayed = new Set(
      (await notifee.getDisplayedNotifications()).map(n => n.notification.data?.alarmId).filter(Boolean)
    );
    for (const a of alarmsRef.current) {
      if (a.enabled && !pending.has(a.id) && !displayed.has(a.id)) {
        await scheduleNotification(a.time, a.label, a.id, a.days);
      }
    }
  };

  const saveAlarms = async (next: Alarm[]) => {
    alarmsRef.current = next;
    setAlarms(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    (async () => {
      try {
        await notifee.requestPermission();
        await loadAlarms();
        await checkIfOpenedByAlarm();
        await checkActiveAlarms();
        await migrateChannel();
        await ensureScheduled();
      } catch (e) {
        console.error(e);
      }
    })();

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') checkActiveAlarms().catch(console.error);
    });

    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.ACTION_PRESS) {
        if (detail.notification?.data?.alarmId) {
          triggerAlarmScreen(detail.notification.data.alarmId as string);
        }
      }
    });

    return () => {
      appStateSub.remove();
      unsubscribe();
    };
  }, []);

  // Kafelki Budzik w planie dnia mają godzinę i nazwę swojego alarmu; usunięty alarm odłącza kafelek.
  useEffect(() => {
    if (!loaded || !routineLoaded) return;
    updateAllPlans(r => {
      let changed = false;
      const tiles = r.tiles.map(t => {
        if (t.kind !== 'alarm' || !t.alarmId) return t;
        const a = alarms.find(x => x.id === t.alarmId);
        if (!a) {
          changed = true;
          return { ...t, alarmId: undefined };
        }
        if (t.time === a.time && t.title === a.label) return t;
        changed = true;
        return { ...t, time: a.time, title: a.label };
      });
      return changed ? { ...r, tiles } : r;
    });
  }, [alarms, loaded, routineLoaded]);

  const addAlarm = async ({ time, label, challenge, days }: AlarmDraft) => {
    const id = Date.now().toString();
    await scheduleNotification(time, label, id, days);
    await saveAlarms([...alarmsRef.current, { id, time, label, challenge, days, enabled: true }]);
    return id;
  };

  const updateAlarm = async (id: string, { time, label, challenge, days }: AlarmDraft) => {
    await notifee.cancelNotification(id);
    await scheduleNotification(time, label, id, days);
    await saveAlarms(
      alarmsRef.current.map(a => (a.id === id ? { ...a, time, label, challenge, days, enabled: true } : a))
    );
  };

  const deleteAlarm = async (id: string) => {
    await notifee.cancelNotification(id);
    await saveAlarms(alarmsRef.current.filter(a => a.id !== id));
  };

  const toggleAlarm = async (id: string) => {
    const target = alarmsRef.current.find(a => a.id === id);
    if (!target) return;
    const enabled = !target.enabled;
    if (enabled) await scheduleNotification(target.time, target.label, id, target.days);
    else await notifee.cancelNotification(id);
    await saveAlarms(alarmsRef.current.map(a => (a.id === id ? { ...a, enabled } : a)));
  };

  /**
   * Gdy pojawia się ekran pobudki, dźwięk przejmuje aplikacja (pętla na strumieniu alarmu),
   * a powiadomienie przechodzi na cichy kanał. Dźwięku powiadomienia Android nie gwarantuje —
   * milknie po dotknięciu powiadomienia lub rozwinięciu panelu; dźwięk aplikacji gra do końca zadań.
   */
  useEffect(() => {
    if (!activeAlarm) return;
    const ringing = activeAlarm;
    if (!startAlarmSound(ALARM_SOUND)) return; // stary build bez modułu — zostaje dźwięk powiadomienia
    if (!createSilentChannel(RINGING_CHANNEL, 'Budzik — trwający alarm')) return;
    notifee
      .displayNotification({
        id: ringing.id,
        title: ringing.label || 'Pobudka!',
        body: 'Alarm dzwoni — wykonaj zadania w aplikacji, aby go wyłączyć',
        data: { alarmId: ringing.id },
        android: {
          channelId: RINGING_CHANNEL,
          category: AndroidCategory.ALARM,
          ongoing: true,
          autoCancel: false,
          pressAction: { id: 'default' },
        },
      })
      .catch(e => console.warn('Nie udało się wyciszyć powiadomienia alarmu', e));
  }, [activeAlarm?.id]);

  const turnOffAlarm = async () => {
    if (!activeAlarm) return;
    stopAlarmSound();
    await notifee.cancelNotification(activeAlarm.id);
    setActiveAlarm(null);
    // Alarm powtarzany — zaplanuj następne dzwonienie; jednorazowy — wyłącz.
    const alarm = alarmsRef.current.find(a => a.id === activeAlarm.id);
    if (alarm?.enabled) {
      if (alarm.days && alarm.days.length === 0) {
        await saveAlarms(alarmsRef.current.map(a => (a.id === alarm.id ? { ...a, enabled: false } : a)));
      } else {
        await scheduleNotification(alarm.time, alarm.label, alarm.id, alarm.days);
      }
    }
    // Plan dnia zaczynający się od budzika rusza dalej sam.
    try {
      // Plan, który zaczyna się od kafelka tego alarmu; jeśli brak — plan na dziś.
      const plans = await loadPlans();
      const plan = plans.find(p => orderedChain(p)[0]?.alarmId === activeAlarm.id) ?? planForDate(plans);
      const chain = plan ? orderedChain(plan) : [];
      if (plan && plan.startAfterAlarm && chain[0]?.kind === 'alarm' && chain.length > 1) {
        router.push(`/plan-run?afterAlarm=1&plan=${plan.id}`);
      }
    } catch (e) {
      console.warn('Nie udało się uruchomić planu dnia', e);
    }
  };

  const snoozeAlarm = async () => {
    if (!activeAlarm) return;
    const { id, label } = activeAlarm;
    stopAlarmSound();
    setActiveAlarm(null);
    await notifee.cancelNotification(id);
    await scheduleAt(Date.now() + SNOOZE_MINUTES * 60000, label, id);
  };

  return (
    <AlarmContext.Provider value={{ alarms, loaded, addAlarm, updateAlarm, deleteAlarm, toggleAlarm }}>
      {children}
      <Modal visible={activeAlarm !== null} animationType="fade" onRequestClose={() => {}}>
        {activeAlarm && (
          <WakeScreen
            alarm={activeAlarm}
            snoozeMinutes={SNOOZE_MINUTES}
            onSnooze={snoozeAlarm}
            onStop={turnOffAlarm}
          />
        )}
      </Modal>
    </AlarmContext.Provider>
  );
}
