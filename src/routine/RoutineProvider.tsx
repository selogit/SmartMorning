import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Routine } from './types';
import { emptyRoutine, loadPlans, planForDate, savePlans } from './storage';

type Update = Routine | ((prev: Routine) => Routine);

interface RoutineContextValue {
  plans: Routine[];
  loaded: boolean;
  /** Plan obowiązujący dziś (wg dni tygodnia). */
  todayPlan: Routine;
  updatePlan: (id: string, update: Update) => void;
  /** Zmiana stosowana do wszystkich planów (np. synchronizacja kafelków Budzik). */
  updateAllPlans: (fn: (plan: Routine) => Routine) => void;
  addPlan: (name: string) => Routine;
  removePlan: (id: string) => void;
  /** Przypisuje dni planowi i zabiera je pozostałym (dzień należy do jednego planu). */
  setPlanDays: (id: string, days: number[]) => void;
}

const RoutineContext = createContext<RoutineContextValue | null>(null);

export function useRoutine() {
  const ctx = useContext(RoutineContext);
  if (!ctx) throw new Error('useRoutine musi być użyte wewnątrz <RoutineProvider>');
  return ctx;
}

const PLACEHOLDER: Routine = { id: 'loading', name: 'Plan dnia', days: [], tiles: [], links: [], startAfterAlarm: true };

export function RoutineProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<Routine[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [day, setDay] = useState(() => new Date().getDay());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPlans().then(p => {
      setPlans(p);
      setLoaded(true);
    });
    // Po północy „plan na dziś” się zmienia.
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') setDay(new Date().getDay());
    });
    const t = setInterval(() => setDay(new Date().getDay()), 60000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, []);

  // Zapis z opóźnieniem — przeciąganie zmienia stan wiele razy na sekundę.
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      savePlans(plans).catch(e => console.warn('Nie udało się zapisać planów', e));
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [plans, loaded]);

  const updatePlan = (id: string, update: Update) =>
    setPlans(prev => prev.map(p => (p.id === id ? (typeof update === 'function' ? update(p) : update) : p)));

  const updateAllPlans = (fn: (plan: Routine) => Routine) =>
    setPlans(prev => {
      let changed = false;
      const next = prev.map(p => {
        const n = fn(p);
        if (n !== p) changed = true;
        return n;
      });
      return changed ? next : prev;
    });

  const addPlan = (name: string) => {
    const plan = emptyRoutine(name);
    setPlans(prev => [...prev, plan]);
    return plan;
  };

  const removePlan = (id: string) => setPlans(prev => (prev.length <= 1 ? prev : prev.filter(p => p.id !== id)));

  const setPlanDays = (id: string, days: number[]) =>
    setPlans(prev =>
      prev.map(p =>
        p.id === id ? { ...p, days: [...days].sort() } : { ...p, days: p.days.filter(d => !days.includes(d)) }
      )
    );

  const todayPlan = planForDate(plans) ?? PLACEHOLDER;
  void day; // wymusza przeliczenie todayPlan po zmianie dnia

  return (
    <RoutineContext.Provider
      value={{ plans, loaded, todayPlan, updatePlan, updateAllPlans, addPlan, removePlan, setPlanDays }}
    >
      {children}
    </RoutineContext.Provider>
  );
}
