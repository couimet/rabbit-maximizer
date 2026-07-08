/** @jest-environment jsdom */

import DurationSelect from '../../dashboard/src/components/DurationSelect.js';

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

describe('DurationSelect', () => {
  it('renders all duration options', () => {
    render(<DurationSelect value="2d" onChange={jest.fn()} aria-label="Test time range" />);

    expect(screen.getByText('Last 24h')).toBeInTheDocument();
    expect(screen.getByText('Last 2d')).toBeInTheDocument();
    expect(screen.getByText('Last 3d')).toBeInTheDocument();
    expect(screen.getByText('Last 5d')).toBeInTheDocument();
    expect(screen.getByText('Last 1w')).toBeInTheDocument();
  });

  it('selects the current value', () => {
    render(<DurationSelect value="1w" onChange={jest.fn()} aria-label="Test time range" />);

    const select = screen.getByRole('combobox', { name: 'Test time range' }) as HTMLSelectElement;
    expect(select.value).toBe('1w');
  });

  it('calls onChange with the selected Duration when changed', () => {
    const handleChange = jest.fn();
    render(<DurationSelect value="2d" onChange={handleChange} aria-label="Test time range" />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Test time range' }), { target: { value: '5d' } });

    expect(handleChange).toHaveBeenCalledWith('5d');
  });
});
