import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACCENTS, YELLOW, setAccentValue } from './theme';

/**
 * Zmiana koloru akcentu bez przepisywania wszystkich ekranów:
 * StyleSheet.create zwraca zwykłe obiekty, więc zapamiętujemy je (bez zamrażania)
 * i przy zmianie podmieniamy w nich stary kolor na nowy. Ten moduł musi być
 * zaimportowany jako pierwszy (index.ts), zanim powstaną style ekranów.
 */
type Sheet = Record<string, Record<string, unknown>>;
const sheets: Sheet[] = [];
const sheetApi = StyleSheet as unknown as { create: (obj: Sheet) => Sheet };
sheetApi.create = (obj: Sheet) => {
  sheets.push(obj);
  return obj;
};

const KEY = 'accent';
let current = YELLOW;

/** Podmienia kolor akcentu w zapamiętanych stylach i w `YELLOW`. */
export function applyAccent(color: string) {
  const from = current.toUpperCase();
  if (from === color.toUpperCase()) return;
  // Style przekazane do widoków RN w trybie DEV zamraża, więc nie zmieniamy ich w miejscu:
  // w arkuszu podmieniamy cały styl na kopię z nowym kolorem (ekrany czytają `s.nazwa` przy rysowaniu).
  for (const sheet of sheets) {
    if (Object.isFrozen(sheet)) continue;
    for (const [name, style] of Object.entries(sheet)) {
      if (!style || typeof style !== 'object' || Array.isArray(style)) continue;
      let copy: Record<string, unknown> | null = null;
      for (const [k, v] of Object.entries(style)) {
        if (typeof v === 'string' && v.toUpperCase() === from) {
          copy = copy ?? { ...style };
          copy[k] = color;
        }
      }
      if (copy) sheet[name] = copy;
    }
  }
  current = color;
  setAccentValue(color);
}

interface ThemeValue {
  accent: string;
  setAccent: (color: string) => void;
}

const ThemeContext = createContext<ThemeValue>({ accent: YELLOW, setAccent: () => {} });
export const useTheme = () => useContext(ThemeContext);

/** Wczytuje zapisany kolor przed pierwszym rysowaniem. Ekrany widoczne przy zmianie robią remount przez `key={accent}`. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(saved => {
        if (saved && ACCENTS.some(a => a.color === saved)) applyAccent(saved);
      })
      .catch(() => {})
      .finally(() => setAccentState(current));
  }, []);

  const setAccent = (color: string) => {
    applyAccent(color);
    setAccentState(color);
    AsyncStorage.setItem(KEY, color).catch(() => {});
  };

  if (accent === null) return null;
  return <ThemeContext.Provider value={{ accent, setAccent }}>{children}</ThemeContext.Provider>;
}
