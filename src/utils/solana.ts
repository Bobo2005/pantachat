import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type SignatureStatus,
} from "@solana/web3.js";
import { config } from "../config.js";

// =============================================================================
// Solana Connection Instance
// =============================================================================

export const solanaConnection = new Connection(config.SOLANA_RPC_URL, {
  commitment: "confirmed",
  confirmTransactionInitialTimeout: 30000,
});

export type SolanaVerificationErrorCode =
  | "TRANSACTION_TIMED_OUT"
  | "SLIPPAGE_FAIL"
  | "TRANSACTION_FAILED";

export class SolanaVerificationError extends Error {
  public readonly code: SolanaVerificationErrorCode;
  public readonly signature: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: SolanaVerificationErrorCode,
    signature: string,
    details?: unknown
  ) {
    super(message);
    this.name = "SolanaVerificationError";
    this.code = code;
    this.signature = signature;
    this.details = details;
    Object.setPrototypeOf(this, SolanaVerificationError.prototype);
  }
}

/**
 * Polls Solana RPC until transaction reaches 'confirmed' or 'finalized' commitment.
 * Strictly adheres to memory.md invariant: Awaits on-chain confirmation before
 * reporting to Panta POST /trades/ to prevent TX_NOT_FOUND errors.
 *
 * @param signature Base58 transaction signature string
 * @param maxTimeoutMs Maximum wait duration (default 30,000ms / 30s)
 */
export async function waitForConfirmation(
  signature: string,
  maxTimeoutMs = 30000
): Promise<boolean> {
  // Sandbox / Mock simulation bypass
  if (
    signature.startsWith("sig_test_") ||
    signature.startsWith("sim_") ||
    signature.startsWith("mock_")
  ) {
    return true;
  }

  const startTime = Date.now();
  const pollIntervalMs = 1500;

  while (Date.now() - startTime < maxTimeoutMs) {
    try {
      const response = await solanaConnection.getSignatureStatus(signature, {
        searchTransactionHistory: true,
      });

      const status: SignatureStatus | null = response?.value;

      if (status) {
        if (status.err) {
          const errStr = JSON.stringify(status.err);
          // Check for slippage tolerance exceeded errors
          if (
            errStr.toLowerCase().includes("slippage") ||
            errStr.includes("Custom: 6000") || // Common Anchor slippage error code
            errStr.includes("Custom: 1")
          ) {
            throw new SolanaVerificationError(
              `Transaction failed due to slippage bounds exceeded: ${errStr}`,
              "SLIPPAGE_FAIL",
              signature,
              status.err
            );
          }

          throw new SolanaVerificationError(
            `Transaction failed on Solana: ${errStr}`,
            "TRANSACTION_FAILED",
            signature,
            status.err
          );
        }

        if (
          status.confirmationStatus === "confirmed" ||
          status.confirmationStatus === "finalized"
        ) {
          return true;
        }
      }
    } catch (err: any) {
      if (err instanceof SolanaVerificationError) {
        throw err;
      }
      // Transient RPC network glitch: continue polling until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new SolanaVerificationError(
    `Transaction ${signature} timed out after ${maxTimeoutMs / 1000}s awaiting confirmation.`,
    "TRANSACTION_TIMED_OUT",
    signature
  );
}

// =============================================================================
// Devnet / Sandbox Transaction Builder
// =============================================================================

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * Builds a valid, on-chain Solana Devnet VersionedTransaction containing an SPL Memo instruction.
 * Used whenever Panta staging / sandbox API returns an empty transaction fixture in devnet mode,
 * guaranteeing that user wallets (Phantom / Solflare) receive a real, signable on-chain transaction.
 */
export async function buildDevnetVersionedTransaction(
  payerPubkey: string,
  memoText: string
): Promise<string> {
  const payer = new PublicKey(payerPubkey);
  const { blockhash } = await solanaConnection.getLatestBlockhash("confirmed");

  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf-8"),
  });

  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [memoInstruction],
  }).compileToV0Message();

  const versionedTx = new VersionedTransaction(messageV0);
  return Buffer.from(versionedTx.serialize()).toString("base64");
}
