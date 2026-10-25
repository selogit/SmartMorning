import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { router } from 'expo-router';
import { NoteMode, RoutineTile } from './types';
import { CATEGORY_LABELS, isSoon, kindInfo } from './tileKinds';
import { useNotes } from '../notes/NotesProvider';
import { noteTitle } from '../notes/NotesListScreen';

const NOTE_MODES: { mode: NoteMode; title: string; hint: string }[] = [
  { mode: 'today', title: 'Notatki na dziś', hint: 'Notatki ustawione na dziś i notatka dnia' },
  { mode: 'pick', title: 'Wybrana notatka', hint: 'Np. coś, co zaplanujesz wieczorem na rano' },
  { mode: 'new', title: 'Nowa notatka', hint: 'Ten krok od razu otworzy pustą notatkę' },
];

const DURATIONS = [0, 5, 10, 15, 30, 60];

interface Props {
  tile: RoutineTile | null;
  onSave: (tile: RoutineTile) => void;
  onClose: () => void;
}

export default function TileEditor({ tile, onSave, onClose }: Props) {
  return (
    <Modal visible={tile !== null} animationType="slide" onRequestClose={onClose}>
      {tile && <EditorBody key={tile.id} tile={tile} onSave={onSave} onClose={onClose} />}
    </Modal>
  );
}

function EditorBody({ tile, onSave, onClose }: { tile: RoutineTile } & Omit<Props, 'tile'>) {
  const bottomInset = useSafeAreaInsets().bottom;
  const info = kindInfo(tile.kind);
  const [title, setTitle] = useState(tile.title);
  const [hh, setHh] = useState(tile.time?.split(':')[0] ?? '');
  const [mm, setMm] = useState(tile.time?.split(':')[1] ?? '');
  const [duration, setDuration] = useState(tile.durationMin ?? 0);
  const [url, setUrl] = useState(tile.url ?? '');
  const [noteMode, setNoteMode] = useState<NoteMode>(tile.noteMode ?? 'today');
  const [noteId, setNoteId] = useState<string | undefined>(tile.noteId);
  const { notes, createNote } = useNotes();
  const isNotes = tile.kind === 'notes';
  const sortedNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);

  const h = Number(hh);
  const m = Number(mm);
  const hasTime = hh !== '' || mm !== '';
  const timeValid = !hasTime || (hh !== '' && h >= 0 && h <= 23 && mm !== '' && m >= 0 && m <= 59);

  const build = (overrides: Partial<RoutineTile> = {}): RoutineTile => ({
    ...tile,
    title: title.trim() || info.label,
    time: hasTime ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` : undefined,
    durationMin: duration || undefined,
    url: info.customUrl ? url.trim() || undefined : tile.url,
    noteMode: isNotes ? noteMode : undefined,
    noteId: isNotes && noteMode === 'pick' ? noteId : undefined,
    ...overrides,
  });

  const save = () => {
    if (!timeValid) return;
    Keyboard.dismiss();
    onSave(build());
  };

  /** Tworzy notatkę dla tego kafelka, zapisuje kafelek i od razu otwiera edytor notatki. */
  const createLinkedNote = () => {
    if (!timeValid) return;
    const note = createNote(`# ${title.trim() || 'Na rano'}\n\n- [ ] `);
    onSave(build({ noteMode: 'pick', noteId: note.id }));
    setTimeout(() => router.push(`/notes/${note.id}?edit=1`), 50);
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerLeft} onPress={onClose}>
          <Text style={s.headerCancel}>Anuluj</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Kafelek</Text>
        </View>
        <TouchableOpacity style={[s.headerRight, !timeValid && s.disabled]} onPress={save} disabled={!timeValid}>
          <Text style={s.headerSave}>Zapisz</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 40 + bottomInset }]} keyboardShouldPersistTaps="handled">
        <View style={s.kindBar}>
          <Text style={s.kindText}>
            {CATEGORY_LABELS[info.category]} · {info.label}
          </Text>
          {isSoon(info) && <Text style={s.kindSoon}>moduł wkrótce</Text>}
        </View>

        <Text style={s.label}>Nazwa</Text>
        <TextInput
          style={s.input}
          value={title}
          onChangeText={setTitle}
          placeholder={info.label}
          placeholderTextColor={MUTED}
          maxLength={24}
          selectionColor={INK}
        />

        <Text style={s.label}>Godzina rozpoczęcia (opcjonalnie)</Text>
        <View style={s.timeRow}>
          <TextInput
            style={[s.input, s.timeInput, !timeValid && s.inputError]}
            value={hh}
            onChangeText={v => setHh(v.replace(/\D/g, '').slice(0, 2))}
            placeholder="GG"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            maxLength={2}
            selectionColor={INK}
          />
          <Text style={s.timeColon}>:</Text>
          <TextInput
            style={[s.input, s.timeInput, !timeValid && s.inputError]}
            value={mm}
            onChangeText={v => setMm(v.replace(/\D/g, '').slice(0, 2))}
            placeholder="MM"
            placeholderTextColor={MUTED}
            keyboardType="number-pad"
            maxLength={2}
            selectionColor={INK}
          />
          {hasTime && (
            <TouchableOpacity
              style={s.clear}
              onPress={() => {
                setHh('');
                setMm('');
              }}
            >
              <Text style={s.clearText}>Wyczyść</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={s.hint}>
          {timeValid
            ? 'Bez godziny krok zacznie się po zakończeniu poprzedniego.'
            : 'Podaj godzinę 00–23 i minuty 00–59.'}
        </Text>

        <Text style={s.label}>Czas trwania</Text>
        <View style={s.segmented}>
          {DURATIONS.map((d, i) => {
            const active = d === duration;
            return (
              <TouchableOpacity
                key={d}
                style={[s.segment, i > 0 && s.segmentDivided, active && s.segmentActive]}
                onPress={() => setDuration(d)}
              >
                <Text style={[s.segmentText, active && s.segmentTextActive]}>{d === 0 ? '—' : `${d}`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.hint}>W minutach. Podczas planu zobaczysz odliczanie.</Text>

        {info.customUrl && (
          <>
            <Text style={s.label}>Link do aplikacji lub strony</Text>
            <TextInput
              style={s.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://…"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={INK}
            />
            <Text style={s.hint}>
              Linki https wielu aplikacji (np. YouTube, Spotify) otwierają je bezpośrednio, jeśli są zainstalowane.
            </Text>
          </>
        )}
        {!info.customUrl && info.url && <Text style={s.hint}>Otwiera: {info.url}</Text>}

        {isNotes && (
          <>
            <Text style={s.label}>Co otworzyć w tym kroku</Text>
            {NOTE_MODES.map(opt => {
              const active = opt.mode === noteMode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[s.modeRow, active && s.modeRowActive]}
                  onPress={() => setNoteMode(opt.mode)}
                  activeOpacity={0.7}
                >
                  <View style={[s.radio, active && s.radioActive]}>{active && <View style={s.radioDot} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modeTitle}>{opt.title}</Text>
                    <Text style={s.modeHint}>{opt.hint}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {noteMode === 'pick' && (
              <>
                <Text style={s.label}>Notatka</Text>
                <TouchableOpacity style={s.createNote} onPress={createLinkedNote} activeOpacity={0.8}>
                  <Text style={s.createNoteText}>+ Utwórz nową notatkę i napisz ją teraz</Text>
                </TouchableOpacity>
                {sortedNotes.length === 0 ? (
                  <Text style={s.hint}>Nie masz jeszcze żadnych notatek.</Text>
                ) : (
                  sortedNotes.slice(0, 20).map(n => {
                    const active = n.id === noteId;
                    return (
                      <TouchableOpacity
                        key={n.id}
                        style={[s.noteRow, active && s.noteRowActive]}
                        onPress={() => setNoteId(n.id)}
                        activeOpacity={0.7}
                      >
                        <View style={[s.radio, active && s.radioActive]}>{active && <View style={s.radioDot} />}</View>
                        <Text style={s.noteRowText} numberOfLines={1}>
                          {noteTitle(n.body)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
                {noteId && !notes.some(n => n.id === noteId) && (
                  <Text style={[s.hint, { color: DANGER }]}>Wybrana notatka została usunięta — wybierz inną.</Text>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: { flexDirection: 'row', borderBottomWidth: LINE, borderBottomColor: INK, backgroundColor: WHITE },
  headerLeft: { paddingHorizontal: 18, paddingVertical: 16, borderRightWidth: LINE, borderRightColor: INK },
  headerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRight: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    backgroundColor: YELLOW,
  },
  disabled: { opacity: 0.4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: INK },
  headerCancel: { fontSize: 16, fontWeight: '600', color: INK },
  headerSave: { fontSize: 16, fontWeight: '800', color: INK },

  body: { padding: 16, paddingBottom: 40 },
  kindBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  kindText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  kindSoon: { color: '#BDBDB6', fontSize: 13, fontWeight: '700' },

  label: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 18, marginBottom: 6 },
  input: {
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '600',
    color: INK,
  },
  inputError: { borderColor: DANGER },
  timeRow: { flexDirection: 'row', alignItems: 'center' },
  timeInput: { width: 72, textAlign: 'center', fontSize: 24, fontWeight: '900' },
  timeColon: { fontSize: 28, fontWeight: '900', color: INK, marginHorizontal: 6 },
  clear: { marginLeft: 12, borderWidth: LINE, borderColor: INK, paddingHorizontal: 12, paddingVertical: 10 },
  clearText: { fontSize: 14, fontWeight: '800', color: INK },
  hint: { fontSize: 13, color: MUTED, marginTop: 6 },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: -LINE,
  },
  modeRowActive: { backgroundColor: YELLOW },
  modeTitle: { fontSize: 16, fontWeight: '800', color: INK },
  modeHint: { fontSize: 12, color: '#55554F', marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { backgroundColor: INK },
  radioDot: { width: 8, height: 8, backgroundColor: YELLOW },
  createNote: { borderWidth: LINE, borderColor: INK, backgroundColor: INK, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  createNoteText: { color: YELLOW, fontSize: 15, fontWeight: '900' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: -LINE,
  },
  noteRowActive: { backgroundColor: YELLOW },
  noteRowText: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },

  segmented: { flexDirection: 'row', borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  segmentDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  segmentActive: { backgroundColor: INK },
  segmentText: { fontSize: 16, fontWeight: '800', color: INK },
  segmentTextActive: { color: YELLOW },
});
