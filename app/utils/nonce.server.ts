import { randomBytes } from "crypto";

export function deriveNonceForRequest(): string {
  const nonce = randomBytes(16).toString("base64");
  return nonce;
}
