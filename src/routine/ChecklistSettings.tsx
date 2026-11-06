import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, DANGER, LINE } from '../theme';
import { DEFAULT_CHECKLIST } from './checklist';

interface Props {
  items: string[];
  onChange: (items: string[]) => void;
  weatherHints: boolean;
  onWeatherHints: (on: boolean) => void;
}

/** Edycja listy „Przed wyjściem” w opcjach kafelka. */
export default function ChecklistSettings({ items, onChange, weatherHints, onWeatherHints }: Props) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!items.some(i => i.trim().toLowerCase() === v.toLowerCase())) onChange([...items, v]);
    setDraft('');
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <View>
      {items.map((item, i) => (
        <View key={`${i}-${item}`} style={s.row}>
          <TextInput
            style={s.itemInput}
            value={item}
            onChangeText={v => onChange(items.map((x, k) => (k === i ? v : x)))}
            selectionColor={INK}
          />
          <TouchableOpacity style={s.icon} onPress={() => move(i, -1)} disabled={i === 0}>
            <Text style={[s.iconText, i === 0 && s.dim]}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.icon} onPress={() => onChange(items.filter((_, k) => k !== i))}>
            <Text style={[s.iconText, { color: DANGER }]}>✕</Text>
          </TouchableOpacity>
        </View>
      ))}
      <View style={s.row}>
        <TextInput
          style={s.itemInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Dodaj rzecz…"
          placeholderTextColor={MUTED}
          onSubmitEditing={add}
          returnKeyType="done"
          blurOnSubmit={false}
          selectionColor={INK}
        />
        <TouchableOpacity style={[s.addBtn, !draft.trim() && s.dim]} onPress={add} disabled={!draft.trim()}>
          <Text style={s.addText}>+ Dodaj</Text>
        </TouchableOpacity>
      </View>
      {items.length === 0 && (
        <TouchableOpacity style={s.reset} onPress={() => onChange(DEFAULT_CHECKLIST)}>
          <Text style={s.resetText}>Przywróć domyślną listę</Text>
        </TouchableOpacity>
      )}
      <Text style={s.hint}>Odhaczenia zerują się każdego dnia.</Text>

      <TouchableOpacity
        style={[s.toggle, weatherHints && s.toggleOn]}
        onPress={() => onWeatherHints(!weatherHints)}
        activeOpacity={0.7}
      >
        <View style={[s.check, weatherHints && s.checkOn]}>{weatherHints && <Text style={s.tick}>✓</Text>}</View>
        <View style={{ flex: 1 }}>
          <Text style={s.toggleTitle}>Podpowiedzi z pogody</Text>
          <Text style={s.toggleHint}>
            Przy deszczu dopisze „☂ Parasol”, przy mrozie „Czapka i rękawiczki” (wg prognozy na rano)
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginBottom: -LINE,
  },
  itemInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: '700', color: INK },
  icon: { paddingHorizontal: 14, paddingVertical: 10, borderLeftWidth: LINE, borderLeftColor: INK },
  iconText: { fontSize: 16, fontWeight: '900', color: INK },
  dim: { opacity: 0.3 },
  addBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: LINE,
    borderLeftColor: INK,
    backgroundColor: YELLOW,
  },
  addText: { fontSize: 14, fontWeight: '900', color: INK },
  reset: { marginTop: 10 + LINE, borderWidth: LINE, borderColor: INK, padding: 10, alignItems: 'center' },
  resetText: { fontSize: 14, fontWeight: '800', color: INK },
  hint: { fontSize: 13, color: MUTED, marginTop: 6 + LINE },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  toggleOn: { backgroundColor: YELLOW },
  check: {
    width: 22,
    height: 22,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOn: { backgroundColor: INK },
  tick: { color: YELLOW, fontSize: 14, fontWeight: '900', lineHeight: 16 },
  toggleTitle: { fontSize: 16, fontWeight: '800', color: INK },
  toggleHint: { fontSize: 12, color: '#55554F', marginTop: 1 },
});
