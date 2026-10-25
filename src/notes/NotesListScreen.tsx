import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, LINE } from '../theme';
import { Note, dayLabel, todayKey, useNotes } from './NotesProvider';
import { plainText } from './markdown';
import { openTodayNote } from './today';

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MONTHS = [
  'stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca',
  'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia',
];
const pad = (n: number) => String(n).padStart(2, '0');

export function noteTitle(body: string) {
  const first = body.split('\n').find(l => plainText(l).trim() !== '');
  return first ? plainText(first).trim() : 'Nowa notatka';
}

function notePreview(body: string) {
  const lines = body.split('\n').filter(l => plainText(l).trim() !== '');
  return lines.slice(1, 3).map(l => plainText(l).trim()).join(' · ');
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (todayKey(d) === todayKey(now)) return `dziś ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (todayKey(d) === todayKey(y)) return `wczoraj ${time}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

export default function NotesListScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { notes, createNote } = useNotes();
  const now = new Date();
  const key = todayKey(now);
  const todayNote = notes.find(n => n.dayKey === key);
  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const openToday = () => openTodayNote(notes, createNote);

  const newNote = () => {
    const note = createNote('');
    router.push(`/notes/${note.id}?edit=1`);
  };

  const renderItem = ({ item }: { item: Note }) => {
    const preview = notePreview(item.body);
    return (
      <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => router.push(`/notes/${item.id}`)}>
        <View style={s.rowText}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {noteTitle(item.body)}
          </Text>
          {preview ? (
            <Text style={s.rowPreview} numberOfLines={1}>
              {preview}
            </Text>
          ) : null}
          {item.showOn && item.showOn >= key ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>Pokaże się: {dayLabel(item.showOn)}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.rowDate}>
          <Text style={s.rowDateText}>{formatDate(item.updatedAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Notatnik</Text>
        <View style={s.countBox}>
          <Text style={s.countText}>{notes.length} notatek</Text>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={n => n.id}
        renderItem={renderItem}
        contentContainerStyle={[s.list, { paddingBottom: 110 + bottomInset }]}
        ListHeaderComponent={
          <TouchableOpacity style={s.today} activeOpacity={0.8} onPress={openToday}>
            <View style={s.todayBar}>
              <Text style={s.todayBarText}>Notatka na dziś</Text>
              <Text style={s.todayBarText}>→</Text>
            </View>
            <View style={s.todayBody}>
              <Text style={s.todayDate}>
                {WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
              </Text>
              <Text style={s.todayHint} numberOfLines={2}>
                {todayNote ? notePreview(todayNote.body) || noteTitle(todayNote.body) : 'Dotknij, aby zapisać plan na dziś'}
              </Text>
            </View>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>Brak notatek. Dodaj pierwszą poniżej.</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={[s.addBar, { height: 72 + bottomInset, paddingBottom: bottomInset }]}
        onPress={newNote}
        activeOpacity={0.85}
      >
        <Text style={s.addPlus}>+</Text>
        <Text style={s.addText}>Nowa notatka</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  title: { flex: 1, fontSize: 32, fontWeight: '900', color: INK, letterSpacing: -1 },
  countBox: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, paddingHorizontal: 10, paddingVertical: 6 },
  countText: { fontSize: 13, fontWeight: '700', color: INK },

  list: { padding: 16, paddingBottom: 110 },
  today: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, marginBottom: 16 },
  todayBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  todayBarText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  todayBody: { padding: 14 },
  todayDate: { fontSize: 22, fontWeight: '900', color: INK },
  todayHint: { fontSize: 14, fontWeight: '600', color: INK, marginTop: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginBottom: -LINE,
  },
  rowText: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  rowTitle: { fontSize: 17, fontWeight: '800', color: INK },
  rowPreview: { fontSize: 13, color: MUTED, marginTop: 2 },
  badge: { alignSelf: 'flex-start', backgroundColor: YELLOW, borderWidth: LINE, borderColor: INK, paddingHorizontal: 6, paddingVertical: 1, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: '900', color: INK },
  rowDate: { paddingHorizontal: 12, justifyContent: 'center', borderLeftWidth: LINE, borderLeftColor: INK },
  rowDateText: { fontSize: 12, fontWeight: '700', color: INK },
  empty: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, padding: 20 },
  emptyText: { fontSize: 16, color: INK },

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
