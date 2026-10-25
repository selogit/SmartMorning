import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { INK, YELLOW, WHITE, LINE } from '../theme';
import { CHALLENGE_TITLES, normalizeChallenge } from '../challenges/challenges';
import AlarmChallenge from '../challenges/AlarmChallenge';
import { Alarm } from './types';
import { pad } from './time';
import { useWeather } from '../weather/WeatherProvider';
import { weatherLine } from '../weather/advice';

const STRIPE_SLOT = 40;
const STRIPE_HEIGHT = 28;
const tabular = ['tabular-nums' as const];

function HazardStripe() {
  const slots = Math.ceil(Dimensions.get('window').width / STRIPE_SLOT) + 2;
  return (
    <View style={styles.stripe}>
      <View style={styles.stripeRow}>
        {Array.from({ length: slots }, (_, i) => (
          <View key={i} style={styles.stripeSlot}>
            <View style={styles.stripeBar} />
          </View>
        ))}
      </View>
    </View>
  );
}

interface WakeScreenProps {
  alarm: Alarm;
  snoozeMinutes: number;
  onSnooze: () => void;
  onStop: () => void;
}

export default function WakeScreen({ alarm, snoozeMinutes, onSnooze, onStop }: WakeScreenProps) {
  const bottomInset = useSafeAreaInsets().bottom;
  const [elapsed, setElapsed] = useState(0);
  const [solving, setSolving] = useState(false);
  const [step, setStep] = useState(0);
  const blink = useRef(new Animated.Value(1)).current;
  const { forecast } = useWeather();
  const challenge = normalizeChallenge(alarm.challenge);
  const total = challenge.types.length;

  const handleStop = () => (total > 0 ? setSolving(true) : onStop());

  const handleStepComplete = () => {
    const next = step + 1;
    if (next >= total) onStop();
    else setStep(next);
  };

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      clearInterval(timer);
      loop.stop();
    };
  }, []);

  const remaining = challenge.types.slice(step).map(t => CHALLENGE_TITLES[t]);

  return (
    <View style={[styles.wake, { paddingBottom: bottomInset }]}>
      <HazardStripe />

      <View style={styles.wakeBody}>
        <View style={styles.wakeHeader}>
          <View style={styles.wakeStatus}>
            <Animated.View style={[styles.wakeDot, { opacity: blink }]} />
            <Text style={styles.wakeStatusText}>Alarm dzwoni</Text>
          </View>
          <View style={styles.wakeElapsed}>
            <Text style={styles.wakeElapsedText}>
              {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}
            </Text>
          </View>
        </View>

        {solving ? (
          <AlarmChallenge
            challenge={challenge}
            step={step}
            onStepComplete={handleStepComplete}
            onBack={() => setSolving(false)}
          />
        ) : (
          <>
            <View style={styles.wakeTimeCell}>
              <Text style={styles.wakeTime} numberOfLines={1} adjustsFontSizeToFit>
                {alarm.time}
              </Text>
            </View>

            <View style={styles.wakeLabelCell}>
              <Text style={styles.wakeLabel} numberOfLines={2}>
                {alarm.label}
              </Text>
              {forecast && (
                <Text style={styles.wakeWeather} numberOfLines={2}>
                  {weatherLine(forecast)}
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.snoozeButton} onPress={onSnooze} activeOpacity={0.8}>
              <Text style={styles.snoozeText}>Drzemka {snoozeMinutes} min</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.stopButton} onPress={handleStop} activeOpacity={0.8}>
              <Text style={styles.stopText}>{step > 0 ? 'Kontynuuj' : 'Wyłącz'}</Text>
              {total > 0 && (
                <Text style={styles.stopHint} numberOfLines={2}>
                  {step > 0 ? 'Zostało' : total > 1 ? 'Najpierw zadania' : 'Najpierw zadanie'}:{' '}
                  {remaining.join(' → ')}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      <HazardStripe />
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: { height: STRIPE_HEIGHT, overflow: 'hidden', backgroundColor: YELLOW },
  stripeRow: { flexDirection: 'row', marginLeft: -STRIPE_SLOT / 2 },
  stripeSlot: { width: STRIPE_SLOT, height: STRIPE_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  stripeBar: {
    width: STRIPE_SLOT / 2 / Math.SQRT2,
    height: 120,
    backgroundColor: INK,
    transform: [{ rotate: '45deg' }],
  },

  wake: { flex: 1, backgroundColor: INK },
  wakeBody: { flex: 1, margin: 16, borderWidth: LINE, borderColor: YELLOW },
  wakeHeader: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: LINE, borderBottomColor: YELLOW },
  wakeStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  wakeDot: { width: 14, height: 14, backgroundColor: YELLOW, marginRight: 10 },
  wakeStatusText: { color: YELLOW, fontSize: 16, fontWeight: '800' },
  wakeElapsed: { paddingHorizontal: 14, justifyContent: 'center', borderLeftWidth: LINE, borderLeftColor: YELLOW },
  wakeElapsedText: { color: YELLOW, fontSize: 18, fontWeight: '700', fontVariant: tabular },
  wakeTimeCell: { flex: 1, backgroundColor: YELLOW, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  wakeTime: { fontSize: 120, fontWeight: '900', color: INK, letterSpacing: -4, fontVariant: tabular },
  wakeLabelCell: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderTopWidth: LINE,
    borderTopColor: YELLOW,
    borderBottomWidth: LINE,
    borderBottomColor: YELLOW,
  },
  wakeLabel: { color: WHITE, fontSize: 24, fontWeight: '700' },
  wakeWeather: { color: YELLOW, fontSize: 15, fontWeight: '700', marginTop: 6 },
  snoozeButton: { paddingVertical: 22, alignItems: 'center', borderBottomWidth: LINE, borderBottomColor: YELLOW },
  snoozeText: { color: YELLOW, fontSize: 20, fontWeight: '800' },
  stopButton: { backgroundColor: WHITE, paddingVertical: 28, paddingHorizontal: 14, alignItems: 'center' },
  stopText: { color: INK, fontSize: 30, fontWeight: '900' },
  stopHint: { color: INK, fontSize: 13, fontWeight: '700', marginTop: 4, opacity: 0.6, textAlign: 'center' },
});
