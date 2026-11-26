/** Browser-side token utilities. Raw invite tokens are shown once and never stored. */

export async function sha256Hex(value: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure token hashing requires an HTTPS or localhost connection.");
  }
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateInviteToken(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("Secure token generation requires an HTTPS or localhost connection.");
  }
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
