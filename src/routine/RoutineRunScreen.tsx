import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, LINE } from '../theme';
import { useRoutine } from './RoutineProvider';
import { orderedChain, scheduleTimes } from './chain';
import { CATEGORY_LABELS, isSoon, kindInfo } from './tileKinds';
import { RoutineTile } from './types';
import { notesForDay, todayKey, useNotes } from '../notes/NotesProvider';
import MarkdownView from '../notes/MarkdownView';
import { toggleCheckAt } from '../notes/markdown';
import WeatherCard from '../weather/WeatherCard';

const tabular = ['tabular-nums' as const];
const pad = (n: number) => String(n).padStart(2, '0');

function openTile(tile: RoutineTile) {
  const info = kindInfo(tile.kind);
  if (info.route) {
    router.push(info.route);
    return;
  }
  const url = tile.url ?? info.url;
  if (url) {
    Linking.openURL(url).catch(() => Alert.alert('Nie udało się otworzyć', url));
  }
}

const canOpen = (tile: RoutineTile) => {
  const info = kindInfo(tile.kind);
  return !!info.route || !!(tile.url ?? info.url);
};

export default function RoutineRunScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { routine } = useRoutine();
  const { notes, updateNote, createNote } = useNotes();
  // Notatki utworzone w krokach „Nowa notatka” (indeks kroku → id), żeby po powrocie nie tworzyć kolejnej.
  const [createdNotes, setCreatedNotes] = useState<Record<number, string>>({});
  const todayNotes = useMemo(() => notesForDay(notes, todayKey()), [notes]);
  const params = useLocalSearchParams<{ afterAlarm?: string }>();
  const chain = useMemo(() => orderedChain(routine), [routine]);
  const times = useMemo(() => scheduleTimes(chain), [chain]);

  // Po wyłączeniu budzika pierwszy krok (Budzik) jest już zaliczony.
  const startIndex = params.afterAlarm === '1' && chain[0]?.kind === 'alarm' ? 1 : 0;
  const [index, setIndex] = useState(startIndex);
  const [stepStartedAt, setStepStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const finished = index >= chain.length;
  const current = finished ? null : chain[index];

  const goTo = (i: number) => {
    setIndex(i);
    setStepStartedAt(Date.now());
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let countdown: { text: string; pct: number; over: boolean } | null = null;
  if (current?.durationMin) {
    const total = current.durationMin * 60;
    const elapsed = Math.floor((now - stepStartedAt) / 1000);
    const left = total - elapsed;
    const abs = Math.abs(left);
    countdown = {
      text: `${left < 0 ? '+' : ''}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`,
      pct: Math.min(1, Math.max(0, elapsed / total)),
      over: left < 0,
    };
  }

  const info = current ? kindInfo(current.kind) : null;
  const isNotesStep = current?.kind === 'notes';
  const isWeatherStep = current?.kind === 'weather';
  const noteMode = current?.noteMode ?? 'today';
  const createdId = createdNotes[index];
  const createdNote = createdId ? notes.find(n => n.id === createdId) : undefined;
  const pickedNote = current?.noteId ? notes.find(n => n.id === current.noteId) : undefined;

  // Notatki pokazane w kroku Notatnik, zależnie od trybu kafelka.
  const stepNotes = !isNotesStep
    ? []
    : noteMode === 'pick'
      ? pickedNote
        ? [pickedNote]
        : []
      : noteMode === 'new'
        ? createdNote
          ? [createdNote]
          : []
        : todayNotes;

  const writeNewNote = () => {
    const note = createNote('');
    setCreatedNotes(prev => ({ ...prev, [index]: note.id }));
    router.push(`/notes/${note.id}?edit=1`);
  };

  // „Nowa notatka”: po wejściu w krok od razu otwórz pustą notatkę (tylko raz na krok).
  useEffect(() => {
    if (isNotesStep && noteMode === 'new' && !createdNotes[index]) writeNewNote();
  }, [index, isNotesStep, noteMode]);

  const open = (tile: RoutineTile) => {
    if (tile.kind === 'notes') {
      if (noteMode === 'new') {
        if (createdNote) router.push(`/notes/${createdNote.id}`);
        else writeNewNote();
        return;
      }
      // Jedna notatka do pokazania — otwórz ją bezpośrednio.
      if (stepNotes.length === 1) {
        router.push(`/notes/${stepNotes[0].id}`);
        return;
      }
    }
    openTile(tile);
  };

  const openLabel = (tile: RoutineTile) => {
    if (tile.kind !== 'notes') return `Otwórz ${tile.title}`;
    if (noteMode === 'new') return createdNote ? 'Otwórz notatkę' : 'Napisz notatkę';
    return stepNotes.length === 1 ? 'Edytuj notatkę' : 'Otwórz Notatnik';
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.closeCell} onPress={close}>
          <Text style={s.closeText}>✕ Zakończ</Text>
        </TouchableOpacity>
        <View style={s.headerTitleCell}>
          <Text style={s.headerTitle}>Plan dnia</Text>
        </View>
        <View style={s.progressCell}>
          <Text style={s.progressText}>
            {Math.min(index + 1, chain.length)}/{chain.length}
          </Text>
        </View>
      </View>

      <View style={s.stepsBar}>
        {chain.map((t, i) => (
          <TouchableOpacity
            key={t.id}
            style={[s.stepSeg, i > 0 && s.stepSegDivided, i < index && s.stepSegDone, i === index && s.stepSegActive]}
            onPress={() => goTo(i)}
          />
        ))}
      </View>

      {current && info ? (
        <View style={[s.body, { paddingBottom: 16 + bottomInset }]}>
          <View style={s.metaRow}>
            <Text style={s.metaText}>{isSoon(info) ? 'Moduł wkrótce' : CATEGORY_LABELS[info.category]}</Text>
            {times[index] && <Text style={s.metaText}>Zaplanowane {times[index]}</Text>}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle} numberOfLines={2} adjustsFontSizeToFit>
              {current.title}
            </Text>
            <Text style={s.cardDesc}>{info.description}</Text>
          </View>

          {isNotesStep && stepNotes.length === 0 && (
            <Text style={s.notesEmpty}>
              {noteMode === 'pick'
                ? 'Wybrana notatka nie istnieje — wybierz inną w edycji kafelka.'
                : noteMode === 'new'
                  ? 'Notatka nie została zapisana. Dotknij „Napisz notatkę”, żeby spróbować jeszcze raz.'
                  : 'Brak notatek na dziś.'}
            </Text>
          )}

          {isNotesStep && stepNotes.length > 0 && (
            <ScrollView style={s.notesPanel} contentContainerStyle={s.notesPanelContent}>
              {stepNotes.map(n => (
                <View key={n.id} style={s.noteCard}>
                  <MarkdownView text={n.body} onToggleCheck={line => updateNote(n.id, toggleCheckAt(n.body, line))} />
                </View>
              ))}
            </ScrollView>
          )}

          {isWeatherStep && (
            <View style={s.weatherPanel}>
              <WeatherCard tone="dark" showHours />
            </View>
          )}

          {countdown && (
            <View style={s.timer}>
              <Text style={[s.timerText, countdown.over && s.timerOver]}>{countdown.text}</Text>
              <View style={s.timerTrack}>
                <View style={[s.timerFill, { flex: countdown.pct }]} />
                <View style={{ flex: 1 - countdown.pct }} />
              </View>
              <Text style={s.timerHint}>
                {countdown.over ? 'Czas minął — przejdź dalej, gdy skończysz' : `${current.durationMin} min na ten krok`}
              </Text>
            </View>
          )}

          {!isNotesStep || stepNotes.length === 0 ? <View style={s.spacer} /> : null}

          {chain[index + 1] && (
            <Text style={s.nextText}>
              Następnie: {chain[index + 1].title}
              {times[index + 1] ? ` · ${times[index + 1]}` : ''}
            </Text>
          )}

          <View style={s.buttons}>
            {canOpen(current) && (
              <TouchableOpacity style={s.openButton} onPress={() => open(current)} activeOpacity={0.8}>
                <Text style={s.openText}>{openLabel(current)}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.nextButton} onPress={() => goTo(index + 1)} activeOpacity={0.8}>
              <Text style={s.nextButtonText}>{index + 1 >= chain.length ? 'Gotowe ✓' : 'Dalej →'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[s.doneBody, { paddingBottom: 16 + bottomInset }]}>
          <Text style={s.doneTitle}>Plan wykonany</Text>
          <Text style={s.doneDesc}>Udanego dnia!</Text>
          {chain.map((t, i) => (
            <View key={t.id} style={s.doneRow}>
              <Text style={s.doneRowIndex}>{pad(i + 1)}</Text>
              <Text style={s.doneRowTitle}>{t.title}</Text>
              <Text style={s.doneRowTime}>{times[i] ?? ''}</Text>
            </View>
          ))}
          <TouchableOpacity style={[s.nextButton, { marginTop: 24 }]} onPress={close}>
            <Text style={s.nextButtonText}>Wróć</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: INK,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: { flexDirection: 'row', borderBottomWidth: LINE, borderBottomColor: YELLOW },
  closeCell: { paddingHorizontal: 14, paddingVertical: 14, borderRightWidth: LINE, borderRightColor: YELLOW },
  closeText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  headerTitleCell: { flex: 1, justifyContent: 'center', paddingHorizontal: 14 },
  headerTitle: { color: WHITE, fontSize: 18, fontWeight: '900' },
  progressCell: { paddingHorizontal: 14, justifyContent: 'center', backgroundColor: YELLOW },
  progressText: { color: INK, fontSize: 16, fontWeight: '900', fontVariant: tabular },

  stepsBar: { flexDirection: 'row', height: 14, borderBottomWidth: LINE, borderBottomColor: YELLOW },
  stepSeg: { flex: 1 },
  stepSegDivided: { borderLeftWidth: LINE, borderLeftColor: YELLOW },
  stepSegDone: { backgroundColor: '#3A3A36' },
  stepSegActive: { backgroundColor: YELLOW },

  body: { flex: 1, padding: 16 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  metaText: { color: YELLOW, fontSize: 14, fontWeight: '800', fontVariant: tabular },
  card: { backgroundColor: YELLOW, padding: 18, borderWidth: LINE, borderColor: YELLOW },
  cardTitle: { color: INK, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  cardDesc: { color: INK, fontSize: 16, fontWeight: '600', marginTop: 4 },

  timer: { marginTop: 16, borderWidth: LINE, borderColor: YELLOW, padding: 14 },
  timerText: { color: WHITE, fontSize: 56, fontWeight: '900', fontVariant: tabular },
  timerOver: { color: YELLOW },
  timerTrack: { flexDirection: 'row', height: 10, borderWidth: LINE, borderColor: YELLOW, marginTop: 8 },
  timerFill: { backgroundColor: YELLOW },
  timerHint: { color: '#9A9A94', fontSize: 13, marginTop: 8 },

  spacer: { flex: 1 },
  notesPanel: { flex: 1, marginTop: 12, marginBottom: 12 },
  notesPanelContent: { paddingBottom: 4 },
  weatherPanel: { marginTop: 12, borderWidth: LINE, borderColor: YELLOW, padding: 14 },
  notesEmpty: { color: '#9A9A94', fontSize: 15, fontWeight: '700', marginTop: 14, lineHeight: 21 },
  noteCard: { backgroundColor: PAPER, padding: 14, marginBottom: 10 },
  nextText: { color: '#9A9A94', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  buttons: { borderWidth: LINE, borderColor: YELLOW },
  openButton: { paddingVertical: 20, alignItems: 'center', borderBottomWidth: LINE, borderBottomColor: YELLOW },
  openText: { color: YELLOW, fontSize: 18, fontWeight: '800' },
  nextButton: { backgroundColor: WHITE, paddingVertical: 24, alignItems: 'center' },
  nextButtonText: { color: INK, fontSize: 26, fontWeight: '900' },

  doneBody: { padding: 16 },
  doneTitle: { color: YELLOW, fontSize: 40, fontWeight: '900', letterSpacing: -1, marginTop: 12 },
  doneDesc: { color: WHITE, fontSize: 18, fontWeight: '600', marginBottom: 20 },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: YELLOW,
    marginBottom: -LINE,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  doneRowIndex: { color: YELLOW, fontSize: 13, fontWeight: '900', width: 30, fontVariant: tabular },
  doneRowTitle: { flex: 1, color: WHITE, fontSize: 16, fontWeight: '800' },
  doneRowTime: { color: MUTED, fontSize: 14, fontWeight: '700', fontVariant: tabular },
});
