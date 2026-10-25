import React, { useRef, useState } from 'react';
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
  Keyboard,
  ScrollView,
  StatusBar,
  SafeAreaView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import {
  ChallengeConfig,
  DEFAULT_CHALLENGE,
  DEFAULT_PHRASE,
  describeChallenge,
  normalizeChallenge,
} from '../challenges/challenges';
import ChallengePicker from '../challenges/ChallengePicker';
import { useAlarms } from './AlarmProvider';
import { Alarm } from './types';
import { pad, parseTime, timeUntil } from './time';

interface EditorState {
  editingId: string | null;
  hours: number;
  minutes: number;
  label: string;
  challenge: ChallengeConfig;
}

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
            <Text style={[styles.wheelText, i === value && styles.wheelTextActive]}>{pad(i)}</Text>
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

export default function AlarmScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { alarms, addAlarm, updateAlarm, deleteAlarm, toggleAlarm } = useAlarms();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openNewAlarm = () => {
    const now = new Date();
    setEditor({
      editingId: null,
      hours: now.getHours(),
      minutes: now.getMinutes(),
      label: '',
      challenge: { ...DEFAULT_CHALLENGE },
    });
  };

  const openEditAlarm = (alarm: Alarm) => {
    const [h, m] = parseTime(alarm.time);
    setEditor({
      editingId: alarm.id,
      hours: h,
      minutes: m,
      label: alarm.label,
      challenge: normalizeChallenge(alarm.challenge),
    });
  };

  const closeEditor = () => {
    Keyboard.dismiss();
    setEditor(null);
  };

  const saveEditor = async () => {
    if (!editor) return;
    Keyboard.dismiss();
    const draft = {
      time: `${pad(editor.hours)}:${pad(editor.minutes)}`,
      label: editor.label.trim() || 'Pobudka!',
      challenge: {
        ...editor.challenge,
        phrase: editor.challenge.phrase.trim() || DEFAULT_PHRASE,
      },
    };
    if (editor.editingId) await updateAlarm(editor.editingId, draft);
    else await addAlarm(draft);
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
          await deleteAlarm(id);
          setEditor(null);
        },
      },
    ]);
  };

  const sortedAlarms = [...alarms].sort((a, b) => a.time.localeCompare(b.time));
  const activeCount = alarms.filter(a => a.enabled).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goHome} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
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
        contentContainerStyle={[styles.listContent, { paddingBottom: 110 + bottomInset }]}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Brak alarmów. Dodaj pierwszy poniżej.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const challengeText = describeChallenge(item.challenge);
          return (
            <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => openEditAlarm(item)}>
              <View style={[styles.timeCell, item.enabled && styles.timeCellOn]}>
                <Text style={[styles.rowTime, !item.enabled && styles.dimmed]}>{item.time}</Text>
              </View>
              <View style={styles.labelCell}>
                <Text style={[styles.rowLabel, !item.enabled && styles.dimmed]} numberOfLines={1}>
                  {item.label}
                </Text>
                {challengeText && (
                  <Text style={[styles.rowChallenge, !item.enabled && styles.dimmed]} numberOfLines={1}>
                    {challengeText}
                  </Text>
                )}
              </View>
              <View style={styles.toggleCell}>
                <SquareToggle value={item.enabled} onPress={() => toggleAlarm(item.id)} />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.addBar, { height: 72 + bottomInset, paddingBottom: bottomInset }]}
        onPress={openNewAlarm}
        activeOpacity={0.85}
      >
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
                <Text style={styles.editorTitle}>{editor.editingId ? 'Edytuj alarm' : 'Nowy alarm'}</Text>
              </View>
              <TouchableOpacity style={styles.headerCellRight} onPress={saveEditor}>
                <Text style={styles.headerSave}>Zapisz</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.editorScroll, { paddingBottom: 32 + bottomInset }]} keyboardShouldPersistTaps="handled">
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

              <ChallengePicker
                value={editor.challenge}
                onChange={challenge => setEditor(prev => (prev ? { ...prev, challenge } : prev))}
              />

              {editor.editingId && (
                <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete}>
                  <Text style={styles.deleteText}>Usuń alarm</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 22, fontWeight: '900', color: INK, marginTop: -2 },
  title: { flex: 1, fontSize: 36, fontWeight: '900', color: INK, letterSpacing: -1 },
  countBox: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, paddingHorizontal: 10, paddingVertical: 6 },
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
  rowChallenge: { fontSize: 12, fontWeight: '700', color: MUTED, marginTop: 3 },
  dimmed: { opacity: 0.35 },
  toggleCell: {
    paddingHorizontal: 12,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    justifyContent: 'center',
    alignItems: 'center',
  },

  toggle: { width: 64, height: 36, borderWidth: LINE, borderColor: INK, padding: 3, justifyContent: 'center' },
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
