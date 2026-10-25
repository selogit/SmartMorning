import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Accelerometer, Pedometer } from 'expo-sensors';
import { INK, YELLOW, WHITE, DANGER, LINE } from '../theme';
import {
  ChallengeConfig,
  ChallengeKind,
  Difficulty,
  CHALLENGE_TITLES,
  DIFFICULTY_LABELS,
  generateMathProblem,
  matchedPrefixLength,
  phrasesMatch,
} from './challenges';

/** Odchylenie od 1 g (grawitacja), powyżej którego ruch liczy się jako potrząśnięcie. */
const SHAKE_THRESHOLD_G = 0.9;
const SHAKE_DEBOUNCE_MS = 220;
/** Po tylu sekundach przy zadaniu z czujnikiem pojawia się awaryjne wyjście (działanie). */
const SENSOR_ESCAPE_AFTER_S = 30;

const tabular = ['tabular-nums' as const];

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={s.progressTrack}>
      <View style={[s.progressFill, { flex: pct }]} />
      <View style={{ flex: 1 - pct }} />
    </View>
  );
}

/* ───────────── Matematyka ───────────── */

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['del', '0', 'ok'],
];

interface MathProps {
  difficulty: Difficulty;
  count: number;
  notice?: string | null;
  onComplete: () => void;
}

function MathChallenge({ difficulty, count, notice, onComplete }: MathProps) {
  const [solved, setSolved] = useState(0);
  const [problem, setProblem] = useState(() => generateMathProblem(difficulty));
  const [input, setInput] = useState('');
  const [wrong, setWrong] = useState(false);

  const submit = () => {
    if (!input) return;
    if (Number(input) === problem.answer) {
      const next = solved + 1;
      if (next >= count) {
        onComplete();
        return;
      }
      setSolved(next);
      setWrong(false);
    } else {
      // Nowe działanie po błędzie, żeby nie dało się zgadywać na ślepo.
      setWrong(true);
    }
    setProblem(generateMathProblem(difficulty));
    setInput('');
  };

  const onKey = (key: string) => {
    if (key === 'ok') return submit();
    setWrong(false);
    if (key === 'del') setInput(v => v.slice(0, -1));
    else setInput(v => (v.length >= 6 ? v : v === '0' ? key : v + key));
  };

  return (
    <View style={s.fill}>
      {notice ? (
        <View style={s.notice}>
          <Text style={s.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={s.metaRow}>
        <Text style={s.metaText}>
          Działanie {solved + 1}/{count}
        </Text>
        <Text style={s.metaText}>{DIFFICULTY_LABELS[difficulty]}</Text>
      </View>
      <ProgressBar value={solved} total={count} />

      <View style={s.problemCell}>
        <Text style={s.problemText} numberOfLines={1} adjustsFontSizeToFit>
          {problem.text} =
        </Text>
      </View>

      <View style={[s.answerCell, wrong && s.answerCellWrong]}>
        {input ? (
          <Text style={s.answerText}>{input}</Text>
        ) : (
          <Text style={[s.answerHint, wrong && s.answerHintWrong]}>
            {wrong ? 'Źle — nowe działanie' : 'Wpisz wynik'}
          </Text>
        )}
      </View>

      <View style={s.keypad}>
        {KEYS.map((row, i) => (
          <View key={i} style={[s.keyRow, i > 0 && s.keyRowDivided]}>
            {row.map((k, j) => (
              <TouchableOpacity
                key={k}
                activeOpacity={0.6}
                style={[s.key, j > 0 && s.keyDivided, k === 'ok' && s.keyOk]}
                onPress={() => onKey(k)}
              >
                <Text style={[s.keyText, k === 'ok' && s.keyOkText]}>
                  {k === 'del' ? '⌫' : k === 'ok' ? 'OK' : k}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────── Fraza ───────────── */

function PhraseChallenge({ phrase, onComplete }: { phrase: string; onComplete: () => void }) {
  const [text, setText] = useState('');
  const done = useRef(false);
  const matched = matchedPrefixLength(text, phrase);
  const diverged = text.length > 0 && matched < text.length;

  const onChange = (value: string) => {
    setText(value);
    if (!done.current && phrasesMatch(value, phrase)) {
      done.current = true;
      onComplete();
    }
  };

  return (
    <ScrollView style={s.fill} keyboardShouldPersistTaps="handled">
      <View style={s.metaRow}>
        <Text style={s.metaText}>Przepisz dokładnie</Text>
        <Text style={s.metaText}>
          {Math.min(matched, phrase.length)}/{phrase.length}
        </Text>
      </View>
      <ProgressBar value={matched} total={phrase.length} />

      <View style={s.phraseCell}>
        <Text style={s.phraseText}>
          <Text style={s.phraseDone}>{phrase.slice(0, matched)}</Text>
          {phrase.slice(matched)}
        </Text>
      </View>

      <TextInput
        style={[s.phraseInput, diverged && s.phraseInputWrong]}
        value={text}
        onChangeText={onChange}
        placeholder="Zacznij pisać…"
        placeholderTextColor="#777"
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        contextMenuHidden
        multiline
        selectionColor={YELLOW}
      />
      {diverged && <Text style={s.phraseError}>Literówka — popraw od zaznaczonego miejsca</Text>}
      <Text style={s.helper}>Wielkość liter nie ma znaczenia, polskie znaki tak.</Text>
    </ScrollView>
  );
}

/* ───────────── Potrząśnięcie ───────────── */

interface SensorProps {
  target: number;
  onComplete: () => void;
  onUnavailable: (reason: string) => void;
}

function ShakeChallenge({ target, onComplete, onUnavailable }: SensorProps) {
  const [count, setCount] = useState(0);
  const completeRef = useLatest(onComplete);
  const unavailableRef = useLatest(onUnavailable);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    let last = 0;
    let n = 0;

    (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      if (!available) {
        unavailableRef.current('Akcelerometr jest niedostępny.');
        return;
      }
      Accelerometer.setUpdateInterval(50);
      sub = Accelerometer.addListener(({ x, y, z }) => {
        const g = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (Math.abs(g - 1) > SHAKE_THRESHOLD_G && now - last > SHAKE_DEBOUNCE_MS) {
          last = now;
          n += 1;
          setCount(n);
          if (n >= target) {
            sub?.remove();
            sub = null;
            completeRef.current();
          }
        }
      });
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [target]);

  return (
    <View style={[s.fill, s.sensorBody]}>
      <View style={s.sensorCell}>
        <Text style={s.sensorCount} numberOfLines={1} adjustsFontSizeToFit>
          {Math.min(count, target)}
          <Text style={s.sensorTotal}>/{target}</Text>
        </Text>
      </View>
      <ProgressBar value={count} total={target} />
      <Text style={s.sensorTitle}>Potrząśnij telefonem</Text>
      <Text style={s.helper}>Mocne, wyraźne ruchy — każdy liczy się jako jedno potrząśnięcie.</Text>
    </View>
  );
}

/* ───────────── Kroki ───────────── */

function StepsChallenge({ target, onComplete, onUnavailable }: SensorProps) {
  const [steps, setSteps] = useState(0);
  const [ready, setReady] = useState(false);
  const completeRef = useLatest(onComplete);
  const unavailableRef = useLatest(onUnavailable);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    let finished = false;

    (async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        if (!available) {
          unavailableRef.current('Ten telefon nie ma licznika kroków.');
          return;
        }
        let perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted) perm = await Pedometer.requestPermissionsAsync();
        if (cancelled) return;
        if (!perm.granted) {
          unavailableRef.current('Brak zgody na licznik kroków.');
          return;
        }
        setReady(true);
        sub = Pedometer.watchStepCount(result => {
          setSteps(result.steps);
          if (!finished && result.steps >= target) {
            finished = true;
            sub?.remove();
            sub = null;
            completeRef.current();
          }
        });
      } catch (e) {
        console.warn('Pedometer error', e);
        if (!cancelled) unavailableRef.current('Nie udało się uruchomić licznika kroków.');
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [target]);

  return (
    <View style={[s.fill, s.sensorBody]}>
      <View style={s.sensorCell}>
        <Text style={s.sensorCount} numberOfLines={1} adjustsFontSizeToFit>
          {Math.min(steps, target)}
          <Text style={s.sensorTotal}>/{target}</Text>
        </Text>
      </View>
      <ProgressBar value={steps} total={target} />
      <Text style={s.sensorTitle}>{ready ? 'Wstań i przejdź się' : 'Uruchamiam licznik kroków…'}</Text>
      <Text style={s.helper}>
        Licznik może reagować z kilkusekundowym opóźnieniem — po prostu idź dalej.
      </Text>
    </View>
  );
}

/* ───────────── Pojedyncze zadanie (z awaryjnym działaniem) ───────────── */

interface SingleProps {
  kind: ChallengeKind;
  challenge: ChallengeConfig;
  onComplete: () => void;
}

function SingleChallenge({ kind, challenge, onComplete }: SingleProps) {
  const [fallback, setFallback] = useState<string | null>(null);
  const [showEscape, setShowEscape] = useState(false);
  const isSensor = kind === 'shake' || kind === 'steps';

  useEffect(() => {
    if (!isSensor) return;
    const t = setTimeout(() => setShowEscape(true), SENSOR_ESCAPE_AFTER_S * 1000);
    return () => clearTimeout(t);
  }, [isSensor]);

  let body: React.ReactNode = null;
  if (fallback !== null) {
    body = (
      <MathChallenge
        difficulty="medium"
        count={1}
        notice={`${fallback} Rozwiąż działanie, aby zaliczyć to zadanie.`}
        onComplete={onComplete}
      />
    );
  } else if (kind === 'math') {
    body = (
      <MathChallenge
        difficulty={challenge.mathDifficulty}
        count={challenge.mathCount}
        onComplete={onComplete}
      />
    );
  } else if (kind === 'phrase') {
    body = <PhraseChallenge phrase={challenge.phrase} onComplete={onComplete} />;
  } else if (kind === 'shake') {
    body = (
      <ShakeChallenge target={challenge.shakeCount} onComplete={onComplete} onUnavailable={setFallback} />
    );
  } else if (kind === 'steps') {
    body = (
      <StepsChallenge target={challenge.stepCount} onComplete={onComplete} onUnavailable={setFallback} />
    );
  }

  return (
    <View style={s.fill}>
      {body}
      {isSensor && showEscape && fallback === null && (
        <TouchableOpacity
          style={s.escape}
          activeOpacity={0.7}
          onPress={() => setFallback('Czujnik nie reaguje?')}
        >
          <Text style={s.escapeText}>Czujnik nie reaguje? Rozwiąż działanie</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ───────────── Sekwencja zadań ───────────── */

interface AlarmChallengeProps {
  challenge: ChallengeConfig;
  /** Indeks bieżącego zadania — trzymany wyżej, żeby „Wróć” nie kasował postępu. */
  step: number;
  onStepComplete: () => void;
  onBack: () => void;
}

export default function AlarmChallenge({ challenge, step, onStepComplete, onBack }: AlarmChallengeProps) {
  const kinds = challenge.types;
  const total = kinds.length;
  const current = Math.min(step, total - 1);
  const kind = kinds[current];
  if (!kind) return null;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backCell} onPress={onBack} activeOpacity={0.7}>
          <Text style={s.backText}>← Wróć</Text>
        </TouchableOpacity>
        <View style={s.titleCell}>
          <Text style={s.titleText} numberOfLines={1}>
            {CHALLENGE_TITLES[kind]}
          </Text>
        </View>
        {total > 1 && (
          <View style={s.stepCell}>
            <Text style={s.stepText}>
              {current + 1}/{total}
            </Text>
          </View>
        )}
      </View>

      {total > 1 && (
        <View style={s.stepsBar}>
          {kinds.map((k, i) => (
            <View
              key={k}
              style={[s.stepSegment, i > 0 && s.stepSegmentDivided, i < current && s.stepSegmentDone, i === current && s.stepSegmentActive]}
            >
              <Text
                style={[s.stepSegmentText, i < current && s.stepSegmentTextOn, i === current && s.stepSegmentTextActive]}
                numberOfLines={1}
              >
                {i < current ? '✓ ' : ''}
                {CHALLENGE_TITLES[k]}
              </Text>
            </View>
          ))}
        </View>
      )}

      <SingleChallenge key={`${current}-${kind}`} kind={kind} challenge={challenge} onComplete={onStepComplete} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  backCell: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRightWidth: LINE,
    borderRightColor: YELLOW,
    justifyContent: 'center',
  },
  backText: { color: YELLOW, fontSize: 16, fontWeight: '700' },
  titleCell: { flex: 1, justifyContent: 'center', paddingHorizontal: 14 },
  titleText: { color: WHITE, fontSize: 18, fontWeight: '900' },
  stepCell: {
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderLeftWidth: LINE,
    borderLeftColor: YELLOW,
    backgroundColor: YELLOW,
  },
  stepText: { color: INK, fontSize: 16, fontWeight: '900', fontVariant: tabular },
  stepsBar: { flexDirection: 'row', borderBottomWidth: LINE, borderBottomColor: YELLOW },
  stepSegment: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, alignItems: 'center' },
  stepSegmentDivided: { borderLeftWidth: LINE, borderLeftColor: YELLOW },
  stepSegmentDone: { backgroundColor: '#3A3A36' },
  stepSegmentActive: { backgroundColor: YELLOW },
  stepSegmentText: { color: '#777', fontSize: 11, fontWeight: '800' },
  stepSegmentTextOn: { color: WHITE },
  stepSegmentTextActive: { color: INK },

  notice: { backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 10 },
  noticeText: { color: INK, fontSize: 14, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  metaText: { color: YELLOW, fontSize: 14, fontWeight: '800', fontVariant: tabular },

  progressTrack: {
    flexDirection: 'row',
    height: 10,
    marginHorizontal: 14,
    borderWidth: LINE,
    borderColor: YELLOW,
  },
  progressFill: { backgroundColor: YELLOW },

  problemCell: {
    marginTop: 14,
    backgroundColor: YELLOW,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  problemText: { color: INK, fontSize: 44, fontWeight: '900', fontVariant: tabular },

  answerCell: {
    height: 72,
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
    justifyContent: 'center',
    alignItems: 'center',
  },
  answerCellWrong: { backgroundColor: DANGER },
  answerText: { color: WHITE, fontSize: 40, fontWeight: '900', fontVariant: tabular },
  answerHint: { color: '#777', fontSize: 18, fontWeight: '700' },
  answerHintWrong: { color: WHITE },

  keypad: { flex: 1, minHeight: 220 },
  keyRow: { flex: 1, flexDirection: 'row' },
  keyRowDivided: { borderTopWidth: LINE, borderTopColor: YELLOW },
  key: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  keyDivided: { borderLeftWidth: LINE, borderLeftColor: YELLOW },
  keyOk: { backgroundColor: WHITE },
  keyText: { color: YELLOW, fontSize: 28, fontWeight: '800' },
  keyOkText: { color: INK, fontWeight: '900' },

  phraseCell: {
    marginTop: 14,
    backgroundColor: YELLOW,
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  phraseText: { color: 'rgba(17,17,17,0.45)', fontSize: 24, fontWeight: '800', lineHeight: 32 },
  phraseDone: { color: INK, textDecorationLine: 'underline' },
  phraseInput: {
    margin: 14,
    minHeight: 96,
    borderWidth: LINE,
    borderColor: YELLOW,
    color: WHITE,
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  phraseInputWrong: { borderColor: DANGER },
  phraseError: { color: '#FF6B6B', fontSize: 14, fontWeight: '700', marginHorizontal: 14, marginTop: -6 },

  helper: { color: '#9A9A94', fontSize: 14, marginHorizontal: 14, marginTop: 10, lineHeight: 20 },

  sensorBody: { paddingBottom: 16 },
  sensorCell: {
    flex: 1,
    marginTop: 14,
    marginBottom: 14,
    backgroundColor: YELLOW,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  sensorCount: { color: INK, fontSize: 110, fontWeight: '900', letterSpacing: -3, fontVariant: tabular },
  sensorTotal: { fontSize: 44, letterSpacing: 0 },
  sensorTitle: { color: WHITE, fontSize: 24, fontWeight: '900', marginHorizontal: 14, marginTop: 16 },

  escape: {
    borderTopWidth: LINE,
    borderTopColor: YELLOW,
    paddingVertical: 16,
    alignItems: 'center',
  },
  escapeText: { color: YELLOW, fontSize: 15, fontWeight: '700' },
});
