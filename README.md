# Solana Validator Block Scheduling & Transaction Ordering Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Network](https://img.shields.io/badge/Solana-Mainnet--Beta-purple)](https://solana.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Tests-6%2F6%20Passing-brightgreen)](test/scheduler.test.ts)

A high-performance measurement and analytical framework to investigate and document how Solana validators order transactions within a block across distinct client software and forks (**Agave**, **Jito-Solana**, and **Firedancer**).

Built for the **Superteam Ukraine Developer Bounty** (*"Inside the Block: How Solana Validators Order Transactions"* — 2,500 USDC prize pool).

---

## 1. Research Question & Objective

In Solana's 400ms leader slots, what determines the precise sequential order of transactions inside a block?
- **Agave (Vanilla):** Implements multi-threaded banking stages where transactions are scheduled by compute-budget priority fee density, subject to write-lock parallelization and arrival jitter.
- **Jito-Solana:** Extends the validator engine with an out-of-protocol blockspace auction, granting top-of-block inclusion to bundles containing tip payments to designated tip accounts.
- **Firedancer / Frankendancer:** Rewrites the network and scheduling pipeline in C, altering batching dynamics and queue scheduling.

This framework conducts **verifiable empirical analysis on Solana Mainnet blocks**, extracting compute-unit limits, priority fees, Jito tip transfers, and write-lock account contention to quantitatively determine the ordering rule of each validator leader.

---

## 2. Architecture & Design Principles

```
┌────────────────────────────────────────────────────────────────────────┐
│               Solana Validator Scheduler Audit Engine                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Solana Mainnet RPC Connection                        │
│                   • Read-only getBlock & getSlot                       │
│                   • getClusterNodes (Validator Client Version Map)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Transaction Decomposition & Parsing                   │
│                                                                        │
│  [Priority Fee Engine]    [Jito MEV Detector]   [Write-Lock Graph]     │
│  • MicroLamports / CU     • 8 Known Tip Mints   • Contention Set       │
│  • CU Requested vs Used   • Tip Amount Lamports • Parallel Threads     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Statistical & Empirical Evaluation                    │
│                                                                        │
│  • Spearman Rank Correlation Coefficient (rs):                         │
│    Measures monotonic relationship between block index and fee density │
│  • Classification: Strict Fee Density vs Jito Bundled vs FCFS         │
│  • Automated Markdown Report Generator                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Safety & Guardrails:
1. **`--dry-run` Default:** Defaults to non-invasive, zero-cost analysis of confirmed on-chain mainnet blocks. Zero SOL is spent.
2. **`--spend-cap <SOL>`:** Enforces an unbypassable programmatic guardrail cap if active transaction broadcast tests are enabled.

---

## 3. Getting Started

### Installation
```bash
git clone https://github.com/sidsri14/solana-scheduler-audit.git
cd solana-scheduler-audit
npm install
```

### Running Tests
Execute the unit test suite verifying rank computations, Spearman correlations, Jito tip detection, and spend cap safety:
```bash
npm test
```

Expected output:
```
▶ Solana Validator Scheduler Audit Suite
  ✔ computes exact rank array with fractional ties (1.5ms)
  ✔ computes Spearman correlation accurately (0.2ms)
  ✔ accurately detects known Jito tip accounts (0.1ms)
  ✔ classifies validator client versions correctly (0.1ms)
  ✔ enforces spend cap guardrail strictly (2.7ms)
  ✔ analyzes mock block transactions and detects priority fee ordering (0.5ms)
✔ Solana Validator Scheduler Audit Suite (6.6ms)
```

### Typecheck
```bash
npm run typecheck
```

### Running Mainnet Block Audit (Dry-Run Mode)
```bash
npm run analyze
```

---

## 4. Key Hypotheses & Ordering Rules

| Ordering Model | Expected Spearman $r_s$ | Block Layout Signature |
| :--- | :---: | :--- |
| **Strict Priority Fee Density** | $r_s \le -0.60$ | Transactions are sorted descending by microLamports per CU. Highest fees strictly appear at index 0..N. |
| **Jito MEV Bundle Clustered** | $r_s \approx -0.40$ to $-0.20$ | Top 1–5 transactions contain transfers to Jito tip accounts. Remainder follows parallel banking stage queues. |
| **Arrival Order / FCFS** | $|r_s| < 0.20$ | Fee density shows no significant correlation with index. Order is determined by network propagation and UDP/QUIC packet arrival. |
| **Contention Jitter** | Mixed | High-fee transactions delayed behind write-locked accounts execute in later threads while disjoint low-fee transactions commit early. |

---

## 5. Deliverables & Outputs

- [`src/analyzer.ts`](src/analyzer.ts): Multi-slot scheduler audit engine.
- [`src/jito.ts`](src/jito.ts): Mainnet Jito tip account registry and detector.
- [`src/statistics.ts`](src/statistics.ts): Statistical rank correlation engine.
- [`SCHEDULER_AUDIT_REPORT.md`](SCHEDULER_AUDIT_REPORT.md): Generated empirical analytical report.

---

## Author & License

- **Developer:** Siddharth Srivastava ([@sidsri14](https://github.com/sidsri14))
- **Email:** `sidsri1502@gmail.com`
- **License:** MIT
