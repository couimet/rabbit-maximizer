/** @jest-environment jsdom */

import DurationSelect from '../../dashboard/src/components/DurationSelect.js';

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

const ARIA_LABEL = 'Test time range';
const DURATION_1W = '1w';
const DURATION_5D = '5d';

describe('DurationSelect', () => {
  it('renders all duration options', () => {
    render(<DurationSelect value="2d" onChange={jest.fn()} aria-label={ARIA_LABEL} />);

    expect(screen.getByText('Last 24h')).toBeInTheDocument();
    expect(screen.getByText('Last 2d')).toBeInTheDocument();
    expect(screen.getByText('Last 3d')).toBeInTheDocument();
    expect(screen.getByText('Last 5d')).toBeInTheDocument();
    expect(screen.getByText('Last 1w')).toBeInTheDocument();
  });

  it('selects the current value', () => {
    render(<DurationSelect value={DURATION_1W} onChange={jest.fn()} aria-label={ARIA_LABEL} />);

    const select = screen.getByRole('combobox', { name: ARIA_LABEL }) as HTMLSelectElement;
    expect(select.value).toBe(DURATION_1W);
  });

  it('calls onChange with the selected Duration when changed', () => {
    const handleChange = jest.fn();
    render(<DurationSelect value="2d" onChange={handleChange} aria-label={ARIA_LABEL} />);

    fireEvent.change(screen.getByRole('combobox', { name: ARIA_LABEL }), { target: { value: DURATION_5D } });

    expect(handleChange).toHaveBeenCalledWith(DURATION_5D);
  });
});
