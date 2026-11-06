import { TileSize } from './types';

export const GRID_COLS = 4;

/** Rozmiar w komórkach siatki [szerokość, wysokość]. */
export const SPAN: Record<TileSize, [number, number]> = {
  small: [1, 1],
  medium: [2, 2],
  large: [4, 2],
};

export const SIZE_LABELS: Record<TileSize, string> = { small: 'Mały', medium: 'Średni', large: 'Duży' };

export interface Cell {
  col: number;
  row: number;
  w: number;
  h: number;
}

/**
 * Układa kafelki w kolejności na siatce `cols` kolumn (jak ekran Start w Windows 8):
 * każdy trafia w pierwsze wolne miejsce, w którym się mieści, a dziury po bokach
 * wypełniają poszerzone sąsiednie kafelki — plansza jest zawsze pełna.
 */
export function layoutGrid(sizes: TileSize[], cols = GRID_COLS): { cells: Cell[]; rows: number } {
  const grid: number[][] = []; // grid[row][col] = indeks kafelka albo -1
  const ensure = (rows: number) => {
    while (grid.length < rows) grid.push(Array(cols).fill(-1));
  };
  const free = (c: number, r: number, w: number, h: number) => {
    ensure(r + h);
    for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (grid[y][x] !== -1) return false;
    return true;
  };
  const fill = (i: number, cell: Cell) => {
    for (let y = cell.row; y < cell.row + cell.h; y++) for (let x = cell.col; x < cell.col + cell.w; x++) grid[y][x] = i;
  };

  const cells: Cell[] = sizes.map((size, i) => {
    const [sw, h] = SPAN[size] ?? SPAN.medium;
    const w = Math.min(sw, cols);
    for (let r = 0; ; r++) {
      for (let c = 0; c + w <= cols; c++) {
        if (free(c, r, w, h)) {
          const cell = { col: c, row: r, w, h };
          fill(i, cell);
          return cell;
        }
      }
    }
  });

  // Wypełnianie dziur: najpierw poszerz kafelek z lewej/prawej, potem wydłuż ten nad dziurą.
  const rows = grid.length;
  const columnFree = (x: number, r0: number, r1: number) => {
    for (let y = r0; y < r1; y++) if (grid[y][x] !== -1) return false;
    return true;
  };
  const rowFree = (y: number, c0: number, c1: number) => {
    for (let x = c0; x < c1; x++) if (grid[y][x] !== -1) return false;
    return true;
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== -1) continue;
        const left = x > 0 ? grid[y][x - 1] : -1;
        const right = x < cols - 1 ? grid[y][x + 1] : -1;
        const up = y > 0 ? grid[y - 1][x] : -1;
        if (left !== -1 && cells[left].col + cells[left].w === x && columnFree(x, cells[left].row, cells[left].row + cells[left].h)) {
          cells[left] = { ...cells[left], w: cells[left].w + 1 };
          fill(left, cells[left]);
          changed = true;
        } else if (right !== -1 && cells[right].col === x + 1 && columnFree(x, cells[right].row, cells[right].row + cells[right].h)) {
          cells[right] = { ...cells[right], col: x, w: cells[right].w + 1 };
          fill(right, cells[right]);
          changed = true;
        } else if (up !== -1 && cells[up].row + cells[up].h === y && rowFree(y, cells[up].col, cells[up].col + cells[up].w)) {
          cells[up] = { ...cells[up], h: cells[up].h + 1 };
          fill(up, cells[up]);
          changed = true;
        }
      }
    }
  }
  return { cells, rows };
}

/** Indeks kafelka pod punktem (w komórkach siatki), albo -1. */
export function cellAt(cells: Cell[], col: number, row: number): number {
  return cells.findIndex(c => col >= c.col && col < c.col + c.w && row >= c.row && row < c.row + c.h);
}
