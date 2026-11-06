import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import OptionWheel, { WheelOption } from '../ui/OptionWheel';

const MINUTES = [
  ...Array.from({ length: 30 }, (_, i) => i + 1),
  35, 40, 45, 50, 55, 60, 75, 90, 120,
];
const OPTIONS: WheelOption<number>[] = MINUTES.map(m => ({ value: m, label: `${m} min` }));
const DEFAULT_MIN = 10;

export interface TimerValue {
  /** Brak = minutnik wyłączony. */
  minutes?: number;
  autoNext: boolean;
}

interface Props {
  value: TimerValue;
  onChange: (value: TimerValue) => void;
}

/** Opcjonalny minutnik kroku planu — wspólny dla wszystkich kafelków. */
export default function TimerSettings({ value, onChange }: Props) {
  const on = value.minutes !== undefined;
  return (
    <View>
      <TouchableOpacity
        style={[s.row, on && s.rowActive]}
        onPress={() => onChange({ ...value, minutes: on ? undefined : DEFAULT_MIN })}
        activeOpacity={0.7}
      >
        <View style={[s.box, on && s.boxActive]}>{on && <Text style={s.tick}>✓</Text>}</View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Minutnik</Text>
          <Text style={s.hint}>Odliczanie w tym kroku i powiadomienie, gdy czas minie</Text>
        </View>
      </TouchableOpacity>

      {on && (
        <>
          <View style={s.wheel}>
            <OptionWheel options={OPTIONS} value={value.minutes!} onChange={minutes => onChange({ ...value, minutes })} />
          </View>
          <TouchableOpacity
            style={[s.row, value.autoNext && s.rowActive]}
            onPress={() => onChange({ ...value, autoNext: !value.autoNext })}
            activeOpacity={0.7}
          >
            <View style={[s.box, value.autoNext && s.boxActive]}>{value.autoNext && <Text style={s.tick}>✓</Text>}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Potem przejdź dalej</Text>
              <Text style={s.hint}>Po końcu odliczania plan sam przejdzie do następnego kroku</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
      <Text style={s.footHint}>
        {on
          ? 'Od długości minutnika zależą godziny kolejnych kroków.'
          : 'Bez minutnika krok trwa, dopóki nie dotkniesz „Dalej”.'}
      </Text>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: -LINE,
  },
  rowActive: { backgroundColor: YELLOW },
  box: {
    width: 22,
    height: 22,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxActive: { backgroundColor: INK },
  tick: { color: YELLOW, fontSize: 14, fontWeight: '900', lineHeight: 16 },
  title: { fontSize: 16, fontWeight: '800', color: INK },
  hint: { fontSize: 12, color: '#55554F', marginTop: 1 },
  wheel: { marginBottom: -LINE },
  footHint: { fontSize: 13, color: MUTED, marginTop: 6 + LINE },
});
