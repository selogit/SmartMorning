import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AppState, Linking, Platform, ActivityIndicator } from 'react-native';
import notifee, { AndroidNotificationSetting, AuthorizationStatus } from '@notifee/react-native';
import { Pedometer } from 'expo-sensors';
import { useCameraPermissions } from 'expo-camera';
import { INK, YELLOW, WHITE, MUTED, DANGER, LINE } from '../theme';
import { useAlarms } from '../alarm/AlarmProvider';
import { normalizeChallenge } from '../challenges/challenges';
import { isAlarmChannelAvailable } from '../../modules/alarm-channel';

const ALARM_CHANNEL = 'wake_alarm_v3';
const OK = '#2E7D32';

/** ok = działa, bad = alarm może nie zadzwonić, warn = może przeszkadzać, info = nie da się sprawdzić automatycznie. */
type Status = 'ok' | 'bad' | 'warn' | 'info';

interface Check {
  id: string;
  title: string;
  hint: string;
  status: Status;
  action?: { label: string; run: () => Promise<unknown> | void };
}

const fullScreenSettings = () =>
  Linking.sendIntent('android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT').catch(() => Linking.openSettings());

/** Sprawdza uprawnienia potrzebne, żeby alarm na pewno zadzwonił; odświeża się po powrocie z ustawień systemu. */
export default function PermissionsCheck() {
  const { alarms } = useAlarms();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [camera, requestCamera] = useCameraPermissions();

  const enabled = alarms.filter(a => a.enabled);
  const usesKind = (kind: string) => enabled.some(a => normalizeChallenge(a.challenge).types.includes(kind as never));
  const needSteps = usesKind('steps');
  const needQr = usesKind('qr');

  const run = useCallback(async () => {
    const out: Check[] = [];
    try {
      const settings = await notifee.getNotificationSettings();
      const notifOk = settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
      out.push({
        id: 'notif',
        title: 'Powiadomienia',
        hint: notifOk ? 'Aplikacja może pokazywać alarmy' : 'Bez tego alarm się nie pokaże ani nie zadzwoni',
        status: notifOk ? 'ok' : 'bad',
        action: notifOk
          ? undefined
          : {
              label: 'Zezwól',
              run: async () => {
                const r = await notifee.requestPermission();
                if (r.authorizationStatus < AuthorizationStatus.AUTHORIZED) await notifee.openNotificationSettings();
              },
            },
      });

      const alarmSetting = settings.android?.alarm ?? AndroidNotificationSetting.NOT_SUPPORTED;
      if (alarmSetting !== AndroidNotificationSetting.NOT_SUPPORTED) {
        const exactOk = alarmSetting === AndroidNotificationSetting.ENABLED;
        out.push({
          id: 'exact',
          title: 'Alarmy i przypomnienia',
          hint: exactOk ? 'Alarm zadzwoni co do minuty' : 'Bez tego Android może opóźnić alarm',
          status: exactOk ? 'ok' : 'bad',
          action: exactOk ? undefined : { label: 'Włącz', run: () => notifee.openAlarmPermissionSettings() },
        });
      }

      if (notifOk && (await notifee.isChannelCreated(ALARM_CHANNEL))) {
        const blocked = await notifee.isChannelBlocked(ALARM_CHANNEL);
        out.push({
          id: 'channel',
          title: 'Kanał „Budzik”',
          hint: blocked ? 'Powiadomienia budzika są wyciszone w systemie' : 'Powiadomienia budzika są włączone',
          status: blocked ? 'bad' : 'ok',
          action: blocked ? { label: 'Włącz', run: () => notifee.openNotificationSettings(ALARM_CHANNEL) } : undefined,
        });
      }

      out.push({
        id: 'sound',
        title: 'Dźwięk alarmu',
        hint: isAlarmChannelAvailable
          ? 'Dźwięk gra na strumieniu alarmu (także w trybie cichym)'
          : 'Moduł dźwięku nie jest wbudowany — przebuduj aplikację',
        status: isAlarmChannelAvailable ? 'ok' : 'warn',
      });

      const optimized = await notifee.isBatteryOptimizationEnabled();
      out.push({
        id: 'battery',
        title: 'Optymalizacja baterii',
        hint: optimized ? 'Zalecane „Bez ograniczeń” — system może usypiać aplikację' : 'Bez ograniczeń',
        status: optimized ? 'warn' : 'ok',
        action: optimized ? { label: 'Zmień', run: () => notifee.openBatteryOptimizationSettings() } : undefined,
      });

      const power = await notifee.getPowerManagerInfo();
      if (power.activity) {
        out.push({
          id: 'power',
          title: `Oszczędzanie energii (${power.manufacturer ?? 'producent'})`,
          hint: 'Ten telefon ma własny menedżer energii — zezwól aplikacji działać w tle',
          status: 'info',
          action: { label: 'Otwórz', run: () => notifee.openPowerManagerSettings() },
        });
      }

      if (Platform.OS === 'android' && Number(Platform.Version) >= 34) {
        out.push({
          id: 'fullscreen',
          title: 'Alarm na pełnym ekranie',
          hint: 'Android 14+: sprawdź, czy aplikacja może pokazywać alarm na zablokowanym ekranie',
          status: 'info',
          action: { label: 'Otwórz', run: fullScreenSettings },
        });
      }

      if (needSteps) {
        const perm = await Pedometer.getPermissionsAsync();
        out.push({
          id: 'steps',
          title: 'Aktywność fizyczna',
          hint: perm.granted ? 'Zadanie „kroki” może liczyć kroki' : 'Potrzebne do zadania „kroki” w Twoim alarmie',
          status: perm.granted ? 'ok' : 'bad',
          action: perm.granted
            ? undefined
            : {
                label: 'Zezwól',
                run: async () => {
                  const r = await Pedometer.requestPermissionsAsync();
                  if (!r.granted && !r.canAskAgain) await Linking.openSettings();
                },
              },
        });
      }
    } catch (e) {
      console.warn('Nie udało się sprawdzić uprawnień', e);
    }
    setChecks(out);
  }, [needSteps]);

  useEffect(() => {
    run();
    const sub = AppState.addEventListener('change', s => s === 'active' && run());
    return () => sub.remove();
  }, [run]);

  const all = [...(checks ?? [])];
  if (needQr && camera) {
    all.push({
      id: 'camera',
      title: 'Aparat',
      hint: camera.granted ? 'Zadanie „kod QR” może skanować' : 'Potrzebny do zadania „kod QR” w Twoim alarmie',
      status: camera.granted ? 'ok' : 'bad',
      action: camera.granted
        ? undefined
        : { label: 'Zezwól', run: () => (camera.canAskAgain ? requestCamera() : Linking.openSettings()) },
    });
  }

  if (checks === null) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={INK} />
      </View>
    );
  }

  const problems = all.filter(c => c.status === 'bad').length;
  return (
    <View>
      <View style={[s.summary, problems > 0 && s.summaryBad]}>
        <Text style={[s.summaryText, problems > 0 && s.summaryTextBad]}>
          {problems === 0 ? '✓ Alarm ma wszystko, czego potrzebuje' : `! ${problems} ${problems === 1 ? 'problem' : 'problemy'} — alarm może nie zadzwonić`}
        </Text>
      </View>
      {all.map(c => (
        <View key={c.id} style={s.row}>
          <View style={[s.badge, s[c.status]]}>
            <Text style={[s.badgeText, c.status === 'warn' && { color: INK }]}>
              {c.status === 'ok' ? '✓' : c.status === 'bad' ? '!' : c.status === 'warn' ? '!' : 'i'}
            </Text>
          </View>
          <View style={s.texts}>
            <Text style={s.title}>{c.title}</Text>
            <Text style={s.hint}>{c.hint}</Text>
          </View>
          {c.action && (
            <TouchableOpacity
              style={[s.action, c.status === 'bad' && s.actionBad]}
              onPress={async () => {
                try {
                  await c.action!.run();
                } catch {
                  Linking.openSettings();
                }
                run();
              }}
            >
              <Text style={[s.actionText, c.status === 'bad' && { color: WHITE }]}>{c.action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={s.recheck} onPress={run}>
        <Text style={s.recheckText}>Sprawdź ponownie</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { padding: 20, alignItems: 'center' },
  summary: { backgroundColor: YELLOW, borderWidth: LINE, borderColor: INK, padding: 12, marginBottom: -LINE },
  summaryBad: { backgroundColor: DANGER },
  summaryText: { fontSize: 15, fontWeight: '900', color: INK },
  summaryTextBad: { color: WHITE },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: LINE,
    borderColor: INK,
    backgroundColor: WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: -LINE,
  },
  badge: { width: 26, height: 26, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  ok: { backgroundColor: OK },
  bad: { backgroundColor: DANGER },
  warn: { backgroundColor: YELLOW, borderWidth: LINE, borderColor: INK },
  info: { backgroundColor: MUTED },
  badgeText: { color: WHITE, fontSize: 15, fontWeight: '900' },
  texts: { flex: 1, marginRight: 8 },
  title: { fontSize: 15, fontWeight: '800', color: INK },
  hint: { fontSize: 12, color: '#55554F', marginTop: 1 },
  action: { borderWidth: LINE, borderColor: INK, paddingHorizontal: 10, paddingVertical: 8 },
  actionBad: { backgroundColor: DANGER, borderColor: DANGER },
  actionText: { fontSize: 13, fontWeight: '900', color: INK },
  recheck: { marginTop: 10 + LINE, borderWidth: LINE, borderColor: INK, paddingVertical: 10, alignItems: 'center' },
  recheckText: { fontSize: 14, fontWeight: '800', color: INK },
});
