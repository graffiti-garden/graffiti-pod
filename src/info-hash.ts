import { sha256 } from "@noble/hashes/sha256";
import { ed25519 as curve } from "@noble/curves/ed25519";

export function base64Encode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCodePoint(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");
}

export function obscureChannel(channel: string, podUrl: string): string {
  const podDomain = new URL(podUrl).hostname;
  const privateKey = sha256(channel);
  const infoHashBytes = curve.getPublicKey(privateKey);
  const pokBytes = curve.sign(sha256(podDomain), privateKey);
  return `${base64Encode(infoHashBytes)}.${base64Encode(pokBytes)}`;
}
