import { SolanaSchedulerAudit } from "./analyzer.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--live");
  const slotsIdx = args.indexOf("--slots");
  const slotCount = slotsIdx !== -1 && args[slotsIdx + 1] ? parseInt(args[slotsIdx + 1], 10) : 3;

  const targetIdx = args.indexOf("--slot");
  const targetSlot = targetIdx !== -1 && args[targetIdx + 1] ? parseInt(args[targetIdx + 1], 10) : null;

  const capIdx = args.indexOf("--spend-cap");
  const spendCapSol = capIdx !== -1 && args[capIdx + 1] ? parseFloat(args[capIdx + 1]) : 0.05;

  const auditor = new SolanaSchedulerAudit({
    dryRun,
    slotCount,
    targetSlot,
    spendCapSol,
  });

  const results = await auditor.runAudit();
  console.log("\n=======================================================");
  console.log("             AUDIT SUMMARY TABLE                       ");
  console.log("=======================================================");
  console.table(
    results.map((r) => ({
      Slot: r.slot,
      Client: r.clientFork,
      Txs: r.totalTransactions,
      JitoBundles: r.jitoBundlesCount,
      SpearmanRs: r.spearmanRankCorrelation,
      RuleDetected: r.orderingHypothesis,
    }))
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
