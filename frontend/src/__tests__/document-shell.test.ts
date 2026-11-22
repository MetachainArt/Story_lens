import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';

describe('index.html', () => {
  it('declares Korean so screen readers use a Korean voice', () => {
    expect(html).toMatch(/<html[^>]*\slang="ko"/);
  });

  it('shows the product name in the browser tab', () => {
    expect(html).toMatch(/<title>스토리 렌즈<\/title>/);
  });
});
