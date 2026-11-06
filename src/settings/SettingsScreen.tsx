import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import BackArrow from '../ui/BackArrow';
import { ACCENTS, INK, PAPER, WHITE, MUTED, LINE, YELLOW } from '../theme';
import { useTheme } from '../themeRuntime';
import PermissionsCheck from './PermissionsCheck';

export default function SettingsScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { accent, setAccent } = useTheme();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const accentName = ACCENTS.find(a => a.color === accent)?.name ?? '';

  // key={accent}: po zmianie koloru ekran rysuje się od nowa z nowymi stylami.
  return (
    <SafeAreaView style={s.container} key={accent}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goBack} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={s.title}>Ustawienia</Text>
      </View>

      <ScrollView contentContainerStyle={[s.body, { paddingBottom: 32 + bottomInset }]}>
        <View style={s.sectionBar}>
          <Text style={s.sectionText}>Uprawnienia alarmu</Text>
        </View>
        <PermissionsCheck />

        <View style={[s.sectionBar, { marginTop: 24 }]}>
          <Text style={s.sectionText}>Kolor akcentu</Text>
          <Text style={s.sectionValue}>{accentName}</Text>
        </View>
        <View style={s.grid}>
          {ACCENTS.map(a => {
            const on = a.color === accent;
            return (
              <TouchableOpacity
                key={a.id}
                style={[s.swatch, { backgroundColor: a.color }, on && s.swatchOn]}
                onPress={() => setAccent(a.color)}
                activeOpacity={0.8}
              >
                <Text style={s.swatchName}>{a.name}</Text>
                {on && <Text style={s.swatchCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={s.hint}>Kolor zmienia się w całej aplikacji: na pulpicie, w planie dnia, alarmach i modułach.</Text>

        <Text style={s.previewLabel}>Podgląd</Text>
        <View style={s.preview}>
          <View style={s.previewAccent}>
            <Text style={s.previewClock}>06:30</Text>
          </View>
          <View style={s.previewDark}>
            <Text style={s.previewDarkText}>Dalej →</Text>
          </View>
        </View>
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
  title: { flex: 1, fontSize: 32, fontWeight: '900', color: INK, letterSpacing: -1 },

  body: { padding: 16 },
  sectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionText: { color: WHITE, fontSize: 15, fontWeight: '900' },
  sectionValue: { color: '#BDBDB6', fontSize: 14, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderLeftWidth: LINE, borderTopWidth: LINE, borderColor: INK },
  swatch: {
    width: '50%',
    height: 72,
    borderRightWidth: LINE,
    borderBottomWidth: LINE,
    borderColor: INK,
    padding: 10,
    justifyContent: 'space-between',
  },
  swatchOn: { borderWidth: 5, borderColor: INK, padding: 7 },
  swatchName: { fontSize: 17, fontWeight: '900', color: INK },
  swatchCheck: { alignSelf: 'flex-end', fontSize: 20, fontWeight: '900', color: INK },
  hint: { fontSize: 13, color: MUTED, marginTop: 8 },

  previewLabel: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 22, marginBottom: 6 },
  preview: { flexDirection: 'row', borderWidth: LINE, borderColor: INK },
  previewAccent: { flex: 1, backgroundColor: YELLOW, padding: 14, borderRightWidth: LINE, borderRightColor: INK },
  previewClock: { fontSize: 40, fontWeight: '900', color: INK, letterSpacing: -1 },
  previewDark: { flex: 1, backgroundColor: INK, justifyContent: 'center', alignItems: 'center' },
  previewDarkText: { color: YELLOW, fontSize: 22, fontWeight: '900' },
});
