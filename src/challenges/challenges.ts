export type ChallengeKind = 'math' | 'phrase' | 'shake' | 'steps';
export type Difficulty = 'easy' | 'medium' | 'hard';

export const CHALLENGE_KINDS: ChallengeKind[] = ['math', 'phrase', 'shake', 'steps'];

export interface ChallengeConfig {
  /** Zadania w kolejności wykonywania; pusta lista = brak zadań. */
  types: ChallengeKind[];
  mathDifficulty: Difficulty;
  mathCount: number;
  phrase: string;
  shakeCount: number;
  stepCount: number;
}

export const DEFAULT_PHRASE = 'Wstaję i zaczynam dzień z energią';

export const DEFAULT_CHALLENGE: ChallengeConfig = {
  types: [],
  mathDifficulty: 'medium',
  mathCount: 3,
  phrase: DEFAULT_PHRASE,
  shakeCount: 30,
  stepCount: 20,
};

export const MATH_COUNTS = [1, 3, 5];
export const SHAKE_COUNTS = [15, 30, 60];
export const STEP_COUNTS = [10, 20, 50];

export const CHALLENGE_OPTIONS: { type: ChallengeKind; title: string; hint: string }[] = [
  { type: 'math', title: 'Matematyka', hint: 'Rozwiąż działania' },
  { type: 'phrase', title: 'Fraza', hint: 'Przepisz zdanie bezbłędnie' },
  { type: 'shake', title: 'Potrząśnięcie', hint: 'Potrząśnij telefonem' },
  { type: 'steps', title: 'Kroki', hint: 'Przejdź kilka kroków' },
];

export const CHALLENGE_TITLES: Record<ChallengeKind, string> = {
  math: 'Matematyka',
  phrase: 'Fraza',
  shake: 'Potrząśnięcie',
  steps: 'Kroki',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Łatwy',
  medium: 'Średni',
  hard: 'Trudny',
};

export const DIFFICULTY_EXAMPLES: Record<Difficulty, string> = {
  easy: 'np. 27 + 38',
  medium: 'np. 7 × 13 + 42',
  hard: 'np. 23 × 17 − 186',
};

type StoredChallenge = Partial<ChallengeConfig> & { type?: string };

const isKind = (t: unknown): t is ChallengeKind =>
  typeof t === 'string' && (CHALLENGE_KINDS as string[]).includes(t);

/**
 * Uzupełnia brakujące pola i migruje stary zapis z jednym zadaniem (`type`)
 * do listy `types`. Alarmy sprzed dodania zadań dostają pustą listę.
 */
export const normalizeChallenge = (c?: StoredChallenge | null): ChallengeConfig => {
  const { type, ...rest } = c ?? {};
  const raw: unknown[] = Array.isArray(rest.types) ? rest.types : type ? [type] : [];
  const types = raw.filter(isKind).filter((t, i, arr) => arr.indexOf(t) === i);
  return { ...DEFAULT_CHALLENGE, ...rest, types };
};

const describeOne = (kind: ChallengeKind, ch: ChallengeConfig) => {
  switch (kind) {
    case 'math':
      return `Matematyka · ${DIFFICULTY_LABELS[ch.mathDifficulty]} · ${ch.mathCount}×`;
    case 'phrase':
      return 'Fraza do przepisania';
    case 'shake':
      return `Potrząśnięcie · ${ch.shakeCount}×`;
    case 'steps':
      return `Kroki · ${ch.stepCount}`;
  }
};

export const describeChallenge = (c?: StoredChallenge | null): string | null => {
  const ch = normalizeChallenge(c);
  if (ch.types.length === 0) return null;
  if (ch.types.length === 1) return describeOne(ch.types[0], ch);
  return ch.types.map(t => CHALLENGE_TITLES[t]).join(' → ');
};

export interface MathProblem {
  text: string;
  answer: number;
}

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export function generateMathProblem(difficulty: Difficulty): MathProblem {
  if (difficulty === 'easy') {
    if (Math.random() < 0.5) {
      const a = rand(11, 59);
      const b = rand(11, 49);
      return { text: `${a} + ${b}`, answer: a + b };
    }
    const a = rand(30, 99);
    const b = rand(11, a - 5);
    return { text: `${a} − ${b}`, answer: a - b };
  }

  if (difficulty === 'medium') {
    const a = rand(3, 12);
    const b = rand(6, 19);
    const c = rand(11, 69);
    return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
  }

  const a = rand(12, 29);
  const b = rand(7, 19);
  const c = rand(101, 399);
  const product = a * b;
  if (product - c > 0 && Math.random() < 0.5) {
    return { text: `${a} × ${b} − ${c}`, answer: product - c };
  }
  return { text: `${a} × ${b} + ${c}`, answer: product + c };
}

const normalizePhrase = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/** Porównanie bez względu na wielkość liter i nadmiarowe spacje (polskie znaki są wymagane). */
export const phrasesMatch = (input: string, target: string) =>
  normalizePhrase(input) === normalizePhrase(target);

/** Ile pierwszych znaków wpisanego tekstu zgadza się z frazą (bez względu na wielkość liter). */
export function matchedPrefixLength(input: string, target: string) {
  const a = input.toLowerCase();
  const b = target.toLowerCase();
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
