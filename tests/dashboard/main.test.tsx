/** @jest-environment jsdom */

import { act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('main', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    globalThis.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;
  });

  it('renders the app into the root element', async () => {
    await act(async () => {
      await import('../../dashboard/src/main.js');
    });

    const root = document.getElementById('root')!;
    expect(root.innerHTML.length).toBeGreaterThan(0);
  });
});
