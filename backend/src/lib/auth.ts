import { generateNonce } from 'siwe';
import { verifyMessage } from 'ethers';

export function newNonce(): string {
  return generateNonce();
}

export interface VerifyResult {
  ok: boolean;
  address?: string;
  error?: string;
}

// Demo-grade SIWE verification:
// recover the signer from (message, signature) and require the expected nonce to be present.
// (Domain/chain enforcement is intentionally relaxed for the off-chain demo; add it back for production.)
export async function verifySiwe(
  message: string,
  signature: string,
  expectedNonce: string,
): Promise<VerifyResult> {
  try {
    if (!message.includes(`Nonce: ${expectedNonce}`)) {
      return { ok: false, error: 'nonce mismatch' };
    }
    const signer = verifyMessage(message, signature); // checksummed address
    return { ok: true, address: signer.toLowerCase() };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'invalid signature' };
  }
}
