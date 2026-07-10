/** @jest-environment jsdom */

import ConfirmDialog from '../../dashboard/src/components/ConfirmDialog.js';

import '@testing-library/jest-dom/jest-globals';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

describe('ConfirmDialog', () => {
  const MESSAGE = 'Are you sure?';
  const CONFIRM_LABEL = 'Proceed';

  it('renders the message and buttons', () => {
    render(<ConfirmDialog message={MESSAGE} confirmLabel={CONFIRM_LABEL} onConfirm={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(CONFIRM_LABEL)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog message={MESSAGE} confirmLabel={CONFIRM_LABEL} onConfirm={onConfirm} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByText(CONFIRM_LABEL));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog message={MESSAGE} confirmLabel={CONFIRM_LABEL} onConfirm={jest.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when overlay backdrop is clicked', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog message={MESSAGE} confirmLabel={CONFIRM_LABEL} onConfirm={jest.fn()} onCancel={onCancel} />);

    fireEvent.click(screen.getByText(MESSAGE).closest('.dialog-overlay')!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog message={MESSAGE} confirmLabel={CONFIRM_LABEL} onConfirm={jest.fn()} onCancel={onCancel} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledWith();
  });
});
