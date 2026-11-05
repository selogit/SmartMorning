import React from 'react';
import { View, StyleSheet } from 'react-native';
import { INK } from '../theme';

const SIZE = 22;
const THICK = 2.5;
const HEAD = 11;
// Kwadrat z lewą i dolną krawędzią obrócony o 45° daje grot „<” z czubkiem po lewej, w połowie wysokości.
const TIP_X = 3;
const HEAD_LEFT = TIP_X - HEAD / 2 + (HEAD * Math.SQRT2) / 2;
const MID = SIZE / 2;

/**
 * Strzałka „wstecz” rysowana z kształtów (nie znak tekstowy), więc jest zawsze wyśrodkowana —
 * czcionki Androida różnie układają znak „←” w pionie.
 */
export default function BackArrow({ color = INK }: { color?: string }) {
  return (
    <View style={s.box}>
      <View style={[s.shaft, { backgroundColor: color }]} />
      <View style={[s.head, { borderColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: SIZE, height: SIZE },
  shaft: {
    position: 'absolute',
    left: TIP_X + 1,
    right: 2,
    top: MID - THICK / 2,
    height: THICK,
  },
  head: {
    position: 'absolute',
    left: HEAD_LEFT,
    top: MID - HEAD / 2,
    width: HEAD,
    height: HEAD,
    borderLeftWidth: THICK,
    borderBottomWidth: THICK,
    transform: [{ rotate: '45deg' }],
  },
});
