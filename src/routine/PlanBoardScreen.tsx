import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Pressable,
  Modal,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  LayoutChangeEvent,
  TextInput,
} from 'react-native';
import BackArrow from '../ui/BackArrow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { useRoutine } from './RoutineProvider';
import { RoutineTile } from './types';
import { connectTiles, disconnectTile, orderedChain, removeTile, scheduleTimes } from './chain';
import { makeTile } from './storage';
import { CATEGORY_LABELS, TILE_KINDS, TileCategory, TileKind, isSoon, kindInfo } from './tileKinds';
import TileEditor from './TileEditor';
import { useAlarms } from '../alarm/AlarmProvider';
import { DAY_ORDER, DAY_SHORT, daysLabel } from '../alarm/time';
import { Routine } from './types';

const TILE_W = 128;
const TILE_H = 74;
const EDGE_GAP = 4;
const ARROW_L = 12;
const ARROW_HW = 7;
const EDGE_THICK = 3;
const GRID = 32;
const DRAG_THRESHOLD = 6;

type Point = { x: number; y: number };

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/* ───────────── Strzałka między kafelkami ───────────── */

function Edge({ a, b, active }: { a: Point; b: Point; active: boolean }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return null;
  const ux = dx / dist;
  const uy = dy / dist;
  // Odległość od środka do krawędzi prostokąta w kierunku strzałki.
  const clip = Math.min(
    ux !== 0 ? (TILE_W / 2 + EDGE_GAP) / Math.abs(ux) : Infinity,
    uy !== 0 ? (TILE_H / 2 + EDGE_GAP) / Math.abs(uy) : Infinity
  );
  if (dist <= clip * 2 + ARROW_L) return null; // kafelki nachodzą na siebie

  const sx = a.x + ux * clip;
  const sy = a.y + uy * clip;
  const ex = b.x - ux * clip;
  const ey = b.y - uy * clip;
  const lineEndX = ex - ux * ARROW_L;
  const lineEndY = ey - uy * ARROW_L;
  const lineLen = Math.hypot(lineEndX - sx, lineEndY - sy);
  const angle = `${Math.atan2(dy, dx)}rad`;
  const color = active ? INK : MUTED;

  const arrowCx = ex - (ux * ARROW_L) / 2;
  const arrowCy = ey - (uy * ARROW_L) / 2;

  return (
    <>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: (sx + lineEndX) / 2 - lineLen / 2,
          top: (sy + lineEndY) / 2 - EDGE_THICK / 2,
          width: lineLen,
          height: EDGE_THICK,
          backgroundColor: color,
          transform: [{ rotate: angle }],
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: arrowCx - ARROW_L / 2,
          top: arrowCy - ARROW_HW,
          width: 0,
          height: 0,
          borderLeftWidth: ARROW_L,
          borderTopWidth: ARROW_HW,
          borderBottomWidth: ARROW_HW,
          borderLeftColor: color,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{ rotate: angle }],
        }}
      />
    </>
  );
}

/* ───────────── Kafelek z przeciąganiem ───────────── */

interface TileViewProps {
  tile: RoutineTile;
  pos: Point;
  order: number | null;
  time: string | null;
  selected: boolean;
  connectSource: boolean;
  connecting: boolean;
  onDrag: (id: string, x: number, y: number) => void;
  onDragEnd: () => void;
  onTap: (id: string) => void;
  /** Tylko Budzik: on = alarm włączony, off = wyłączony, none = brak połączonego alarmu. */
  alarmState?: 'on' | 'off' | 'none';
}

function TileView(props: TileViewProps) {
  const { tile, pos, order, time, selected, connectSource, connecting } = props;
  const latest = useLatest(props);
  const start = useRef<Point>({ x: 0, y: 0 });
  const moved = useRef(false);
  const [dragging, setDragging] = useState(false);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          start.current = { ...latest.current.pos };
          moved.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!moved.current && Math.abs(g.dx) + Math.abs(g.dy) > DRAG_THRESHOLD) {
            moved.current = true;
            setDragging(true);
          }
          if (moved.current) {
            latest.current.onDrag(latest.current.tile.id, start.current.x + g.dx, start.current.y + g.dy);
          }
        },
        onPanResponderRelease: () => {
          if (moved.current) latest.current.onDragEnd();
          else latest.current.onTap(latest.current.tile.id);
          moved.current = false;
          setDragging(false);
        },
        onPanResponderTerminate: () => {
          moved.current = false;
          setDragging(false);
        },
      }),
    []
  );

  const info = kindInfo(tile.kind);
  const soon = isSoon(info);
  const noteHint =
    tile.kind === 'notes'
      ? tile.noteMode === 'pick'
        ? 'wybrana'
        : tile.noteMode === 'new'
          ? 'nowa'
          : null
      : tile.kind === 'alarm'
        ? props.alarmState === 'off'
          ? 'wyłączony'
          : props.alarmState === 'none'
            ? 'bez alarmu'
            : null
        : null;
  const meta = [time, tile.durationMin ? `${tile.durationMin} min` : null, noteHint].filter(Boolean).join(' · ');

  return (
    <View
      {...responder.panHandlers}
      style={[
        s.tile,
        info.category === 'module' && s.tileModule,
        info.category === 'app' && s.tileApp,
        info.category === 'task' && s.tileTask,
        { left: pos.x, top: pos.y },
        order === null && s.tileDetached,
        (selected || dragging) && s.tileLifted,
        connectSource && s.tileConnectSource,
        connecting && !connectSource && s.tileConnectTarget,
      ]}
    >
      <View style={s.tileHeader}>
        <View style={[s.orderBadge, order === null && s.orderBadgeEmpty]}>
          <Text style={s.orderText}>{order ?? '–'}</Text>
        </View>
        <Text style={[s.tileCategory, info.category === 'task' && s.onInk]} numberOfLines={1}>
          {soon ? 'WKRÓTCE' : CATEGORY_LABELS[info.category].toUpperCase()}
        </Text>
      </View>
      <Text style={[s.tileTitle, info.category === 'task' && s.onInkStrong]} numberOfLines={1}>
        {tile.title}
      </Text>
      <Text style={[s.tileMeta, info.category === 'task' && s.onInk]} numberOfLines={1}>
        {meta || 'bez czasu'}
      </Text>
    </View>
  );
}

/* ───────────── Ekran planszy ───────────── */

export default function PlanBoardScreen() {
  const bottomInset = useSafeAreaInsets().bottom;
  const { plans, todayPlan, updatePlan, addPlan, removePlan, setPlanDays } = useRoutine();
  const params = useLocalSearchParams<{ plan?: string }>();
  const [planId, setPlanId] = useState<string | undefined>(params.plan);
  const routine = plans.find(p => p.id === planId) ?? todayPlan;
  const setRoutine = (update: Routine | ((prev: Routine) => Routine)) => updatePlan(routine.id, update);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const switchPlan = (id: string) => {
    setPlanId(id);
    setSelectedId(null);
    setConnectFrom(null);
  };

  const openSettings = () => {
    setNameDraft(routine.name);
    setSettingsOpen(true);
  };

  const createPlan = () => {
    const plan = addPlan(`Plan ${plans.length + 1}`);
    switchPlan(plan.id);
    setNameDraft(plan.name);
    setSettingsOpen(true);
  };

  const confirmRemovePlan = () => {
    if (plans.length <= 1) return;
    Alert.alert(`Usunąć plan „${routine.name}”?`, 'Kafelki tego planu zostaną usunięte. Alarmy zostają.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => {
          const other = plans.find(p => p.id !== routine.id);
          removePlan(routine.id);
          setSettingsOpen(false);
          if (other) switchPlan(other.id);
        },
      },
    ]);
  };
  const { alarms } = useAlarms();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoutineTile | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const chain = useMemo(() => orderedChain(routine), [routine]);
  const times = useMemo(() => scheduleTimes(chain), [chain]);
  const orderOf = useMemo(() => new Map(chain.map((t, i) => [t.id, i])), [chain]);
  const chainLinks = useMemo(() => {
    const ids = new Set(chain.map(t => t.id));
    return new Set(routine.links.filter(l => ids.has(l.from) && ids.has(l.to)).map(l => `${l.from}>${l.to}`));
  }, [chain, routine.links]);

  const rangeX = Math.max(1, size.w - TILE_W);
  const rangeY = Math.max(1, size.h - TILE_H);
  const toPx = (t: RoutineTile): Point => ({ x: clamp01(t.x) * rangeX, y: clamp01(t.y) * rangeY });
  const center = (t: RoutineTile): Point => {
    const p = toPx(t);
    return { x: p.x + TILE_W / 2, y: p.y + TILE_H / 2 };
  };

  const selected = routine.tiles.find(t => t.id === selectedId) ?? null;
  const connectSource = routine.tiles.find(t => t.id === connectFrom) ?? null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const onDrag = (id: string, px: number, py: number) => {
    setRoutine(r => ({
      ...r,
      tiles: r.tiles.map(t => (t.id === id ? { ...t, x: clamp01(px / rangeX), y: clamp01(py / rangeY) } : t)),
    }));
  };

  const onTap = (id: string) => {
    if (connectFrom) {
      if (id === connectFrom) {
        setConnectFrom(null);
        return;
      }
      const result = connectTiles(routine, connectFrom, id);
      if ('error' in result) {
        Alert.alert('Nie można połączyć', result.error);
        return;
      }
      setRoutine(result.routine);
      setConnectFrom(null);
      setSelectedId(id);
      return;
    }
    setSelectedId(prev => (prev === id ? null : id));
  };

  const clearSelection = () => {
    setSelectedId(null);
    setConnectFrom(null);
  };

  const addTile = (kind: TileKind) => {
    setPaletteOpen(false);
    // Nowy kafelek na środku, lekko przesunięty przy kolejnych dodaniach, żeby się nie nakładały.
    const n = routine.tiles.length;
    const tile = makeTile(kind, clamp01(0.5 + ((n % 3) - 1) * 0.12), clamp01(0.5 + ((n % 4) - 1.5) * 0.08));
    setRoutine(r => {
      const next = { ...r, tiles: [...r.tiles, tile] };
      // Wygodny skrót: nowy kafelek doczepia się na końcu planu.
      const current = orderedChain(r);
      const last = current[current.length - 1];
      if (!last) return next;
      const res = connectTiles(next, last.id, tile.id);
      return 'routine' in res ? res.routine : next;
    });
    setSelectedId(tile.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    Alert.alert(`Usunąć „${selected.title}”?`, 'Sąsiednie kafelki zostaną połączone ze sobą.', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: () => {
          setRoutine(r => removeTile(r, selected.id));
          setSelectedId(null);
        },
      },
    ]);
  };

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const gridLines = useMemo(() => {
    const lines: React.ReactNode[] = [];
    for (let x = GRID; x < size.w; x += GRID) lines.push(<View key={`v${x}`} style={[s.gridV, { left: x }]} />);
    for (let y = GRID; y < size.h; y += GRID) lines.push(<View key={`h${y}`} style={[s.gridH, { top: y }]} />);
    return lines;
  }, [size.w, size.h]);

  const categories: TileCategory[] = ['module', 'app', 'task'];

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={s.title}>Plan dnia</Text>
        <View style={s.countBox}>
          <Text style={s.countText}>
            {chain.length}/{routine.tiles.length} w planie
          </Text>
        </View>
      </View>

      <ScrollView
        horizontal
        style={s.tabs}
        contentContainerStyle={s.tabsContent}
        showsHorizontalScrollIndicator={false}
      >
        {plans.map(p => {
          const active = p.id === routine.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.tab, active && s.tabActive]}
              onPress={() => (active ? openSettings() : switchPlan(p.id))}
              activeOpacity={0.7}
            >
              <Text style={[s.tabName, active && s.tabNameActive]} numberOfLines={1}>
                {p.name}
                {p.id === todayPlan.id ? ' · dziś' : ''}
              </Text>
              <Text style={[s.tabDays, active && s.tabDaysActive]} numberOfLines={1}>
                {p.days.length === 0 ? 'bez dni' : daysLabel(p.days)}
                {active ? '  ⚙' : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={[s.tab, s.tabAdd]} onPress={createPlan} activeOpacity={0.7}>
          <Text style={s.tabName}>+ Plan</Text>
          <Text style={s.tabDays}>np. weekend</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={s.optionRow}
        activeOpacity={0.7}
        onPress={() => setRoutine(r => ({ ...r, startAfterAlarm: !r.startAfterAlarm }))}
      >
        <View style={[s.check, routine.startAfterAlarm && s.checkOn]}>
          {routine.startAfterAlarm && <Text style={s.checkMark}>✓</Text>}
        </View>
        <Text style={s.optionText}>Uruchom plan po wyłączeniu budzika</Text>
      </TouchableOpacity>

      {connectSource ? (
        <View style={s.banner}>
          <Text style={s.bannerText} numberOfLines={2}>
            Dotknij kafelek, który ma być po „{connectSource.title}”
          </Text>
          <TouchableOpacity style={s.bannerButton} onPress={() => setConnectFrom(null)}>
            <Text style={s.bannerButtonText}>Anuluj</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.hintBar}>
          <Text style={s.hintText}>Przeciągaj kafelki · dotknij, aby połączyć lub edytować</Text>
        </View>
      )}

      <Pressable style={s.canvas} onLayout={onLayout} onPress={clearSelection}>
        {gridLines}
        {size.w > 0 &&
          routine.links.map(l => {
            const a = routine.tiles.find(t => t.id === l.from);
            const b = routine.tiles.find(t => t.id === l.to);
            if (!a || !b) return null;
            return (
              <Edge key={`${l.from}>${l.to}`} a={center(a)} b={center(b)} active={chainLinks.has(`${l.from}>${l.to}`)} />
            );
          })}
        {size.w > 0 &&
          // Zaznaczony kafelek rysujemy na końcu, żeby był na wierzchu.
          [...routine.tiles]
            .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))
            .map(t => {
              const idx = orderOf.get(t.id);
              return (
                <TileView
                  key={t.id}
                  tile={t}
                  pos={toPx(t)}
                  order={idx === undefined ? null : idx + 1}
                  time={idx === undefined ? t.time ?? null : times[idx]}
                  selected={t.id === selectedId}
                  connectSource={t.id === connectFrom}
                  connecting={connectFrom !== null}
                  onDrag={onDrag}
                  onDragEnd={() => {}}
                  onTap={onTap}
                  alarmState={
                    t.kind !== 'alarm'
                      ? undefined
                      : !t.alarmId
                        ? 'none'
                        : alarms.find(a => a.id === t.alarmId)?.enabled
                          ? 'on'
                          : 'off'
                  }
                />
              );
            })}
        {routine.tiles.length === 0 && (
          <View style={s.empty} pointerEvents="none">
            <Text style={s.emptyText}>Pusta plansza. Dodaj pierwszy kafelek poniżej.</Text>
          </View>
        )}
      </Pressable>

      {selected && !connectSource ? (
        <View style={[s.actions, { paddingBottom: bottomInset }]}>
          <TouchableOpacity style={[s.action, s.actionPrimary]} onPress={() => setConnectFrom(selected.id)}>
            <Text style={s.actionText}>Połącz →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.action, s.actionDivided]} onPress={() => setEditing(selected)}>
            <Text style={s.actionText}>Edytuj</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.action, s.actionDivided]}
            onPress={() => setRoutine(r => disconnectTile(r, selected.id))}
          >
            <Text style={s.actionText}>Odłącz</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.action, s.actionDivided]} onPress={deleteSelected}>
            <Text style={[s.actionText, s.danger]}>Usuń</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.actions, { paddingBottom: bottomInset }]}>
          <TouchableOpacity style={[s.action, s.actionPrimary]} onPress={() => setPaletteOpen(true)}>
            <Text style={s.actionTextBig}>+ Dodaj kafelek</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.action, s.actionDivided, s.actionInk, chain.length === 0 && s.disabled]}
            disabled={chain.length === 0}
            onPress={() => router.push(`/plan-run?plan=${routine.id}`)}
          >
            <Text style={[s.actionTextBig, s.onInkStrong]}>▶ Uruchom</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={paletteOpen} transparent animationType="slide" onRequestClose={() => setPaletteOpen(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setPaletteOpen(false)}>
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Dodaj kafelek</Text>
              <TouchableOpacity onPress={() => setPaletteOpen(false)}>
                <Text style={s.sheetClose}>Zamknij</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 32 + bottomInset }}>
              {categories.map(cat => (
                <View key={cat}>
                  <Text style={s.sheetSection}>{CATEGORY_LABELS[cat]}</Text>
                  {TILE_KINDS.filter(k => k.category === cat).map(k => (
                    <TouchableOpacity key={k.kind} style={s.sheetRow} onPress={() => addTile(k.kind)}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.sheetRowTitle}>{k.label}</Text>
                        <Text style={s.sheetRowDesc}>{k.description}</Text>
                      </View>
                      {isSoon(k) && <Text style={s.sheetSoon}>Wkrótce</Text>}
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={s.sheetBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[s.sheet, s.settings]} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Ustawienia planu</Text>
              <TouchableOpacity
                onPress={() => {
                  updatePlan(routine.id, r => ({ ...r, name: nameDraft.trim() || r.name }));
                  setSettingsOpen(false);
                }}
              >
                <Text style={s.sheetClose}>Gotowe</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.sheetSection}>Nazwa</Text>
            <TextInput
              style={s.nameInput}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="np. Dni robocze"
              placeholderTextColor={MUTED}
              maxLength={24}
              selectionColor={INK}
            />
            <Text style={s.sheetSection}>Dni, w które obowiązuje</Text>
            <View style={s.dayRow}>
              {DAY_ORDER.map((d, i) => {
                const on = routine.days.includes(d);
                const owner = plans.find(p => p.id !== routine.id && p.days.includes(d));
                return (
                  <TouchableOpacity
                    key={d}
                    style={[s.day, i > 0 && s.dayDivided, on && s.dayOn]}
                    onPress={() =>
                      setPlanDays(routine.id, on ? routine.days.filter(x => x !== d) : [...routine.days, d])
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={[s.dayText, on && s.dayTextOn]}>{DAY_SHORT[d]}</Text>
                    {!on && owner && <View style={s.dayTaken} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.settingsHint}>
              Dzień może należeć tylko do jednego planu — zaznaczenie go tutaj zabierze go innemu planowi (kropka = dzień
              innego planu). Dni bez planu używają planu „{plans[0]?.name}”.
            </Text>
            {plans.length > 1 && (
              <TouchableOpacity style={s.removePlan} onPress={confirmRemovePlan}>
                <Text style={s.removePlanText}>Usuń ten plan</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <TileEditor
        tile={editing}
        onClose={() => setEditing(null)}
        onSave={tile => {
          setRoutine(r => ({ ...r, tiles: r.tiles.map(t => (t.id === tile.id ? tile : t)) }));
          setEditing(null);
        }}
      />
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
  countBox: { borderWidth: LINE, borderColor: INK, backgroundColor: YELLOW, paddingHorizontal: 10, paddingVertical: 6 },
  countText: { fontSize: 13, fontWeight: '700', color: INK },

  tabs: { flexGrow: 0, borderBottomWidth: LINE, borderBottomColor: INK, backgroundColor: PAPER },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'stretch' },
  tab: {
    minHeight: 48,
    justifyContent: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 180,
  },
  tabActive: { backgroundColor: INK },
  tabAdd: { borderStyle: 'dashed' },
  tabName: { fontSize: 14, lineHeight: 19, fontWeight: '900', color: INK, includeFontPadding: false },
  tabNameActive: { color: YELLOW },
  tabDays: { fontSize: 11, lineHeight: 15, fontWeight: '700', color: MUTED, marginTop: 1, includeFontPadding: false },
  tabDaysActive: { color: '#BDBDB6' },
  settings: { maxHeight: undefined, paddingBottom: 16 },
  nameInput: {
    marginHorizontal: 16,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '700',
    color: INK,
  },
  dayRow: { flexDirection: 'row', marginHorizontal: 16, borderWidth: LINE, borderColor: INK, backgroundColor: WHITE },
  day: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  dayDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  dayOn: { backgroundColor: YELLOW },
  dayText: { fontSize: 15, fontWeight: '800', color: MUTED },
  dayTextOn: { color: INK, fontWeight: '900' },
  dayTaken: { width: 6, height: 6, backgroundColor: MUTED, marginTop: 3 },
  settingsHint: { fontSize: 12, color: MUTED, marginHorizontal: 16, marginTop: 8, lineHeight: 17 },
  removePlan: { marginHorizontal: 16, marginTop: 14, borderWidth: LINE, borderColor: INK, paddingVertical: 12, alignItems: 'center' },
  removePlanText: { fontSize: 15, fontWeight: '800', color: DANGER },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: WHITE,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
  },
  check: {
    width: 24,
    height: 24,
    borderWidth: LINE,
    borderColor: INK,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOn: { backgroundColor: INK },
  checkMark: { color: YELLOW, fontSize: 14, fontWeight: '900' },
  optionText: { fontSize: 14, fontWeight: '700', color: INK },

  hintBar: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: LINE, borderBottomColor: INK },
  hintText: { fontSize: 12, fontWeight: '700', color: MUTED },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YELLOW,
    borderBottomWidth: LINE,
    borderBottomColor: INK,
    paddingLeft: 16,
  },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '800', color: INK, paddingVertical: 10 },
  bannerButton: { paddingHorizontal: 16, paddingVertical: 12, borderLeftWidth: LINE, borderLeftColor: INK },
  bannerButtonText: { fontSize: 14, fontWeight: '800', color: INK },

  canvas: { flex: 1, margin: 12, overflow: 'hidden' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(17,17,17,0.07)' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(17,17,17,0.07)' },
  empty: { position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '700', color: MUTED },

  tile: {
    position: 'absolute',
    width: TILE_W,
    height: TILE_H,
    borderWidth: LINE,
    borderColor: INK,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'space-between',
  },
  tileModule: { backgroundColor: YELLOW },
  tileApp: { backgroundColor: WHITE },
  tileTask: { backgroundColor: INK },
  tileDetached: { opacity: 0.55, borderStyle: 'dashed' },
  tileLifted: {
    borderWidth: 3,
    elevation: 8,
    shadowColor: INK,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 3, height: 3 },
  },
  tileConnectSource: { borderColor: DANGER, borderWidth: 3 },
  tileConnectTarget: { borderStyle: 'dashed' },
  tileHeader: { flexDirection: 'row', alignItems: 'center' },
  orderBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    backgroundColor: INK,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    borderWidth: 1,
    borderColor: YELLOW,
  },
  orderBadgeEmpty: { backgroundColor: MUTED },
  orderText: { color: YELLOW, fontSize: 12, fontWeight: '900' },
  tileCategory: { flex: 1, fontSize: 9, fontWeight: '900', color: INK, letterSpacing: 0.5 },
  tileTitle: { fontSize: 16, fontWeight: '900', color: INK },
  tileMeta: { fontSize: 11, fontWeight: '700', color: INK, opacity: 0.7 },
  onInk: { color: '#BDBDB6' },
  onInkStrong: { color: YELLOW },

  actions: { flexDirection: 'row', borderTopWidth: LINE, borderTopColor: INK, backgroundColor: WHITE, minHeight: 64 },
  action: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 14 },
  actionDivided: { borderLeftWidth: LINE, borderLeftColor: INK },
  actionPrimary: { backgroundColor: YELLOW },
  actionInk: { backgroundColor: INK },
  actionText: { fontSize: 15, fontWeight: '800', color: INK },
  actionTextBig: { fontSize: 17, fontWeight: '900', color: INK },
  danger: { color: DANGER },
  disabled: { opacity: 0.4 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '75%', backgroundColor: PAPER, borderTopWidth: LINE, borderTopColor: INK },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: INK,
  },
  sheetTitle: { color: YELLOW, fontSize: 17, fontWeight: '900' },
  sheetClose: { color: WHITE, fontSize: 15, fontWeight: '700' },
  sheetSection: { fontSize: 12, fontWeight: '900', color: MUTED, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: -LINE,
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sheetRowTitle: { fontSize: 16, fontWeight: '800', color: INK },
  sheetRowDesc: { fontSize: 13, color: MUTED, marginTop: 2 },
  sheetSoon: { fontSize: 11, fontWeight: '800', color: MUTED, borderWidth: LINE, borderColor: MUTED, paddingHorizontal: 6, paddingVertical: 2 },
});
