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
import { nextOccurrence, parseTime } from './time';
import WakeScreen from './WakeScreen';
import { router } from 'expo-router';
import { loadRoutine } from '../routine/storage';
import { orderedChain } from '../routine/chain';

const STORAGE_KEY = 'alarms';
const ALARM_SOUND = 'wake_alarm';
const ALARM_CHANNEL = 'wake_alarm_v2';
export const SNOOZE_MINUTES = 5;

interface AlarmContextValue {
  alarms: Alarm[];
  addAlarm: (draft: AlarmDraft) => Promise<void>;
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

async function scheduleAt(timestamp: number, label: string, alarmId: string) {
  try {
    const channelId = await notifee.createChannel({
      id: ALARM_CHANNEL,
      name: 'Budzik',
      importance: AndroidImportance.HIGH,
      sound: ALARM_SOUND,
      vibration: true,
      vibrationPattern: [400, 600, 400, 600],
      bypassDnd: true,
      visibility: AndroidVisibility.PUBLIC,
    });

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

const scheduleNotification = (time: string, label: string, alarmId: string) =>
  scheduleAt(nextOccurrence(...parseTime(time)).getTime(), label, alarmId);

/**
 * Trzyma stan alarmów i ekran pobudki na poziomie całej aplikacji,
 * więc alarm przejmuje ekran niezależnie od otwartego modułu.
 */
export function AlarmProvider({ children }: { children: React.ReactNode }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);
  const alarmsRef = useRef<Alarm[]>([]);

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

  const addAlarm = async ({ time, label, challenge }: AlarmDraft) => {
    const id = Date.now().toString();
    await scheduleNotification(time, label, id);
    await saveAlarms([...alarmsRef.current, { id, time, label, challenge, enabled: true }]);
  };

  const updateAlarm = async (id: string, { time, label, challenge }: AlarmDraft) => {
    await notifee.cancelNotification(id);
    await scheduleNotification(time, label, id);
    await saveAlarms(
      alarmsRef.current.map(a => (a.id === id ? { ...a, time, label, challenge, enabled: true } : a))
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
    if (enabled) await scheduleNotification(target.time, target.label, id);
    else await notifee.cancelNotification(id);
    await saveAlarms(alarmsRef.current.map(a => (a.id === id ? { ...a, enabled } : a)));
  };

  const turnOffAlarm = async () => {
    if (!activeAlarm) return;
    await notifee.cancelNotification(activeAlarm.id);
    setActiveAlarm(null);
    // Plan dnia zaczynający się od budzika rusza dalej sam.
    try {
      const routine = await loadRoutine();
      const chain = orderedChain(routine);
      if (routine.startAfterAlarm && chain[0]?.kind === 'alarm' && chain.length > 1) {
        router.push('/plan-run?afterAlarm=1');
      }
    } catch (e) {
      console.warn('Nie udało się uruchomić planu dnia', e);
    }
  };

  const snoozeAlarm = async () => {
    if (!activeAlarm) return;
    const { id, label } = activeAlarm;
    setActiveAlarm(null);
    await notifee.cancelNotification(id);
    await scheduleAt(Date.now() + SNOOZE_MINUTES * 60000, label, id);
  };

  return (
    <AlarmContext.Provider value={{ alarms, addAlarm, updateAlarm, deleteAlarm, toggleAlarm }}>
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
