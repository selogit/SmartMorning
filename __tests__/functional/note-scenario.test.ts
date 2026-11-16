/** Test funkcjonalny S2: notatka dnia i edycja Markdownu. */
import { openTodayNote } from '../../src/notes/today';
import { Note } from '../../src/notes/NotesProvider';
import { toggleLinePrefix, continueList, toggleCheckAt, parseLine, toggleInline } from '../../src/notes/markdown';
import { pushed, __resetRouter } from '../mocks/expoRouter';

beforeEach(() => __resetRouter());

const makeCreateNote = (notes: Note[]) => {
  return (body = '', dayKey?: string): Note => {
    const note: Note = { id: `n${notes.length + 1}`, body, updatedAt: Date.now(), dayKey } as Note;
    notes.push(note);
    return note;
  };
};

describe('S2. Notatka dnia', () => {
  it('krok 1: pierwsze otwarcie tworzy notatkę z nagłówkiem daty i pustą checklistą', () => {
    const notes: Note[] = [];
    openTodayNote(notes, makeCreateNote(notes));

    expect(notes).toHaveLength(1);
    const note = notes[0];
    // Nagłówek: „# Plan na <dzień> <miesiąc>"
    expect(note.body).toMatch(/^# Plan na \d{1,2} [a-ź]+\n\n- \[ \] $/);
    // Nawigacja do edycji nowej notatki
    expect(pushed).toEqual([`/notes/${note.id}?edit=1`]);
  });

  it('krok 2: ponowne otwarcie tego samego dnia trafia do istniejącej notatki', () => {
    const notes: Note[] = [];
    const create = makeCreateNote(notes);
    openTodayNote(notes, create);
    __resetRouter();

    openTodayNote(notes, create);
    expect(notes).toHaveLength(1); // nie powstała druga
    expect(pushed).toEqual([`/notes/${notes[0].id}`]); // podgląd, bez ?edit=1
  });

  it('krok 3: użytkownik dopisuje zadania — Enter kontynuuje checklistę', () => {
    // GIVEN: notatka z jednym pustym zadaniem, kursor na końcu
    let text = '# Plan na 10 listopada\n\n- [ ] kupić mleko';
    const caret = text.length;

    // WHEN: Enter na końcu linii zadania
    const afterEnter = text.slice(0, caret) + '\n' + text.slice(caret);
    const r1 = continueList(text, afterEnter, { start: caret, end: caret })!;

    // THEN: nowa linia to kolejne puste zadanie
    expect(r1.text.endsWith('- [ ] kupić mleko\n- [ ] ')).toBe(true);

    // WHEN: użytkownik pisze treść i robi Enter na pustym zadaniu
    const r2 = continueList(r1.text, r1.text.slice(0, r1.selection.start) + '\n' + r1.text.slice(r1.selection.start), {
      start: r1.selection.start,
      end: r1.selection.start,
    })!;
    // THEN: pusta pozycja kończy listę (znacznik znika)
    expect(r2.text.endsWith('- [ ] kupić mleko\n')).toBe(true);
  });

  it('krok 4: pasek narzędzi — zamiana tekstu w zadanie i pogrubienie', () => {
    // GIVEN: zwykła linia
    let text = 'oddać książki';
    // WHEN: przycisk „checklista"
    const r = toggleLinePrefix(text, { start: 0, end: 0 }, 'check');
    expect(r.text).toBe('- [ ] oddać książki');

    // WHEN: zaznaczenie słowa „książki" i przycisk „B"
    const start = r.text.indexOf('książki');
    const b = toggleInline(r.text, { start, end: start + 'książki'.length }, '**');
    expect(b.text).toBe('- [ ] oddać **książki**');
  });

  it('krok 5: odhaczanie zadań w podglądzie', () => {
    let text = '# Plan na 10 listopada\n\n- [ ] kupić mleko\n- [ ] oddać książki';
    // WHEN: tapnięcie w pierwsze zadanie (linia 2)
    text = toggleCheckAt(text, 2);
    expect(parseLine(text.split('\n')[2])).toMatchObject({ kind: 'check', checked: true });

    // AND: drugie zadanie wciąż odznaczone
    expect(parseLine(text.split('\n')[3])).toMatchObject({ kind: 'check', checked: false });

    // WHEN: ponowne tapnięcie cofa odhaczenie
    text = toggleCheckAt(text, 2);
    expect(parseLine(text.split('\n')[2])).toMatchObject({ checked: false });
  });
});
