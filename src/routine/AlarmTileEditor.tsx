import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import { useAlarms } from '../alarm/AlarmProvider';
import AlarmEditor from '../alarm/AlarmEditor';
import { AlarmDraft } from '../alarm/types';
import { DEFAULT_CHALLENGE, describeChallenge, normalizeChallenge } from '../challenges/challenges';
import { ALL_DAYS, daysLabel } from '../alarm/time';
import { RoutineTile } from './types';

const DURATIONS = [0, 5, 10, 15, 30, 60];

interface Props {
  tile: RoutineTile | null;
  onSave: (tile: RoutineTile) => void;
  onClose: () => void;
}

/**
 * Kafelek Budzik edytuje prawdziwy alarm — tym samym edytorem co ekran Budzik.
 * Kafelek bez połączonego alarmu tworzy nowy alarm przy zapisie (albo łączy się z istniejącym).
 */
export default function AlarmTileEditor({ tile, onSave, onClose }: Props) {
  const { alarms, addAlarm, updateAlarm } = useAlarms();
  const linked = tile?.alarmId ? alarms.find(a => a.id === tile.alarmId) : undefined;
  const [duration, setDuration] = useState(0);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Reset czasu trwania przy otwarciu edytora dla innego kafelka.
  if (tile && openedFor !== tile.id) {
    setOpenedFor(tile.id);
    setDuration(tile.durationMin ?? 0);
  }
  if (!tile && openedFor !== null) setOpenedFor(null);

  const draft: AlarmDraft | null = !tile
    ? null
    : linked
      ? {
          time: linked.time,
          label: linked.label,
          challenge: normalizeChallenge(linked.challenge),
          days: linked.days ?? [...ALL_DAYS],
        }
      : {
          time: tile.time ?? '06:30',
          label: tile.title && tile.title !== 'Budzik' ? tile.title : '',
          challenge: { ...DEFAULT_CHALLENGE },
          days: [...ALL_DAYS],
        };

  const save = async (d: AlarmDraft) => {
    if (!tile) return;
    let alarmId = linked?.id;
    if (alarmId) await updateAlarm(alarmId, d);
    else alarmId = await addAlarm(d);
    onSave({ ...tile, alarmId, time: d.time, title: d.label, durationMin: duration || undefined });
  };

  const linkExisting = (id: string) => {
    if (!tile) return;
    const a = alarms.find(x => x.id === id);
    if (!a) return;
    onSave({ ...tile, alarmId: a.id, time: a.time, title: a.label, durationMin: duration || undefined });
  };

  const others = alarms.filter(a => a.id !== linked?.id).sort((a, b) => a.time.localeCompare(b.time));

  const header = (
    <View style={s.box}>
      <View style={s.bar}>
        <Text style={s.barText}>{linked ? 'Kafelek steruje tym alarmem' : 'Nowy alarm dla planu dnia'}</Text>
      </View>
      <Text style={s.hint}>
        {linked
          ? 'Zmiany zapiszą się w alarmie — zobaczysz je także na ekranie Budzik.'
          : 'Zapisanie utworzy alarm na ekranie Budzik. Możesz też użyć jednego z istniejących:'}
      </Text>
      {!linked &&
        others.map(a => (
          <TouchableOpacity key={a.id} style={s.alarmRow} onPress={() => linkExisting(a.id)} activeOpacity={0.7}>
            <Text style={s.alarmTime}>{a.time}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.alarmLabel} numberOfLines={1}>
                {a.label} · {daysLabel(a.days)}
                {a.enabled ? '' : ' (wyłączony)'}
              </Text>
              {describeChallenge(a.challenge) && (
                <Text style={s.alarmMeta} numberOfLines={1}>
                  {describeChallenge(a.challenge)}
                </Text>
              )}
            </View>
            <Text style={s.alarmUse}>Użyj</Text>
          </TouchableOpacity>
        ))}
    </View>
  );

  const footer = (
    <View style={s.box}>
      <View style={s.bar}>
        <Text style={s.barText}>Czas na ten krok planu</Text>
      </View>
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
      <Text style={s.hint}>W minutach — od tego zależą godziny kolejnych kroków.</Text>
    </View>
  );

  return (
    <AlarmEditor
      draft={draft}
      title={linked ? 'Budzik w planie' : 'Nowy budzik w planie'}
      onSave={save}
      onClose={onClose}
      header={header}
      footer={footer}
    />
  );
}

const s = StyleSheet.create({
  box: { marginHorizontal: 16, marginTop: 16, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  bar: { backgroundColor: INK, paddingHorizontal: 14, paddingVertical: 10 },
  barText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, color: MUTED, paddingHorizontal: 14, paddingVertical: 10 },
  alarmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: LINE,
    borderTopColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  alarmTime: { fontSize: 22, fontWeight: '900', color: INK, marginRight: 12, fontVariant: ['tabular-nums'] },
  alarmLabel: { fontSize: 15, fontWeight: '700', color: INK },
  alarmMeta: { fontSize: 12, color: MUTED, marginTop: 1 },
  alarmUse: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: YELLOW,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  segmented: { flexDirection: 'row', borderTopWidth: LINE, borderTopColor: INK },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  segmentDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  segmentActive: { backgroundColor: INK },
  segmentText: { fontSize: 16, fontWeight: '800', color: INK },
  segmentTextActive: { color: YELLOW },
});
