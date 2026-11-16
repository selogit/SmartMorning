/** Testy jednostkowe: src/notes/markdown.ts */
import {
  parseLine,
  parseInline,
  plainText,
  toggleInline,
  toggleLinePrefix,
  continueList,
  toggleCheckAt,
  currentLineKind,
} from '../../src/notes/markdown';

describe('parseLine', () => {
  it.each([
    ['# Tytuł', 'h1', 'Tytuł'],
    ['## Podtytuł', 'h2', 'Podtytuł'],
    ['- punkt', 'bullet', 'punkt'],
    ['* punkt', 'bullet', 'punkt'],
    ['3. numer', 'number', 'numer'],
    ['> cytat', 'quote', 'cytat'],
    ['zwykły tekst', 'text', 'zwykły tekst'],
  ])('%s → %s', (line, kind, content) => {
    const info = parseLine(line as string);
    expect(info.kind).toBe(kind);
    expect(info.content).toBe(content);
  });

  it('checkbox: odznaczony i zaznaczony (x/X)', () => {
    expect(parseLine('- [ ] zadanie')).toMatchObject({ kind: 'check', checked: false });
    expect(parseLine('- [x] zadanie')).toMatchObject({ kind: 'check', checked: true });
    expect(parseLine('- [X] zadanie')).toMatchObject({ kind: 'check', checked: true });
  });

  it('zachowuje wcięcie', () => {
    expect(parseLine('  - punkt').indent).toBe('  ');
  });

  it('numer listy jest odczytywany', () => {
    expect(parseLine('12. coś').number).toBe(12);
  });
});

describe('parseInline', () => {
  it('pogrubienie, kursywa, podkreślenie, przekreślenie', () => {
    expect(parseInline('**b**')).toEqual([{ text: 'b', bold: true }]);
    expect(parseInline('*i*')).toEqual([{ text: 'i', italic: true }]);
    expect(parseInline('__u__')).toEqual([{ text: 'u', underline: true }]);
    expect(parseInline('~~s~~')).toEqual([{ text: 's', strike: true }]);
  });

  it('style zagnieżdżone: ***x*** = pogrubiona kursywa', () => {
    const spans = parseInline('***x***');
    expect(spans).toEqual([{ text: 'x', bold: true, italic: true }]);
  });

  it('tekst mieszany dzieli się na fragmenty', () => {
    expect(parseInline('a **b** c')).toEqual([{ text: 'a ' }, { text: 'b', bold: true }, { text: ' c' }]);
  });

  it('niedomknięty znacznik zostaje zwykłym tekstem', () => {
    expect(parseInline('**otwarte')).toEqual([{ text: '**otwarte' }]);
  });

  it('plainText usuwa znaczniki i prefiks linii', () => {
    expect(plainText('- [ ] **Ważne** zadanie')).toBe('Ważne zadanie');
  });
});

describe('toggleInline', () => {
  it('owija zaznaczenie znacznikiem', () => {
    const r = toggleInline('abc', { start: 0, end: 3 }, '**');
    expect(r.text).toBe('**abc**');
    expect(r.selection).toEqual({ start: 2, end: 5 });
  });

  it('zdejmuje istniejący znacznik wokół zaznaczenia', () => {
    const r = toggleInline('**abc**', { start: 2, end: 5 }, '**');
    expect(r.text).toBe('abc');
  });

  it('zaznaczenie obejmujące znaczniki też je zdejmuje', () => {
    const r = toggleInline('**abc**', { start: 0, end: 7 }, '**');
    expect(r.text).toBe('abc');
  });

  it('pusty kursor wstawia parę znaczników', () => {
    const r = toggleInline('ab', { start: 1, end: 1 }, '*');
    expect(r.text).toBe('a**b');
    expect(r.selection).toEqual({ start: 2, end: 2 });
  });
});

describe('toggleLinePrefix', () => {
  it('dodaje prefiks nagłówka', () => {
    const r = toggleLinePrefix('tekst', { start: 0, end: 0 }, 'h1');
    expect(r.text).toBe('# tekst');
  });

  it('zdejmuje prefiks, gdy wszystkie linie już go mają', () => {
    const r = toggleLinePrefix('# tekst', { start: 3, end: 3 }, 'h1');
    expect(r.text).toBe('tekst');
  });

  it('numeruje kolejne linie zaznaczenia', () => {
    const r = toggleLinePrefix('a\nb\nc', { start: 0, end: 5 }, 'number');
    expect(r.text).toBe('1. a\n2. b\n3. c');
  });

  it('zamienia rodzaj listy (bullet → check)', () => {
    const r = toggleLinePrefix('- a', { start: 0, end: 3 }, 'check');
    expect(r.text).toBe('- [ ] a');
  });
});

describe('continueList', () => {
  it('Enter w punkcie listy dodaje kolejny punkt', () => {
    const prev = '- jeden';
    const next = '- jeden\n';
    const r = continueList(prev, next, { start: 7, end: 7 });
    expect(r?.text).toBe('- jeden\n- ');
  });

  it('Enter w liście numerowanej zwiększa numer', () => {
    const prev = '1. a';
    const r = continueList(prev, '1. a\n', { start: 4, end: 4 });
    expect(r?.text).toBe('1. a\n2. ');
  });

  it('Enter na pustym punkcie kończy listę', () => {
    const prev = '- a\n- ';
    const r = continueList(prev, '- a\n- \n', { start: 6, end: 6 });
    expect(r?.text).toBe('- a\n');
  });

  it('Enter w zwykłym tekście → null (bez ingerencji)', () => {
    expect(continueList('tekst', 'tekst\n', { start: 5, end: 5 })).toBeNull();
  });

  it('zmiana inna niż Enter → null', () => {
    expect(continueList('- a', '- ab', { start: 3, end: 3 })).toBeNull();
  });
});

describe('toggleCheckAt / currentLineKind', () => {
  it('odhacza zadanie we wskazanej linii', () => {
    const text = '# Plan\n- [ ] kawa\n- [x] prysznic';
    expect(toggleCheckAt(text, 1)).toBe('# Plan\n- [x] kawa\n- [x] prysznic');
    expect(toggleCheckAt(text, 2)).toBe('# Plan\n- [ ] kawa\n- [ ] prysznic');
  });

  it('linia niebędąca checkboxem pozostaje bez zmian', () => {
    expect(toggleCheckAt('zwykły tekst', 0)).toBe('zwykły tekst');
  });

  it('currentLineKind wykrywa rodzaj linii pod kursorem', () => {
    const text = '# Tytuł\n- punkt';
    expect(currentLineKind(text, { start: 2, end: 2 })).toBe('h1');
    expect(currentLineKind(text, { start: 10, end: 10 })).toBe('bullet');
  });
});
