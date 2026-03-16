/**
 * ECDSA (secp256k1) private key parsing for Hedera SDK.
 * Supports raw 32-byte hex and DER-encoded hex; always uses fromStringECDSA/fromStringDer (no fromString guessing).
 */

import { PrivateKey } from "@hashgraph/sdk";

const HEX_REGEX = /^[0-9a-fA-F]+$/;

export type EcdsaKeyFormat = "ecdsa-raw" | "ecdsa-der";

/**
 * Detects the format of an ECDSA private key string (for logging only).
 * Does not validate or parse the key.
 */
export function detectKeyFormat(input: string): EcdsaKeyFormat {
  const hex = input.startsWith("0x") ? input.slice(2) : input;
  if (!HEX_REGEX.test(hex)) return "ecdsa-raw"; // will fail in parse
  if (hex.length === 64) return "ecdsa-raw";
  if (hex.startsWith("302e") || hex.startsWith("302E")) return "ecdsa-der";
  return "ecdsa-raw";
}

/**
 * Parses an ECDSA private key string safely.
 * - Accepts "0x..." and plain hex.
 * - Raw 32-byte hex (64 hex chars) → PrivateKey.fromStringECDSA(hex).
 * - DER-encoded ECDSA hex (starts with 302e...) → PrivateKey.fromStringDer(hex).
 * @throws Error if the string does not look like valid ECDSA hex.
 */
export function parseEcdsaPrivateKey(input: string): PrivateKey {
  const raw = input.trim();
  const hex = raw.startsWith("0x") ? raw.slice(2).trim() : raw;

  if (!hex || !HEX_REGEX.test(hex)) {
    throw new Error(
      "Invalid ECDSA private key: not hex (expected 0x-prefixed or plain hex, 64 chars raw or DER starting with 302e)"
    );
  }

  if (hex.length === 64) {
    return PrivateKey.fromStringECDSA(hex);
  }

  if (hex.toLowerCase().startsWith("302e")) {
    return PrivateKey.fromStringDer(hex);
  }

  throw new Error(
    "Invalid ECDSA private key: expected 64-char raw hex or DER hex starting with 302e"
  );
}
