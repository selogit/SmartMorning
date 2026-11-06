import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, DANGER, LINE } from '../theme';
import { useTransit } from './TransitProvider';
import { StatusTone, Trip } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number) => `${pad(new Date(ms).getHours())}:${pad(new Date(ms).getMinutes())}`;

const TONE_BG: Record<StatusTone, string> = { ok: '#2E7D32', late: '#E8A100', bad: DANGER, unknown: '#55554F' };

export function tripTitle(t: Trip) {
  if (t.label) return t.label;
  return t.kind === 'train' ? `${t.fromName} → ${t.toName}, ${t.time}` : `${t.line} · ${t.stopName}${t.time ? `, ${t.time}` : ''}`;
}

/** Statusy zapisanych połączeń (strona Dojazd i krok planu). */
export default function TripStatusList({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { settings, statuses, refreshing, lastRefresh, refresh } = useTransit();
  const dark = tone === 'dark';
  const fg = dark ? WHITE : INK;
  const line = dark ? YELLOW : INK;

  if (settings.trips.length === 0) {
    return <Text style={[s.empty, { color: dark ? '#9A9A94' : MUTED }]}>Nie masz zapisanych połączeń.</Text>;
  }

  return (
    <View style={[s.box, { borderColor: line }]}>
      {settings.trips.map((t, i) => {
        const st = statuses[t.id];
        return (
          <View key={t.id} style={[s.row, i > 0 && { borderTopWidth: LINE, borderTopColor: line }]}>
            <View style={s.rowHead}>
              <Text style={[s.kind, { color: dark ? YELLOW : MUTED }]}>{t.kind === 'train' ? 'POCIĄG' : 'ZTM'}</Text>
              <Text style={[s.title, { color: fg }]} numberOfLines={2}>
                {tripTitle(t)}
              </Text>
              {st && !st.error && (
                <View style={[s.badge, { backgroundColor: TONE_BG[st.tone] }]}>
                  <Text style={s.badgeText}>{st.headline}</Text>
                </View>
              )}
            </View>
            {st ? (
              <>
                <Text style={[s.detail, { color: st.error ? (dark ? '#FF8A80' : DANGER) : dark ? '#BDBDB6' : '#55554F' }]}>
                  {st.detail}
                </Text>
                {st.extra?.map(e => (
                  <Text key={e} style={[s.extra, { color: fg }]}>
                    {e}
                  </Text>
                ))}
                {st.alerts?.map(a => (
                  <Text key={a} style={s.alert}>
                    ⚠ {a}
                  </Text>
                ))}
              </>
            ) : (
              <Text style={[s.detail, { color: dark ? '#9A9A94' : MUTED }]}>
                {refreshing ? 'Sprawdzam…' : 'Jeszcze nie sprawdzono'}
              </Text>
            )}
          </View>
        );
      })}
      <TouchableOpacity
        style={[s.refresh, { borderTopColor: line }, dark ? s.refreshDark : s.refreshLight]}
        onPress={() => refresh(true)}
        disabled={refreshing}
        activeOpacity={0.8}
      >
        {refreshing ? (
          <ActivityIndicator color={INK} />
        ) : (
          <Text style={s.refreshText}>Odśwież{lastRefresh ? ` · sprawdzono ${hm(lastRefresh)}` : ''}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { fontSize: 14, fontWeight: '700', padding: 14 },
  box: { borderWidth: LINE },
  row: { paddingHorizontal: 14, paddingVertical: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center' },
  kind: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginRight: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, marginLeft: 8 },
  badgeText: { color: WHITE, fontSize: 14, fontWeight: '900' },
  detail: { fontSize: 13, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  extra: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  alert: { fontSize: 13, fontWeight: '700', color: '#E8A100', marginTop: 4 },
  refresh: { borderTopWidth: LINE, paddingVertical: 12, alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  refreshLight: { backgroundColor: YELLOW },
  refreshDark: { backgroundColor: YELLOW },
  refreshText: { fontSize: 14, fontWeight: '900', color: INK },
});
