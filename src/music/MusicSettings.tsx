import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
} from 'react-native';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { useMusic } from './MusicProvider';
import { PICKABLE, detectService, isValidMusicUrl, openMusic, serviceInfo, serviceLabel } from './services';

const HOW_TO: Record<string, string> = {
  spotify: 'W Spotify: playlista → ⋯ → Udostępnij → Kopiuj link.',
  ytmusic: 'W YouTube Music: playlista → ⋮ → Udostępnij → Kopiuj link.',
  apple: 'W Apple Music: playlista → ⋯ → Udostępnij → Kopiuj link.',
  tidal: 'W Tidal: playlista → ⋯ → Udostępnij → Kopiuj link.',
  deezer: 'W Deezer: playlista → ⋯ → Udostępnij → Kopiuj link.',
  soundcloud: 'W SoundCloud: playlista → Udostępnij → Kopiuj link.',
};

/** Ustawienia muzyki: serwis, zapisane playlisty, ★ na poranek. Używane w ekranie Muzyka i w opcjach kafelka. */
export default function MusicSettings() {
  const { service, items, defaultId, setService, addItem, removeItem, setDefault } = useMusic();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const urlOk = isValidMusicUrl(url);
  const detected = url.trim() ? serviceLabel(detectService(url)) : null;

  const open = (link: string) =>
    openMusic(link).catch(() => Alert.alert('Nie udało się otworzyć', 'Sprawdź link albo czy aplikacja jest zainstalowana.'));

  const add = () => {
    if (!urlOk) return;
    addItem(name.trim() || `Playlista ${items.length + 1}`, url);
    setName('');
    setUrl('');
    Keyboard.dismiss();
  };

  const confirmRemove = (id: string, n: string) =>
    Alert.alert(`Usunąć „${n}”?`, undefined, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => removeItem(id) },
    ]);

  const home = serviceInfo(service)?.home;

  return (
    <View>
          <View style={s.bar}>
            <Text style={s.barText}>Twój serwis</Text>
          </View>
          <View style={s.chips}>
            {PICKABLE.map(sv => {
              const on = sv.id === service;
              return (
                <TouchableOpacity key={sv.id} style={[s.chip, on && s.chipOn]} onPress={() => setService(sv.id)}>
                  <Text style={[s.chipText, on && s.chipTextOn]}>{sv.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {home && (
            <TouchableOpacity style={s.openService} onPress={() => open(home)} activeOpacity={0.8}>
              <Text style={s.openServiceText}>Otwórz {serviceLabel(service)}</Text>
            </TouchableOpacity>
          )}

          <View style={[s.bar, s.barSpaced]}>
            <Text style={s.barText}>Twoje playlisty</Text>
            <Text style={s.barMeta}>★ = na poranek</Text>
          </View>
          {items.length === 0 ? (
            <Text style={s.empty}>Dodaj playlistę poniżej — wklej link z aplikacji muzycznej.</Text>
          ) : (
            items.map(it => {
              const fav = it.id === defaultId;
              return (
                <View key={it.id} style={s.item}>
                  <TouchableOpacity style={s.play} onPress={() => open(it.url)} activeOpacity={0.7}>
                    <Text style={s.playText}>▶</Text>
                  </TouchableOpacity>
                  <View style={s.itemInfo}>
                    <Text style={s.itemName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={s.itemMeta} numberOfLines={1}>
                      {serviceLabel(it.service)}
                    </Text>
                  </View>
                  <TouchableOpacity style={[s.iconCell, fav && s.iconCellOn]} onPress={() => setDefault(it.id)}>
                    <Text style={[s.icon, fav && s.iconOn]}>★</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconCell} onPress={() => confirmRemove(it.id, it.name)}>
                    <Text style={[s.icon, { color: DANGER }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <View style={[s.bar, s.barSpaced]}>
            <Text style={s.barText}>Dodaj playlistę</Text>
          </View>
          <View style={s.form}>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Nazwa, np. Poranna energia"
              placeholderTextColor={MUTED}
              maxLength={40}
              selectionColor={INK}
            />
            <TextInput
              style={[s.input, s.inputDivided, url.trim() !== '' && !urlOk && s.inputError]}
              value={url}
              onChangeText={setUrl}
              placeholder="Link do playlisty, albumu lub utworu"
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              selectionColor={INK}
            />
            <Text style={s.hint}>
              {url.trim() && !urlOk
                ? 'To nie wygląda na link — skopiuj go przyciskiem „Udostępnij” w aplikacji.'
                : detected
                  ? `Rozpoznano: ${detected}`
                  : HOW_TO[service] ?? 'Skopiuj link do playlisty z aplikacji muzycznej.'}
            </Text>
            <TouchableOpacity style={[s.add, !urlOk && s.disabled]} onPress={add} disabled={!urlOk} activeOpacity={0.8}>
              <Text style={s.addText}>+ Zapisz playlistę</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.note}>
            Playlista otwiera się w aplikacji serwisu — odtwarzanie zaczynasz tam jednym dotknięciem. W planie dnia kafelek
            Muzyka może otworzyć ją automatycznie.
          </Text>
    </View>
  );
}

const s = StyleSheet.create({

  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: INK,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  barSpaced: { marginTop: 16 },
  barText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  barMeta: { color: '#BDBDB6', fontSize: 12, fontWeight: '700' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, padding: 8 },
  chip: { borderWidth: LINE, borderColor: INK, paddingHorizontal: 12, paddingVertical: 8, margin: 4 },
  chipOn: { backgroundColor: INK },
  chipText: { fontSize: 14, fontWeight: '800', color: INK },
  chipTextOn: { color: YELLOW },
  openService: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: YELLOW, paddingVertical: 12, alignItems: 'center' },
  openServiceText: { fontSize: 15, fontWeight: '900', color: INK },

  empty: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, padding: 14, fontSize: 14, color: MUTED, fontWeight: '600' },
  item: { flexDirection: 'row', alignItems: 'stretch', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  play: { width: 52, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center', borderRightWidth: LINE, borderRightColor: INK },
  playText: { fontSize: 20, color: INK, fontWeight: '900' },
  itemInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  itemName: { fontSize: 16, fontWeight: '800', color: INK },
  itemMeta: { fontSize: 12, fontWeight: '700', color: MUTED, marginTop: 1 },
  iconCell: { width: 46, justifyContent: 'center', alignItems: 'center', borderLeftWidth: LINE, borderLeftColor: INK },
  iconCellOn: { backgroundColor: INK },
  icon: { fontSize: 18, color: MUTED, fontWeight: '900' },
  iconOn: { color: YELLOW },

  form: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  input: { paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: INK },
  inputDivided: { borderTopWidth: LINE, borderTopColor: INK },
  inputError: { color: DANGER },
  hint: { fontSize: 12, color: MUTED, paddingHorizontal: 14, paddingBottom: 10 },
  add: { backgroundColor: INK, paddingVertical: 14, alignItems: 'center' },
  addText: { color: YELLOW, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  note: { fontSize: 12, color: MUTED, marginTop: 14, lineHeight: 17 },
});
