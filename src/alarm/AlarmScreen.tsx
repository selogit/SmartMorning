import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import BackArrow from '../ui/BackArrow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { DEFAULT_CHALLENGE, describeChallenge, normalizeChallenge } from '../challenges/challenges';
import { useAlarms } from './AlarmProvider';
import AlarmEditor from './AlarmEditor';
import { BedtimeRow } from '../sleep/BedtimeCard';
import { Alarm, AlarmDraft } from './types';
import { ALL_DAYS, daysLabel, pad } from './time';

interface EditorState {
  editingId: string | null;
  draft: AlarmDraft;
}

const tabular = ['tabular-nums' as const];

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
      draft: {
        time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
        label: '',
        challenge: { ...DEFAULT_CHALLENGE },
        days: [...ALL_DAYS],
      },
    });
  };

  const openEditAlarm = (alarm: Alarm) =>
    setEditor({
      editingId: alarm.id,
      draft: {
        time: alarm.time,
        label: alarm.label,
        challenge: normalizeChallenge(alarm.challenge),
        days: alarm.days ?? [...ALL_DAYS],
      },
    });

  const saveEditor = async (draft: AlarmDraft) => {
    if (!editor) return;
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
          <BackArrow />
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
        ListHeaderComponent={<BedtimeRow />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Brak alarmów. Dodaj pierwszy poniżej.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const challengeText = [daysLabel(item.days), describeChallenge(item.challenge)].filter(Boolean).join(' · ');
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

      <AlarmEditor
        draft={editor?.draft ?? null}
        title={editor?.editingId ? 'Edytuj alarm' : 'Nowy alarm'}
        onSave={saveEditor}
        onClose={() => setEditor(null)}
        onDelete={editor?.editingId ? confirmDelete : undefined}
      />
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

});
