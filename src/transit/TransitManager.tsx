import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { newTripId, useTransit } from './TransitProvider';
import { PlannedTrain, PlkStation, searchStations, trainsBetween } from './plk';
import { ZtmDeparture, ZtmStop, departures, linesAtStop } from './ztm';
import { carrierLabel } from './status';
import { tripTitle } from './TripStatusList';

const PL: Record<string, string> = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z' };
const norm = (s: string) => s.toLowerCase().replace(/[ąćęłńóśźż]/g, c => PL[c]).trim();
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ───────────── wspólne ───────────── */

function FlowScreen({ title, onCancel, children }: { title: string; onCancel: () => void; children: React.ReactNode }) {
  const bottomInset = useSafeAreaInsets().bottom;
  return (
    <SafeAreaView style={s.flow}>
      <View style={s.flowHeader}>
        <TouchableOpacity style={s.flowCancel} onPress={onCancel}>
          <Text style={s.flowCancelText}>Anuluj</Text>
        </TouchableOpacity>
        <Text style={s.flowTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 + bottomInset }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({ n, title, done }: { n: number; title: string; done?: string }) {
  return (
    <View style={[s.step, done ? s.stepDone : null]}>
      <Text style={s.stepN}>{n}</Text>
      <Text style={s.stepTitle} numberOfLines={1}>
        {done ?? title}
      </Text>
    </View>
  );
}

function Row({ title, sub, onPress, right }: { title: string; sub?: string; onPress: () => void; right?: string }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right ? <Text style={s.rowRight}>{right}</Text> : null}
    </TouchableOpacity>
  );
}

/* ───────────── pociąg ───────────── */

function StationSearch({ plkKey, placeholder, onPick }: { plkKey: string; placeholder: string; onPick: (s: PlkStation) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<PlkStation[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 3) {
      setList([]);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await searchStations(q, plkKey);
        if (alive) {
          setList(res);
          setErr(res.length ? null : 'Brak stacji o takiej nazwie (wpisz początek, np. „Warszawa Zach”)');
        }
      } catch (e: any) {
        if (alive) setErr(e?.message ?? 'Błąd wyszukiwania');
      } finally {
        if (alive) setBusy(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <>
      <View style={s.searchRow}>
        <TextInput
          style={s.search}
          value={q}
          onChangeText={setQ}
          placeholder={placeholder}
          placeholderTextColor={MUTED}
          autoFocus
          autoCorrect={false}
          selectionColor={INK}
        />
        {busy && <ActivityIndicator color={INK} style={{ marginRight: 12 }} />}
      </View>
      {err && <Text style={s.err}>{err}</Text>}
      {list.map(st => (
        <Row
          key={st.id}
          title={st.name}
          onPress={() => {
            Keyboard.dismiss();
            onPick(st);
          }}
        />
      ))}
    </>
  );
}

function AddTrain({ plkKey, onDone, onCancel }: { plkKey: string; onDone: () => void; onCancel: () => void }) {
  const { addTrip } = useTransit();
  const [from, setFrom] = useState<PlkStation | null>(null);
  const [to, setTo] = useState<PlkStation | null>(null);
  const [trains, setTrains] = useState<PlannedTrain[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to) return;
    setTrains(null);
    setErr(null);
    trainsBetween(from.id, to.id, today(), plkKey)
      .then(list => setTrains(list.filter(t => t.departureDay === 0)))
      .catch(e => setErr(e?.message ?? 'Nie udało się pobrać rozkładu'));
  }, [from?.id, to?.id]);

  const pick = (t: PlannedTrain) => {
    if (!from || !to) return;
    addTrip({ id: newTripId(), kind: 'train', fromId: from.id, fromName: from.name, toId: to.id, toName: to.name, time: t.departure });
    onDone();
  };

  return (
    <FlowScreen title="Nowy pociąg" onCancel={onCancel}>
      <Step n={1} title="Skąd jedziesz?" done={from ? `Skąd: ${from.name}` : undefined} />
      {!from && <StationSearch plkKey={plkKey} placeholder="Stacja początkowa, np. Warszawa Zachodnia" onPick={setFrom} />}
      {from && (
        <>
          <Step n={2} title="Dokąd?" done={to ? `Dokąd: ${to.name}` : undefined} />
          {!to && <StationSearch plkKey={plkKey} placeholder="Stacja docelowa, np. Warszawa Śródmieście" onPick={setTo} />}
        </>
      )}
      {from && to && (
        <>
          <Step n={3} title="Który pociąg?" />
          <Text style={s.hint}>Godziny z dzisiejszego rozkładu. Zapisana zostaje godzina odjazdu — każdego dnia aplikacja znajdzie pociąg o tej porze.</Text>
          {err && <Text style={s.err}>{err}</Text>}
          {!trains && !err && <ActivityIndicator color={INK} style={{ marginTop: 16 }} />}
          {trains?.length === 0 && <Text style={s.err}>Dziś nie ma bezpośrednich pociągów na tej trasie.</Text>}
          {trains?.map(t => (
            <Row
              key={t.key}
              title={`${t.departure}${t.arrival ? ` → ${t.arrival}` : ''}`}
              sub={[carrierLabel(t.carrier), t.number, t.name, t.platform ? `peron ${t.platform}` : ''].filter(Boolean).join(' · ')}
              right="Wybierz"
              onPress={() => pick(t)}
            />
          ))}
        </>
      )}
    </FlowScreen>
  );
}

/* ───────────── autobus / tramwaj ───────────── */

function AddZtm({ ztmKey, onDone, onCancel }: { ztmKey: string; onDone: () => void; onCancel: () => void }) {
  const { addTrip, loadStops } = useTransit();
  const [stops, setStops] = useState<ZtmStop[] | null>(null);
  const [q, setQ] = useState('');
  const [stop, setStop] = useState<ZtmStop | null>(null);
  const [lines, setLines] = useState<string[] | null>(null);
  const [line, setLine] = useState<string | null>(null);
  const [deps, setDeps] = useState<ZtmDeparture[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadStops()
      .then(setStops)
      .catch(e => setErr(e?.message ?? 'Nie udało się pobrać listy przystanków'));
  }, []);

  useEffect(() => {
    if (!stop) return;
    setLines(null);
    linesAtStop(stop.id, stop.nr, ztmKey)
      .then(setLines)
      .catch(e => setErr(e?.message ?? 'Nie udało się pobrać linii'));
  }, [stop?.id, stop?.nr]);

  useEffect(() => {
    if (!stop || !line) return;
    setDeps(null);
    departures(stop.id, stop.nr, line, ztmKey)
      .then(setDeps)
      .catch(e => setErr(e?.message ?? 'Nie udało się pobrać rozkładu'));
  }, [line]);

  const results = useMemo(() => {
    const nq = norm(q);
    if (!stops || nq.length < 2) return [];
    return stops
      .filter(st => norm(st.name).includes(nq))
      .sort((a, b) => Number(!norm(a.name).startsWith(nq)) - Number(!norm(b.name).startsWith(nq)) || a.name.localeCompare(b.name) || a.nr.localeCompare(b.nr))
      .slice(0, 40);
  }, [stops, q]);

  const save = (time?: string) => {
    if (!stop || !line) return;
    addTrip({
      id: newTripId(),
      kind: 'ztm',
      stopId: stop.id,
      stopNr: stop.nr,
      stopName: stop.name,
      stopDir: stop.dir,
      lat: stop.lat,
      lon: stop.lon,
      line,
      time,
    });
    onDone();
  };

  return (
    <FlowScreen title="Nowy autobus / tramwaj" onCancel={onCancel}>
      {err && <Text style={s.err}>{err}</Text>}
      <Step n={1} title="Przystanek" done={stop ? `Przystanek: ${stop.name} ${stop.nr}` : undefined} />
      {!stop && (
        <>
          {!stops && !err && (
            <View style={s.loading}>
              <ActivityIndicator color={INK} />
              <Text style={s.hint}>Pobieram listę przystanków (raz na tydzień)…</Text>
            </View>
          )}
          {stops && (
            <TextInput
              style={[s.search, s.searchAlone]}
              value={q}
              onChangeText={setQ}
              placeholder="Nazwa przystanku, np. Dworzec Centralny"
              placeholderTextColor={MUTED}
              autoFocus
              autoCorrect={false}
              selectionColor={INK}
            />
          )}
          {results.map(st => (
            <Row
              key={`${st.id}-${st.nr}`}
              title={`${st.name} ${st.nr}`}
              sub={st.dir ? `w stronę: ${st.dir}` : undefined}
              onPress={() => {
                Keyboard.dismiss();
                setStop(st);
              }}
            />
          ))}
          {stops && q.trim().length >= 2 && results.length === 0 && <Text style={s.err}>Nie znaleziono przystanku.</Text>}
        </>
      )}

      {stop && (
        <>
          <Step n={2} title="Linia" done={line ? `Linia ${line}` : undefined} />
          {!line && !lines && !err && <ActivityIndicator color={INK} style={{ marginTop: 12 }} />}
          {!line && lines && (
            <View style={s.chips}>
              {lines.map(l => (
                <TouchableOpacity key={l} style={s.chip} onPress={() => setLine(l)}>
                  <Text style={s.chipText}>{l}</Text>
                </TouchableOpacity>
              ))}
              {lines.length === 0 && <Text style={s.err}>Brak linii na tym słupku.</Text>}
            </View>
          )}
        </>
      )}

      {stop && line && (
        <>
          <Step n={3} title="Kiedy?" />
          <Row title="Najbliższe odjazdy" sub="Bez stałej godziny — zawsze 2 najbliższe kursy" right="Wybierz" onPress={() => save()} />
          <Text style={s.hint}>Albo konkretny kurs (godzina z dzisiejszego rozkładu):</Text>
          {!deps && !err && <ActivityIndicator color={INK} style={{ marginTop: 12 }} />}
          <View style={s.chips}>
            {deps?.map(d => (
              <TouchableOpacity key={`${d.time}-${d.brigade}`} style={s.chip} onPress={() => save(d.time.slice(0, 5))}>
                <Text style={s.chipText}>{d.time.slice(0, 5)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </FlowScreen>
  );
}

/* ───────────── całość ───────────── */

/** Klucze API, zapisane połączenia i ich dodawanie — w ekranie Dojazd i w opcjach kafelka. */
export default function TransitManager() {
  const { settings, setKeys, removeTrip, refresh } = useTransit();
  const [plk, setPlk] = useState(settings.plkKey ?? '');
  const [ztm, setZtm] = useState(settings.ztmKey ?? '');
  const [adding, setAdding] = useState<'train' | 'ztm' | null>(null);

  useEffect(() => {
    setPlk(settings.plkKey ?? '');
    setZtm(settings.ztmKey ?? '');
  }, [settings.plkKey, settings.ztmKey]);

  const keysChanged = plk.trim() !== (settings.plkKey ?? '') || ztm.trim() !== (settings.ztmKey ?? '');
  const ztmLooksOld = ztm.trim() !== '' && !ztm.trim().startsWith('eyJ');

  const startAdding = (kind: 'train' | 'ztm') => {
    if (kind === 'train' && !settings.plkKey) return Alert.alert('Brak klucza PLK', 'Najpierw wpisz i zapisz klucz PLK.');
    if (kind === 'ztm' && !settings.ztmKey) return Alert.alert('Brak klucza ZTM', 'Najpierw wpisz i zapisz klucz ZTM.');
    setAdding(kind);
  };

  return (
    <View>
      <View style={s.bar}>
        <Text style={s.barText}>Moje połączenia</Text>
      </View>
      {settings.trips.length === 0 ? (
        <Text style={s.empty}>Dodaj pociąg albo autobus/tramwaj, którym jeździsz rano.</Text>
      ) : (
        settings.trips.map(t => (
          <View key={t.id} style={s.trip}>
            <View style={{ flex: 1 }}>
              <Text style={s.tripKind}>{t.kind === 'train' ? 'POCIĄG' : 'AUTOBUS / TRAMWAJ'}</Text>
              <Text style={s.tripTitle}>{tripTitle(t)}</Text>
              {t.kind === 'ztm' && !t.time && <Text style={s.tripSub}>najbliższe odjazdy</Text>}
            </View>
            <TouchableOpacity
              style={s.tripRemove}
              onPress={() =>
                Alert.alert('Usunąć połączenie?', tripTitle(t), [
                  { text: 'Anuluj', style: 'cancel' },
                  { text: 'Usuń', style: 'destructive', onPress: () => removeTrip(t.id) },
                ])
              }
            >
              <Text style={s.tripRemoveText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      <View style={s.addRow}>
        <TouchableOpacity style={s.add} onPress={() => startAdding('train')} activeOpacity={0.8}>
          <Text style={s.addText}>+ Pociąg</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.add, s.addDivided]} onPress={() => startAdding('ztm')} activeOpacity={0.8}>
          <Text style={s.addText}>+ Autobus / tramwaj</Text>
        </TouchableOpacity>
      </View>

      <View style={[s.bar, { marginTop: 16 }]}>
        <Text style={s.barText}>Klucze API</Text>
      </View>
      <View style={s.keys}>
        <Text style={s.keyLabel}>PKP PLK (pociągi, opóźnienia)</Text>
        <TextInput
          style={s.keyInput}
          value={plk}
          onChangeText={setPlk}
          placeholder="wklej klucz z pdp-api.plk-sa.pl"
          placeholderTextColor={MUTED}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={INK}
        />
        <Text style={s.keyLabel}>ZTM Warszawa (autobusy, tramwaje)</Text>
        <TextInput
          style={s.keyInput}
          value={ztm}
          onChangeText={setZtm}
          placeholder="wklej klucz z dane.um.warszawa.pl (eyJ…)"
          placeholderTextColor={MUTED}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={INK}
        />
        {ztmLooksOld && (
          <Text style={s.warn}>
            Ten klucz wygląda na klucz ze starego portalu api.um.warszawa.pl, który jest wygaszany. Nowy klucz (zaczyna się
            od „eyJ”) wygenerujesz na dane.um.warszawa.pl/key-api.
          </Text>
        )}
        <TouchableOpacity
          style={[s.keySave, !keysChanged && s.disabled]}
          disabled={!keysChanged}
          onPress={() => {
            setKeys({ plkKey: plk.trim() || undefined, ztmKey: ztm.trim() || undefined });
            Keyboard.dismiss();
            setTimeout(() => refresh(true), 100);
          }}
        >
          <Text style={s.keySaveText}>{keysChanged ? 'Zapisz klucze' : 'Klucze zapisane'}</Text>
        </TouchableOpacity>
        <Text style={s.hint}>
          Klucze są zapisane tylko w tym telefonie. Dane: PKP Polskie Linie Kolejowe S.A. (Otwarte Dane Kolejowe) oraz Miasto
          Stołeczne Warszawa / ZTM (dane.um.warszawa.pl, CC BY). Pozycje GPS dają tylko szacunek czasu dojazdu.
        </Text>
      </View>

      <Modal visible={adding !== null} animationType="slide" onRequestClose={() => setAdding(null)}>
        {adding === 'train' && settings.plkKey && (
          <AddTrain
            plkKey={settings.plkKey}
            onCancel={() => setAdding(null)}
            onDone={() => {
              setAdding(null);
              setTimeout(() => refresh(true), 100);
            }}
          />
        )}
        {adding === 'ztm' && settings.ztmKey && (
          <AddZtm
            ztmKey={settings.ztmKey}
            onCancel={() => setAdding(null)}
            onDone={() => {
              setAdding(null);
              setTimeout(() => refresh(true), 100);
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { backgroundColor: INK, paddingHorizontal: 14, paddingVertical: 10 },
  barText: { color: YELLOW, fontSize: 15, fontWeight: '800' },
  empty: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, padding: 14, fontSize: 14, color: MUTED, fontWeight: '600' },
  trip: { flexDirection: 'row', alignItems: 'stretch', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  tripKind: { fontSize: 10, fontWeight: '900', color: MUTED, paddingHorizontal: 12, paddingTop: 10 },
  tripTitle: { fontSize: 15, fontWeight: '800', color: INK, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 2 },
  tripSub: { fontSize: 12, color: MUTED, paddingHorizontal: 12, marginTop: -8, paddingBottom: 10 },
  tripRemove: { width: 48, justifyContent: 'center', alignItems: 'center', borderLeftWidth: LINE, borderLeftColor: INK },
  tripRemoveText: { fontSize: 18, fontWeight: '900', color: DANGER },
  addRow: { flexDirection: 'row', borderWidth: LINE, borderTopWidth: 0, borderColor: INK },
  add: { flex: 1, backgroundColor: YELLOW, paddingVertical: 14, alignItems: 'center' },
  addDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  addText: { fontSize: 15, fontWeight: '900', color: INK },

  keys: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, padding: 12 },
  keyLabel: { fontSize: 13, fontWeight: '800', color: INK, marginTop: 4, marginBottom: 6 },
  keyInput: { borderWidth: LINE, borderColor: INK, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: INK, marginBottom: 8 },
  warn: { fontSize: 12, color: DANGER, fontWeight: '700', marginBottom: 8, lineHeight: 17 },
  keySave: { backgroundColor: INK, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  keySaveText: { color: YELLOW, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.4 },
  hint: { fontSize: 12, color: MUTED, marginTop: 10, lineHeight: 17 },

  flow: { flex: 1, backgroundColor: PAPER, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 },
  flowHeader: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: LINE, borderBottomColor: INK, backgroundColor: WHITE },
  flowCancel: { paddingHorizontal: 18, paddingVertical: 16, borderRightWidth: LINE, borderRightColor: INK },
  flowCancelText: { fontSize: 16, fontWeight: '600', color: INK },
  flowTitle: { flex: 1, alignSelf: 'center', textAlign: 'center', fontSize: 17, fontWeight: '800', color: INK, paddingRight: 70 },

  step: { flexDirection: 'row', alignItems: 'center', backgroundColor: INK, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12 },
  stepDone: { backgroundColor: '#3A3A36' },
  stepN: { color: INK, backgroundColor: YELLOW, fontWeight: '900', fontSize: 13, width: 22, textAlign: 'center', marginRight: 10 },
  stepTitle: { flex: 1, color: YELLOW, fontSize: 15, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  search: { flex: 1, fontSize: 16, color: INK, paddingHorizontal: 12, paddingVertical: 12 },
  searchAlone: { borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE },
  err: { fontSize: 13, fontWeight: '700', color: DANGER, marginTop: 8 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: LINE, borderTopWidth: 0, borderColor: INK, backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 11 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: INK },
  rowSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  rowRight: { fontSize: 13, fontWeight: '900', color: INK, backgroundColor: YELLOW, paddingHorizontal: 10, paddingVertical: 6, borderWidth: LINE, borderColor: INK },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  chip: { borderWidth: LINE, borderColor: INK, backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 8, margin: 3 },
  chipText: { fontSize: 15, fontWeight: '900', color: INK },
});
