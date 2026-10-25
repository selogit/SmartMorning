import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { INK, YELLOW, WHITE, MUTED, LINE } from '../theme';
import { useWeather } from './WeatherProvider';
import { codeInfo } from './codes';
import { adviceFor, morningWindow, round } from './advice';

interface Props {
  /** light = strona główna (jasne tło), dark = plan dnia / ekran pobudki. */
  tone?: 'light' | 'dark';
  onPress?: () => void;
  /** Pokaż pasek godzin porannych. */
  showHours?: boolean;
}

/** Zwięzłe podsumowanie pogody do osadzenia na innych ekranach. */
export default function WeatherCard({ tone = 'light', onPress, showHours = false }: Props) {
  const { place, forecast, loading, error } = useWeather();
  const dark = tone === 'dark';
  const fg = dark ? WHITE : INK;

  const body = (() => {
    if (!place) {
      return <Text style={[s.empty, { color: fg }]}>Pogoda — dotknij, aby ustawić miasto</Text>;
    }
    if (!forecast) {
      return (
        <Text style={[s.empty, { color: fg }]}>
          {loading ? 'Pobieram pogodę…' : error ? `Pogoda niedostępna: ${error}` : 'Brak danych pogodowych'}
        </Text>
      );
    }
    const info = codeInfo(forecast.current.code, forecast.current.isDay);
    const tips = adviceFor(forecast);
    const morning = morningWindow(forecast);
    return (
      <>
        <View style={s.row}>
          <Text style={s.icon}>{info.icon}</Text>
          <Text style={[s.temp, { color: fg }]}>{round(forecast.current.temp)}°</Text>
          <View style={s.info}>
            <Text style={[s.label, { color: fg }]} numberOfLines={1}>
              {info.label}
            </Text>
            <Text style={[s.place, { color: dark ? '#9A9A94' : MUTED }]} numberOfLines={1}>
              {place.name} · odczuwalna {round(forecast.current.feels)}°
            </Text>
          </View>
        </View>
        <View style={[s.tip, dark && s.tipDark]}>
          <Text style={[s.tipText, dark && s.tipTextDark]} numberOfLines={2}>
            {tips[0]}
          </Text>
        </View>
        {showHours && morning.hours.length > 0 && (
          <View style={[s.hours, { borderColor: dark ? YELLOW : INK }]}>
            {morning.hours.map((h, i) => (
              <View key={h.time} style={[s.hour, i > 0 && { borderLeftWidth: LINE, borderLeftColor: dark ? YELLOW : INK }]}>
                <Text style={[s.hourTime, { color: fg }]}>{h.time.slice(11, 13)}</Text>
                <Text style={s.hourIcon}>{codeInfo(h.code).icon}</Text>
                <Text style={[s.hourTemp, { color: fg }]}>{round(h.temp)}°</Text>
                <Text style={s.hourRain}>{h.precipProb ?? 0}%</Text>
              </View>
            ))}
          </View>
        )}
      </>
    );
  })();

  if (!onPress) return <View style={s.root}>{body}</View>;
  return (
    <TouchableOpacity style={s.root} activeOpacity={0.8} onPress={onPress}>
      {body}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: {},
  empty: { fontSize: 15, fontWeight: '700', paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 34, marginRight: 8 },
  temp: { fontSize: 40, fontWeight: '900', letterSpacing: -1, marginRight: 12 },
  info: { flex: 1 },
  label: { fontSize: 16, fontWeight: '800' },
  place: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  tip: { marginTop: 10, backgroundColor: INK, paddingHorizontal: 10, paddingVertical: 8 },
  tipDark: { backgroundColor: YELLOW },
  tipText: { color: YELLOW, fontSize: 13, fontWeight: '800' },
  tipTextDark: { color: INK },
  hours: { flexDirection: 'row', marginTop: 10, borderWidth: LINE },
  hour: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  hourTime: { fontSize: 12, fontWeight: '900' },
  hourIcon: { fontSize: 16, marginVertical: 2 },
  hourTemp: { fontSize: 14, fontWeight: '900' },
  hourRain: { fontSize: 11, fontWeight: '700', color: '#4A90C2' },
});
