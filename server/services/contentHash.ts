import { createHash } from 'node:crypto';

export function createContentHash(content: string): string {
  return createHash('sha256').update(content.trim().replace(/\s+/g, ' ')).digest('hex');
}
