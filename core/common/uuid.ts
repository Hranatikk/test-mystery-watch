/* eslint-disable no-bitwise */
import { defaultRng, type Rng } from './random';

/** RFC4122 v4-shaped id. Not cryptographically secure, which is fine for a mock. */
export function uuid(rng: Rng = defaultRng): string {
  const hex: string[] = [];
  for (let i = 0; i < 32; i++) {
    hex.push(Math.floor(rng() * 16).toString(16));
  }
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
