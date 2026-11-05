import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, Switch } from 'react-native';
import { INK, YELLOW, PAPER, WHITE, MUTED, LINE } from '../theme';
import { useAlarms } from '../alarm/AlarmProvider';
import OptionWheel from '../ui/OptionWheel';
import { useBedtime } from './BedtimeProvider';
import { currentNight, hm, sleepLabel } from './bedtime';
import { formatDuration } from '../alarm/time';

const SLEEP_OPTIONS = Array.from({ length: 17 }, (_, i) => 6 * 60 + i * 15).map(m => ({ value: m, label: sleepLabel(m) }));
const BEFORE_OPTIONS = [0, 10, 15, 20, 30, 45, 60, 90].map(m => ({
  value: m,
  label: m === 0 ? 'o czasie' : `${m} min przed`,
}));

/** Okno ustawień przypomnienia o śnie. */
export function BedtimeSettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, setSettings } = useBedtime();
  const { alarms } = useAlarms();
  const night = currentNight(alarms, settings);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Przypomnienie o śnie</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.sheetClose}>Gotowe</Text>
            </TouchableOpacity>
          </View>

          <View style={s.switchRow}>
            <Text style={s.switchLabel}>Przypominaj o pójściu spać</Text>
            <Switch
              value={settings.enabled}
              onValueChange={enabled => setSettings({ ...settings, enabled })}
              trackColor={{ false: '#B0B0AA', true: INK }}
              thumbColor={settings.enabled ? YELLOW : WHITE}
            />
          </View>

          <View style={[s.wheels, !settings.enabled && s.dimmed]} pointerEvents={settings.enabled ? 'auto' : 'none'}>
            <View style={s.wheelCol}>
              <Text style={s.label}>Ile snu</Text>
              <OptionWheel
                options={SLEEP_OPTIONS}
                value={settings.sleepMinutes}
                onChange={sleepMinutes => setSettings({ ...settings, sleepMinutes })}
              />
            </View>
            <View style={s.wheelCol}>
              <Text style={s.label}>Przypomnienie</Text>
              <OptionWheel
                options={BEFORE_OPTIONS}
                value={settings.remindBefore}
                onChange={remindBefore => setSettings({ ...settings, remindBefore })}
              />
            </View>
          </View>

          <Text style={s.summary}>
            {!night
              ? 'Brak włączonych alarmów — przypomnienie liczy się od pierwszego alarmu następnego dnia.'
              : settings.enabled
                ? `Najbliższa noc: połóż się o ${hm(night.bedtime)}, przypomnienie o ${hm(night.remindAt)}. Pobudka ${hm(night.wake)}.`
                : 'Przypomnienia wyłączone.'}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Wiersz na ekranie Budzik: skrót ustawień i wejście do nich. */
export function BedtimeRow() {
  const { settings } = useBedtime();
  const { alarms } = useAlarms();
  const [open, setOpen] = useState(false);
  const night = currentNight(alarms, settings);
  return (
    <>
      <TouchableOpacity style={s.row} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={s.rowIcon}>🌙</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Przypomnienie o śnie</Text>
          <Text style={s.rowMeta} numberOfLines={1}>
            {!settings.enabled
              ? 'wyłączone'
              : night
                ? `połóż się o ${hm(night.bedtime)} · ${sleepLabel(settings.sleepMinutes)} snu`
                : `${sleepLabel(settings.sleepMinutes)} snu · brak alarmów`}
          </Text>
        </View>
        <View style={s.rowAction}>
          <Text style={s.rowActionText}>Ustaw</Text>
        </View>
      </TouchableOpacity>
      <BedtimeSettingsModal visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * Karta wieczorna na stronę główną — pokazuje się, gdy do pory snu zostało mniej niż 4 h
 * (albo pora snu już minęła, a pobudka jeszcze nie).
 */
export function EveningCard({ onWriteNote }: { onWriteNote: () => void }) {
  const { settings } = useBedtime();
  const { alarms } = useAlarms();
  const now = new Date();
  const night = currentNight(alarms, settings, now);
  if (!settings.enabled || !night) return null;
  const toBed = night.bedtime.getTime() - now.getTime();
  if (toBed > 4 * 3600000) return null;
  const late = toBed <= 0;

  return (
    <View style={s.card}>
      <View style={s.cardBar}>
        <Text style={s.cardBarText}>🌙 Wieczór</Text>
        <Text style={s.cardBarMeta}>pobudka {hm(night.wake)}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.cardMain}>
          {late ? 'Pora snu już minęła' : `Połóż się o ${hm(night.bedtime)}`}
        </Text>
        <Text style={s.cardSub}>
          {late
            ? `Do pobudki zostało ${formatDuration(night.wake.getTime() - now.getTime())}.`
            : `Za ${formatDuration(toBed)} — tak prześpisz ${sleepLabel(settings.sleepMinutes)}.`}
        </Text>
      </View>
      <TouchableOpacity style={s.cardButton} onPress={onWriteNote} activeOpacity={0.8}>
        <Text style={s.cardButtonText}>Zapisz coś na jutro</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: PAPER, borderWidth: LINE, borderColor: INK, paddingBottom: 16 },
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 14,
  },
  switchLabel: { fontSize: 15, fontWeight: '800', color: INK, flex: 1 },
  wheels: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 8 },
  wheelCol: { flex: 1 },
  dimmed: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 10, marginBottom: 6 },
  summary: { fontSize: 13, color: INK, fontWeight: '600', marginHorizontal: 16, marginTop: 12, lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingLeft: 12,
    marginBottom: 16,
  },
  rowIcon: { fontSize: 20, marginRight: 10 },
  rowTitle: { fontSize: 15, fontWeight: '900', color: INK, paddingTop: 10 },
  rowMeta: { fontSize: 12, fontWeight: '700', color: MUTED, paddingBottom: 10, marginTop: 1 },
  rowAction: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    backgroundColor: YELLOW,
  },
  rowActionText: { fontSize: 14, fontWeight: '900', color: INK },

  card: { marginTop: 16, borderWidth: LINE, borderColor: INK, backgroundColor: INK },
  cardBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  cardBarText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  cardBarMeta: { color: '#BDBDB6', fontSize: 13, fontWeight: '700' },
  cardBody: { padding: 14 },
  cardMain: { color: WHITE, fontSize: 24, fontWeight: '900' },
  cardSub: { color: '#BDBDB6', fontSize: 14, fontWeight: '600', marginTop: 4 },
  cardButton: { backgroundColor: YELLOW, paddingVertical: 14, alignItems: 'center' },
  cardButtonText: { color: INK, fontSize: 15, fontWeight: '900' },
});
