import { Injectable } from "@nestjs/common";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
const dns = require("node:dns");

@Injectable()
export class DhtService {
  dht: any;
  initializedPromise: Promise<void>;
  reverseDnsCache = new Map<string, Promise<string>>();

  constructor() {
    this.initializedPromise = (async () => {
      // @ts-ignore
      const { default: DHT } = await import("bittorrent-dht");
      this.dht = new DHT();
    })();
  }

  async close() {
    await this.initializedPromise;
    await new Promise<void>((resolve) => this.dht.destroy(resolve));
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

  peerCallback(
    infoHash: string,
    peers: Set<string>,
    { host }: { host: string },
    peerInfoHash: Buffer,
  ) {
    if (bytesToHex(peerInfoHash) === infoHash && !peers.has(host)) {
      peers.add(host);

      if (!this.reverseDnsCache.has(host)) {
        this.reverseDnsCache.set(
          host,
          new Promise<string>((resolve, reject) => {
            dns.lookupService(host, 443, (err, hostname) => {
              if (err) {
                reject(err);
              } else {
                resolve(hostname);
              }
            });
          }),
        );
      }
    }
  }

  async lookup(channel: string): Promise<string[]> {
    await this.initializedPromise;

    const infoHash = this.channelToInfoHash(channel);

    const peers = new Set<string>();
    const peerCallback = this.peerCallback.bind(this, infoHash, peers);
    this.dht.on("peer", peerCallback);

    // Wait for recursive lookup to finish
    await new Promise<void>((resolve, reject) => {
      this.dht.lookup(infoHash, (reply: Error | null) => {
        reply ? reject(reply) : resolve();
      });
    });

    this.dht.removeListener("peer", peerCallback);

    return await Promise.all(
      Array.from(peers).map((peer) => this.reverseDnsCache.get(peer)),
    );
  }
}
