/** @jest-environment jsdom */

import '@testing-library/jest-dom/jest-globals';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act } from '@testing-library/react';

describe('main', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    globalThis.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
  });

  it('renders the app into the root element', async () => {
    await act(async () => {
      await import('../../dashboard/src/main.js');
    });

    const root = document.getElementById('root')!;
    expect(root.innerHTML.length).toBeGreaterThan(0);
  });
});
