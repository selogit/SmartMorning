export type ChallengeKind = 'math' | 'phrase' | 'shake' | 'steps' | 'qr';
export type Difficulty = 'veryEasy' | 'easy' | 'medium' | 'hard' | 'expert';

export const DIFFICULTIES: Difficulty[] = ['veryEasy', 'easy', 'medium', 'hard', 'expert'];

export const CHALLENGE_KINDS: ChallengeKind[] = ['math', 'phrase', 'shake', 'steps', 'qr'];

export interface ChallengeConfig {
  /** Zadania w kolejności wykonywania; pusta lista = brak zadań. */
  types: ChallengeKind[];
  mathDifficulty: Difficulty;
  mathCount: number;
  phrase: string;
  shakeCount: number;
  stepCount: number;
  /** Treść zarejestrowanego kodu (QR lub kreskowego), który wyłącza alarm. */
  qrValue?: string;
  /** Gdzie jest kod, np. „Łazienka” — podpowiedź na ekranie pobudki. */
  qrLabel?: string;
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

const range = (from: number, to: number, step = 1) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);

export const MATH_COUNTS = range(1, 10);
export const SHAKE_COUNTS = range(5, 100, 5);
export const STEP_COUNTS = [...range(5, 100, 5), 120, 150, 200];

export const CHALLENGE_OPTIONS: { type: ChallengeKind; title: string; hint: string }[] = [
  { type: 'math', title: 'Matematyka', hint: 'Rozwiąż działania' },
  { type: 'phrase', title: 'Fraza', hint: 'Przepisz zdanie bezbłędnie' },
  { type: 'shake', title: 'Potrząśnięcie', hint: 'Potrząśnij telefonem' },
  { type: 'steps', title: 'Kroki', hint: 'Przejdź kilka kroków' },
  { type: 'qr', title: 'Kod QR', hint: 'Zeskanuj swój kod, np. w łazience' },
];

export const CHALLENGE_TITLES: Record<ChallengeKind, string> = {
  math: 'Matematyka',
  phrase: 'Fraza',
  shake: 'Potrząśnięcie',
  steps: 'Kroki',
  qr: 'Kod QR',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  veryEasy: 'Bardzo łatwy',
  easy: 'Łatwy',
  medium: 'Średni',
  hard: 'Trudny',
  expert: 'Ekspert',
};

export const DIFFICULTY_EXAMPLES: Record<Difficulty, string> = {
  veryEasy: 'np. 4 + 7',
  easy: 'np. 27 + 38',
  medium: 'np. 7 × 13 + 42',
  hard: 'np. 23 × 17 − 186',
  expert: 'np. 17 × 9 + 14 × 6',
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
  const merged = { ...DEFAULT_CHALLENGE, ...rest, types };
  if (!DIFFICULTIES.includes(merged.mathDifficulty)) merged.mathDifficulty = DEFAULT_CHALLENGE.mathDifficulty;
  return merged;
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
    case 'qr':
      return ch.qrLabel ? `Kod QR · ${ch.qrLabel}` : 'Kod QR';
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
  if (difficulty === 'veryEasy') {
    const a = rand(2, 9);
    const b = rand(2, 9);
    return { text: `${a} + ${b}`, answer: a + b };
  }

  if (difficulty === 'expert') {
    const a = rand(12, 25);
    const b = rand(6, 15);
    const c = rand(11, 19);
    const d = rand(3, 9);
    return { text: `${a} × ${b} + ${c} × ${d}`, answer: a * b + c * d };
  }

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
