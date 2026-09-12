import { norm } from '../gates.ts';

const VIDEO = /video (intro|interview|response|cover)|submit a video|upload a video|hirevue|one-way interview|spark hire|recorded interview|loom video/;

export function detectVideoAsk(description?: string, title?: string): boolean {
  return VIDEO.test(`${norm(title || '')} ${norm(description || '')}`);
}
