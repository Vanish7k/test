/**
 * Sudoku engine: randomized full-grid generation, unique-solution digging,
 * and a MRV backtracking counter used for uniqueness checks.
 */

const TARGET_CLUES = {
  easy: 40,
  medium: 34,
  hard: 28,
  expert: 24,
};

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function candidates(board, index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Uint8Array(10);
  for (let c = 0; c < 9; c += 1) used[board[row * 9 + c]] = 1;
  for (let r = 0; r < 9; r += 1) used[board[r * 9 + col]] = 1;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) used[board[r * 9 + c]] = 1;
  }
  const result = [];
  for (let n = 1; n <= 9; n += 1) {
    if (!used[n]) result.push(n);
  }
  return result;
}

/** Fill an empty board with a random complete solution. */
function fillRandom(board) {
  let bestIndex = -1;
  let bestCandidates = null;

  for (let i = 0; i < 81; i += 1) {
    if (board[i] !== 0) continue;
    const options = candidates(board, i);
    if (options.length === 0) return false;
    if (!bestCandidates || options.length < bestCandidates.length) {
      bestIndex = i;
      bestCandidates = options;
      if (options.length === 1) break;
    }
  }

  if (bestIndex === -1) return true;

  for (const value of shuffle(bestCandidates.slice())) {
    board[bestIndex] = value;
    if (fillRandom(board)) return true;
    board[bestIndex] = 0;
  }
  return false;
}

function generateSolution() {
  const board = new Array(81).fill(0);
  fillRandom(board);
  return board;
}

/** Count solutions up to `limit`; stops early once the limit is reached. */
function countSolutions(puzzle, limit = 2) {
  const board = puzzle.slice();
  let count = 0;

  function search() {
    let bestIndex = -1;
    let bestCandidates = null;

    for (let i = 0; i < 81; i += 1) {
      if (board[i] !== 0) continue;
      const options = candidates(board, i);
      if (options.length === 0) return;
      if (!bestCandidates || options.length < bestCandidates.length) {
        bestIndex = i;
        bestCandidates = options;
        if (options.length === 1) break;
      }
    }

    if (bestIndex === -1) {
      count += 1;
      return;
    }

    for (const value of bestCandidates) {
      board[bestIndex] = value;
      search();
      board[bestIndex] = 0;
      if (count >= limit) return;
    }
  }

  search();
  return count;
}

/** Remove clues one by one, keeping the puzzle's solution unique. */
function digClues(puzzle, target) {
  let clues = 81;
  const order = shuffle(Array.from({ length: 81 }, (_, i) => i));

  for (const index of order) {
    if (clues <= target) break;
    const backup = puzzle[index];
    puzzle[index] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      clues -= 1;
    } else {
      puzzle[index] = backup;
    }
  }

  return clues;
}

/**
 * Generate a puzzle. Digging sometimes stalls above the requested clue count,
 * so a few attempts are made and the sparsest board wins.
 */
function generatePuzzle(difficulty = 'medium') {
  const target = TARGET_CLUES[difficulty] ?? TARGET_CLUES.medium;
  let best = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const solution = generateSolution();
    const puzzle = solution.slice();
    const clues = digClues(puzzle, target);

    if (!best || clues < best.clues) {
      best = { puzzle, solution, clues };
    }
    if (clues <= target) break;
  }

  return {
    puzzle: best.puzzle,
    solution: best.solution,
    clues: best.clues,
    difficulty,
  };
}
