import { Connection } from "@solana/web3.js";
import {
  type CliConfig,
  type SlotAnalysisResult,
  type ValidatorClientType,
} from "./types.js";
import { analyzeBlockTransactions } from "./parser.js";

export class SolanaSchedulerAudit {
  public config: CliConfig;
  public connection: Connection;
  public currentSpendLamports = 0;

  constructor(config: Partial<CliConfig> = {}) {
    this.config = {
      dryRun: config.dryRun ?? true,
      spendCapSol: config.spendCapSol ?? 0.05,
      rpcUrl: config.rpcUrl ?? "https://api.mainnet-beta.solana.com",
      slotCount: config.slotCount ?? 3,
      targetSlot: config.targetSlot ?? null,
    };
    this.connection = new Connection(this.config.rpcUrl, "confirmed");
  }

  /**
   * Enforces spend cap guardrail before any potential transaction sending.
   */
  assertSpendCap(estimatedLamports: number): void {
    if (this.config.dryRun) {
      return; // Dry-run mode spends 0 lamports
    }
    const maxLamports = this.config.spendCapSol * 1_000_000_000;
    if (this.currentSpendLamports + estimatedLamports > maxLamports) {
      throw new Error(
        `[GUARDRAIL TRIGGERED] Spend cap exceeded: Attempted ${(this.currentSpendLamports + estimatedLamports) / 1e9} SOL exceeds cap ${this.config.spendCapSol} SOL`
      );
    }
    this.currentSpendLamports += estimatedLamports;
  }

  /**
   * Queries cluster nodes and creates a lookup map from nodePubkey -> client version.
   */
  async getValidatorVersionMap(): Promise<Map<string, string>> {
    const versionMap = new Map<string, string>();
    try {
      const nodes = await this.connection.getClusterNodes();
      for (const node of nodes) {
        if (node.pubkey && node.version) {
          versionMap.set(node.pubkey, node.version);
        }
      }
    } catch (err) {
      console.warn("Notice: getClusterNodes fallback used or limited RPC response.");
    }
    return versionMap;
  }

  /**
   * Analyzes blocks for given slots or latest confirmed slots.
   */
  async runAudit(): Promise<SlotAnalysisResult[]> {
    console.log("=== Solana Validator Leader Scheduler Audit ===");
    console.log(`RPC Endpoint: ${this.config.rpcUrl}`);
    console.log(`Dry-Run Mode: ${this.config.dryRun} (Zero lamports spent)`);
    console.log(`Spend Cap: ${this.config.spendCapSol} SOL`);

    const versionMap = await this.getValidatorVersionMap();
    const results: SlotAnalysisResult[] = [];

    let targetSlots: number[] = [];
    if (this.config.targetSlot) {
      targetSlots = [this.config.targetSlot];
    } else {
      const currentSlot = await this.connection.getSlot();
      // Sample recent slots with spacing
      for (let i = 1; i <= this.config.slotCount; i++) {
        targetSlots.push(Number(currentSlot) - i * 15);
      }
    }

    for (const slot of targetSlots) {
      try {
        console.log(`\nFetching block for slot ${slot}...`);
        const leaderPubkey = (await this.connection.getSlotLeader()) ?? "UnknownLeader";
        const clientVersion = versionMap.get(leaderPubkey) ?? "Agave 2.0.15 (Default)";

        const block = await this.connection.getBlock(slot, {
          maxSupportedTransactionVersion: 0,
        });

        if (!block) {
          console.warn(`Slot ${slot} was skipped or empty.`);
          continue;
        }

        const analysis = analyzeBlockTransactions(
          slot,
          block,
          leaderPubkey,
          clientVersion
        );
        results.push(analysis);

        console.log(`Slot ${slot} Analysis:`);
        console.log(`  Leader: ${analysis.leaderPubkey.slice(0, 8)}... (${analysis.clientFork} - ${analysis.clientVersion})`);
        console.log(`  Transactions: ${analysis.totalTransactions} (Success: ${analysis.successfulTransactions}, Fail: ${analysis.failedTransactions})`);
        console.log(`  Jito Bundles Detected: ${analysis.jitoBundlesCount}`);
        console.log(`  Spearman Fee Rank Correlation: ${analysis.spearmanRankCorrelation}`);
        console.log(`  Ordering Hypothesis: ${analysis.orderingHypothesis}`);
      } catch (err: any) {
        console.error(`Failed to analyze slot ${slot}:`, err.message);
      }
    }

    return results;
  }
}
