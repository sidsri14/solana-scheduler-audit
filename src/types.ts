export type ValidatorClientType = "Agave" | "Jito-Solana" | "Firedancer" | "Unknown";

export interface AnalyzedTransaction {
  index: number;
  signature: string;
  feeLamports: number;
  computeUnitLimit: number;
  computeUnitPriceMicroLamports: bigint;
  computeUnitsConsumed: number | null;
  isJitoTip: boolean;
  jitoTipAmountLamports: number;
  feeDensityMicroLamportsPerCU: number;
  writeLockAccounts: string[];
  hasError: boolean;
}

export interface SlotAnalysisResult {
  slot: number;
  blockTime: number | null;
  blockhash: string;
  leaderPubkey: string;
  clientVersion: string;
  clientFork: ValidatorClientType;
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  jitoBundlesCount: number;
  spearmanRankCorrelation: number;
  orderingHypothesis: "Strict Priority Density" | "Jito Tip Clustered" | "Arrival / Mixed FCFS" | "Uncorrelated / Congestion Jitter";
  topTransactionsSample: AnalyzedTransaction[];
}

export interface CliConfig {
  dryRun: boolean;
  spendCapSol: number;
  rpcUrl: string;
  slotCount: number;
  targetSlot: number | null;
}
