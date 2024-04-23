import { Injectable } from "@nestjs/common";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
const dns = require("node:dns");

const DOMAIN_BLOCKS = ["poneytelecom.eu"];
const ANNOUNCE_INTERVAL = 60 * 60 * 1000;

@Injectable()
export class DhtService {
  dht: any;
  initializedPromise: Promise<void>;
  reverseDnsCache = new Map<string, Promise<string>>();
  announceIntervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.initializedPromise = (async () => {
      // @ts-ignore
      const { default: DHT } = await import("bittorrent-dht");
      this.dht = new DHT();
      await new Promise<void>((resolve) => {
        this.dht.on("ready", resolve);
      });
    })();
  }

  async close() {
    this.announceIntervals.forEach((interval) => clearInterval(interval));
    await this.initializedPromise;
    await new Promise<void>((resolve) => this.dht.destroy(resolve));
  }

  channelToInfoHash(channel: string): string {
    const hash = sha256(channel);
    // Reduce to 20 bytes because bittorrent uses sha1
    return bytesToHex(hash.slice(0, 20));
  }

  private async announceCallback(infoHash: string) {
    await this.initializedPromise;
    if (this.dht.destroyed) return;

    await new Promise<void>(async (resolve, reject) => {
      this.dht.announce(infoHash, undefined, (reply: Error | null) => {
        reply ? reject(reply) : resolve();
      });
    });
  }

  async announce(channel: string): Promise<void> {
    if (this.announceIntervals.has(channel)) {
      throw new Error("Already announcing");
    }

    // Start the announce cycle
    const infoHash = this.channelToInfoHash(channel);
    const interval = setInterval(
      this.announceCallback.bind(this, infoHash),
      ANNOUNCE_INTERVAL * (1 + Math.random()),
    );
    this.announceIntervals.set(channel, interval);
    await this.announceCallback(infoHash);
  }

  async unannounce(channel: string): Promise<void> {
    if (!this.announceIntervals.has(channel)) {
      throw new Error("Not announcing");
    }
    const interval = this.announceIntervals.get(channel);
    clearTimeout(interval);
    this.announceIntervals.delete(channel);
  }

  private peerCallback(
    infoHash: string,
    peers: Set<string>,
    { host }: { host: string },
    peerInfoHash: Buffer,
  ): void {
    if (bytesToHex(peerInfoHash) !== infoHash || peers.has(host)) {
      return;
    }
    peers.add(host);

    if (this.reverseDnsCache.has(host)) return;
    this.reverseDnsCache.set(
      host,
      new Promise<string>((resolve) => {
        dns.lookupService(host, 443, (err: Error, hostname: string) => {
          if (
            err ||
            DOMAIN_BLOCKS.some((blocked) => hostname.endsWith(blocked))
          ) {
            console.log(`Failed to resolve ${host}`);
            console.log(err);
            console.log(hostname);
            resolve(null);
          } else {
            resolve(hostname);
          }
        });
      }),
    );
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

    // Wait for all reverse DNS lookups to finish
    // and filter out failed lookups
    return (
      await Promise.all(
        Array.from(peers).map((peer) => this.reverseDnsCache.get(peer)),
      )
    ).filter((result) => result !== null);
  }
}
