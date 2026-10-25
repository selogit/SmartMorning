import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  Modal,
  Pressable,
  TextStyle,
  TextInputSelectionChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { addDaysKey, dayLabel, todayKey, useNotes } from './NotesProvider';
import MarkdownView from './MarkdownView';
import { noteTitle } from './NotesListScreen';
import {
  BlockKind,
  EditResult,
  InlineMarker,
  LineKind,
  Selection,
  continueList,
  currentLineKind,
  toggleCheckAt,
  toggleInline,
  toggleLinePrefix,
} from './markdown';

type ToolButton =
  | { type: 'inline'; marker: InlineMarker; label: string; style: TextStyle }
  | { type: 'block'; kind: BlockKind; label: string }
  | { type: 'divider' };

const TOOLS: ToolButton[] = [
  { type: 'inline', marker: '**', label: 'B', style: { fontWeight: '900' } },
  { type: 'inline', marker: '*', label: 'I', style: { fontStyle: 'italic', fontWeight: '700' } },
  { type: 'inline', marker: '__', label: 'U', style: { textDecorationLine: 'underline', fontWeight: '700' } },
  { type: 'inline', marker: '~~', label: 'S', style: { textDecorationLine: 'line-through', fontWeight: '700' } },
  { type: 'divider' },
  { type: 'block', kind: 'h1', label: 'H1' },
  { type: 'block', kind: 'h2', label: 'H2' },
  { type: 'divider' },
  { type: 'block', kind: 'bullet', label: '•  Lista' },
  { type: 'block', kind: 'number', label: '1.' },
  { type: 'block', kind: 'check', label: '☐' },
  { type: 'block', kind: 'quote', label: '❝' },
];

export default function NoteEditorScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const { notes, loaded, updateNote, deleteNote, setShowOn } = useNotes();
  const [pickerOpen, setPickerOpen] = useState(false);
  const note = notes.find(n => n.id === id);

  const [body, setBody] = useState(note?.body ?? '');
  const [mode, setMode] = useState<'edit' | 'view'>(edit === '1' || !note?.body.trim() ? 'edit' : 'view');
  const [forcedSel, setForcedSel] = useState<Selection | undefined>(undefined);
  const [lineKind, setLineKind] = useState<LineKind>('text');
  const sel = useRef<Selection>({ start: body.length, end: body.length });
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const deleted = useRef(false);

  // Wczytanie treści, gdy notatki doczytają się po otwarciu ekranu.
  const initialised = useRef(!!note);
  useEffect(() => {
    if (!initialised.current && note) {
      initialised.current = true;
      setBody(note.body);
      if (!note.body.trim()) setMode('edit');
    }
  }, [note]);

  // Wymuszone zaznaczenie (po akcji z paska) trzymamy tylko przez chwilę — potem oddajemy kontrolę klawiaturze.
  useEffect(() => {
    if (!forcedSel) return;
    const t = setTimeout(() => setForcedSel(undefined), 60);
    return () => clearTimeout(t);
  }, [forcedSel]);

  // Pusta notatka znika po wyjściu z edytora.
  useEffect(
    () => () => {
      if (!deleted.current && bodyRef.current.trim() === '') deleteNote(id);
    },
    []
  );

  const commit = (text: string) => {
    setBody(text);
    updateNote(id, text);
  };

  const apply = (res: EditResult) => {
    commit(res.text);
    sel.current = res.selection;
    setForcedSel(res.selection);
    setLineKind(currentLineKind(res.text, res.selection));
  };

  const onChangeText = (text: string) => {
    const res = continueList(bodyRef.current, text, sel.current);
    if (res) apply(res);
    else commit(text);
  };

  const onSelectionChange = (e: TextInputSelectionChangeEvent) => {
    if (forcedSel) return;
    sel.current = e.nativeEvent.selection;
    setLineKind(currentLineKind(bodyRef.current, sel.current));
  };

  const onTool = (tool: ToolButton) => {
    if (tool.type === 'inline') apply(toggleInline(bodyRef.current, sel.current, tool.marker));
    else if (tool.type === 'block') apply(toggleLinePrefix(bodyRef.current, sel.current, tool.kind));
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/notes'));

  const confirmDelete = () =>
    Alert.alert('Usunąć notatkę?', 'Tej operacji nie można cofnąć.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => {
          deleted.current = true;
          deleteNote(id);
          goBack();
        },
      },
    ]);

  if (loaded && !note && !deleted.current) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.missing}>
          <Text style={s.missingText}>Ta notatka nie istnieje.</Text>
          <TouchableOpacity style={s.missingButton} onPress={goBack}>
            <Text style={s.missingButtonText}>Wróć</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.headerCell} onPress={goBack}>
          <Text style={s.headerBack}>←</Text>
        </TouchableOpacity>
        <View style={s.headerTitleCell}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {noteTitle(body)}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.headerCell, s.headerCellDivided, s.modeCell]}
          onPress={() => setMode(m => (m === 'edit' ? 'view' : 'edit'))}
        >
          <Text style={s.modeText}>{mode === 'edit' ? 'Podgląd' : 'Edytuj'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.headerCell, s.headerCellDivided]} onPress={confirmDelete}>
          <Text style={s.deleteText}>Usuń</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[s.scheduleBar, note?.showOn && note.showOn >= todayKey() && s.scheduleBarOn]}
        activeOpacity={0.7}
        onPress={() => setPickerOpen(true)}
      >
        <Text style={s.scheduleText} numberOfLines={1}>
          {note?.showOn
            ? note.showOn >= todayKey()
              ? `Pokaże się na ekranie głównym: ${dayLabel(note.showOn)}`
              : `Była pokazana: ${dayLabel(note.showOn)}`
            : 'Pokaż na ekranie głównym w wybranym dniu'}
        </Text>
        <Text style={s.scheduleAction}>{note?.showOn ? 'Zmień' : 'Ustaw'}</Text>
      </TouchableOpacity>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Kiedy pokazać notatkę?</Text>
            </View>
            <Text style={s.sheetHint}>
              Notatka pojawi się tego dnia na ekranie głównym i w kroku Notatnik w planie dnia.
            </Text>
            <View style={s.dayGrid}>
              {[0, 1, 2, 3, 4, 5, 6].map(offset => {
                const key = addDaysKey(offset);
                const active = note?.showOn === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[s.dayChip, active && s.dayChipActive]}
                    onPress={() => {
                      setShowOn(id, key);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{dayLabel(key)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={s.sheetClear}
              onPress={() => {
                setShowOn(id, undefined);
                setPickerOpen(false);
              }}
            >
              <Text style={s.sheetClearText}>Nie pokazuj</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {mode === 'edit' ? (
        <>
          <ScrollView
            horizontal
            style={s.toolbar}
            contentContainerStyle={s.toolbarContent}
            keyboardShouldPersistTaps="always"
            showsHorizontalScrollIndicator={false}
          >
            {TOOLS.map((tool, i) =>
              tool.type === 'divider' ? (
                <View key={i} style={s.toolDivider} />
              ) : (
                <TouchableOpacity
                  key={i}
                  style={[s.tool, tool.type === 'block' && tool.kind === lineKind && s.toolActive]}
                  onPress={() => onTool(tool)}
                  activeOpacity={0.6}
                >
                  <Text
                    style={[
                      s.toolText,
                      tool.type === 'inline' && tool.style,
                      tool.type === 'block' && tool.kind === lineKind && s.toolTextActive,
                    ]}
                  >
                    {tool.label}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </ScrollView>
          <TextInput
            style={[s.input, { paddingBottom: 24 + bottomInset }]}
            value={body}
            onChangeText={onChangeText}
            onSelectionChange={onSelectionChange}
            selection={forcedSel}
            multiline
            autoFocus
            placeholder={'Zacznij pisać…\n\nZaznacz tekst i użyj paska powyżej,\nżeby go pogrubić albo zrobić listę.'}
            placeholderTextColor={MUTED}
            selectionColor={INK}
            textAlignVertical="top"
            scrollEnabled
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={[s.view, { paddingBottom: 48 + bottomInset }]}>
          <MarkdownView text={body} onToggleCheck={line => commit(toggleCheckAt(bodyRef.current, line))} />
          <TouchableOpacity style={s.editHint} onPress={() => setMode('edit')}>
            <Text style={s.editHintText}>Dotknij, aby edytować</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: LINE, borderBottomColor: INK, backgroundColor: WHITE },
  headerCell: { paddingHorizontal: 16, justifyContent: 'center', minHeight: 54 },
  headerCellDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  headerBack: { fontSize: 22, fontWeight: '900', color: INK },
  headerTitleCell: { flex: 1, justifyContent: 'center', paddingHorizontal: 8, borderLeftWidth: LINE, borderLeftColor: INK },
  headerTitle: { fontSize: 16, fontWeight: '800', color: INK },
  modeCell: { backgroundColor: YELLOW },
  modeText: { fontSize: 15, fontWeight: '900', color: INK },
  deleteText: { fontSize: 15, fontWeight: '800', color: DANGER },

  scheduleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
    backgroundColor: WHITE,
  },
  scheduleBarOn: { backgroundColor: YELLOW },
  scheduleText: { flex: 1, fontSize: 13, fontWeight: '700', color: INK, paddingVertical: 10 },
  scheduleAction: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
  },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: PAPER, borderWidth: LINE, borderColor: INK },
  sheetHeader: { backgroundColor: INK, paddingHorizontal: 16, paddingVertical: 14 },
  sheetTitle: { color: YELLOW, fontSize: 17, fontWeight: '900' },
  sheetHint: { fontSize: 13, color: MUTED, paddingHorizontal: 16, paddingTop: 12 },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12 },
  dayChip: {
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 10,
    margin: 4,
  },
  dayChipActive: { backgroundColor: INK },
  dayChipText: { fontSize: 15, fontWeight: '800', color: INK },
  dayChipTextActive: { color: YELLOW },
  sheetClear: { borderTopWidth: LINE, borderTopColor: INK, paddingVertical: 14, alignItems: 'center' },
  sheetClearText: { fontSize: 15, fontWeight: '800', color: DANGER },

  toolbar: { flexGrow: 0, borderBottomWidth: LINE, borderBottomColor: INK, backgroundColor: INK },
  toolbarContent: { alignItems: 'center', paddingHorizontal: 6 },
  tool: { minWidth: 44, height: 46, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
  toolActive: { backgroundColor: YELLOW },
  toolText: { fontSize: 18, color: YELLOW, fontWeight: '700' },
  toolTextActive: { color: INK },
  toolDivider: { width: LINE, height: 26, backgroundColor: '#55554F', marginHorizontal: 4 },

  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    fontSize: 17,
    lineHeight: 25,
    color: INK,
    backgroundColor: PAPER,
  },

  view: { padding: 16, paddingBottom: 48 },
  editHint: { marginTop: 24, borderWidth: LINE, borderColor: INK, borderStyle: 'dashed', paddingVertical: 14, alignItems: 'center' },
  editHintText: { fontSize: 14, fontWeight: '700', color: MUTED },

  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  missingText: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 16 },
  missingButton: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, paddingHorizontal: 24, paddingVertical: 12 },
  missingButtonText: { fontSize: 16, fontWeight: '900', color: INK },
});
