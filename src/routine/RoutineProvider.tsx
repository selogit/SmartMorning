import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Routine } from './types';
import { loadRoutine, saveRoutine } from './storage';

interface RoutineContextValue {
  routine: Routine;
  loaded: boolean;
  setRoutine: (update: Routine | ((prev: Routine) => Routine)) => void;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error('useRoutine musi być użyte wewnątrz <RoutineProvider>');
  return ctx;
}

const EMPTY: Routine = { tiles: [], links: [], startAfterAlarm: true };

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [routine, setRoutineState] = useState<Routine>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRoutine().then(r => {
      setRoutineState(r);
      setLoaded(true);
    });
  }, []);

  // Zapis z opóźnieniem — przeciąganie zmienia stan wiele razy na sekundę.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveRoutine(routine).catch(e => console.warn('Nie udało się zapisać planu', e));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [routine, loaded]);

  return (
    <RoutineContext.Provider value={{ routine, loaded, setRoutine: setRoutineState }}>
      {children}
    </RoutineContext.Provider>
  );
}
