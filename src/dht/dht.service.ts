import { Injectable } from "@nestjs/common";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";

@Injectable()
export class DhtService {
  dht: any;
  initializedPromise: Promise<void>;

  constructor() {
    this.initializedPromise = (async () => {
      // @ts-ignore
      const { default: DHT } = await import("bittorrent-dht");
      this.dht = new DHT();
    })();
  }

  channelToInfoHash(channel: string): string {
    const hash = sha256(channel);
    // Reduce to 20 bytes because bittorrent uses sha1
    return bytesToHex(hash.slice(0, 20));
  }

  async announce(channel: string): Promise<void> {
    await this.initializedPromise;

    const infoHash = this.channelToInfoHash(channel);
    return new Promise<void>((resolve, reject) => {
      this.dht.announce(infoHash, undefined, (reply: Error | null) => {
        reply ? reject(reply) : resolve();
      });
    });
  }

  async lookup(channel: string): Promise<string[]> {
    await this.initializedPromise;

    const infoHash = this.channelToInfoHash(channel);
    const peers = [];
    const peerCallback = (peer: string, peerInfoHash: string) => {
      if (peerInfoHash === infoHash) {
        peers.push(peer);
      }
    };
    this.dht.on("peer", peerCallback);

    // Wait for recursive lookup to finish
    await new Promise<void>((resolve, reject) => {
      this.dht.lookup(infoHash, (reply: Error | null) => {
        reply ? reject(reply) : resolve();
      });
    });

    this.dht.removeListener("peer", peerCallback);

    return peers;
  }
}
