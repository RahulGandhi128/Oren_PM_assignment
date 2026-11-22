// Small synchronous SHA-256 (FIPS 180-4). Synchronous so the assumption-set ID can be computed
// during render, and identical in every context (crypto.subtle is missing on plain-http LAN hosts).

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

// Round constants: first 32 bits of the fractional parts of the cube roots (K) and
// square roots (H0) of the first primes, computed rather than typed out.
function primes(count: number): number[] {
  const out: number[] = [];
  for (let n = 2; out.length < count; n++) if (out.every((p) => n % p !== 0)) out.push(n);
  return out;
}
const frac32 = (x: number) => ((x - Math.floor(x)) * 2 ** 32) >>> 0;
const P = primes(64);
const K = Uint32Array.from(P, (p) => frac32(Math.cbrt(p)));
const H0 = Uint32Array.from(P.slice(0, 8), (p) => frac32(Math.sqrt(p)));

export function sha256Hex(text: string): string {
  const msg = new TextEncoder().encode(text);
  const len = msg.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(msg);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor((len * 8) / 2 ** 32));
  view.setUint32(total - 4, (len * 8) >>> 0);

  const H = Uint32Array.from(H0);
  const W = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2];
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, "0")).join("");
}
