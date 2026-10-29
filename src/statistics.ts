/**
 * Computes ranks for an array of numbers (fractional ranks for ties).
 */
export function rankArray(arr: number[]): number[] {
  const sorted = arr
    .map((val, idx) => ({ val, idx }))
    .sort((a, b) => a.val - b.val);

  const ranks = new Array<number>(arr.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].val === sorted[i].val) {
      j++;
    }
    const averageRank = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k++) {
      ranks[sorted[k].idx] = averageRank;
    }
    i = j + 1;
  }
  return ranks;
}

/**
 * Computes Spearman Rank Correlation Coefficient between two arrays.
 * Returns a value between -1 and 1.
 * - If negative (-1 to 0): higher X values correlate with lower Y values.
 *   In our block analysis: if X = blockIndex (0, 1, 2...) and Y = feeDensity,
 *   a negative correlation means higher fees appear at the START of the block.
 */
export function computeSpearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) {
    return 0;
  }

  const n = x.length;
  const rankX = rankArray(x);
  const rankY = rankArray(y);

  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const diff = rankX[i] - rankY[i];
    sumD2 += diff * diff;
  }

  // rs = 1 - (6 * sumD2) / (n * (n^2 - 1))
  const denom = n * (n * n - 1);
  if (denom === 0) return 0;
  const rs = 1 - (6 * sumD2) / denom;
  return Math.round(rs * 1000) / 1000;
}
