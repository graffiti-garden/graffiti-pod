import "dotenv/config";
import { sha256 } from "@noble/hashes/sha256";
import { ed25519 as curve } from "@noble/curves/ed25519";

const myDomain = process.env.DOMAIN;
if (!myDomain) {
  throw new Error("You must set the DOMAIN variable in your .env file");
}
const myDomainHash = sha256(myDomain);

export function base64Encode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCodePoint(...bytes));
  // Make sure it is url safe
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");
}

export function base64Decode(str: string): Uint8Array {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 != 0) {
    base64 += "=";
  }
  return new Uint8Array(Array.from(atob(base64), (s) => s.codePointAt(0) ?? 0));
}

export class InfoHash {
  private static base64urlRegex = "[A-Za-z0-9_-]";
  private static obscuredChannelRegex = new RegExp(
    `^(${this.base64urlRegex}{43}\\.${this.base64urlRegex}{86})$`,
  );

  private static toPrivateKey(channel: string): Uint8Array {
    return sha256(channel);
  }

  static toInfoHash(channel: string): string {
    const infoHashBytes = curve.getPublicKey(this.toPrivateKey(channel));
    return base64Encode(infoHashBytes);
  }

  static toPok(channel: string): string {
    const pokBytes = curve.sign(myDomainHash, this.toPrivateKey(channel));
    return base64Encode(pokBytes);
  }

  static verifyInfoHashAndPok(infoHash: string, pok: string) {
    try {
      return curve.verify(
        base64Decode(pok),
        myDomainHash,
        base64Decode(infoHash),
      );
    } catch {
      return false;
    }
  }

  static obscureChannel(channel: string): string {
    return `${this.toInfoHash(channel)}.${this.toPok(channel)}`;
  }

  static verifyObscuredChannel(obscuredChannel: string): string {
    const match = obscuredChannel.match(this.obscuredChannelRegex);
    if (!match) {
      throw new Error(
        "Obscured channel must be of the form infoHash.pok where infoHash and pok are base64url encoded.",
      );
    }
    const [infoHash, pok] = match[1].split(".");
    if (!this.verifyInfoHashAndPok(infoHash, pok)) {
      throw new Error("Invalid infoHash or pok");
    }
    return infoHash;
  }
}
