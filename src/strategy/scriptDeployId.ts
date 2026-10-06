/**
 * The row a C strategy card deploys to, named by the client. The backend activates the
 * `strategy_id` it is sent, or a new one when it is sent none (`strategyaction.go` `deployCard`),
 * and Athena's activate is an upsert by id: a card that sends no id makes a new strategy on every
 * request, so a resend after a request that got no answer would start a second one. Named here
 * instead, the same for every attempt of the same card and kind, on any device and after a
 * relaunch: a resend activates the same row again.
 *
 * A UUID version 5 (RFC 9562 §5.5): SHA-1 over a fixed namespace and the card's lasting identity.
 * The backend checks only that the id parses as a UUID.
 */
import type {RunOptionKind} from '../types/strategyRun.ts';

/** This app's namespace for deploy ids; changing it would orphan every row named before. */
export const SCRIPT_DEPLOY_NAMESPACE = '3f0e6a52-9c1d-4b7e-8a25-6d4c1b9e7f30';

/** What names a card's deploy row: where the card is, the run it is, and the code it carries. */
export interface ScriptDeployIdentity {
  chatId: string;
  /** The saved message the card is in; a turn not saved yet has nothing lasting to name. */
  messageId: string;
  /** The card's place among that message's cards. */
  cardKey: string;
  kind: Exclude<RunOptionKind, 'backtest'>;
  scriptHash: string;
}

const utf8 = (text: string): number[] => {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return bytes;
};

const rotl = (value: number, by: number): number =>
  (value << by) | (value >>> (32 - by));

/** SHA-1 (FIPS 180-4) of a byte string, as 20 bytes. */
export function sha1(message: readonly number[]): number[] {
  const bytes = [...message, 0x80];
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bits = message.length * 8;
  const high = Math.floor(bits / 0x100000000);
  for (const word of [high, bits >>> 0])
    bytes.push(
      (word >>> 24) & 255,
      (word >>> 16) & 255,
      (word >>> 8) & 255,
      word & 255,
    );
  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80).fill(0);
  for (let block = 0; block < bytes.length; block += 64) {
    for (let i = 0; i < 16; i += 1) {
      const at = block + i * 4;
      w[i] =
        ((bytes[at] ?? 0) << 24) |
        ((bytes[at + 1] ?? 0) << 16) |
        ((bytes[at + 2] ?? 0) << 8) |
        (bytes[at + 3] ?? 0);
    }
    for (let i = 16; i < 80; i += 1)
      w[i] = rotl(
        (w[i - 3] ?? 0) ^ (w[i - 8] ?? 0) ^ (w[i - 14] ?? 0) ^ (w[i - 16] ?? 0),
        1,
      );
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let i = 0; i < 80; i += 1) {
      const [f, k] =
        i < 20
          ? [(b & c) | (~b & d), 0x5a827999]
          : i < 40
            ? [b ^ c ^ d, 0x6ed9eba1]
            : i < 60
              ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc]
              : [b ^ c ^ d, 0xca62c1d6];
      const next = (rotl(a, 5) + f + e + k + (w[i] ?? 0)) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = next;
    }
    h[0] = ((h[0] ?? 0) + a) | 0;
    h[1] = ((h[1] ?? 0) + b) | 0;
    h[2] = ((h[2] ?? 0) + c) | 0;
    h[3] = ((h[3] ?? 0) + d) | 0;
    h[4] = ((h[4] ?? 0) + e) | 0;
  }
  return h.flatMap(word => [
    (word >>> 24) & 255,
    (word >>> 16) & 255,
    (word >>> 8) & 255,
    word & 255,
  ]);
}

const uuidBytes = (uuid: string): number[] => {
  const hex = uuid.replace(/-/g, '');
  return Array.from({length: 16}, (_, i) =>
    Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
};

const hex = (byte: number): string => byte.toString(16).padStart(2, '0');

/** A UUID version 5 of `name` in `namespace` (RFC 9562 §5.5). */
export function uuidV5(name: string, namespace: string): string {
  const digest = sha1([...uuidBytes(namespace), ...utf8(name)]).slice(0, 16);
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
  const text = digest.map(hex).join('');
  return [
    text.slice(0, 8),
    text.slice(8, 12),
    text.slice(12, 16),
    text.slice(16, 20),
    text.slice(20),
  ].join('-');
}

/**
 * The row a card's paper (`forward`) or live deploy is sent with when the card names no saved
 * strategy of its own: the same for every attempt of that card and kind, so a resend can only
 * activate that row again, never start a second one.
 */
export const scriptDeployId = ({
  chatId,
  messageId,
  cardKey,
  kind,
  scriptHash,
}: ScriptDeployIdentity): string =>
  uuidV5(
    ['c-card', chatId, messageId, cardKey, kind, scriptHash].join('\u0000'),
    SCRIPT_DEPLOY_NAMESPACE,
  );
