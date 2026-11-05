import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
  Keyboard,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { ChallengeConfig, DEFAULT_PHRASE } from '../challenges/challenges';
import ChallengePicker from '../challenges/ChallengePicker';
import { AlarmDraft } from './types';
import { ALL_DAYS, DAY_ORDER, DAY_SHORT, WEEKEND_DAYS, WORK_DAYS, alarmTimeUntil, pad, parseTime } from './time';

const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const tabular = ['tabular-nums' as const];

interface WheelProps {
  count: number;
  value: number;
  onChange: (v: number) => void;
  onTouchStart?: () => void;
  divided?: boolean;
}

function Wheel({ count, value, onChange, onTouchStart, divided }: WheelProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
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
    <View style={[s.wheel, divided && s.wheelDivided]}>
      <View pointerEvents="none" style={s.wheelHighlight} />
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
            style={s.wheelItem}
            onPress={() => {
              Keyboard.dismiss();
              scrollRef.current?.scrollTo({ y: i * ITEM_HEIGHT, animated: true });
            }}
          >
            <Text style={[s.wheelText, i === value && s.wheelTextActive]}>{pad(i)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export interface AlarmEditorProps {
  /** Dane początkowe; null = edytor zamknięty. */
  draft: AlarmDraft | null;
  title: string;
  onSave: (draft: AlarmDraft) => void | Promise<void>;
  onClose: () => void;
  /** Przycisk „Usuń alarm” na dole (tylko przy edycji istniejącego alarmu). */
  onDelete?: () => void;
  /** Dodatkowa treść nad polami alarmu (np. wybór istniejącego alarmu dla kafelka). */
  header?: React.ReactNode;
  /** Dodatkowa treść pod zadaniami (np. czas trwania kroku w planie). */
  footer?: React.ReactNode;
}

/**
 * Jeden edytor alarmu dla całej aplikacji: ekran Budzik i kafelek Budzik na planszy planu dnia.
 */
export default function AlarmEditor(props: AlarmEditorProps) {
  const { draft, onClose } = props;
  return (
    <Modal visible={draft !== null} animationType="slide" onRequestClose={onClose}>
      {draft && <EditorBody {...props} draft={draft} />}
    </Modal>
  );
}

function EditorBody({ draft, title, onSave, onClose, onDelete, header, footer }: AlarmEditorProps & { draft: AlarmDraft }) {
  const bottomInset = useSafeAreaInsets().bottom;
  const [initialH, initialM] = parseTime(draft.time);
  const [hours, setHours] = useState(initialH);
  const [minutes, setMinutes] = useState(initialM);
  const [label, setLabel] = useState(draft.label);
  const [challenge, setChallenge] = useState<ChallengeConfig>(draft.challenge);
  const [days, setDays] = useState<number[]>(draft.days);
  const time = `${pad(hours)}:${pad(minutes)}`;

  const toggleDay = (d: number) =>
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()));
  const presets: { label: string; days: number[] }[] = [
    { label: 'Codziennie', days: ALL_DAYS },
    { label: 'Pn–Pt', days: WORK_DAYS },
    { label: 'Weekend', days: WEEKEND_DAYS },
    { label: 'Jednorazowo', days: [] },
  ];
  const isPreset = (p: number[]) => p.length === days.length && p.every(d => days.includes(d));
  const [saving, setSaving] = useState(false);

  const close = () => {
    Keyboard.dismiss();
    onClose();
  };

  const save = async () => {
    if (saving) return;
    if (challenge.types.includes('qr') && !challenge.qrValue) {
      Alert.alert('Brak kodu', 'Zeskanuj swój kod w zadaniu „Kod QR” albo odznacz to zadanie.');
      return;
    }
    Keyboard.dismiss();
    setSaving(true);
    try {
      await onSave({
        time,
        label: label.trim() || 'Pobudka!',
        days,
        challenge: { ...challenge, phrase: challenge.phrase.trim() || DEFAULT_PHRASE },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.editor}>
      <View style={s.editorHeader}>
        <TouchableOpacity style={s.headerCellLeft} onPress={close}>
          <Text style={s.headerCancel}>Anuluj</Text>
        </TouchableOpacity>
        <View style={s.headerCellCenter}>
          <Text style={s.editorTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <TouchableOpacity style={[s.headerCellRight, saving && s.disabled]} onPress={save} disabled={saving}>
          <Text style={s.headerSave}>Zapisz</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[s.editorScroll, { paddingBottom: 32 + bottomInset }]}
        keyboardShouldPersistTaps="handled"
      >
        {header}

        <TextInput
          style={s.input}
          value={label}
          onChangeText={setLabel}
          placeholder="Nazwa alarmu (opcjonalnie)"
          placeholderTextColor={MUTED}
          maxLength={40}
          returnKeyType="done"
          blurOnSubmit
          onSubmitEditing={Keyboard.dismiss}
          autoCorrect={false}
          selectionColor={INK}
        />

        <View style={s.untilBar}>
          <Text style={s.untilText}>{alarmTimeUntil(time, days)}</Text>
        </View>

        <View style={s.wheelsBox}>
          <Wheel count={24} value={hours} onChange={setHours} onTouchStart={Keyboard.dismiss} />
          <Wheel count={60} value={minutes} onChange={setMinutes} onTouchStart={Keyboard.dismiss} divided />
        </View>

        <View style={s.daysBox}>
          <View style={s.daysBar}>
            <Text style={s.daysTitle}>Powtarzanie</Text>
          </View>
          <View style={s.dayRow}>
            {DAY_ORDER.map((d, i) => {
              const on = days.includes(d);
              return (
                <TouchableOpacity
                  key={d}
                  style={[s.day, i > 0 && s.dayDivided, on && s.dayOn]}
                  onPress={() => toggleDay(d)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dayText, on && s.dayTextOn]}>{DAY_SHORT[d]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.presetRow}>
            {presets.map((p, i) => {
              const on = isPreset(p.days);
              return (
                <TouchableOpacity
                  key={p.label}
                  style={[s.preset, i > 0 && s.dayDivided, on && s.presetOn]}
                  onPress={() => setDays([...p.days])}
                  activeOpacity={0.7}
                >
                  <Text style={[s.presetText, on && s.presetTextOn]} numberOfLines={1}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {days.length === 0 && (
            <Text style={s.daysHint}>Alarm zadzwoni raz i sam się wyłączy.</Text>
          )}
        </View>

        <ChallengePicker value={challenge} onChange={setChallenge} />

        {footer}

        {onDelete && (
          <TouchableOpacity style={s.deleteButton} onPress={onDelete}>
            <Text style={s.deleteText}>Usuń alarm</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  headerCellCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  headerCellRight: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    backgroundColor: YELLOW,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  editorTitle: { fontSize: 17, fontWeight: '800', color: INK },
  headerCancel: { fontSize: 16, fontWeight: '600', color: INK },
  headerSave: { fontSize: 16, fontWeight: '800', color: INK },
  editorScroll: { paddingBottom: 32 },

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

  daysBox: { marginHorizontal: 16, marginTop: 16, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  daysBar: { backgroundColor: INK, paddingHorizontal: 14, paddingVertical: 10 },
  daysTitle: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  dayRow: { flexDirection: 'row' },
  day: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  dayDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  dayOn: { backgroundColor: YELLOW },
  dayText: { fontSize: 15, fontWeight: '800', color: MUTED },
  dayTextOn: { color: INK, fontWeight: '900' },
  presetRow: { flexDirection: 'row', borderTopWidth: LINE, borderTopColor: INK },
  preset: { flex: 1, paddingVertical: 10, alignItems: 'center', paddingHorizontal: 2 },
  presetOn: { backgroundColor: INK },
  presetText: { fontSize: 12, fontWeight: '800', color: INK },
  presetTextOn: { color: YELLOW },
  daysHint: { fontSize: 13, color: MUTED, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: LINE, borderTopColor: INK },

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
});
