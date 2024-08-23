import { parseErrorResponse } from "./response-parsers";

export default class LinesFeed {
  private decoder = new TextDecoder();
  // TODO: make this persistent
  private cache = new Map<string, { lastModified: Date; lines: string[] }>();
  private locks = new Map<string, Promise<string[]>>();

  async *parseResponse(response: Response): AsyncGenerator<string, void, void> {
    if (response.status === 204 || response.status === 304) {
      return;
    }
    if (!response.ok) {
      throw new Error((await parseErrorResponse(response)).message);
    }
    if (response.status !== 200 && response.status !== 226) {
      throw new Error(`Unexpected status code: ${response.status}`);
    }
    if (response.status === 226) {
      const im = response.headers.get("IM");
      if (!im || !im.includes("prepend")) {
        throw new Error("Unrecognized instance manipulation for delta updates");
      }
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get a reader from the response body");
    }

    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();

      if (value) {
        buffer += this.decoder.decode(value);
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          yield part;
        }
      }

      if (done) break;
    }

    // Clear the buffer
    if (buffer) {
      yield buffer;
    }
  }

  async *fetch(
    fetch_: typeof fetch,
    url: string,
    ifModifiedSince?: Date,
  ): AsyncGenerator<string, void, void> {
    // Share the results of concurrent requests
    const lock = this.locks.get(url);
    if (lock) {
      const lines = await lock;
      for (const line of lines) {
        yield line;
      }
      return;
    }

    let resolveLock = (lines: string[]) => {};
    this.locks.set(
      url,
      new Promise((resolve) => {
        resolveLock = (lines: string[]) => {
          this.locks.delete(url);
          resolve(lines);
        };
      }),
    );

    let lastModified: Date | undefined = undefined;
    let cachedLines: string[] = [];

    if (ifModifiedSince) {
      lastModified = ifModifiedSince;
    } else {
      const cached = this.cache.get(url);
      if (cached) {
        lastModified = cached.lastModified;
        cachedLines = cached.lines;
      }
    }

    let response: Response;
    try {
      response = await fetch_(url, {
        headers: {
          ...(lastModified
            ? {
                "A-IM": "prepend",
                "If-Modified-Since": lastModified.toISOString(),
              }
            : {}),
        },
      });
    } catch (e) {
      resolveLock([]);
      throw e;
    }

    if (response.status === 200 || response.status === 204) {
      this.cache.delete(url);
      cachedLines = [];
    }

    const newLines: string[] = [];
    try {
      for await (const line of this.parseResponse(response)) {
        newLines.push(line);
      }
    } catch (e) {
      resolveLock([]);
      throw e;
    }

    const lines = [...newLines, ...cachedLines];
    const lastModifiedHeader = response.headers.get("Last-Modified");
    if (lastModifiedHeader) {
      const lastModified = new Date(lastModifiedHeader);
      if (!Number.isNaN(lastModified.getTime())) {
        this.cache.set(url, {
          lastModified,
          lines,
        });
      }
    }

    resolveLock(lines);

    for (const line of lines) {
      yield line;
    }
  }
}
