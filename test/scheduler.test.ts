import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeSpearmanCorrelation, rankArray } from "../src/statistics.js";
import { isJitoTipAccount, checkJitoTipInstruction } from "../src/jito.js";
import { classifyValidatorClient, analyzeBlockTransactions } from "../src/parser.js";
import { SolanaSchedulerAudit } from "../src/analyzer.js";

describe("Solana Validator Scheduler Audit Suite", () => {
  test("computes exact rank array with fractional ties", () => {
    const data = [10, 20, 20, 40];
    const ranks = rankArray(data);
    assert.deepStrictEqual(ranks, [1, 2.5, 2.5, 4]);
  });

  test("computes Spearman correlation accurately", () => {
    // Perfect inverse correlation: indices 0..4, fee 100..20
    const indices = [0, 1, 2, 3, 4];
    const feesDesc = [100, 80, 60, 40, 20];
    const corrInverse = computeSpearmanCorrelation(indices, feesDesc);
    assert.strictEqual(corrInverse, -1);

    // Perfect positive correlation
    const feesAsc = [20, 40, 60, 80, 100];
    const corrPositive = computeSpearmanCorrelation(indices, feesAsc);
    assert.strictEqual(corrPositive, 1);
  });

  test("accurately detects known Jito tip accounts", () => {
    const tipAccount = "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5";
    const nonTipAccount = "11111111111111111111111111111111";

    assert.strictEqual(isJitoTipAccount(tipAccount), true);
    assert.strictEqual(isJitoTipAccount(nonTipAccount), false);

    const check1 = checkJitoTipInstruction(tipAccount, 100_000);
    assert.strictEqual(check1.isTip, true);
    assert.strictEqual(check1.amount, 100_000);
  });

  test("classifies validator client versions correctly", () => {
    assert.strictEqual(classifyValidatorClient("2.0.15"), "Agave");
    assert.strictEqual(classifyValidatorClient("jito-solana-v2.0.14"), "Jito-Solana");
    assert.strictEqual(classifyValidatorClient("firedancer-v0.1"), "Firedancer");
    assert.strictEqual(classifyValidatorClient("custom-haskell"), "Unknown");
  });

  test("enforces spend cap guardrail strictly", () => {
    const auditor = new SolanaSchedulerAudit({
      dryRun: false,
      spendCapSol: 0.01, // 0.01 SOL = 10,000,000 lamports
    });

    // Spending 5,000,000 lamports should succeed
    assert.doesNotThrow(() => auditor.assertSpendCap(5_000_000));

    // Spending additional 6,000,000 lamports exceeds 10,000,000 cap and MUST throw
    assert.throws(
      () => auditor.assertSpendCap(6_000_000),
      /Spend cap exceeded/
    );
  });

  test("analyzes mock block transactions and detects priority fee ordering", () => {
    const mockBlock = {
      blockTime: 1730000000,
      blockhash: "4uQeVj5tqViQh7yWWGStvkEG1Zmhx6uasJtWCJziofM",
      transactions: [
        {
          signatures: ["sig_high_fee_0"],
          message: { accountKeys: ["96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"] },
          meta: { fee: 50000, err: null, computeUnitsConsumed: 50000 },
        },
        {
          signatures: ["sig_mid_fee_1"],
          message: { accountKeys: ["UserPubkey11111111111111111111111111111"] },
          meta: { fee: 10000, err: null, computeUnitsConsumed: 50000 },
        },
        {
          signatures: ["sig_low_fee_2"],
          message: { accountKeys: ["UserPubkey22222222222222222222222222222"] },
          meta: { fee: 5000, err: null, computeUnitsConsumed: 50000 },
        },
      ],
    };

    const analysis = analyzeBlockTransactions(
      100200300,
      mockBlock,
      "LeaderPubkey11111111111111111111111111111",
      "jito-solana-2.0.14"
    );

    assert.strictEqual(analysis.slot, 100200300);
    assert.strictEqual(analysis.totalTransactions, 3);
    assert.strictEqual(analysis.jitoBundlesCount, 1);
    assert.strictEqual(analysis.clientFork, "Jito-Solana");
    // High fee at index 0, low at index 2 -> negative correlation
    assert.ok(analysis.spearmanRankCorrelation < 0);
  });
});
