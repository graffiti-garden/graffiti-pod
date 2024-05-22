import "dotenv/config";
import { sha256 } from "@noble/hashes/sha256";
import { ed25519 as curve } from "@noble/curves/ed25519";
import { bytesToHex } from "@noble/hashes/utils";

const myDomain = process.env.DOMAIN;
if (!myDomain) {
  throw new Error("You must set the DOMAIN variable in your .env file");
}
const myDomainHash = sha256(myDomain);

export class InfoHash {
  private static toPrivateKey(channel: string): Uint8Array {
    return sha256(channel);
  }

  static toInfoHash(channel: string): string {
    const infoHashBytes = curve.getPublicKey(this.toPrivateKey(channel));
    return bytesToHex(infoHashBytes);
  }

  static toPok(channel: string): string {
    const pokBytes = curve.sign(myDomainHash, this.toPrivateKey(channel));
    return bytesToHex(pokBytes);
  }

  static verifyInfoHashAndPok(infoHash: string, pok: string) {
    try {
      return curve.verify(pok, myDomainHash, infoHash);
    } catch {
      return false;
    }
  }
}
