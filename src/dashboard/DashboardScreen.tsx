import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, SafeAreaView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, LINE } from '../theme';
import { useAlarms } from '../alarm/AlarmProvider';
import { formatDuration, nextOccurrence, pad, parseTime } from '../alarm/time';
import { describeChallenge } from '../challenges/challenges';
import { useRoutine } from '../routine/RoutineProvider';
import { orderedChain, scheduleTimes } from '../routine/chain';
import { kindInfo } from '../routine/tileKinds';
import { notesForDay, todayKey, useNotes } from '../notes/NotesProvider';
import { plainText } from '../notes/markdown';
import { noteTitle } from '../notes/NotesListScreen';
import { openTodayNote } from '../notes/today';
import WeatherCard from '../weather/WeatherCard';

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];
const tabular = ['tabular-nums' as const];

const greetingFor = (h: number) =>
  h < 5 ? 'Dobranoc' : h < 12 ? 'Dzień dobry' : h < 18 ? 'Miłego dnia' : 'Dobry wieczór';

export default function DashboardScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { alarms } = useAlarms();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const next = useMemo(() => {
    const upcoming = alarms
      .filter(a => a.enabled)
      .map(alarm => ({ alarm, at: nextOccurrence(...parseTime(alarm.time), now) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    return upcoming[0] ?? null;
  }, [alarms, now]);

  const { routine } = useRoutine();
  const chain = useMemo(() => orderedChain(routine), [routine]);
  const times = useMemo(() => scheduleTimes(chain), [chain]);
  const { notes, createNote } = useNotes();
  const todayNotes = useMemo(() => notesForDay(notes, todayKey(now)), [notes, now]);

  const newNote = () => {
    const note = createNote('');
    router.push(`/notes/${note.id}?edit=1`);
  };

  const challengeText = next ? describeChallenge(next.alarm.challenge) : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 32 + bottomInset }]}>
        <View style={styles.hero}>
          <View style={styles.clockCell}>
            <Text style={styles.clock} numberOfLines={1} adjustsFontSizeToFit>
              {pad(now.getHours())}:{pad(now.getMinutes())}
            </Text>
          </View>
          <View style={styles.greetingCell}>
            <Text style={styles.greeting}>{greetingFor(now.getHours())}</Text>
            <Text style={styles.date}>
              {WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
            </Text>
          </View>
        </View>

        <View style={styles.weatherBox}>
          <WeatherCard onPress={() => router.push('/weather')} />
        </View>

        <TouchableOpacity style={styles.nextCard} activeOpacity={0.8} onPress={() => router.push('/alarm')}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextHeaderText}>Najbliższy alarm</Text>
            <Text style={styles.nextHeaderArrow}>→</Text>
          </View>
          {next ? (
            <View style={styles.nextBody}>
              <Text style={styles.nextTime}>{next.alarm.time}</Text>
              <View style={styles.nextInfo}>
                <Text style={styles.nextIn}>za {formatDuration(next.at.getTime() - now.getTime())}</Text>
                <Text style={styles.nextLabel} numberOfLines={1}>
                  {next.alarm.label}
                </Text>
                {challengeText && (
                  <Text style={styles.nextChallenge} numberOfLines={1}>
                    {challengeText}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.nextBody}>
              <Text style={styles.nextEmpty}>Brak aktywnych alarmów — dotknij, aby ustawić pobudkę.</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.sectionBar}>
          <Text style={styles.sectionTitle}>Notatki na dziś</Text>
          <Text style={styles.sectionCount}>{todayNotes.length}</Text>
        </View>
        <View style={styles.notesBox}>
          {todayNotes.length === 0 ? (
            <Text style={styles.notesEmpty}>
              Nic na dziś. W notatce wybierz „Pokaż na ekranie głównym”, żeby pojawiła się tutaj wybranego dnia.
            </Text>
          ) : (
            todayNotes.map((n, i) => {
              const preview = n.body
                .split('\n')
                .map(l => plainText(l).trim())
                .filter(Boolean)
                .slice(1, 3)
                .join(' · ');
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.noteRow, i > 0 && styles.noteRowDivided]}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/notes/${n.id}`)}
                >
                  <Text style={styles.noteTitle} numberOfLines={1}>
                    {noteTitle(n.body)}
                  </Text>
                  {preview ? (
                    <Text style={styles.notePreview} numberOfLines={2}>
                      {preview}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
        <View style={styles.planActions}>
          <TouchableOpacity
            style={[styles.notesOpen, styles.notesToday]}
            activeOpacity={0.8}
            onPress={() => openTodayNote(notes, createNote)}
          >
            <Text style={styles.notesButtonText}>Notatka na dziś</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.notesOpen, styles.notesDivided]}
            activeOpacity={0.8}
            onPress={() => router.push('/notes')}
          >
            <Text style={styles.notesButtonText}>Wszystkie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.notesOpen, styles.notesDivided]} activeOpacity={0.8} onPress={newNote}>
            <Text style={styles.notesButtonText}>+ Nowa</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionBar}>
          <Text style={styles.sectionTitle}>Plan dnia</Text>
          <Text style={styles.sectionCount}>
            {chain.length} {chain.length === 1 ? 'krok' : chain.length < 5 && chain.length > 1 ? 'kroki' : 'kroków'}
          </Text>
        </View>

        <TouchableOpacity style={styles.plan} activeOpacity={0.85} onPress={() => router.push('/plan')}>
          {chain.length === 0 ? (
            <Text style={styles.planEmpty}>Plan jest pusty — ułóż kafelki na planszy.</Text>
          ) : (
            chain.map((t, i) => {
              const info = kindInfo(t.kind);
              return (
                <View key={t.id} style={styles.planRow}>
                  <View style={styles.planRail}>
                    <View style={[styles.planDot, info.category === 'module' && styles.planDotModule]} />
                    {i < chain.length - 1 && <View style={styles.planLine} />}
                  </View>
                  <Text style={styles.planTime}>{times[i] ?? '—'}</Text>
                  <View style={styles.planInfo}>
                    <Text style={styles.planTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    {t.durationMin ? <Text style={styles.planMeta}>{t.durationMin} min</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </TouchableOpacity>

        <View style={styles.planActions}>
          <TouchableOpacity style={styles.planEdit} activeOpacity={0.8} onPress={() => router.push('/plan')}>
            <Text style={styles.planEditText}>Edytuj planszę</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.planRun, chain.length === 0 && styles.disabled]}
            activeOpacity={0.8}
            disabled={chain.length === 0}
            onPress={() => router.push('/plan-run')}
          >
            <Text style={styles.planRunText}>▶ Uruchom</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  scroll: { padding: 16, paddingBottom: 32 },

  hero: { flexDirection: 'row', borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  clockCell: {
    backgroundColor: YELLOW,
    borderRightWidth: LINE,
    borderRightColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
    minWidth: 150,
  },
  clock: { fontSize: 52, fontWeight: '900', color: INK, letterSpacing: -2, fontVariant: tabular },
  greetingCell: { flex: 1, paddingHorizontal: 14, justifyContent: 'center' },
  greeting: { fontSize: 22, fontWeight: '900', color: INK },
  date: { fontSize: 14, fontWeight: '600', color: MUTED, marginTop: 2 },

  weatherBox: { marginTop: 16, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, padding: 14 },
  nextCard: { marginTop: 16, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  nextHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  nextHeaderText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  nextHeaderArrow: { color: YELLOW, fontSize: 18, fontWeight: '900' },
  nextBody: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  nextTime: { fontSize: 44, fontWeight: '900', color: INK, fontVariant: tabular, marginRight: 14 },
  nextInfo: { flex: 1 },
  nextIn: { fontSize: 16, fontWeight: '800', color: INK },
  nextLabel: { fontSize: 14, fontWeight: '600', color: INK, marginTop: 2 },
  nextChallenge: { fontSize: 12, fontWeight: '700', color: MUTED, marginTop: 2 },
  nextEmpty: { fontSize: 15, fontWeight: '600', color: INK, flex: 1 },

  sectionBar: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionTitle: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  sectionCount: { color: '#BDBDB6', fontSize: 13, fontWeight: '700' },

  notesBox: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  notesEmpty: { fontSize: 14, fontWeight: '600', color: MUTED, padding: 14, lineHeight: 20 },
  noteRow: { paddingHorizontal: 14, paddingVertical: 12 },
  noteRowDivided: { borderTopWidth: LINE, borderTopColor: INK },
  noteTitle: { fontSize: 17, fontWeight: '900', color: INK },
  notePreview: { fontSize: 13, fontWeight: '600', color: MUTED, marginTop: 2 },
  notesOpen: { flex: 1, backgroundColor: WHITE, paddingVertical: 14, alignItems: 'center' },
  notesToday: { flex: 1.4, backgroundColor: YELLOW },
  notesDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  notesButtonText: { fontSize: 14, fontWeight: '900', color: INK },
  plan: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, paddingVertical: 8 },
  planEmpty: { fontSize: 15, fontWeight: '600', color: INK, padding: 14 },
  planRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 46, paddingHorizontal: 14 },
  planRail: { width: 18, alignItems: 'center' },
  planDot: { width: 14, height: 14, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, marginTop: 14 },
  planDotModule: { backgroundColor: YELLOW },
  planLine: { flex: 1, width: LINE, backgroundColor: INK },
  planTime: { width: 56, marginLeft: 8, fontSize: 16, fontWeight: '900', color: INK, paddingTop: 11, fontVariant: tabular },
  planInfo: { flex: 1, paddingTop: 11, paddingBottom: 6 },
  planTitle: { fontSize: 16, fontWeight: '800', color: INK },
  planMeta: { fontSize: 12, fontWeight: '700', color: MUTED, marginTop: 1 },
  planActions: { flexDirection: 'row', borderWidth: LINE, borderTopWidth: 0, borderColor: INK },
  planEdit: { flex: 1, backgroundColor: YELLOW, paddingVertical: 16, alignItems: 'center' },
  planEditText: { fontSize: 16, fontWeight: '900', color: INK },
  planRun: {
    flex: 1,
    backgroundColor: INK,
    paddingVertical: 16,
    alignItems: 'center',
    borderLeftWidth: LINE,
    borderLeftColor: INK,
  },
  planRunText: { fontSize: 16, fontWeight: '900', color: YELLOW },
  disabled: { opacity: 0.4 },
});
