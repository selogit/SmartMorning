export const INK = '#111111';
/** Kolor akcentu — zmieniany w Ustawieniach (patrz `themeRuntime.tsx`), dlatego `let`. */
export let YELLOW = '#FFD500';
export const PAPER = '#E4E4E0';
export const WHITE = '#FFFFFF';
export const MUTED = '#8A8A84';
export const DANGER = '#C62828';
export const LINE = 2;

export interface AccentPreset {
  id: string;
  name: string;
  color: string;
}

/** Jasne kolory — czytelne z czarnym tekstem i na czarnym tle. */
export const ACCENTS: AccentPreset[] = [
  { id: 'yellow', name: 'Żółty', color: '#FFD500' },
  { id: 'orange', name: 'Pomarańcz', color: '#FF9F1C' },
  { id: 'coral', name: 'Koral', color: '#FF7A66' },
  { id: 'pink', name: 'Róż', color: '#FF8CC6' },
  { id: 'lavender', name: 'Lawenda', color: '#B9A2FF' },
  { id: 'sky', name: 'Błękit', color: '#5BC8FA' },
  { id: 'mint', name: 'Mięta', color: '#3EE0A0' },
  { id: 'lime', name: 'Limonka', color: '#C6F432' },
];

/** Tylko dla `themeRuntime` — reszta aplikacji czyta `YELLOW`. */
export function setAccentValue(color: string) {
  YELLOW = color;
}
