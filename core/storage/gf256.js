/**
 * GF(2^8) Galois Field Arithmetic
 *
 * Implements arithmetic in GF(2^8) using the irreducible polynomial
 * x^8 + x^4 + x^3 + x^2 + 1 (0x11d), the same polynomial used by
 * Backblaze's Reed-Solomon implementation and liberasurecode.
 *
 * This is standard, well-established mathematics (established technology [A]).
 * SAYMAN's contribution is a self-contained pure-JS implementation for
 * browser/Node.js compatibility without native addons.
 *
 * References:
 *   - Backblaze Java RS implementation (Apache 2.0)
 *   - klauspost/reedsolomon (MIT)
 *   - "A Tutorial on Reed-Solomon Coding" by W. Cary Huffman
 */

const POLY = 0x11d; // x^8+x^4+x^3+x^2+1
const GF_SIZE = 256;

// Build log and antilog (exp) tables
const LOG_TABLE = new Uint8Array(GF_SIZE);
const EXP_TABLE = new Uint8Array(GF_SIZE * 2); // doubled for wrap-around convenience

let x = 1;
for (let i = 0; i < GF_SIZE - 1; i++) {
  EXP_TABLE[i] = x;
  LOG_TABLE[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= POLY;
}
// Fill second half to avoid modulo in mul
for (let i = GF_SIZE - 1; i < GF_SIZE * 2; i++) {
  EXP_TABLE[i] = EXP_TABLE[i - (GF_SIZE - 1)];
}
// LOG_TABLE[0] is undefined (log(0) = -inf); ensure it stays 0 (unused in valid ops)

/**
 * GF(2^8) multiplication
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

/**
 * GF(2^8) division
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function gfDiv(a, b) {
  if (b === 0) throw new Error('GF division by zero');
  if (a === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] - LOG_TABLE[b] + (GF_SIZE - 1)];
}

/**
 * GF(2^8) exponentiation: base^exp
 * @param {number} base
 * @param {number} exp
 * @returns {number}
 */
export function gfPow(base, exp) {
  if (base === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[base] * exp) % (GF_SIZE - 1)];
}

/**
 * GF(2^8) inverse
 * @param {number} a
 * @returns {number}
 */
export function gfInv(a) {
  if (a === 0) throw new Error('GF inverse of zero');
  return EXP_TABLE[(GF_SIZE - 1) - LOG_TABLE[a]];
}

/**
 * Build a Cauchy matrix of dimensions (rows x cols) over GF(2^8).
 * A Cauchy matrix C[i][j] = 1 / (x_i XOR y_j) where x and y are
 * disjoint sets of GF(2^8) elements.
 * Any square sub-matrix of a Cauchy matrix is invertible,
 * which is the key property needed for MDS (Maximum Distance Separable) codes.
 *
 * We use x_i = i (for i in 0..rows-1) and y_j = rows+j (for j in 0..cols-1).
 *
 * @param {number} rows - number of parity shards (M)
 * @param {number} cols - number of data shards (N)
 * @returns {Uint8Array[]} matrix as array of row Uint8Arrays
 */
export function buildCauchyMatrix(rows, cols) {
  const matrix = [];
  for (let i = 0; i < rows; i++) {
    const row = new Uint8Array(cols);
    for (let j = 0; j < cols; j++) {
      row[j] = gfInv(i ^ (rows + j));
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Invert a square GF(2^8) matrix using Gaussian elimination.
 * Modifies the input matrix in-place and returns the inverse.
 *
 * @param {Uint8Array[]} matrix - square matrix (n x n)
 * @returns {Uint8Array[]} inverse matrix
 */
export function invertMatrix(matrix) {
  const n = matrix.length;
  // Create augmented matrix [matrix | identity]
  const aug = matrix.map((row, i) => {
    const augRow = new Uint8Array(n * 2);
    augRow.set(row, 0);
    augRow[n + i] = 1;
    return augRow;
  });

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let pivotRow = -1;
    for (let row = col; row < n; row++) {
      if (aug[row][col] !== 0) { pivotRow = row; break; }
    }
    if (pivotRow === -1) throw new Error('Matrix is not invertible');
    if (pivotRow !== col) {
      [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];
    }
    // Scale pivot row so pivot element = 1
    const pivotVal = aug[col][col];
    const pivotInv = gfInv(pivotVal);
    for (let j = 0; j < n * 2; j++) {
      aug[col][j] = gfMul(aug[col][j], pivotInv);
    }
    // Eliminate column in all other rows
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (factor === 0) continue;
      for (let j = 0; j < n * 2; j++) {
        aug[row][j] ^= gfMul(factor, aug[col][j]);
      }
    }
  }

  return aug.map(row => row.slice(n));
}

export { LOG_TABLE, EXP_TABLE };
