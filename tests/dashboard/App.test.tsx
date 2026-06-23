/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../dashboard/src/api.js', () => ({
  fetchSummary: jest.fn(() => new Promise(() => {})),
  fetchQueue: jest.fn(() => new Promise(() => {})),
  fetchEvents: jest.fn(() => new Promise(() => {})),
  formatDate: jest.fn((iso: string) => iso),
}));

import App from '../../dashboard/src/App.js';

describe('App', () => {
  beforeEach(() => {
    render(<App />);
  });

  it('renders the logo and title', () => {
    expect(screen.getByAltText('Rabbit Maximizer')).toBeInTheDocument();
    expect(screen.getByText('Rabbit Maximizer')).toBeInTheDocument();
  });

  it('renders all three tab buttons', () => {
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Queue')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('shows loading text for the default Summary tab', () => {
    expect(screen.getByText('Loading summary…')).toBeInTheDocument();
  });

  it('switches to loading state on Queue tab', () => {
    fireEvent.click(screen.getByText('Queue'));
    expect(screen.getByText('Loading queue…')).toBeInTheDocument();
  });

  it('switches to loading state on Events tab', () => {
    fireEvent.click(screen.getByText('Events'));
    expect(screen.getByText('Loading events…')).toBeInTheDocument();
  });

  it('renders the footer with GitHub link', () => {
    const link = screen.getByText('github.com/couimet/rabbit-maximizer');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/couimet/rabbit-maximizer');
  });
});
