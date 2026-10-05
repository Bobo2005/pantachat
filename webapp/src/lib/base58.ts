// Lightweight Base58 decoder for Solana private keys (zero external dependencies)
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE = BigInt(58);

export function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  let num = BigInt(0);
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base58 character: "${char}"`);
    }
    num = num * BASE + BigInt(index);
  }

  // Convert BigInt to byte array
  const hex = num.toString(16);
  const paddedHex = hex.length % 2 === 0 ? hex : "0" + hex;
  const bytes = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(paddedHex.substring(i * 2, i * 2 + 2), 16);
  }

  // Handle leading '1's (zeros in base58)
  let leadingZeros = 0;
  for (let i = 0; i < str.length && str[i] === "1"; i++) {
    leadingZeros++;
  }

  if (leadingZeros > 0) {
    const result = new Uint8Array(leadingZeros + bytes.length);
    result.set(bytes, leadingZeros);
    return result;
  }

  return bytes;
}

export function parseSolanaSecretKey(rawKey: string): Uint8Array {
  const trimmed = rawKey.trim();
  // Case 1: JSON array format (e.g. "[1,2,3,...]")
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const parsed = JSON.parse(trimmed);
    return new Uint8Array(parsed);
  }
  // Case 2: Base58 string (e.g. exported from Phantom)
  return decodeBase58(trimmed);
}
