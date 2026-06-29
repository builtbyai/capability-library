/**
 * Streaming sha256 — used during intake to hash bytes WHILE writing them.
 * The two-pass alternative (write, then re-read to hash) is wrong: a parallel
 * upload of the same file would race and both would store before either could
 * dedup-check.
 */
import { createHash } from 'node:crypto';

export interface HashedStream {
  /** The original stream, tee'd through the hasher. */
  stream: AsyncIterable<Uint8Array>;
  /** Resolves to the lowercase-hex sha256 once the stream is fully consumed. */
  hash: Promise<string>;
}

export function hashStream(input: AsyncIterable<Uint8Array>): HashedStream {
  const hasher = createHash('sha256');
  let resolve!: (h: string) => void;
  let reject!: (e: unknown) => void;
  const hash = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  async function* tee() {
    try {
      for await (const chunk of input) {
        hasher.update(chunk);
        yield chunk;
      }
      resolve(hasher.digest('hex'));
    } catch (err) {
      reject(err);
      throw err;
    }
  }

  return { stream: tee(), hash };
}

/** Convenience for the in-memory case. */
export function hashBytes(buf: Uint8Array | Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
