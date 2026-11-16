/**
 * Testy jednostkowe: src/routine/grid.ts
 * Układanie kafelków na siatce 4 kolumn (styl Windows 8).
 */
import { layoutGrid, cellAt, SPAN, GRID_COLS } from '../../src/routine/grid';
import { TileSize } from '../../src/routine/types';

/** Sprawdza, że żadne dwa kafelki nie nachodzą na siebie. */
function assertNoOverlap(cells: { col: number; row: number; w: number; h: number }[]) {
  const taken = new Set<string>();
  for (const c of cells) {
    for (let y = c.row; y < c.row + c.h; y++) {
      for (let x = c.col; x < c.col + c.w; x++) {
        const key = `${x},${y}`;
        expect(taken.has(key)).toBe(false);
        taken.add(key);
      }
    }
  }
  return taken;
}

describe('layoutGrid', () => {
  it('duży kafelek zajmuje cały wiersz (4×2)', () => {
    const { cells } = layoutGrid(['large']);
    expect(cells[0]).toEqual({ col: 0, row: 0, w: 4, h: 2 });
  });

  it('dwa średnie mieszczą się obok siebie', () => {
    const { cells, rows } = layoutGrid(['medium', 'medium']);
    expect(cells[0].row).toBe(0);
    expect(cells[1].row).toBe(0);
    expect(rows).toBe(2);
    assertNoOverlap(cells);
  });

  it('kafelki nigdy nie nachodzą na siebie (losowe układy)', () => {
    const sizes: TileSize[] = ['small', 'medium', 'large'];
    for (let seed = 0; seed < 50; seed++) {
      const n = 1 + (seed % 10);
      const layout = Array.from({ length: n }, (_, i) => sizes[(seed + i * 7) % 3]);
      const { cells } = layoutGrid(layout);
      assertNoOverlap(cells);
      for (const c of cells) {
        expect(c.col).toBeGreaterThanOrEqual(0);
        expect(c.col + c.w).toBeLessThanOrEqual(GRID_COLS);
      }
    }
  });

  it('plansza jest zawsze pełna — dziury są wypełniane poszerzeniem sąsiadów', () => {
    // small (1×1) obok medium (2×2) zostawia dziury, które algorytm ma domknąć.
    const { cells, rows } = layoutGrid(['small', 'medium', 'small']);
    const covered = assertNoOverlap(cells);
    expect(covered.size).toBe(rows * GRID_COLS); // każda komórka zajęta
  });

  it('pusta lista → pusta plansza', () => {
    const { cells, rows } = layoutGrid([]);
    expect(cells).toEqual([]);
    expect(rows).toBe(0);
  });
});

describe('cellAt', () => {
  it('znajduje kafelek pod wskazaną komórką', () => {
    const { cells } = layoutGrid(['medium', 'medium']);
    expect(cellAt(cells, 0, 0)).toBe(0);
    expect(cellAt(cells, 2, 1)).toBe(1);
    expect(cellAt(cells, 0, 99)).toBe(-1);
  });
});

describe('SPAN', () => {
  it('rozmiary zgodne ze specyfikacją', () => {
    expect(SPAN.small).toEqual([1, 1]);
    expect(SPAN.medium).toEqual([2, 2]);
    expect(SPAN.large).toEqual([4, 2]);
  });
});
