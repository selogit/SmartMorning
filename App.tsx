import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  AppState,
  Keyboard,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  TriggerType,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  TimestampTrigger,
  AndroidCategory,
} from '@notifee/react-native';

notifee.onBackgroundEvent(async ({ type }) => {
  console.log('Background event:', type);
});

interface Alarm {
  id: string;
  time: string;
  enabled: boolean;
  label: string;
}

interface EditorState {
  editingId: string | null;
  hours: number;
  minutes: number;
  label: string;
}

const INK = '#111111';
const YELLOW = '#FFD500';
const PAPER = '#E4E4E0';
const WHITE = '#FFFFFF';
const MUTED = '#8A8A84';
const DANGER = '#C62828';
const LINE = 2;
const ALARM_SOUND = 'wake_alarm';
const ALARM_CHANNEL = 'wake_alarm_v2';
const SNOOZE_MINUTES = 5;
const STRIPE_SLOT = 40;
const STRIPE_HEIGHT = 28;

const pad = (n: number) => n.toString().padStart(2, '0');

const timeUntil = (hours: number, minutes: number) => {
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `Zadzwoni za ${m} min`;
  if (m === 0) return `Zadzwoni za ${h} h`;
  return `Zadzwoni za ${h} h ${m} min`;
};

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

interface WheelProps {
  count: number;
  value: number;
  onChange: (v: number) => void;
  onTouchStart?: () => void;
  divided?: boolean;
}

function Wheel({ count, value, onChange, onTouchStart, divided }: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const lastIndex = useRef(value);
  const didInitialScroll = useRef(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const index = Math.min(count - 1, Math.max(0, raw));
    if (index !== lastIndex.current) {
      lastIndex.current = index;
      onChange(index);
    }
  };

  return (
    <View style={[styles.wheel, divided && styles.wheelDivided]}>
      <View pointerEvents="none" style={styles.wheelHighlight} />
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollBeginDrag={onTouchStart}
        onContentSizeChange={() => {
          if (!didInitialScroll.current) {
            didInitialScroll.current = true;
            scrollRef.current?.scrollTo({ y: value * ITEM_HEIGHT, animated: false });
          }
        }}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
      >
        {Array.from({ length: count }, (_, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.6}
            style={styles.wheelItem}
            onPress={() => {
              Keyboard.dismiss();
              scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
            }}
          >
            <Text style={[styles.wheelText, i === value && styles.wheelTextActive]}>
              {pad(i)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

function SquareToggle({ value, onPress }: { value: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}
    >
      <View style={[styles.toggleKnob, value ? styles.toggleKnobOn : styles.toggleKnobOff]} />
    </TouchableOpacity>
  );
}

function HazardStripe() {
  const slots = Math.ceil(Dimensions.get('window').width / STRIPE_SLOT) + 2;
  return (
    <View style={styles.stripe}>
      <View style={styles.stripeRow}>
        {Array.from({ length: slots }, (_, i) => (
          <View key={i} style={styles.stripeSlot}>
            <View style={styles.stripeBar} />
          </View>
        ))}
      </View>
    </View>
  );
}

interface WakeScreenProps {
  alarm: Alarm;
  onSnooze: () => void;
  onStop: () => void;
}

function WakeScreen({ alarm, onSnooze, onStop }: WakeScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      clearInterval(timer);
      loop.stop();
    };
  }, []);

  return (
    <View style={styles.wake}>
      <HazardStripe />

      <View style={styles.wakeBody}>
        <View style={styles.wakeHeader}>
          <View style={styles.wakeStatus}>
            <Animated.View style={[styles.wakeDot, { opacity: blink }]} />
            <Text style={styles.wakeStatusText}>Alarm dzwoni</Text>
          </View>
          <View style={styles.wakeElapsed}>
            <Text style={styles.wakeElapsedText}>
              {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}
            </Text>
          </View>
        </View>

        <View style={styles.wakeTimeCell}>
          <Text style={styles.wakeTime} numberOfLines={1} adjustsFontSizeToFit>
            {alarm.time}
          </Text>
        </View>

        <View style={styles.wakeLabelCell}>
          <Text style={styles.wakeLabel} numberOfLines={2}>
            {alarm.label}
          </Text>
        </View>

        <TouchableOpacity style={styles.snoozeButton} onPress={onSnooze} activeOpacity={0.8}>
          <Text style={styles.snoozeText}>Drzemka {SNOOZE_MINUTES} min</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopButton} onPress={onStop} activeOpacity={0.8}>
          <Text style={styles.stopText}>Wyłącz</Text>
        </TouchableOpacity>
      </View>

      <HazardStripe />
    </View>
  );
}

export default function App() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<Alarm | null>(null);

  const alarmsRef = useRef<Alarm[]>([]);

  const triggerAlarmScreen = (alarmId: string) => {
    const triggered = alarmsRef.current.find(a => a.id === alarmId);
    setActiveAlarm(
      triggered ?? { id: alarmId, time: '??:??', enabled: true, label: 'Pobudka!' }
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

  const loadAlarms = async () => {
    try {
      const stored = await AsyncStorage.getItem('alarms');
      if (stored) {
        const parsed: Alarm[] = JSON.parse(stored);
        alarmsRef.current = parsed;
        setAlarms(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveAlarms = async (newAlarms: Alarm[]) => {
    alarmsRef.current = newAlarms;
    setAlarms(newAlarms);
    await AsyncStorage.setItem('alarms', JSON.stringify(newAlarms));
  };

  const scheduleNotification = async (timeStr: string, label: string, alarmId: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const triggerDate = new Date();
    triggerDate.setHours(hours, minutes, 0, 0);
    if (triggerDate <= new Date()) {
      triggerDate.setDate(triggerDate.getDate() + 1);
    }
    await scheduleAt(triggerDate.getTime(), label, alarmId);
  };

  const scheduleAt = async (timestamp: number, label: string, alarmId: string) => {
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
            fullScreenAction: { id: 'default' },
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
            {
              text: 'Otwórz Ustawienia',
              onPress: async () => await notifee.openAlarmPermissionSettings(),
            },
          ]
        );
      } else {
        console.error('Błąd tworzenia alarmu:', error);
      }
    }
  };

  const openNewAlarm = () => {
    const now = new Date();
    setEditor({
      editingId: null,
      hours: now.getHours(),
      minutes: now.getMinutes(),
      label: '',
    });
  };

  const openEditAlarm = (alarm: Alarm) => {
    const [h, m] = alarm.time.split(':').map(Number);
    setEditor({ editingId: alarm.id, hours: h, minutes: m, label: alarm.label });
  };

  const closeEditor = () => {
    Keyboard.dismiss();
    setEditor(null);
  };

  const saveEditor = async () => {
    if (!editor) return;
    Keyboard.dismiss();

    const time = `${pad(editor.hours)}:${pad(editor.minutes)}`;
    const label = editor.label.trim() || 'Pobudka!';

    if (editor.editingId) {
      const id = editor.editingId;
      await notifee.cancelNotification(id);
      await scheduleNotification(time, label, id);
      const updated = alarmsRef.current.map(a =>
        a.id === id ? { ...a, time, label, enabled: true } : a
      );
      await saveAlarms(updated);
    } else {
      const id = Date.now().toString();
      await scheduleNotification(time, label, id);
      await saveAlarms([...alarmsRef.current, { id, time, label, enabled: true }]);
    }

    setEditor(null);
  };

  const confirmDelete = () => {
    if (!editor?.editingId) return;
    const id = editor.editingId;
    Alert.alert('Usunąć alarm?', 'Tej operacji nie można cofnąć.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          await notifee.cancelNotification(id);
          await saveAlarms(alarmsRef.current.filter(a => a.id !== id));
          setEditor(null);
        },
      },
    ]);
  };

  const toggleAlarm = async (id: string) => {
    const target = alarmsRef.current.find(a => a.id === id);
    if (!target) return;
    const enabled = !target.enabled;

    if (enabled) {
      await scheduleNotification(target.time, target.label, id);
    } else {
      await notifee.cancelNotification(id);
    }

    await saveAlarms(alarmsRef.current.map(a => (a.id === id ? { ...a, enabled } : a)));
  };

  const turnOffAlarm = async () => {
    if (activeAlarm) {
      await notifee.cancelNotification(activeAlarm.id);
      setActiveAlarm(null);
    }
  };

  const snoozeAlarm = async () => {
    if (!activeAlarm) return;
    const { id, label } = activeAlarm;
    setActiveAlarm(null);
    await notifee.cancelNotification(id);
    await scheduleAt(Date.now() + SNOOZE_MINUTES * 60000, label, id);
  };

  const sortedAlarms = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  const activeCount = alarms.filter(a => a.enabled).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={PAPER} />

      <View style={styles.header}>
        <Text style={styles.title}>Budzik</Text>
        <View style={styles.countBox}>
          <Text style={styles.countText}>
            {activeCount}/{alarms.length} aktywne
          </Text>
        </View>
      </View>

      <FlatList
        data={sortedAlarms}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Brak alarmów. Dodaj pierwszy poniżej.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => openEditAlarm(item)}
          >
            <View style={[styles.timeCell, item.enabled && styles.timeCellOn]}>
              <Text style={[styles.rowTime, !item.enabled && styles.dimmed]}>{item.time}</Text>
            </View>
            <View style={styles.labelCell}>
              <Text style={[styles.rowLabel, !item.enabled && styles.dimmed]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
            <View style={styles.toggleCell}>
              <SquareToggle value={item.enabled} onPress={() => toggleAlarm(item.id)} />
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.addBar} onPress={openNewAlarm} activeOpacity={0.85}>
        <Text style={styles.addPlus}>+</Text>
        <Text style={styles.addText}>Dodaj alarm</Text>
      </TouchableOpacity>

      <Modal visible={editor !== null} animationType="slide" onRequestClose={closeEditor}>
        {editor && (
          <SafeAreaView style={styles.editor}>
            <View style={styles.editorHeader}>
              <TouchableOpacity style={styles.headerCellLeft} onPress={closeEditor}>
                <Text style={styles.headerCancel}>Anuluj</Text>
              </TouchableOpacity>
              <View style={styles.headerCellCenter}>
                <Text style={styles.editorTitle}>
                  {editor.editingId ? 'Edytuj alarm' : 'Nowy alarm'}
                </Text>
              </View>
              <TouchableOpacity style={styles.headerCellRight} onPress={saveEditor}>
                <Text style={styles.headerSave}>Zapisz</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              value={editor.label}
              onChangeText={label => setEditor(prev => (prev ? { ...prev, label } : prev))}
              placeholder="Nazwa alarmu (opcjonalnie)"
              placeholderTextColor={MUTED}
              maxLength={40}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              autoCorrect={false}
              selectionColor={INK}
            />

            <View style={styles.untilBar}>
              <Text style={styles.untilText}>{timeUntil(editor.hours, editor.minutes)}</Text>
            </View>

            <View style={styles.wheelsBox}>
              <Wheel
                count={24}
                value={editor.hours}
                onChange={hours => setEditor(prev => (prev ? { ...prev, hours } : prev))}
                onTouchStart={Keyboard.dismiss}
              />
              <Wheel
                count={60}
                value={editor.minutes}
                onChange={minutes => setEditor(prev => (prev ? { ...prev, minutes } : prev))}
                onTouchStart={Keyboard.dismiss}
                divided
              />
            </View>

            {editor.editingId && (
              <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Usuń alarm</Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        )}
      </Modal>

      <Modal visible={activeAlarm !== null} animationType="fade" onRequestClose={() => {}}>
        {activeAlarm && (
          <WakeScreen alarm={activeAlarm} onSnooze={snoozeAlarm} onStop={turnOffAlarm} />
        )}
      </Modal>
    </SafeAreaView>
  );
}

const tabular = ['tabular-nums' as const];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
  },
  title: { fontSize: 36, fontWeight: '900', color: INK, letterSpacing: -1 },
  countBox: {
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: YELLOW,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  countText: { fontSize: 14, fontWeight: '700', color: INK },

  listContent: { padding: 16, paddingBottom: 110 },
  emptyBox: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, padding: 20 },
  emptyText: { fontSize: 16, color: INK },

  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginBottom: -LINE,
  },
  timeCell: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRightWidth: LINE,
    borderRightColor: INK,
    backgroundColor: WHITE,
    justifyContent: 'center',
  },
  timeCellOn: { backgroundColor: YELLOW },
  rowTime: { fontSize: 36, fontWeight: '800', color: INK, fontVariant: tabular },
  labelCell: { flex: 1, paddingHorizontal: 14, justifyContent: 'center' },
  rowLabel: { fontSize: 16, fontWeight: '600', color: INK },
  dimmed: { opacity: 0.35 },
  toggleCell: {
    paddingHorizontal: 12,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    justifyContent: 'center',
    alignItems: 'center',
  },

  toggle: {
    width: 64,
    height: 36,
    borderWidth: LINE,
    borderColor: INK,
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: INK, alignItems: 'flex-end' },
  toggleOff: { backgroundColor: WHITE, alignItems: 'flex-start' },
  toggleKnob: { width: 24, height: 24 },
  toggleKnobOn: { backgroundColor: YELLOW },
  toggleKnobOff: { backgroundColor: INK },

  addBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: YELLOW,
    borderTopWidth: LINE,
    borderTopColor: INK,
  },
  addPlus: { fontSize: 36, fontWeight: '300', color: INK, marginRight: 12, lineHeight: 40 },
  addText: { fontSize: 20, fontWeight: '800', color: INK },

  editor: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: LINE,
    borderBottomColor: INK,
    backgroundColor: WHITE,
  },
  headerCellLeft: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRightWidth: LINE,
    borderRightColor: INK,
    justifyContent: 'center',
  },
  headerCellCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerCellRight: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    backgroundColor: YELLOW,
    justifyContent: 'center',
  },
  editorTitle: { fontSize: 17, fontWeight: '800', color: INK },
  headerCancel: { fontSize: 16, fontWeight: '600', color: INK },
  headerSave: { fontSize: 16, fontWeight: '800', color: INK },

  input: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: LINE,
    borderColor: INK,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: WHITE,
    fontSize: 18,
    fontWeight: '600',
    color: INK,
  },

  untilBar: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: INK,
    paddingVertical: 10,
    alignItems: 'center',
  },
  untilText: { color: YELLOW, fontSize: 15, fontWeight: '700' },

  wheelsBox: {
    marginHorizontal: 16,
    flexDirection: 'row',
    borderWidth: LINE,
    borderTopWidth: 0,
    borderColor: INK,
    backgroundColor: WHITE,
  },
  wheel: { flex: 1, height: WHEEL_HEIGHT },
  wheelDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: 28, fontWeight: '600', color: '#B0B0AA', fontVariant: tabular },
  wheelTextActive: { fontSize: 44, fontWeight: '900', color: INK },
  wheelHighlight: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    backgroundColor: YELLOW,
    borderTopWidth: LINE,
    borderBottomWidth: LINE,
    borderColor: INK,
  },

  deleteButton: {
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: { color: DANGER, fontSize: 16, fontWeight: '800' },

  stripe: {
    height: STRIPE_HEIGHT,
    overflow: 'hidden',
    backgroundColor: YELLOW,
  },
  stripeRow: { flexDirection: 'row', marginLeft: -STRIPE_SLOT / 2 },
  stripeSlot: {
    width: STRIPE_SLOT,
    height: STRIPE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripeBar: {
    width: STRIPE_SLOT / 2 / Math.SQRT2,
    height: 120,
    backgroundColor: INK,
    transform: [{ rotate: '45deg' }],
  },

  wake: { flex: 1, backgroundColor: INK },
  wakeBody: {
    flex: 1,
    margin: 16,
    borderWidth: LINE,
    borderColor: YELLOW,
  },
  wakeHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  wakeStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  wakeDot: { width: 14, height: 14, backgroundColor: YELLOW, marginRight: 10 },
  wakeStatusText: { color: YELLOW, fontSize: 16, fontWeight: '800' },
  wakeElapsed: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderLeftWidth: LINE,
    borderLeftColor: YELLOW,
  },
  wakeElapsedText: { color: YELLOW, fontSize: 18, fontWeight: '700', fontVariant: tabular },
  wakeTimeCell: {
    flex: 1,
    backgroundColor: YELLOW,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  wakeTime: {
    fontSize: 120,
    fontWeight: '900',
    color: INK,
    letterSpacing: -4,
    fontVariant: tabular,
  },
  wakeLabelCell: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderTopWidth: LINE,
    borderTopColor: YELLOW,
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  wakeLabel: { color: WHITE, fontSize: 24, fontWeight: '700' },
  snoozeButton: {
    paddingVertical: 22,
    alignItems: 'center',
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  snoozeText: { color: YELLOW, fontSize: 20, fontWeight: '800' },
  stopButton: { backgroundColor: WHITE, paddingVertical: 32, alignItems: 'center' },
  stopText: { color: INK, fontSize: 30, fontWeight: '900' },
});
