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
import NewsCard from '../news/NewsCard';
import TripStatusList from '../transit/TripStatusList';
import { useTransit } from '../transit/TransitProvider';
import { useMusic } from '../music/MusicProvider';
import StepTimer from './StepTimer';
import ChecklistStep from './ChecklistStep';
import { openMusic, serviceLabel } from '../music/services';

const tabular = ['tabular-nums' as const];
const pad = (n: number) => String(n).padStart(2, '0');

function openTile(tile: RoutineTile) {
  const info = kindInfo(tile.kind);
  if (info.route) {
    router.push(info.route);
    return;
  }
  const url = tile.url ?? info.url;
  if (!url) return;
  const fail = () => Alert.alert('Nie udało się otworzyć', url);
  // Najpierw aplikacja (jeśli kafelek ma jej link), a gdy jej nie ma — strona.
  if (info.appUrl && !tile.url) Linking.openURL(info.appUrl).catch(() => Linking.openURL(url).catch(fail));
  else Linking.openURL(url).catch(fail);
}

const canOpen = (tile: RoutineTile) => {
  const info = kindInfo(tile.kind);
  return !!info.route || !!(tile.url ?? info.url);
};

export default function RoutineRunScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { plans, todayPlan } = useRoutine();
  const { notes, updateNote, createNote } = useNotes();
  // Notatki utworzone w krokach „Nowa notatka” (indeks kroku → id), żeby po powrocie nie tworzyć kolejnej.
  const [createdNotes, setCreatedNotes] = useState<Record<number, string>>({});
  const todayNotes = useMemo(() => notesForDay(notes, todayKey()), [notes]);
  const params = useLocalSearchParams<{ afterAlarm?: string; plan?: string }>();
  const routine = plans.find(p => p.id === params.plan) ?? todayPlan;
  const chain = useMemo(() => orderedChain(routine), [routine]);
  const times = useMemo(() => scheduleTimes(chain), [chain]);

  // Po wyłączeniu budzika pierwszy krok (Budzik) jest już zaliczony.
  const startIndex = params.afterAlarm === '1' && chain[0]?.kind === 'alarm' ? 1 : 0;
  const [index, setIndex] = useState(startIndex);

  const finished = index >= chain.length;
  const current = finished ? null : chain[index];

  const goTo = (i: number) => {
    setIndex(i);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const info = current ? kindInfo(current.kind) : null;
  const isNotesStep = current?.kind === 'notes';
  const isWeatherStep = current?.kind === 'weather';
  const isNewsStep = current?.kind === 'news';
  const isTransitStep = current?.kind === 'transit';
  const isChecklistStep = current?.kind === 'checklist';
  const transit = useTransit();

  // Dojazd: sprawdź od razu po wejściu w krok i odświeżaj co 2 minuty (limit PLK: 100 zapytań/h).
  useEffect(() => {
    if (!isTransitStep) return;
    transit.refresh();
    const t = setInterval(() => transit.refresh(), 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [isTransitStep, index]);
  const isMusicStep = current?.kind === 'music';
  const music = useMusic();
  const playlist = isMusicStep
    ? music.items.find(i => i.id === (current?.musicId ?? music.defaultId)) ?? undefined
    : undefined;
  const [autoOpened, setAutoOpened] = useState<Record<number, boolean>>({});

  // „Otwórz od razu”: przy wejściu w krok Muzyka otwórz playlistę (raz na krok).
  useEffect(() => {
    if (isMusicStep && current?.autoOpen && playlist && !autoOpened[index]) {
      setAutoOpened(prev => ({ ...prev, [index]: true }));
      openMusic(playlist.url).catch(() => {});
    }
  }, [index, isMusicStep, playlist?.id]);
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
    if (tile.kind === 'music' && playlist) {
      openMusic(playlist.url).catch(() => router.push('/music'));
      return;
    }
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
    if (tile.kind === 'music') return playlist ? `▶ Odtwórz „${playlist.name}”` : 'Wybierz muzykę';
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
          <Text style={s.headerTitle} numberOfLines={1}>
            {routine.name}
          </Text>
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

          {isMusicStep && (
            <View style={s.weatherPanel}>
              <Text style={s.musicName} numberOfLines={2}>
                {playlist ? playlist.name : 'Brak wybranej playlisty'}
              </Text>
              <Text style={s.musicMeta}>
                {playlist
                  ? `${serviceLabel(playlist.service)}${current?.autoOpen ? ' · otwiera się automatycznie' : ''}`
                  : 'Dodaj playlistę w module Muzyka i oznacz ją ★.'}
              </Text>
            </View>
          )}

          {isTransitStep && (
            <ScrollView style={s.newsPanel}>
              <TripStatusList tone="dark" />
            </ScrollView>
          )}

          {isNewsStep && (
            <ScrollView style={s.newsPanel}>
              <NewsCard count={6} tone="dark" />
            </ScrollView>
          )}

          {isWeatherStep && (
            <View style={s.weatherPanel}>
              <WeatherCard tone="dark" showHours />
            </View>
          )}

          {isChecklistStep && <ChecklistStep tile={current} />}

          {!!current.durationMin && (
            <StepTimer
              key={`${index}-${current.id}`}
              minutes={current.durationMin}
              title={current.title}
              nextTitle={chain[index + 1]?.title}
              autoNext={current.timerAutoNext}
              onAutoNext={() => goTo(index + 1)}
            />
          )}

          {(!isNotesStep || stepNotes.length === 0) && !isNewsStep && !isTransitStep && !isChecklistStep ? <View style={s.spacer} /> : null}

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


  spacer: { flex: 1 },
  notesPanel: { flex: 1, marginTop: 12, marginBottom: 12 },
  notesPanelContent: { paddingBottom: 4 },
  musicName: { color: WHITE, fontSize: 22, fontWeight: '900' },
  musicMeta: { color: '#9A9A94', fontSize: 13, fontWeight: '700', marginTop: 4 },
  newsPanel: { flex: 1, marginTop: 12, marginBottom: 12, borderWidth: LINE, borderColor: YELLOW },
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
