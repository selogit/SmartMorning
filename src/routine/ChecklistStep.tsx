import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { INK, YELLOW, WHITE, LINE } from '../theme';
import { useWeather } from '../weather/WeatherProvider';
import { todayKey } from '../notes/NotesProvider';
import { RoutineTile } from './types';
import { ChecklistState, DEFAULT_CHECKLIST, isChecked, stateForDay, toggleItem, weatherItems } from './checklist';

const KEY = 'checklist-state';
const tabular = ['tabular-nums' as const];

/** Krok „Przed wyjściem” — lista do odhaczenia; stan zapisany na dziś. */
export default function ChecklistStep({ tile }: { tile: RoutineTile }) {
  const { forecast } = useWeather();
  const [state, setState] = useState<ChecklistState>(() => stateForDay(null, todayKey()));

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(raw => setState(stateForDay(raw ? JSON.parse(raw) : null, todayKey())))
      .catch(() => {});
  }, []);

  const base = tile.checklist ?? DEFAULT_CHECKLIST;
  const extra = tile.weatherHints === false ? [] : weatherItems(forecast, base);
  const items = [...extra, ...base];
  const done = items.filter(i => isChecked(state, tile.id, i)).length;
  const all = items.length > 0 && done === items.length;

  const toggle = (item: string) => {
    const next = toggleItem(stateForDay(state, todayKey()), tile.id, item);
    setState(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };

  return (
    <View style={s.panel}>
      <View style={[s.head, all && s.headDone]}>
        <Text style={[s.headText, all && s.headTextDone]}>{all ? 'Wszystko zabrane ✓' : 'Masz wszystko?'}</Text>
        <Text style={[s.count, all && s.headTextDone]}>
          {done}/{items.length}
        </Text>
      </View>
      <ScrollView>
        {items.length === 0 && <Text style={s.empty}>Lista jest pusta — dodaj rzeczy w opcjach kafelka.</Text>}
        {items.map((item, i) => {
          const on = isChecked(state, tile.id, item);
          const fromWeather = i < extra.length;
          return (
            <TouchableOpacity key={item} style={s.row} onPress={() => toggle(item)} activeOpacity={0.7}>
              <View style={[s.box, on && s.boxOn]}>{on && <Text style={s.tick}>✓</Text>}</View>
              <Text style={[s.item, on && s.itemOn]} numberOfLines={2}>
                {item}
              </Text>
              {fromWeather && <Text style={s.tag}>pogoda</Text>}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { flex: 1, marginTop: 12, marginBottom: 12, borderWidth: LINE, borderColor: YELLOW },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  headDone: { backgroundColor: YELLOW },
  headText: { color: YELLOW, fontSize: 16, fontWeight: '900' },
  headTextDone: { color: INK },
  count: { color: YELLOW, fontSize: 16, fontWeight: '900', fontVariant: tabular },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A36',
  },
  box: {
    width: 28,
    height: 28,
    borderWidth: LINE,
    borderColor: YELLOW,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxOn: { backgroundColor: YELLOW },
  tick: { color: INK, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  item: { flex: 1, color: WHITE, fontSize: 19, fontWeight: '800' },
  itemOn: { color: '#77776F', textDecorationLine: 'line-through' },
  tag: { color: INK, backgroundColor: YELLOW, fontSize: 11, fontWeight: '900', paddingHorizontal: 6, paddingVertical: 2 },
  empty: { color: '#9A9A94', fontSize: 15, fontWeight: '700', padding: 14 },
});
