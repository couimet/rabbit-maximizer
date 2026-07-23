/** @jest-environment jsdom */

import { ErrorProvider, GlobalErrorBanner, useErrorContext } from '../../dashboard/src/index.js';

import '@testing-library/jest-dom/jest-globals';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactElement, useEffect } from 'react';

const renderBanner = (ui?: ReactElement) => render(<ErrorProvider>{ui ?? <GlobalErrorBanner />}</ErrorProvider>);

const ErrorReporter = ({ id, message }: { id: string; message: string }) => {
  const { reportError } = useErrorContext();
  useEffect(() => {
    reportError(id, message);
  }, [id, message, reportError]);
  return null;
};

describe('GlobalErrorBanner', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = renderBanner();
    expect(container.querySelector('.global-error-banner')).not.toBeInTheDocument();
  });

  it('renders a single error message', () => {
    renderBanner(
      <>
        <ErrorReporter id="test-1" message="Something went wrong" />
        <GlobalErrorBanner />
      </>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders multiple errors stacked', () => {
    renderBanner(
      <>
        <ErrorReporter id="err-a" message="First error" />
        <ErrorReporter id="err-b" message="Second error" />
        <GlobalErrorBanner />
      </>,
    );
    expect(screen.getByText('First error')).toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
  });

  it('dismisses an individual error on button click', () => {
    renderBanner(
      <>
        <ErrorReporter id="err-a" message="First error" />
        <ErrorReporter id="err-b" message="Second error" />
        <GlobalErrorBanner />
      </>,
    );
    const dismissButtons = screen.getAllByLabelText('Dismiss error');
    fireEvent.click(dismissButtons[0]);
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
  });

  it('does not add duplicate when same id and message are re-reported', () => {
    const DoubleReporter = () => {
      const { reportError } = useErrorContext();
      useEffect(() => {
        reportError('test-1', 'Same message');
        reportError('test-1', 'Same message');
      }, [reportError]);
      return null;
    };
    renderBanner(
      <>
        <DoubleReporter />
        <GlobalErrorBanner />
      </>,
    );
    expect(screen.getByText('Same message')).toBeInTheDocument();
    expect(screen.getAllByText('Same message')).toHaveLength(1);
  });

  it('replaces error with same id when message changes', () => {
    const { rerender } = renderBanner(
      <>
        <ErrorReporter id="test-1" message="First message" />
        <GlobalErrorBanner />
      </>,
    );
    expect(screen.getByText('First message')).toBeInTheDocument();

    rerender(
      <ErrorProvider>
        <ErrorReporter id="test-1" message="Updated message" />
        <GlobalErrorBanner />
      </ErrorProvider>,
    );
    expect(screen.queryByText('First message')).not.toBeInTheDocument();
    expect(screen.getByText('Updated message')).toBeInTheDocument();
  });
});
