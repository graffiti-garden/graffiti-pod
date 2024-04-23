import { Injectable } from "@nestjs/common";
import { sha256 } from "@noble/hashes/sha256";
import { ed25519 as curve } from "@noble/curves/ed25519";
import { bytesToHex } from "@noble/hashes/utils";

@Injectable()
export class InfoHashService {
  private toPrivateKey(channel: string): Uint8Array {
    return sha256(channel);
  }

  toInfoHash(channel: string): string {
    const infoHashBytes = curve.getPublicKey(this.toPrivateKey(channel));
    return bytesToHex(infoHashBytes);
  }

  toPok(channel: string, challenge: string): string {
    const pokBytes = curve.sign(challenge, this.toPrivateKey(channel));
    return bytesToHex(pokBytes);
  }

  verifyInfoHashAndPok(infoHash: string, pok: string, challenge: string) {
    try {
      return curve.verify(pok, challenge, infoHash);
    } catch {
      return false;
    }
  }
}
