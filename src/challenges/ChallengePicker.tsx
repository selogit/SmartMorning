import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Keyboard, Modal, SafeAreaView } from 'react-native';
import QrScanner from './QrScanner';
import { Pedometer } from 'expo-sensors';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import OptionWheel from '../ui/OptionWheel';

const countOptions = (values: number[], unit: (n: number) => string) =>
  values.map(v => ({ value: v, label: `${v} ${unit(v)}` }));

/** Polska odmiana: 1 działanie, 2–4 działania, 5+ działań (z wyjątkiem 12–14). */
const plural = (one: string, few: string, many: string) => (n: number) => {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
};

const MATH_OPTIONS = countOptions(MATH_COUNTS, plural('działanie', 'działania', 'działań'));
const SHAKE_OPTIONS = countOptions(SHAKE_COUNTS, plural('potrząśnięcie', 'potrząśnięcia', 'potrząśnięć'));
const STEP_OPTIONS = countOptions(STEP_COUNTS, plural('krok', 'kroki', 'kroków'));
const DIFFICULTY_OPTIONS = DIFFICULTIES.map(d => ({ value: d, label: DIFFICULTY_LABELS[d] }));
import {
  ChallengeConfig,
  ChallengeKind,
  DIFFICULTIES,
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
  const [scanning, setScanning] = useState(false);
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
            <View style={s.wheelRow}>
              <View style={s.wheelCol}>
                <OptionLabel>Poziom trudności</OptionLabel>
                <OptionWheel
                  options={DIFFICULTY_OPTIONS}
                  value={value.mathDifficulty}
                  onChange={mathDifficulty => set({ mathDifficulty })}
                />
              </View>
              <View style={s.wheelCol}>
                <OptionLabel>Liczba działań</OptionLabel>
                <OptionWheel options={MATH_OPTIONS} value={value.mathCount} onChange={mathCount => set({ mathCount })} />
              </View>
            </View>
            <Text style={s.example}>{DIFFICULTY_EXAMPLES[value.mathDifficulty]}</Text>
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
            <OptionWheel options={SHAKE_OPTIONS} value={value.shakeCount} onChange={shakeCount => set({ shakeCount })} />
          </>
        );
      case 'steps':
        return (
          <>
            <OptionLabel>Liczba kroków</OptionLabel>
            <OptionWheel options={STEP_OPTIONS} value={value.stepCount} onChange={stepCount => set({ stepCount })} />
          </>
        );
      case 'qr':
        return (
          <>
            <OptionLabel>Twój kod</OptionLabel>
            <View style={[s.qrBox, !value.qrValue && s.qrBoxMissing]}>
              <Text style={s.qrStatus} numberOfLines={2}>
                {value.qrValue ? `✓ Zapisany: ${value.qrValue.slice(0, 40)}${value.qrValue.length > 40 ? '…' : ''}` : 'Kod nie jest jeszcze zapisany'}
              </Text>
            </View>
            <TouchableOpacity style={s.qrScan} onPress={() => setScanning(true)} activeOpacity={0.8}>
              <Text style={s.qrScanText}>{value.qrValue ? 'Zeskanuj inny kod' : 'Zeskanuj swój kod'}</Text>
            </TouchableOpacity>
            <OptionLabel>Gdzie jest kod? (opcjonalnie)</OptionLabel>
            <TextInput
              style={s.input}
              value={value.qrLabel ?? ''}
              onChangeText={qrLabel => set({ qrLabel })}
              placeholder="np. Łazienka, lustro"
              placeholderTextColor={MUTED}
              maxLength={30}
              selectionColor={INK}
            />
            <Text style={s.example}>
              Dowolny kod QR albo kreskowy — np. naklejka w łazience albo kod z pasty do zębów. Im dalej od łóżka, tym
              lepiej.
            </Text>
          </>
        );
    }
  };

  return (
    <View style={s.root}>
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <SafeAreaView style={s.scanScreen}>
          <View style={s.scanHeader}>
            <Text style={s.scanTitle}>Zeskanuj kod, który wyłączy alarm</Text>
            <TouchableOpacity onPress={() => setScanning(false)}>
              <Text style={s.scanClose}>Anuluj</Text>
            </TouchableOpacity>
          </View>
          {scanning && (
            <QrScanner
              hint="Skieruj aparat na kod"
              onScanned={data => {
                set({ qrValue: data });
                setScanning(false);
              }}
              onPermissionDenied={() => {
                setScanning(false);
                Alert.alert('Brak dostępu do aparatu', 'Zezwól aplikacji na aparat w ustawieniach telefonu.');
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
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
  qrBox: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, padding: 12 },
  qrBoxMissing: { backgroundColor: WHITE, borderStyle: 'dashed' },
  qrStatus: { fontSize: 14, fontWeight: '800', color: INK },
  qrScan: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: INK, paddingVertical: 12, alignItems: 'center' },
  qrScanText: { color: YELLOW, fontSize: 15, fontWeight: '900' },
  scanScreen: { flex: 1, backgroundColor: INK },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 14,
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  scanTitle: { color: YELLOW, fontSize: 16, fontWeight: '900', flex: 1, marginRight: 12 },
  scanClose: { color: WHITE, fontSize: 15, fontWeight: '700' },
  wheelRow: { flexDirection: 'row', gap: 10 },
  wheelCol: { flex: 1 },

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
