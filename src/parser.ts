import {
  type AnalyzedTransaction,
  type SlotAnalysisResult,
  type ValidatorClientType,
} from "./types.js";
import { isJitoTipAccount } from "./jito.js";
import { computeSpearmanCorrelation } from "./statistics.js";

const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

/**
 * Classifies validator client software based on version string.
 */
export function classifyValidatorClient(version: string): ValidatorClientType {
  const lower = version.toLowerCase();
  if (lower.includes("jito")) return "Jito-Solana";
  if (lower.includes("firedancer") || lower.includes("frankendancer")) return "Firedancer";
  if (lower.startsWith("2.") || lower.startsWith("1.") || lower.includes("agave")) return "Agave";
  return "Unknown";
}

/**
 * Parses instructions to extract priority fees, compute units, and Jito tips.
 */
export function parseTransactionMeta(
  tx: any,
  index: number
): AnalyzedTransaction {
  let computeUnitLimit = 200_000; // Solana default
  let computeUnitPriceMicroLamports = 0n;
  let isJitoTip = false;
  let jitoTipAmountLamports = 0;
  const writeLockAccounts: string[] = [];

  const message = tx.transaction?.message ?? tx.message;
  const meta = tx.meta;
  const signature = tx.transaction?.signatures?.[0] ?? tx.signatures?.[0] ?? `tx_${index}`;
  const feeLamports = meta?.fee ?? 5000;
  const hasError = meta?.err !== null && meta?.err !== undefined;
  const computeUnitsConsumed = meta?.computeUnitsConsumed ?? null;

  // 1. Account keys and write locks
  if (message?.accountKeys) {
    message.accountKeys.forEach((keyObj: any, keyIdx: number) => {
      const pubkey = typeof keyObj === "string" ? keyObj : keyObj.pubkey ?? keyObj.toString();
      const isWritable = typeof keyObj === "object" ? keyObj.writable : message.header?.numRequiredSignatures > keyIdx;
      if (isWritable) {
        writeLockAccounts.push(pubkey);
      }
      if (isJitoTipAccount(pubkey)) {
        isJitoTip = true;
      }
    });
  }

  // 2. Compute budget instructions
  const instructions = message?.instructions ?? [];
  for (const ix of instructions) {
    const programId = ix.programId ?? (message?.accountKeys ? message.accountKeys[ix.programIdIndex]?.pubkey ?? message.accountKeys[ix.programIdIndex] : null);
    if (programId === COMPUTE_BUDGET_PROGRAM_ID) {
      // Decode data if base58 or hex/buffer
      try {
        if (ix.data) {
          const buf = Buffer.from(ix.data, "base64");
          if (buf.length > 0) {
            const disc = buf[0];
            if (disc === 2 && buf.length >= 5) {
              computeUnitLimit = buf.readUInt32LE(1);
            } else if (disc === 3 && buf.length >= 9) {
              computeUnitPriceMicroLamports = buf.readBigUInt64LE(1);
            }
          }
        }
      } catch {
        // Fallback or json-parsed format
      }
    }
  }

  // 3. Fee density: (Fee in microLamports) / Compute Units
  const cuBasis = computeUnitsConsumed && computeUnitsConsumed > 0 ? computeUnitsConsumed : computeUnitLimit;
  const totalMicroLamports = Number(computeUnitPriceMicroLamports) + (feeLamports * 1_000_000) / cuBasis;
  const feeDensity = Math.round(totalMicroLamports / cuBasis);

  return {
    index,
    signature,
    feeLamports,
    computeUnitLimit,
    computeUnitPriceMicroLamports,
    computeUnitsConsumed,
    isJitoTip,
    jitoTipAmountLamports,
    feeDensityMicroLamportsPerCU: feeDensity,
    writeLockAccounts,
    hasError,
  };
}

/**
 * Analyzes a full Solana block and outputs ordering statistics.
 */
export function analyzeBlockTransactions(
  slot: number,
  block: any,
  leaderPubkey: string,
  clientVersion: string
): SlotAnalysisResult {
  const transactions = block.transactions ?? [];
  const analyzedTxs: AnalyzedTransaction[] = transactions.map((tx: any, idx: number) =>
    parseTransactionMeta(tx, idx)
  );

  const totalTransactions = analyzedTxs.length;
  const successfulTransactions = analyzedTxs.filter((t) => !t.hasError).length;
  const failedTransactions = totalTransactions - successfulTransactions;
  const jitoBundlesCount = analyzedTxs.filter((t) => t.isJitoTip).length;

  // Compute correlation between block index and fee density
  const indices = analyzedTxs.map((t) => t.index);
  const feeDensities = analyzedTxs.map((t) => t.feeDensityMicroLamportsPerCU);
  const spearman = computeSpearmanCorrelation(indices, feeDensities);

  // Classify ordering rule
  let orderingHypothesis: SlotAnalysisResult["orderingHypothesis"] = "Uncorrelated / Congestion Jitter";
  if (spearman <= -0.45) {
    orderingHypothesis = "Strict Priority Density";
  } else if (jitoBundlesCount > 0 && analyzedTxs.slice(0, 10).some((t) => t.isJitoTip)) {
    orderingHypothesis = "Jito Tip Clustered";
  } else if (Math.abs(spearman) < 0.25) {
    orderingHypothesis = "Arrival / Mixed FCFS";
  }

  return {
    slot,
    blockTime: block.blockTime ?? null,
    blockhash: block.blockhash ?? "",
    leaderPubkey,
    clientVersion,
    clientFork: classifyValidatorClient(clientVersion),
    totalTransactions,
    successfulTransactions,
    failedTransactions,
    jitoBundlesCount,
    spearmanRankCorrelation: spearman,
    orderingHypothesis,
    topTransactionsSample: analyzedTxs.slice(0, 8),
  };
}
