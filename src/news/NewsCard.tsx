import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import { useNews } from './NewsProvider';
import { timeAgo } from './rss';

interface Props {
  count?: number;
  tone?: 'light' | 'dark';
  /** Akcja „Wszystkie wiadomości”. */
  onMore?: () => void;
}

/** Najnowsze nagłówki z przeglądu „Dla mnie” — strona główna i krok planu. */
export default function NewsCard({ count = 3, tone = 'light', onMore }: Props) {
  const { digest, digestKeys, loading, errors } = useNews();
  const dark = tone === 'dark';
  const busy = digestKeys.some(k => loading[k]);
  const error = digestKeys.map(k => errors[k]).find(Boolean);
  const items = digest.slice(0, count);
  const fg = dark ? WHITE : INK;
  const line = dark ? YELLOW : INK;

  return (
    <View>
      {items.length === 0 ? (
        <Text style={[s.empty, { color: dark ? '#9A9A94' : MUTED }]}>
          {busy ? 'Pobieram wiadomości…' : error ? `Wiadomości niedostępne: ${error}` : 'Brak wiadomości'}
        </Text>
      ) : (
        items.map((it, i) => (
          <TouchableOpacity
            key={it.id}
            style={[s.item, i > 0 && { borderTopWidth: LINE, borderTopColor: line }]}
            onPress={() => Linking.openURL(it.link).catch(() => {})}
            activeOpacity={0.7}
          >
            <Text style={[s.meta, { color: dark ? YELLOW : MUTED }]} numberOfLines={1}>
              {it.source}
              {it.publishedAt ? ` · ${timeAgo(it.publishedAt)}` : ''}
            </Text>
            <Text style={[s.title, { color: fg }]} numberOfLines={3}>
              {it.title}
            </Text>
          </TouchableOpacity>
        ))
      )}
      {onMore && (
        <TouchableOpacity
          style={[s.more, { borderTopColor: line }, dark ? s.moreDark : s.moreLight]}
          onPress={onMore}
          activeOpacity={0.8}
        >
          <Text style={[s.moreText, { color: dark ? INK : INK }]}>Wszystkie wiadomości →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 14, fontWeight: '700', padding: 14 },
  item: { paddingHorizontal: 14, paddingVertical: 10 },
  meta: { fontSize: 11, fontWeight: '800', marginBottom: 2 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  more: { borderTopWidth: LINE, paddingVertical: 12, alignItems: 'center' },
  moreLight: { backgroundColor: YELLOW },
  moreDark: { backgroundColor: YELLOW },
  moreText: { fontSize: 14, fontWeight: '900' },
});
