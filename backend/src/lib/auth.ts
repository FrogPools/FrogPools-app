import { SiweMessage, generateNonce } from 'siwe';

export function newNonce(): string {
  return generateNonce();
}

export interface VerifyResult {
  ok: boolean;
  address?: string;
  error?: string;
}

// Verify a SIWE message + signature against the expected domain and nonce.
export async function verifySiwe(
  message: string,
  signature: string,
  expectedDomain: string,
  expectedNonce: string,
): Promise<VerifyResult> {
  try {
    const siwe = new SiweMessage(message);
    const res = await siwe.verify({ signature, domain: expectedDomain, nonce: expectedNonce });
    if (!res.success) return { ok: false, error: 'signature verification failed' };
    return { ok: true, address: siwe.address.toLowerCase() };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'invalid message' };
  }
}
