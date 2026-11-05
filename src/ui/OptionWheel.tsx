import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { INK, YELLOW, WHITE, LINE } from '../theme';

export interface WheelOption<T> {
  value: T;
  label: string;
}

interface Props<T> {
  options: WheelOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Liczba widocznych pozycji (nieparzysta). */
  visible?: number;
  itemHeight?: number;
}

const tabular = ['tabular-nums' as const];

/** Indeks wartości; dla liczb spoza listy — najbliższa pozycja. */
function indexOf<T>(options: WheelOption<T>[], value: T) {
  const exact = options.findIndex(o => o.value === value);
  if (exact >= 0) return exact;
  if (typeof value === 'number') {
    let best = 0;
    options.forEach((o, i) => {
      if (Math.abs((o.value as number) - value) < Math.abs((options[best].value as number) - value)) best = i;
    });
    return best;
  }
  return 0;
}

/** Przewijane kółko wyboru (jak przy ustawianiu godziny), do list z wieloma opcjami. */
export default function OptionWheel<T>({ options, value, onChange, visible = 3, itemHeight = 46 }: Props<T>) {
  const ref = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const selected = indexOf(options, value);
  const last = useRef(selected);
  const didInit = useRef(false);
  const padding = itemHeight * Math.floor(visible / 2);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const raw = Math.round(e.nativeEvent.contentOffset.y / itemHeight);
    const i = Math.min(options.length - 1, Math.max(0, raw));
    if (i !== last.current) {
      last.current = i;
      onChange(options[i].value);
    }
  };

  return (
    <View style={[s.wheel, { height: itemHeight * visible }]}>
      <View pointerEvents="none" style={[s.highlight, { top: padding, height: itemHeight }]} />
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onContentSizeChange={() => {
          if (!didInit.current) {
            didInit.current = true;
            ref.current?.scrollTo({ y: selected * itemHeight, animated: false });
          }
        }}
        contentContainerStyle={{ paddingVertical: padding }}
      >
        {options.map((o, i) => (
          <TouchableOpacity
            key={String(o.value)}
            activeOpacity={0.6}
            style={[s.item, { height: itemHeight }]}
            onPress={() => ref.current?.scrollTo({ y: i * itemHeight, animated: true })}
          >
            <Text
              style={[s.text, i === selected && s.textActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wheel: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, overflow: 'hidden' },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: YELLOW,
    borderTopWidth: LINE,
    borderBottomWidth: LINE,
    borderColor: INK,
  },
  item: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  text: { fontSize: 16, fontWeight: '600', color: '#9A9A94', fontVariant: tabular },
  textActive: { fontSize: 18, fontWeight: '900', color: INK },
});
