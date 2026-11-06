import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
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
  ScrollViewInstance,
  Animated,
  LayoutAnimation,
} from 'react-native';
import BackArrow from '../ui/BackArrow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { INK, YELLOW, PAPER, WHITE, MUTED, DANGER, LINE } from '../theme';
import { useRoutine } from './RoutineProvider';
import { Routine, RoutineTile, TileSize } from './types';
import { moveTile, removeTile, scheduleTimes } from './chain';
import { makeTile } from './storage';
import { CATEGORY_LABELS, TILE_KINDS, TileCategory, TileKind, isSoon, kindInfo } from './tileKinds';
import { Cell, GRID_COLS, SIZE_LABELS, cellAt, layoutGrid } from './grid';
import TileEditor from './TileEditor';
import { useAlarms } from '../alarm/AlarmProvider';
import { DAY_ORDER, DAY_SHORT, daysLabel } from '../alarm/time';

const PAD = 10;
const GAP = 6;
const DRAG_THRESHOLD = 6;
const SWAP_COOLDOWN = 220;
const SIZES: TileSize[] = ['small', 'medium', 'large'];

type Rect = { x: number; y: number; w: number; h: number };

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/* ───────────── Kafelek ───────────── */

interface TileViewProps {
  tile: RoutineTile;
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  compact: boolean;
  large: boolean;
  time: string | null;
  editMode: boolean;
  selected: boolean;
  /** Przesunięcie palca (tylko przeciągany kafelek) — animowane natywnie, bez przerysowywania ekranu. */
  pan: Animated.ValueXY | null;
  onPress: (id: string) => void;
  onLongPress: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (dx: number, dy: number) => void;
  onDragEnd: () => void;
  /** Tylko Budzik: on = alarm włączony, off = wyłączony, none = brak połączonego alarmu. */
  alarmState?: 'on' | 'off' | 'none';
}

const TileView = memo(function TileView(props: TileViewProps) {
  const { tile, index, x, y, w, h, compact, large, time, editMode, selected, pan } = props;
  const latest = useLatest(props);
  const moved = useRef(false);
  const draggable = editMode && selected;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          moved.current = false;
        },
        onPanResponderMove: (_, g) => {
          if (!moved.current && Math.abs(g.dx) + Math.abs(g.dy) > DRAG_THRESHOLD) {
            moved.current = true;
            latest.current.onDragStart(latest.current.tile.id);
          }
          if (moved.current) latest.current.onDragMove(g.dx, g.dy);
        },
        onPanResponderRelease: () => {
          if (moved.current) latest.current.onDragEnd();
          else latest.current.onPress(latest.current.tile.id);
          moved.current = false;
        },
        onPanResponderTerminate: () => {
          if (moved.current) latest.current.onDragEnd();
          moved.current = false;
        },
      }),
    []
  );

  const info = kindInfo(tile.kind);
  const soon = isSoon(info);
  const dark = info.category === 'task';
  const hint =
    tile.kind === 'notes'
      ? tile.noteMode === 'pick'
        ? 'wybrana notatka'
        : tile.noteMode === 'new'
          ? 'nowa notatka'
          : null
      : tile.kind === 'alarm'
        ? props.alarmState === 'off'
          ? 'wyłączony'
          : props.alarmState === 'none'
            ? 'bez alarmu'
            : null
        : null;
  const meta = [time, tile.durationMin ? `⏱ ${tile.durationMin} min` : null, hint].filter(Boolean).join(' · ');

  const body = (
    <>
      <View style={s.tileTop}>
        <Text style={[s.num, compact && s.numSmall, dark && s.onInkStrong]}>{index + 1}</Text>
        {!compact && (
          <Text style={[s.tileCategory, dark && s.onInk]} numberOfLines={1}>
            {soon ? 'WKRÓTCE' : CATEGORY_LABELS[info.category].toUpperCase()}
          </Text>
        )}
      </View>
      <View>
        <Text
          style={[s.tileTitle, compact && s.tileTitleSmall, large && s.tileTitleLarge, dark && s.onInkStrong]}
          numberOfLines={2}
        >
          {tile.title}
        </Text>
        {large && (
          <Text style={[s.tileDesc, dark && s.onInk]} numberOfLines={1}>
            {info.description}
          </Text>
        )}
        {!!meta && (
          <Text style={[s.tileMeta, compact && s.tileMetaSmall, dark && s.onInk]} numberOfLines={1}>
            {compact ? time ?? (tile.durationMin ? `⏱${tile.durationMin}` : '') : meta}
          </Text>
        )}
      </View>
      {selected && <View style={s.selMark} pointerEvents="none"><Text style={s.selMarkText}>✓</Text></View>}
    </>
  );

  const style = [
    s.tile,
    info.category === 'module' && s.tileModule,
    info.category === 'app' && s.tileApp,
    dark && s.tileTask,
    { left: x, top: y, width: w, height: h },
    compact && s.tileCompact,
    editMode && !selected && s.tileEditing,
    selected && s.tileSelected,
    pan && s.tileDragging,
  ];

  if (draggable) {
    return (
      <Animated.View
        {...responder.panHandlers}
        style={[...style, pan && { transform: pan.getTranslateTransform() }]}
      >
        {body}
      </Animated.View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [...style, pressed && s.tilePressed]}
      onPress={() => props.onPress(tile.id)}
      onLongPress={() => props.onLongPress(tile.id)}
      delayLongPress={350}
    >
      {body}
    </Pressable>
  );
});

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
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoutineTile | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Przeciąganie: kolejność trzymana lokalnie i zapisywana do planu dopiero po puszczeniu kafelka.
  const [drag, setDrag] = useState<{ id: string; start: Rect } | null>(null);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const lastSwap = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const tiles = useMemo(() => {
    if (!dragOrder) return routine.tiles;
    const byId = new Map(routine.tiles.map(t => [t.id, t]));
    return dragOrder.map(id => byId.get(id)).filter((t): t is RoutineTile => !!t);
  }, [routine.tiles, dragOrder]);
  const times = useMemo(() => scheduleTimes(tiles), [tiles]);
  const { cells, rows } = useMemo(() => layoutGrid(tiles.map(t => t.size ?? 'medium')), [tiles]);

  // Siatka 4 kolumn na całą szerokość; przy niewielu rzędach kafelki wyciągają się na wysokość planszy.
  const colW = size.w > 0 ? (size.w - 2 * PAD + GAP) / GRID_COLS : 0;
  const fitH = rows > 0 ? (size.h - 2 * PAD + GAP) / rows : colW;
  const rowH = Math.max(colW, Math.min(colW * 1.6, fitH));
  const rectOf = (c: Cell): Rect => ({
    x: PAD + c.col * colW,
    y: PAD + c.row * rowH,
    w: c.w * colW - GAP,
    h: c.h * rowH - GAP,
  });
  const contentH = rows * rowH + 2 * PAD - GAP;

  const selected = tiles.find(t => t.id === selectedId) ?? null;
  const selectedIndex = selected ? tiles.indexOf(selected) : -1;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  const enterEdit = (id: string | null) => {
    setEditMode(true);
    setSelectedId(id);
  };
  const exitEdit = () => {
    setEditMode(false);
    setSelectedId(null);
    setDrag(null);
    setDragOrder(null);
  };

  // Aktualne wartości dla stabilnych callbacków (kafelki są memo i nie przerysowują się bez potrzeby).
  const live = useLatest({ tiles, cells, colW, rowH, editMode, drag, rectOf });

  const onPress = useCallback((id: string) => {
    const { tiles: list, editMode: editing } = live.current;
    if (!editing) {
      const t = list.find(x => x.id === id);
      if (t) setEditing(t);
      return;
    }
    setSelectedId(prev => (prev === id ? null : id));
  }, []);

  const onLongPress = useCallback((id: string) => enterEdit(id), []);

  const onDragStart = useCallback((id: string) => {
    const { tiles: list, cells: cs, rectOf: r } = live.current;
    const i = list.findIndex(t => t.id === id);
    if (i < 0) return;
    pan.setValue({ x: 0, y: 0 });
    setDragOrder(list.map(t => t.id));
    setDrag({ id, start: r(cs[i]) });
  }, []);

  const onDragMove = useCallback((dx: number, dy: number) => {
    pan.setValue({ x: dx, y: dy });
    const { drag: d, tiles: list, cells: cs, colW: cw, rowH: rh } = live.current;
    if (!d || cw === 0) return;
    const now = Date.now();
    if (now - lastSwap.current < SWAP_COOLDOWN) return;
    const cx = d.start.x + d.start.w / 2 + dx;
    const cy = d.start.y + d.start.h / 2 + dy;
    const target = cellAt(cs, Math.floor((cx - PAD) / cw), Math.floor((cy - PAD) / rh));
    const from = list.findIndex(t => t.id === d.id);
    if (target < 0 || from < 0 || target === from) return;
    lastSwap.current = now;
    LayoutAnimation.configureNext(LayoutAnimation.create(160, 'easeInEaseOut', 'scaleXY'));
    setDragOrder(moveTile(list.map(t => t.id), from, target));
  }, []);

  const onDragEnd = useCallback(() => {
    const { tiles: list } = live.current;
    const ids = list.map(t => t.id);
    setRoutine(r => {
      const byId = new Map(r.tiles.map(t => [t.id, t]));
      const ordered = ids.map(id => byId.get(id)).filter((t): t is RoutineTile => !!t);
      const rest = r.tiles.filter(t => !ids.includes(t.id));
      return { ...r, tiles: [...ordered, ...rest] };
    });
    LayoutAnimation.configureNext(LayoutAnimation.create(140, 'easeInEaseOut', 'opacity'));
    setDrag(null);
    setDragOrder(null);
    pan.setValue({ x: 0, y: 0 });
  }, [routine.id]);

  const shift = (dir: -1 | 1) => {
    if (selectedIndex < 0) return;
    setRoutine(r => ({ ...r, tiles: moveTile(r.tiles, selectedIndex, selectedIndex + dir) }));
  };

  const resize = (sz: TileSize) => {
    if (!selected) return;
    setRoutine(r => ({ ...r, tiles: r.tiles.map(t => (t.id === selected.id ? { ...t, size: sz } : t)) }));
  };

  const addTile = (kind: TileKind) => {
    setPaletteOpen(false);
    const tile = makeTile(kind);
    setRoutine(r => ({ ...r, tiles: [...r.tiles, tile] }));
    enterEdit(tile.id);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const deleteSelected = () => {
    if (!selected) return;
    Alert.alert(`Usunąć „${selected.title}”?`, 'Kolejne kafelki przesuną się o jedno miejsce.', [
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
  const categories: TileCategory[] = ['module', 'app', 'task'];

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity style={s.backButton} onPress={goHome} activeOpacity={0.7}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={s.title}>Plan dnia</Text>
        <TouchableOpacity
          style={[s.countBox, editMode && s.countBoxInk]}
          onPress={() => (editMode ? exitEdit() : enterEdit(null))}
          activeOpacity={0.7}
        >
          <Text style={[s.countText, editMode && s.onInkStrong]}>{editMode ? 'Gotowe ✓' : 'Edytuj układ'}</Text>
        </TouchableOpacity>
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

      <View style={[s.hintBar, editMode && s.hintBarEdit]}>
        <Text style={[s.hintText, editMode && s.hintTextEdit]} numberOfLines={2}>
          {!editMode
            ? 'Numery to kolejność kroków · dotknij kafelek, by zmienić opcje · przytrzymaj, by edytować układ'
            : selected
              ? 'Przeciągnij zaznaczony kafelek na inne miejsce albo użyj strzałek · wybierz rozmiar poniżej'
              : 'Dotknij kafelek, by go zaznaczyć'}
        </Text>
      </View>

      <View style={s.board} onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          scrollEnabled={!drag && !(editMode && selected)}
          contentContainerStyle={{ height: Math.max(contentH, size.h) }}
          keyboardShouldPersistTaps="handled"
        >
          {colW > 0 &&
            tiles.map((t, i) => {
              const dragging = drag?.id === t.id;
              const rect = dragging && drag ? drag.start : rectOf(cells[i]);
              return (
                <TileView
                  key={t.id}
                  tile={t}
                  index={i}
                  x={rect.x}
                  y={rect.y}
                  w={rect.w}
                  h={rect.h}
                  compact={cells[i].w === 1 && cells[i].h === 1}
                  large={cells[i].w >= 3}
                  time={times[i]}
                  editMode={editMode}
                  selected={t.id === selectedId}
                  pan={dragging ? pan : null}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  onDragStart={onDragStart}
                  onDragMove={onDragMove}
                  onDragEnd={onDragEnd}
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
          {tiles.length === 0 && (
            <View style={s.empty} pointerEvents="none">
              <Text style={s.emptyText}>Pusta plansza. Dodaj pierwszy kafelek poniżej.</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {editMode && selected ? (
        <View style={{ paddingBottom: bottomInset, backgroundColor: WHITE }}>
          <View style={s.actions}>
            {SIZES.map((sz, i) => {
              const on = (selected.size ?? 'medium') === sz;
              return (
                <TouchableOpacity
                  key={sz}
                  style={[s.action, i > 0 && s.actionDivided, on && s.actionInk]}
                  onPress={() => resize(sz)}
                >
                  <Text style={[s.actionText, on && s.onInkStrong]}>{SIZE_LABELS[sz]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.actions}>
            <TouchableOpacity
              style={[s.action, selectedIndex <= 0 && s.disabled]}
              disabled={selectedIndex <= 0}
              onPress={() => shift(-1)}
            >
              <Text style={s.actionText}>← Wcześniej</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.action, s.actionDivided, selectedIndex >= tiles.length - 1 && s.disabled]}
              disabled={selectedIndex >= tiles.length - 1}
              onPress={() => shift(1)}
            >
              <Text style={s.actionText}>Później →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.action, s.actionDivided]} onPress={() => setEditing(selected)}>
              <Text style={s.actionText}>Opcje</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.action, s.actionDivided]} onPress={deleteSelected}>
              <Text style={[s.actionText, s.danger]}>Usuń</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[s.actions, { paddingBottom: bottomInset }]}>
          <TouchableOpacity style={[s.action, s.actionPrimary]} onPress={() => setPaletteOpen(true)}>
            <Text style={s.actionTextBig}>+ Dodaj kafelek</Text>
          </TouchableOpacity>
          {editMode ? (
            <TouchableOpacity style={[s.action, s.actionDivided, s.actionInk]} onPress={exitEdit}>
              <Text style={[s.actionTextBig, s.onInkStrong]}>Gotowe ✓</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.action, s.actionDivided, s.actionInk, tiles.length === 0 && s.disabled]}
              disabled={tiles.length === 0}
              onPress={() => router.push(`/plan-run?plan=${routine.id}`)}
            >
              <Text style={[s.actionTextBig, s.onInkStrong]}>▶ Uruchom</Text>
            </TouchableOpacity>
          )}
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
  countBoxInk: { backgroundColor: INK },
  hintBarEdit: { backgroundColor: YELLOW },
  hintTextEdit: { color: INK },

  board: { flex: 1 },
  empty: { position: 'absolute', left: 0, right: 0, top: 120, alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '700', color: MUTED },

  tile: {
    position: 'absolute',
    borderWidth: LINE,
    borderColor: INK,
    padding: 10,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  tileCompact: { padding: 7 },
  tileModule: { backgroundColor: YELLOW },
  tileApp: { backgroundColor: WHITE },
  tileTask: { backgroundColor: INK },
  tilePressed: { opacity: 0.8 },
  tileEditing: { opacity: 0.75 },
  tileSelected: { borderWidth: 4, borderColor: DANGER },
  tileDragging: {
    zIndex: 10,
    elevation: 10,
    shadowColor: INK,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 4, height: 4 },
  },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start' },
  num: { fontSize: 30, lineHeight: 32, fontWeight: '900', color: INK, letterSpacing: -1, marginRight: 8 },
  numSmall: { fontSize: 20, lineHeight: 22 },
  tileCategory: { flex: 1, textAlign: 'right', fontSize: 9, fontWeight: '900', color: INK, letterSpacing: 0.5, marginTop: 3 },
  tileTitle: { fontSize: 18, fontWeight: '900', color: INK, letterSpacing: -0.3 },
  tileTitleSmall: { fontSize: 12, letterSpacing: 0 },
  tileTitleLarge: { fontSize: 26, letterSpacing: -0.8 },
  tileDesc: { fontSize: 12, fontWeight: '600', color: INK, opacity: 0.75, marginTop: 1 },
  tileMeta: { fontSize: 12, fontWeight: '800', color: INK, opacity: 0.75, marginTop: 2 },
  tileMetaSmall: { fontSize: 10, marginTop: 1 },
  selMark: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: DANGER,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  selMarkText: { color: WHITE, fontSize: 13, fontWeight: '900' },
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
