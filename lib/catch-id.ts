type IdCrypto = Partial<Pick<Crypto, 'randomUUID' | 'getRandomValues'>>;
let sequence = 0;

/** Local record IDs, never authentication tokens. HTTP previews may lack randomUUID. */
export function createCatchId(source: IdCrypto | null = globalThis.crypto): string {
  if (typeof source?.randomUUID === 'function') return source.randomUUID();

  if (typeof source?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    source.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  // Keep local journalling usable even in a browser without Web Crypto.
  sequence += 1;
  return `catch-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
