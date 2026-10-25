import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  Linking,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { useWeather } from './WeatherProvider';
import { searchPlaces } from './api';
import { codeInfo } from './codes';
import { adviceFor, hhmm, morningWindow, round } from './advice';
import { WeatherPlace } from './types';

const WEEKDAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const pad = (n: number) => String(n).padStart(2, '0');

const placeLabel = (p: WeatherPlace) => [p.admin1, p.country].filter(Boolean).join(', ');

function dayName(date: string, index: number) {
  if (index === 0) return 'Dziś';
  if (index === 1) return 'Jutro';
  const [y, m, d] = date.split('-').map(Number);
  const name = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return name[0].toUpperCase() + name.slice(1);
}

function PlaceSearch({ apiKey, onPick, onCancel }: { apiKey?: string; onPick: (p: WeatherPlace) => void; onCancel?: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const mySeq = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await searchPlaces(q, apiKey);
        if (mySeq !== seq.current) return;
        setResults(found);
        setError(found.length === 0 ? 'Nie znaleziono takiej miejscowości' : null);
      } catch (e: any) {
        if (mySeq === seq.current) setError(e?.message ?? 'Błąd wyszukiwania');
      } finally {
        if (mySeq === seq.current) setBusy(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query, apiKey]);

  return (
    <View>
      <View style={s.sectionBar}>
        <Text style={s.sectionTitle}>Wybierz miasto</Text>
        {onCancel && (
          <TouchableOpacity onPress={onCancel}>
            <Text style={s.sectionAction}>Anuluj</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="np. Kraków"
          placeholderTextColor={MUTED}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          selectionColor={INK}
        />
        {busy && <ActivityIndicator style={s.searchSpinner} color={INK} />}
      </View>
      {error && <Text style={s.searchError}>{error}</Text>}
      {results.map(p => (
        <TouchableOpacity
          key={`${p.id ?? ''}${p.latitude},${p.longitude}`}
          style={s.resultRow}
          onPress={() => {
            Keyboard.dismiss();
            onPick(p);
          }}
        >
          <Text style={s.resultName}>{p.name}</Text>
          <Text style={s.resultMeta}>{placeLabel(p)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function WeatherScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { place, forecast, fetchedAt, loading, error, apiKey, refresh, setPlace, setApiKey } = useWeather();
  const [searching, setSearching] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKey ?? '');

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const updated = fetchedAt
    ? (() => {
        const d = new Date(fetchedAt);
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      })()
    : null;

  const info = forecast ? codeInfo(forecast.current.code, forecast.current.isDay) : null;
  const morning = forecast ? morningWindow(forecast) : null;
  const tips = forecast ? adviceFor(forecast) : [];

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <Text style={s.backText}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Pogoda</Text>
        {place && (
          <TouchableOpacity style={s.refresh} onPress={() => refresh(true)} disabled={loading}>
            {loading ? <ActivityIndicator color={INK} /> : <Text style={s.refreshText}>Odśwież</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 40 + bottomInset }]} keyboardShouldPersistTaps="handled">
        {!place || searching ? (
          <PlaceSearch
            apiKey={apiKey}
            onPick={p => {
              setPlace(p);
              setSearching(false);
            }}
            onCancel={place ? () => setSearching(false) : undefined}
          />
        ) : (
          <>
            <View style={s.placeBar}>
              <View style={{ flex: 1 }}>
                <Text style={s.placeName}>{place.name}</Text>
                <Text style={s.placeMeta}>{placeLabel(place)}</Text>
              </View>
              <TouchableOpacity style={s.placeChange} onPress={() => setSearching(true)}>
                <Text style={s.placeChangeText}>Zmień</Text>
              </TouchableOpacity>
            </View>

            {error && (
              <View style={s.errorBar}>
                <Text style={s.errorText}>
                  {forecast ? `Brak połączenia — pokazuję dane z ${updated}. ` : ''}
                  {error}
                </Text>
              </View>
            )}

            {forecast && info && morning ? (
              <>
                <View style={s.now}>
                  <Text style={s.nowIcon}>{info.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.nowTemp}>{round(forecast.current.temp)}°</Text>
                    <Text style={s.nowLabel}>{info.label}</Text>
                  </View>
                  <View style={s.nowStats}>
                    <Text style={s.nowStat}>Odczuwalna {round(forecast.current.feels)}°</Text>
                    <Text style={s.nowStat}>Wiatr {round(forecast.current.wind)} km/h</Text>
                    {forecast.current.precipitation > 0 && (
                      <Text style={s.nowStat}>Opad {forecast.current.precipitation} mm</Text>
                    )}
                  </View>
                </View>

                <View style={s.tips}>
                  {tips.map(t => (
                    <View key={t} style={s.tipRow}>
                      <View style={s.tipDot} />
                      <Text style={s.tipText}>{t}</Text>
                    </View>
                  ))}
                </View>

                <View style={s.sectionBar}>
                  <Text style={s.sectionTitle}>{morning.label}</Text>
                  <Text style={s.sectionMeta}>temperatura · szansa opadów</Text>
                </View>
                <View style={s.hours}>
                  {morning.hours.map((h, i) => (
                    <View key={h.time} style={[s.hour, i > 0 && s.hourDivided]}>
                      <Text style={s.hourTime}>{h.time.slice(11, 16)}</Text>
                      <Text style={s.hourIcon}>{codeInfo(h.code).icon}</Text>
                      <Text style={s.hourTemp}>{round(h.temp)}°</Text>
                      <Text style={s.hourRain}>{h.precipProb ?? 0}%</Text>
                    </View>
                  ))}
                </View>

                <View style={s.sectionBar}>
                  <Text style={s.sectionTitle}>Najbliższe dni</Text>
                </View>
                {forecast.daily.map((d, i) => (
                  <View key={d.date} style={s.dayRow}>
                    <Text style={s.dayName}>{dayName(d.date, i)}</Text>
                    <Text style={s.dayIcon}>{codeInfo(d.code).icon}</Text>
                    <Text style={s.dayTemps}>
                      {round(d.min)}° / {round(d.max)}°
                    </Text>
                    <Text style={s.dayRain}>{d.precipProbMax ?? 0}%</Text>
                    <Text style={s.daySun}>
                      ↑{hhmm(d.sunrise)} ↓{hhmm(d.sunset)}
                    </Text>
                  </View>
                ))}

                {updated && <Text style={s.updated}>Zaktualizowano {updated}</Text>}
              </>
            ) : (
              <View style={s.loadingBox}>
                {loading ? <ActivityIndicator color={INK} size="large" /> : <Text style={s.loadingText}>Brak danych</Text>}
              </View>
            )}
          </>
        )}

        <TouchableOpacity style={s.keyToggle} onPress={() => setKeyOpen(o => !o)}>
          <Text style={s.keyToggleText}>
            Klucz API Open-Meteo {apiKey ? '· ustawiony' : '(opcjonalny)'} {keyOpen ? '▲' : '▼'}
          </Text>
        </TouchableOpacity>
        {keyOpen && (
          <View style={s.keyBox}>
            <Text style={s.keyHint}>
              Do użytku prywatnego klucz nie jest potrzebny. Po wpisaniu klucza aplikacja korzysta z płatnego API
              (customer-api.open-meteo.com).
            </Text>
            <TextInput
              style={s.keyInput}
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="wklej klucz"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              selectionColor={INK}
            />
            <TouchableOpacity
              style={s.keySave}
              onPress={() => {
                setApiKey(keyDraft);
                setKeyOpen(false);
                Keyboard.dismiss();
              }}
            >
              <Text style={s.keySaveText}>{keyDraft.trim() ? 'Zapisz klucz' : 'Usuń klucz'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => Linking.openURL('https://open-meteo.com/')}>
          <Text style={s.attribution}>Dane pogodowe: Open-Meteo.com (CC BY 4.0)</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAPER,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  backText: { fontSize: 22, fontWeight: '900', color: INK, marginTop: -2 },
  title: { flex: 1, fontSize: 32, fontWeight: '900', color: INK, letterSpacing: -1 },
  refresh: {
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: YELLOW,
    paddingHorizontal: 12,
    height: 40,
    justifyContent: 'center',
    minWidth: 86,
    alignItems: 'center',
  },
  refreshText: { fontSize: 14, fontWeight: '800', color: INK },

  body: { padding: 16, paddingBottom: 40 },

  sectionBar: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionTitle: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  sectionMeta: { color: '#BDBDB6', fontSize: 12, fontWeight: '700' },
  sectionAction: { color: WHITE, fontSize: 14, fontWeight: '700' },

  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  searchInput: { flex: 1, fontSize: 18, fontWeight: '600', color: INK, paddingHorizontal: 14, paddingVertical: 14 },
  searchSpinner: { marginRight: 14 },
  searchError: { fontSize: 14, fontWeight: '700', color: DANGER, marginTop: 10 },
  resultRow: {
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: -LINE,
  },
  resultName: { fontSize: 17, fontWeight: '800', color: INK },
  resultMeta: { fontSize: 13, color: MUTED, marginTop: 2 },

  placeBar: { flexDirection: 'row', alignItems: 'center', borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, paddingLeft: 14 },
  placeName: { fontSize: 20, fontWeight: '900', color: INK, paddingTop: 10 },
  placeMeta: { fontSize: 13, color: MUTED, paddingBottom: 10 },
  placeChange: { alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: 16, borderLeftWidth: LINE, borderLeftColor: INK },
  placeChangeText: { fontSize: 14, fontWeight: '800', color: INK },

  errorBar: { backgroundColor: DANGER, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  errorText: { color: WHITE, fontSize: 13, fontWeight: '700' },

  now: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: YELLOW,
    borderWidth: LINE,
    borderColor: INK,
    padding: 14,
  },
  nowIcon: { fontSize: 54, marginRight: 12 },
  nowTemp: { fontSize: 60, fontWeight: '900', color: INK, letterSpacing: -2, lineHeight: 64 },
  nowLabel: { fontSize: 16, fontWeight: '800', color: INK },
  nowStats: { alignItems: 'flex-end' },
  nowStat: { fontSize: 13, fontWeight: '700', color: INK, marginTop: 2 },

  tips: { backgroundColor: INK, padding: 14, borderWidth: LINE, borderTopWidth: 0, borderColor: INK },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3 },
  tipDot: { width: 8, height: 8, backgroundColor: YELLOW, marginTop: 6, marginRight: 10 },
  tipText: { flex: 1, color: WHITE, fontSize: 15, fontWeight: '700', lineHeight: 21 },

  hours: { flexDirection: 'row', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  hour: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  hourDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  hourTime: { fontSize: 12, fontWeight: '900', color: INK },
  hourIcon: { fontSize: 20, marginVertical: 4 },
  hourTemp: { fontSize: 16, fontWeight: '900', color: INK },
  hourRain: { fontSize: 11, fontWeight: '800', color: '#2F6FA0', marginTop: 2 },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderTopWidth: 0,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dayName: { width: 96, fontSize: 15, fontWeight: '900', color: INK },
  dayIcon: { fontSize: 20, width: 32 },
  dayTemps: { flex: 1, fontSize: 15, fontWeight: '800', color: INK },
  dayRain: { width: 44, fontSize: 13, fontWeight: '800', color: '#2F6FA0' },
  daySun: { fontSize: 12, fontWeight: '700', color: MUTED },

  updated: { fontSize: 12, color: MUTED, marginTop: 10 },
  loadingBox: { paddingVertical: 48, alignItems: 'center' },
  loadingText: { fontSize: 15, color: MUTED, fontWeight: '700' },

  keyToggle: { marginTop: 28, paddingVertical: 8 },
  keyToggleText: { fontSize: 13, fontWeight: '800', color: MUTED },
  keyBox: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, padding: 12 },
  keyHint: { fontSize: 13, color: MUTED, lineHeight: 19 },
  keyInput: {
    borderWidth: LINE,
    borderColor: INK,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: INK,
  },
  keySave: { marginTop: 10, backgroundColor: YELLOW, borderWidth: LINE, borderColor: INK, paddingVertical: 12, alignItems: 'center' },
  keySaveText: { fontSize: 15, fontWeight: '900', color: INK },

  attribution: { fontSize: 12, color: MUTED, marginTop: 16, textDecorationLine: 'underline' },
});
