import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Linking,
  RefreshControl,
  Modal,
  Pressable,
  Keyboard,
} from 'react-native';
import BackArrow from '../ui/BackArrow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { FeedKey, TOPICS, TopicId, mergeFeeds } from './api';
import { MAX_KEYWORDS, useNews } from './NewsProvider';
import { NewsItem, timeAgo } from './rss';

type Tab = 'digest' | FeedKey;

export default function NewsScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { settings, setSettings, feeds, loading, errors, refresh, digest, digestKeys, refreshDigest } = useNews();
  const [tab, setTab] = useState<Tab>('digest');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (tab !== 'digest') refresh(tab);
  }, [tab]);

  const keys: FeedKey[] = tab === 'digest' ? digestKeys : [tab];
  const items: NewsItem[] = tab === 'digest' ? digest : mergeFeeds([feeds[tab]?.items ?? []], 60);
  const busy = keys.some(k => loading[k]);
  const error = keys.map(k => errors[k]).find(Boolean);
  const fetchedAt = Math.max(0, ...keys.map(k => feeds[k]?.fetchedAt ?? 0));

  const onRefresh = () => (tab === 'digest' ? refreshDigest(true) : refresh(tab, true));
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const tabs: { key: Tab; label: string }[] = [
    { key: 'digest', label: 'Dla mnie' },
    ...TOPICS.map(t => ({ key: t.id as Tab, label: t.label })),
    ...settings.keywords.map(k => ({ key: `q:${k}` as Tab, label: `#${k}` })),
  ];

  const toggleTopic = (id: TopicId) => {
    const on = settings.digestTopics.includes(id);
    const next = on ? settings.digestTopics.filter(t => t !== id) : [...settings.digestTopics, id];
    setSettings({ ...settings, digestTopics: TOPICS.map(t => t.id).filter(t => next.includes(t)) });
  };

  const addKeyword = () => {
    const k = keyword.trim();
    if (!k || settings.keywords.includes(k) || settings.keywords.length >= MAX_KEYWORDS) return;
    setSettings({ ...settings, keywords: [...settings.keywords, k] });
    setKeyword('');
    Keyboard.dismiss();
  };

  const removeKeyword = (k: string) => {
    setSettings({ ...settings, keywords: settings.keywords.filter(x => x !== k) });
    if (tab === `q:${k}`) setTab('digest');
  };

  const updated = fetchedAt
    ? `${String(new Date(fetchedAt).getHours()).padStart(2, '0')}:${String(new Date(fetchedAt).getMinutes()).padStart(2, '0')}`
    : null;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={s.title}>Wiadomości</Text>
        <TouchableOpacity style={s.settingsButton} onPress={() => setSettingsOpen(true)}>
          <Text style={s.settingsText}>Ustaw</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal style={s.tabs} contentContainerStyle={s.tabsContent} showsHorizontalScrollIndicator={false}>
        {tabs.map(t => {
          const active = t.key === tab;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t.key)}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {error && (
        <View style={s.errorBar}>
          <Text style={s.errorText}>
            {items.length > 0 && updated ? `Brak połączenia — wiadomości z ${updated}. ` : ''}
            {error}
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={it => it.id}
        contentContainerStyle={[s.list, { paddingBottom: 24 + bottomInset }]}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={onRefresh} colors={[INK]} />}
        ListHeaderComponent={
          tab === 'digest' ? (
            <Text style={s.hint}>
              Przegląd z: {settings.digestTopics.map(id => TOPICS.find(t => t.id === id)?.label).join(', ') || '—'}
              {settings.keywords.length ? ` + hasła: ${settings.keywords.join(', ')}` : ''}. Pociągnij w dół, aby odświeżyć.
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyText}>{busy ? 'Pobieram wiadomości…' : 'Brak wiadomości do pokazania.'}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[s.row, index === 0 && s.rowFirst]}
            onPress={() => Linking.openURL(item.link).catch(() => {})}
            activeOpacity={0.7}
          >
            <Text style={s.rowMeta} numberOfLines={1}>
              {item.source}
              {item.publishedAt ? ` · ${timeAgo(item.publishedAt)}` : ''}
            </Text>
            <Text style={s.rowTitle}>{item.title}</Text>
          </TouchableOpacity>
        )}
        ListFooterComponent={
          items.length > 0 ? (
            <Text style={s.footer}>
              Źródło: Google News{updated ? ` · zaktualizowano ${updated}` : ''}. Artykuły otwierają się na stronach
              redakcji.
            </Text>
          ) : undefined
        }
      />

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Przegląd „Dla mnie”</Text>
              <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                <Text style={s.sheetClose}>Gotowe</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 16 }}>
              <Text style={s.sheetSection}>Tematy</Text>
              <View style={s.chips}>
                {TOPICS.map(t => {
                  const on = settings.digestTopics.includes(t.id);
                  return (
                    <TouchableOpacity key={t.id} style={[s.chip, on && s.chipOn]} onPress={() => toggleTopic(t.id)}>
                      <Text style={[s.chipText, on && s.chipTextOn]}>
                        {on ? '✓ ' : ''}
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.sheetSection}>
                Własne hasła ({settings.keywords.length}/{MAX_KEYWORDS})
              </Text>
              <View style={s.keywordRow}>
                <TextInput
                  style={s.keywordInput}
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="np. Kraków, sztuczna inteligencja"
                  placeholderTextColor={MUTED}
                  returnKeyType="done"
                  onSubmitEditing={addKeyword}
                  maxLength={40}
                  selectionColor={INK}
                />
                <TouchableOpacity
                  style={[s.keywordAdd, settings.keywords.length >= MAX_KEYWORDS && s.disabled]}
                  onPress={addKeyword}
                  disabled={settings.keywords.length >= MAX_KEYWORDS}
                >
                  <Text style={s.keywordAddText}>Dodaj</Text>
                </TouchableOpacity>
              </View>
              {settings.keywords.map(k => (
                <View key={k} style={s.keywordItem}>
                  <Text style={s.keywordText}>#{k}</Text>
                  <TouchableOpacity onPress={() => removeKeyword(k)}>
                    <Text style={s.keywordRemove}>Usuń</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <Text style={s.sheetHint}>
                Hasła szukają wiadomości z ostatnich 2 dni i mają własne zakładki. Przegląd pokazuje się też na stronie
                głównej i w kroku Wiadomości w planie dnia.
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
  title: { flex: 1, fontSize: 30, fontWeight: '900', color: INK, letterSpacing: -1 },
  settingsButton: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, paddingHorizontal: 12, height: 40, justifyContent: 'center' },
  settingsText: { fontSize: 14, fontWeight: '800', color: INK },

  tabs: { flexGrow: 0, borderBottomWidth: LINE, borderBottomColor: INK },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  tab: {
    minHeight: 42,
    justifyContent: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tabActive: { backgroundColor: INK },
  tabText: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: INK, includeFontPadding: false },
  tabTextActive: { color: YELLOW },

  errorBar: { backgroundColor: DANGER, paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { color: WHITE, fontSize: 13, fontWeight: '700' },

  list: { padding: 16 },
  hint: { fontSize: 12, fontWeight: '600', color: MUTED, marginBottom: 10, lineHeight: 17 },
  row: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 12 },
  rowFirst: { borderTopWidth: LINE },
  rowMeta: { fontSize: 12, fontWeight: '800', color: MUTED, marginBottom: 3 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: INK, lineHeight: 22 },
  empty: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, padding: 20 },
  emptyText: { fontSize: 15, color: INK },
  footer: { fontSize: 12, color: MUTED, marginTop: 12, lineHeight: 17 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: PAPER, borderWidth: LINE, borderColor: INK, maxHeight: '85%' },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: INK,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetTitle: { color: YELLOW, fontSize: 17, fontWeight: '900' },
  sheetClose: { color: WHITE, fontSize: 15, fontWeight: '700' },
  sheetSection: { fontSize: 12, fontWeight: '900', color: MUTED, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  chip: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 8, margin: 4 },
  chipOn: { backgroundColor: INK },
  chipText: { fontSize: 14, fontWeight: '800', color: INK },
  chipTextOn: { color: YELLOW },
  keywordRow: { flexDirection: 'row', marginHorizontal: 16, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  keywordInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: INK },
  keywordAdd: { justifyContent: 'center', paddingHorizontal: 14, backgroundColor: YELLOW, borderLeftWidth: LINE, borderLeftColor: INK },
  keywordAddText: { fontSize: 14, fontWeight: '900', color: INK },
  disabled: { opacity: 0.4 },
  keywordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    borderWidth: LINE,
    borderTopWidth: 0,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  keywordText: { fontSize: 15, fontWeight: '800', color: INK },
  keywordRemove: { fontSize: 14, fontWeight: '800', color: DANGER },
  sheetHint: { fontSize: 12, color: MUTED, marginHorizontal: 16, marginTop: 10, lineHeight: 17 },
});
