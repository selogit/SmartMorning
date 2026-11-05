import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { INK, YELLOW, WHITE, LINE } from '../theme';

/** QR i najpopularniejsze kody kreskowe — można użyć np. kodu z opakowania pasty do zębów. */
export const CODE_TYPES = ['qr', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'datamatrix'] as const;

interface Props {
  onScanned: (data: string) => void;
  /** Tekst nad ramką. */
  hint?: string;
  /** Wywoływane, gdy nie ma zgody na aparat i nie da się o nią zapytać. */
  onPermissionDenied?: () => void;
  /** false = aparat działa, ale nie zgłasza kodów (np. po udanym skanie). */
  active?: boolean;
}

/** Podgląd z aparatu z ramką celownika; zgłasza zeskanowany kod (z ochroną przed wielokrotnym zgłoszeniem). */
export default function QrScanner({ onScanned, hint, onPermissionDenied, active = true }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef<{ data: string; at: number } | null>(null);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) requestPermission();
    else if (!permission.granted && !permission.canAskAgain) onPermissionDenied?.();
  }, [permission?.granted, permission?.canAskAgain]);

  if (!permission) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={YELLOW} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.msg}>Potrzebny jest dostęp do aparatu, żeby zeskanować kod.</Text>
        <TouchableOpacity
          style={s.button}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        >
          <Text style={s.buttonText}>{permission.canAskAgain ? 'Zezwól na aparat' : 'Otwórz ustawienia'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handle = ({ data }: { data: string }) => {
    const now = Date.now();
    if (last.current && last.current.data === data && now - last.current.at < 1500) return;
    last.current = { data, at: now };
    onScanned(data);
  };

  return (
    <View style={s.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...CODE_TYPES] }}
        onBarcodeScanned={active ? handle : undefined}
      />
      <View style={s.overlay} pointerEvents="none">
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
        <View style={s.frame} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 230, height: 230, borderWidth: 4, borderColor: YELLOW },
  hint: {
    color: INK,
    backgroundColor: YELLOW,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    overflow: 'hidden',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: INK },
  msg: { color: WHITE, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  button: { backgroundColor: YELLOW, borderWidth: LINE, borderColor: YELLOW, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: INK, fontSize: 15, fontWeight: '900' },
});
