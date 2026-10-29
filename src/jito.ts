/**
 * Official Jito tip accounts recognized on Solana Mainnet-Beta.
 * Reference: https://jito-foundation.gitbook.io/mev/mev-payment-and-distribution/on-chain-addresses
 */
export const JITO_TIP_ACCOUNTS = new Set([
  "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
  "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
  "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
  "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
  "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
  "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
]);

export function isJitoTipAccount(address: string): boolean {
  return JITO_TIP_ACCOUNTS.has(address);
}

/**
 * Checks whether an instruction transfers lamports to a Jito tip account.
 */
export function checkJitoTipInstruction(
  destinationAccount: string,
  lamports: number
): { isTip: boolean; amount: number } {
  if (isJitoTipAccount(destinationAccount) && lamports > 0) {
    return { isTip: true, amount: lamports };
  }
  return { isTip: false, amount: 0 };
}
