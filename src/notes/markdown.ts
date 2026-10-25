/**
 * Minimalny Markdown notatek:
 *   # Nagłówek, ## Podtytuł, - punkt, 1. numer, - [ ] / - [x] zadanie, > cytat
 *   **pogrubienie**, *kursywa*, __podkreślenie__, ~~przekreślenie~~
 */

export type LineKind = 'h1' | 'h2' | 'bullet' | 'number' | 'check' | 'quote' | 'text';

export interface LineInfo {
  kind: LineKind;
  indent: string;
  prefix: string;
  content: string;
  checked?: boolean;
  number?: number;
}

const LINE_RE = /^(\s*)(## |# |[-*] \[( |x|X)\] |[-*] |(\d+)\. |> )?(.*)$/;

export function parseLine(line: string): LineInfo {
  const m = LINE_RE.exec(line);
  if (!m) return { kind: 'text', indent: '', prefix: '', content: line };
  const indent = m[1] ?? '';
  const prefix = m[2] ?? '';
  const content = m[5] ?? '';
  if (!prefix) return { kind: 'text', indent, prefix, content };
  if (prefix === '# ') return { kind: 'h1', indent, prefix, content };
  if (prefix === '## ') return { kind: 'h2', indent, prefix, content };
  if (prefix === '> ') return { kind: 'quote', indent, prefix, content };
  if (m[3] !== undefined) return { kind: 'check', indent, prefix, content, checked: m[3].toLowerCase() === 'x' };
  if (m[4] !== undefined) return { kind: 'number', indent, prefix, content, number: Number(m[4]) };
  return { kind: 'bullet', indent, prefix, content };
}

/* ───────────── Formatowanie w linii ───────────── */

export interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

type Style = Omit<Span, 'text'>;
export type InlineMarker = '**' | '*' | '__' | '~~';

const MARKERS: [InlineMarker, keyof Style][] = [
  ['**', 'bold'],
  ['__', 'underline'],
  ['~~', 'strike'],
  ['*', 'italic'],
];

/** Szuka zamknięcia znacznika; przy serii (np. "***") bierze jej koniec, żeby ***x*** = pogrubiona kursywa. */
function findClose(text: string, mk: string, from: number) {
  let p = text.indexOf(mk, from);
  while (p !== -1 && text[p + mk.length] === mk[0]) p = text.indexOf(mk, p + 1);
  return p;
}

export function parseInline(text: string, style: Style = {}): Span[] {
  const out: Span[] = [];
  let buf = '';
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const [mk, key] of MARKERS) {
      if (!text.startsWith(mk, i)) continue;
      const close = findClose(text, mk, i + mk.length);
      if (close > i + mk.length) {
        if (buf) {
          out.push({ text: buf, ...style });
          buf = '';
        }
        out.push(...parseInline(text.slice(i + mk.length, close), { ...style, [key]: true }));
        i = close + mk.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      buf += text[i];
      i++;
    }
  }
  if (buf) out.push({ text: buf, ...style });
  return out;
}

export const plainText = (text: string) =>
  parseInline(parseLine(text).content)
    .map(s => s.text)
    .join('');

/* ───────────── Edycja z paska narzędzi ───────────── */

export interface Selection {
  start: number;
  end: number;
}

export interface EditResult {
  text: string;
  selection: Selection;
}

const runLength = (text: string, idx: number, dir: 1 | -1, ch: string) => {
  let n = 0;
  let i = dir === 1 ? idx : idx - 1;
  while (i >= 0 && i < text.length && text[i] === ch) {
    n++;
    i += dir;
  }
  return n;
};

/** Czy tuż przed/za zaznaczeniem stoi dokładnie ten znacznik (a nie np. ** przy kursywie). */
function wrappedBy(text: string, sel: Selection, mk: InlineMarker) {
  if (mk === '*') {
    const before = runLength(text, sel.start, -1, '*');
    const after = runLength(text, sel.end, 1, '*');
    return (before === 1 || before === 3) && (after === 1 || after === 3);
  }
  return text.slice(sel.start - mk.length, sel.start) === mk && text.slice(sel.end, sel.end + mk.length) === mk;
}

export function toggleInline(text: string, sel: Selection, mk: InlineMarker): EditResult {
  const { start, end } = sel;
  const L = mk.length;
  const selected = text.slice(start, end);

  // Zdejmij znaczniki otaczające zaznaczenie.
  if (start !== end && wrappedBy(text, sel, mk)) {
    return {
      text: text.slice(0, start - L) + selected + text.slice(end + L),
      selection: { start: start - L, end: end - L },
    };
  }
  // Zaznaczenie zawiera znaczniki (np. zaznaczono całe "**słowo**").
  if (selected.length > 2 * L && selected.startsWith(mk) && selected.endsWith(mk)) {
    const inner = selected.slice(L, -L);
    return { text: text.slice(0, start) + inner + text.slice(end), selection: { start, end: start + inner.length } };
  }
  // Pusty kursor — wstaw parę i ustaw kursor w środku.
  if (start === end) {
    return { text: text.slice(0, start) + mk + mk + text.slice(end), selection: { start: start + L, end: start + L } };
  }
  return {
    text: text.slice(0, start) + mk + selected + mk + text.slice(end),
    selection: { start: start + L, end: end + L },
  };
}

export type BlockKind = Exclude<LineKind, 'text'>;

const prefixFor = (kind: BlockKind, n: number) =>
  kind === 'h1'
    ? '# '
    : kind === 'h2'
      ? '## '
      : kind === 'bullet'
        ? '- '
        : kind === 'number'
          ? `${n}. `
          : kind === 'check'
            ? '- [ ] '
            : '> ';

const lineBounds = (text: string, sel: Selection) => {
  const start = text.lastIndexOf('\n', sel.start - 1) + 1;
  let end = text.indexOf('\n', sel.end);
  if (end === -1) end = text.length;
  return { start, end };
};

/** Rodzaj linii, w której stoi kursor — do podświetlenia przycisków. */
export function currentLineKind(text: string, sel: Selection): LineKind {
  const { start } = lineBounds(text, { start: sel.start, end: sel.start });
  let end = text.indexOf('\n', start);
  if (end === -1) end = text.length;
  return parseLine(text.slice(start, end)).kind;
}

/** Włącza/wyłącza nagłówek, listę lub cytat dla wszystkich linii w zaznaczeniu. */
export function toggleLinePrefix(text: string, sel: Selection, kind: BlockKind): EditResult {
  const { start, end } = lineBounds(text, sel);
  const lines = text.slice(start, end).split('\n');
  const infos = lines.map(parseLine);
  const allHave = infos.every(i => i.kind === kind);
  let n = 1;
  const next = infos.map(i => (allHave ? i.indent + i.content : i.indent + prefixFor(kind, n++) + i.content));
  const block = next.join('\n');
  const newText = text.slice(0, start) + block + text.slice(end);

  if (lines.length === 1) {
    const delta = next[0].length - lines[0].length;
    const clampPos = (p: number) => Math.max(start, Math.min(start + block.length, p + delta));
    return { text: newText, selection: { start: clampPos(sel.start), end: clampPos(sel.end) } };
  }
  return { text: newText, selection: { start, end: start + block.length } };
}

/**
 * Wywoływane po każdej zmianie tekstu. Jeśli użytkownik wcisnął Enter w linii listy:
 * kontynuuje listę (kolejny numer, nowy punkt), a na pustym punkcie kończy listę.
 */
export function continueList(prev: string, next: string, prevSel: Selection): EditResult | null {
  const { start, end } = prevSel;
  if (next !== prev.slice(0, start) + '\n' + prev.slice(end)) return null;

  const lineStart = prev.lastIndexOf('\n', start - 1) + 1;
  const line = prev.slice(lineStart, start);
  const info = parseLine(line);
  if (info.kind === 'text' || info.kind === 'h1' || info.kind === 'h2') return null;

  if (info.content.trim() === '') {
    // Enter na pustym punkcie = koniec listy (usuń znacznik, nie dodawaj nowej linii).
    const text = prev.slice(0, lineStart) + prev.slice(end);
    return { text, selection: { start: lineStart, end: lineStart } };
  }

  const prefix =
    info.kind === 'number' ? `${(info.number ?? 0) + 1}. ` : info.kind === 'check' ? '- [ ] ' : info.prefix;
  const insert = '\n' + info.indent + prefix;
  const text = prev.slice(0, start) + insert + prev.slice(end);
  const caret = start + insert.length;
  return { text, selection: { start: caret, end: caret } };
}

/** Odhacza/odznacza zadanie w podanej linii (używane w podglądzie). */
export function toggleCheckAt(text: string, lineIndex: number): string {
  const lines = text.split('\n');
  const info = parseLine(lines[lineIndex] ?? '');
  if (info.kind !== 'check') return text;
  lines[lineIndex] = info.indent + (info.checked ? '- [ ] ' : '- [x] ') + info.content;
  return lines.join('\n');
}
