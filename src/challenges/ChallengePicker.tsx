import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard } from 'react-native';
import { Pedometer } from 'expo-sensors';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import {
  ChallengeConfig,
  ChallengeKind,
  Difficulty,
  CHALLENGE_OPTIONS,
  CHALLENGE_TITLES,
  DEFAULT_PHRASE,
  DIFFICULTY_EXAMPLES,
  DIFFICULTY_LABELS,
  MATH_COUNTS,
  SHAKE_COUNTS,
  STEP_COUNTS,
} from './challenges';

interface SegmentedProps<T extends string | number> {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
}

function Segmented<T extends string | number>({ options, value, onChange, format }: SegmentedProps<T>) {
  return (
    <View style={s.segmented}>
      {options.map((opt, i) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={String(opt)}
            activeOpacity={0.7}
            style={[s.segment, i > 0 && s.segmentDivided, active && s.segmentActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[s.segmentText, active && s.segmentTextActive]}>
              {format ? format(opt) : String(opt)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function OptionLabel({ children }: { children: string }) {
  return <Text style={s.optionLabel}>{children}</Text>;
}

interface Props {
  value: ChallengeConfig;
  onChange: (c: ChallengeConfig) => void;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

async function ensureStepPermission() {
  // Zgodę na licznik kroków bierzemy od razu, a nie o 6:00 rano.
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      Alert.alert(
        'Licznik kroków niedostępny',
        'Ten telefon nie ma czujnika kroków. Podczas alarmu dostaniesz zamiast tego działanie matematyczne.'
      );
      return;
    }
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Brak zgody',
        'Bez zgody na „Aktywność fizyczna” kroki nie będą liczone — podczas alarmu dostaniesz wtedy działanie matematyczne.'
      );
    }
  } catch (e) {
    console.warn('Pedometer permission error', e);
  }
}

export default function ChallengePicker({ value, onChange }: Props) {
  const set = (patch: Partial<ChallengeConfig>) => onChange({ ...value, ...patch });
  const selected = value.types;

  const toggleKind = (kind: ChallengeKind) => {
    Keyboard.dismiss();
    if (selected.includes(kind)) {
      set({ types: selected.filter(k => k !== kind) });
      return;
    }
    set({ types: [...selected, kind] });
    if (kind === 'steps') ensureStepPermission();
  };

  const clearAll = () => {
    Keyboard.dismiss();
    set({ types: [] });
  };

  const renderOptions = (kind: ChallengeKind) => {
    switch (kind) {
      case 'math':
        return (
          <>
            <OptionLabel>Poziom trudności</OptionLabel>
            <Segmented
              options={DIFFICULTIES}
              value={value.mathDifficulty}
              onChange={mathDifficulty => set({ mathDifficulty })}
              format={d => DIFFICULTY_LABELS[d]}
            />
            <Text style={s.example}>{DIFFICULTY_EXAMPLES[value.mathDifficulty]}</Text>
            <OptionLabel>Liczba działań</OptionLabel>
            <Segmented options={MATH_COUNTS} value={value.mathCount} onChange={mathCount => set({ mathCount })} />
          </>
        );
      case 'phrase':
        return (
          <>
            <OptionLabel>Fraza do przepisania</OptionLabel>
            <TextInput
              style={s.input}
              value={value.phrase}
              onChangeText={phrase => set({ phrase })}
              placeholder={DEFAULT_PHRASE}
              placeholderTextColor={MUTED}
              maxLength={80}
              multiline
              autoCorrect={false}
              selectionColor={INK}
            />
            <Text style={s.example}>Puste pole = fraza domyślna. Wklejanie jest zablokowane.</Text>
          </>
        );
      case 'shake':
        return (
          <>
            <OptionLabel>Liczba potrząśnięć</OptionLabel>
            <Segmented options={SHAKE_COUNTS} value={value.shakeCount} onChange={shakeCount => set({ shakeCount })} />
          </>
        );
      case 'steps':
        return (
          <>
            <OptionLabel>Liczba kroków</OptionLabel>
            <Segmented options={STEP_COUNTS} value={value.stepCount} onChange={stepCount => set({ stepCount })} />
          </>
        );
    }
  };

  return (
    <View style={s.root}>
      <View style={s.sectionBar}>
        <Text style={s.sectionTitle}>Zadania przed wyłączeniem</Text>
        <Text style={s.sectionHint}>Zaznacz jedno lub kilka — wykonasz je po kolei</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.7}
        style={[s.typeRow, selected.length === 0 && s.typeRowActive]}
        onPress={clearAll}
      >
        <View style={[s.radio, selected.length === 0 && s.radioActive]}>
          {selected.length === 0 && <View style={s.radioDot} />}
        </View>
        <View style={s.typeTextCell}>
          <Text style={s.typeTitle}>Brak</Text>
          <Text style={s.typeHint}>Wyłączasz jednym dotknięciem</Text>
        </View>
      </TouchableOpacity>

      {CHALLENGE_OPTIONS.map(opt => {
        const order = selected.indexOf(opt.type);
        const active = order >= 0;
        return (
          <TouchableOpacity
            key={opt.type}
            activeOpacity={0.7}
            style={[s.typeRow, active && s.typeRowActive]}
            onPress={() => toggleKind(opt.type)}
          >
            <View style={[s.check, active && s.checkActive]}>
              {active && <Text style={s.checkText}>{order + 1}</Text>}
            </View>
            <View style={s.typeTextCell}>
              <Text style={s.typeTitle}>{opt.title}</Text>
              <Text style={s.typeHint}>{opt.hint}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {selected.map((kind, i) => (
        <View key={kind} style={s.options}>
          <Text style={s.optionsTitle}>
            {i + 1}. {CHALLENGE_TITLES[kind]}
          </Text>
          {renderOptions(kind)}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  root: { marginHorizontal: 16, marginTop: 16 },
  sectionBar: {
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: INK,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  sectionTitle: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  sectionHint: { color: '#BDBDB6', fontSize: 12, fontWeight: '600', marginTop: 2 },
  check: {
    width: 26,
    height: 26,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkActive: { backgroundColor: INK },
  checkText: { color: YELLOW, fontSize: 14, fontWeight: '900' },
  optionsTitle: { fontSize: 15, fontWeight: '900', color: INK, marginTop: 12 },

  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderTopWidth: 0,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  typeRowActive: { backgroundColor: YELLOW },
  radio: {
    width: 26,
    height: 26,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { backgroundColor: INK },
  radioDot: { width: 10, height: 10, backgroundColor: YELLOW },
  typeTextCell: { flex: 1 },
  typeTitle: { fontSize: 17, fontWeight: '800', color: INK },
  typeHint: { fontSize: 13, color: '#55554F', marginTop: 2 },

  options: {
    borderWidth: LINE,
    borderTopWidth: 0,
    borderColor: INK,
    backgroundColor: WHITE,
    padding: 14,
    paddingTop: 4,
  },
  optionLabel: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 12, marginBottom: 6 },
  example: { fontSize: 13, color: MUTED, marginTop: 6 },

  segmented: { flexDirection: 'row', borderWidth: LINE, borderColor: INK },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: WHITE },
  segmentDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  segmentActive: { backgroundColor: INK },
  segmentText: { fontSize: 16, fontWeight: '800', color: INK },
  segmentTextActive: { color: YELLOW },

  input: {
    borderWidth: LINE,
    borderColor: INK,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 17,
    fontWeight: '600',
    color: INK,
    minHeight: 56,
    textAlignVertical: 'top',
  },
});
