import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface AlarmChannelNative {
  createAlarmChannel(id: string, name: string, soundName: string): boolean;
  createSilentChannel(id: string, name: string): boolean;
  startAlarmSound(soundName: string): boolean;
  stopAlarmSound(): boolean;
  isAlarmSoundPlaying(): boolean;
  deleteChannel(id: string): boolean;
}

const native = Platform.OS === 'android' ? requireOptionalNativeModule<AlarmChannelNative>('AlarmChannel') : null;

/** Czy moduł natywny jest dostępny (wymaga przebudowania aplikacji po dodaniu modułu). */
export const isAlarmChannelAvailable = native !== null;

/** Tworzy kanał z dźwiękiem na strumieniu alarmu. Zwraca false, gdy moduł niedostępny. */
export function createAlarmChannel(id: string, name: string, soundName: string): boolean {
  if (!native) return false;
  try {
    return native.createAlarmChannel(id, name, soundName);
  } catch (e) {
    console.warn('Nie udało się utworzyć kanału alarmu', e);
    return false;
  }
}

export function deleteChannel(id: string): boolean {
  if (!native) return false;
  try {
    return native.deleteChannel(id);
  } catch {
    return false;
  }
}

/** Kanał bez dźwięku — na niego przenosimy powiadomienie, gdy dźwięk gra w aplikacji. */
export function createSilentChannel(id: string, name: string): boolean {
  if (!native) return false;
  try {
    return native.createSilentChannel(id, name);
  } catch {
    return false;
  }
}

/**
 * Odtwarza dźwięk alarmu w pętli (strumień alarmu + wibracja), niezależnie od powiadomienia.
 * Zwraca false, gdy moduł niedostępny albo odtwarzanie się nie udało.
 */
export function startAlarmSound(soundName: string): boolean {
  if (!native) return false;
  try {
    return native.startAlarmSound(soundName);
  } catch (e) {
    console.warn('Nie udało się odtworzyć dźwięku alarmu', e);
    return false;
  }
}

export function stopAlarmSound(): void {
  if (!native) return;
  try {
    native.stopAlarmSound();
  } catch {
    // nic — dźwięk i tak nie gra
  }
}
