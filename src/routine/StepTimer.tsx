import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { INK, YELLOW, WHITE, LINE } from '../theme';

const CHANNEL = 'step-timer';
const AUTO_NEXT_DELAY = 3000;
const tabular = ['tabular-nums' as const];
const pad = (n: number) => String(n).padStart(2, '0');

/** „mm:ss”, po czasie z „+” (np. +01:05). */
export function formatLeft(ms: number) {
  const sec = Math.ceil(Math.abs(ms) / 1000) * (ms < 0 ? -1 : 1);
  const abs = Math.abs(sec);
  return `${sec < 0 ? '+' : ''}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

async function schedule(id: string, endsAt: number, title: string, nextTitle?: string) {
  try {
    await notifee.cancelNotification(id);
    if (endsAt - Date.now() < 1500) return;
    const channelId = await notifee.createChannel({
      id: CHANNEL,
      name: 'Minutnik planu',
      importance: AndroidImportance.HIGH,
      vibration: true,
    });
    await notifee.createTriggerNotification(
      {
        id,
        title: `⏱ Czas minął: ${title}`,
        body: nextTitle ? `Następnie: ${nextTitle}` : 'To był ostatni krok planu.',
        data: { type: 'step-timer' },
        android: { channelId, pressAction: { id: 'default' } },
      },
      { type: TriggerType.TIMESTAMP, timestamp: endsAt, alarmManager: { allowWhileIdle: true } }
    );
  } catch (e) {
    console.warn('Nie udało się zaplanować minutnika', e);
  }
}

const cancel = (id: string) => notifee.cancelNotification(id).catch(() => {});

interface Props {
  minutes: number;
  title: string;
  nextTitle?: string;
  autoNext?: boolean;
  /** Wywoływane po końcu odliczania, gdy autoNext. */
  onAutoNext: () => void;
}

/** Minutnik kroku: startuje sam, pauza, +1 min, reset; powiadomienie także poza aplikacją. Montuj z key = krok. */
export default function StepTimer({ minutes, title, nextTitle, autoNext, onAutoNext }: Props) {
  const total = minutes * 60 * 1000;
  const [endsAt, setEndsAt] = useState<number | null>(() => Date.now() + total);
  const [pausedLeft, setPausedLeft] = useState(total);
  const [now, setNow] = useState(() => Date.now());
  const rang = useRef(false);
  // Własne id na każdy krok — anulowanie poprzedniego kroku nie skasuje minutnika nowego.
  const notifId = useRef(`step-timer-${Date.now()}`).current;
  const [autoAt, setAutoAt] = useState<number | null>(null);

  const running = endsAt !== null;
  const left = running ? endsAt - now : pausedLeft;
  const over = left <= 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(t);
      cancel(notifId);
    };
  }, []);

  // Powiadomienie systemowe na koniec odliczania (działa też, gdy jesteś w innej aplikacji).
  useEffect(() => {
    if (endsAt !== null) schedule(notifId, endsAt, title, nextTitle);
    else cancel(notifId);
  }, [endsAt]);

  // Koniec odliczania przy otwartej aplikacji.
  useEffect(() => {
    if (!running || !over || rang.current) return;
    rang.current = true;
    Vibration.vibrate([0, 500, 250, 500, 250, 500]);
    if (autoNext) setAutoAt(Date.now() + AUTO_NEXT_DELAY);
  }, [running, over]);

  useEffect(() => {
    if (autoAt !== null && now >= autoAt) {
      setAutoAt(null);
      onAutoNext();
    }
  }, [now, autoAt]);

  const pause = () => {
    setPausedLeft(Math.max(0, left));
    setEndsAt(null);
    setAutoAt(null);
  };
  const resume = () => {
    const base = Date.now() + pausedLeft;
    if (pausedLeft > 0) rang.current = false;
    setEndsAt(base);
  };
  const addMinute = () => {
    rang.current = false;
    setAutoAt(null);
    if (running) setEndsAt(Math.max(endsAt!, Date.now()) + 60000);
    else setPausedLeft(p => Math.max(0, p) + 60000);
  };
  const reset = () => {
    rang.current = false;
    setAutoAt(null);
    setPausedLeft(total);
    setEndsAt(Date.now() + total);
  };

  const pct = Math.min(1, Math.max(0, 1 - left / total));
  const hint = autoAt
    ? `Przechodzę dalej za ${Math.max(1, Math.ceil((autoAt - now) / 1000))} s…`
    : over
      ? 'Czas minął — przejdź dalej, gdy skończysz'
      : running
        ? `Minutnik ${minutes} min${autoNext ? ' · potem następny krok' : ''}`
        : 'Pauza';

  return (
    <View style={s.timer}>
      <Text style={[s.text, over && s.over, !running && !over && s.paused]}>{formatLeft(left)}</Text>
      <View style={s.track}>
        <View style={[s.fill, { flex: pct }]} />
        <View style={{ flex: 1 - pct }} />
      </View>
      <Text style={s.hint}>{hint}</Text>
      <View style={s.buttons}>
        <TouchableOpacity style={s.btn} onPress={running ? pause : resume} disabled={!running && pausedLeft <= 0}>
          <Text style={s.btnText}>{running ? 'Pauza' : 'Wznów'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnDivided]} onPress={addMinute}>
          <Text style={s.btnText}>+1 min</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnDivided]} onPress={reset}>
          <Text style={s.btnText}>Od nowa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  timer: { marginTop: 16, borderWidth: LINE, borderColor: YELLOW, paddingTop: 12 },
  text: { color: WHITE, fontSize: 52, fontWeight: '900', fontVariant: tabular, paddingHorizontal: 14 },
  over: { color: YELLOW },
  paused: { color: '#77776F' },
  track: { flexDirection: 'row', height: 10, borderWidth: LINE, borderColor: YELLOW, marginTop: 6, marginHorizontal: 14 },
  fill: { backgroundColor: YELLOW },
  hint: { color: '#9A9A94', fontSize: 13, marginTop: 8, paddingHorizontal: 14 },
  buttons: { flexDirection: 'row', borderTopWidth: LINE, borderTopColor: YELLOW, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  btnDivided: { borderLeftWidth: LINE, borderLeftColor: YELLOW },
  btnText: { color: YELLOW, fontSize: 15, fontWeight: '900' },
});
