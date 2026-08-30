/** @jest-environment jsdom */

import { TrackedPrs } from '../../dashboard/src/index.js';

import '@testing-library/jest-dom/jest-globals';
import { getUniqueGitHubRepoRef, getUniqueInt, getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

describe('TrackedPrs', () => {
  it('shows loading text when items is null', () => {
    render(<TrackedPrs items={null} headingLevel="h3" />);
    expect(screen.getByText('Loading tracked PRs...')).toBeInTheDocument();
  });

  it('shows empty state when there are no tracked PRs', () => {
    render(<TrackedPrs items={[]} headingLevel="h3" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Tracked PRs — 0' })).toBeInTheDocument();
    expect(screen.getByText('No tracked PRs.')).toBeInTheDocument();
  });

  it('renders tracked PR rows with the reviewed badge', () => {
    const repo = getUniqueGitHubRepoRef().fullName;
    const prNumber = getUniqueInt();
    const title = getUniqueString();
    const author = getUniqueString();
    const items = [
      {
        repo_full_name: repo,
        pr_number: prNumber,
        title,
        author_login: author,
        last_review_state: 'review_approved',
        last_coderabbit_review_at: null,
      },
    ];

    render(<TrackedPrs items={items} headingLevel="h3" />);

    expect(screen.getByRole('heading', { level: 3, name: 'Tracked PRs — 1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${repo} — ${title} (#${prNumber})` })).toHaveAttribute('href', `https://github.com/${repo}/pull/${prNumber}`);
    expect(screen.getByText(author)).toBeInTheDocument();
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
    expect(screen.queryByText('Awaiting review')).not.toBeInTheDocument();
  });

  it('renders the awaiting badge when last_review_state is null', () => {
    const repo = getUniqueGitHubRepoRef().fullName;
    const items = [
      {
        repo_full_name: repo,
        pr_number: getUniqueInt(),
        title: getUniqueString(),
        author_login: getUniqueString(),
        last_review_state: null,
        last_coderabbit_review_at: null,
      },
    ];

    render(<TrackedPrs items={items} headingLevel="h3" />);

    expect(screen.getByText('Awaiting review')).toBeInTheDocument();
    expect(screen.queryByText('Reviewed')).not.toBeInTheDocument();
  });

  it('renders an h2 heading when headingLevel is h2', () => {
    render(<TrackedPrs items={[]} headingLevel="h2" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Tracked PRs — 0' })).toBeInTheDocument();
  });

  describe('collapsible explanation', () => {
    const toggleName = 'Why is this list here?';

    it('shows the toggle collapsed by default with the explanation hidden', () => {
      render(<TrackedPrs items={[]} headingLevel="h3" />);

      expect(screen.getByRole('button', { name: toggleName })).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByText(
          "Open PRs CodeRabbit has not reviewed yet. Rabbit Maximizer only acts once CodeRabbit acknowledges a PR, so these are outside the queue's flow.",
        ),
      ).not.toBeInTheDocument();
    });

    it('expands the explanation on click', () => {
      render(<TrackedPrs items={[]} headingLevel="h3" />);

      fireEvent.click(screen.getByRole('button', { name: toggleName }));

      expect(screen.getByRole('button', { name: toggleName })).toHaveAttribute('aria-expanded', 'true');
      expect(
        screen.getByText(
          "Open PRs CodeRabbit has not reviewed yet. Rabbit Maximizer only acts once CodeRabbit acknowledges a PR, so these are outside the queue's flow.",
        ),
      ).toBeInTheDocument();
    });

    it('collapses the explanation again on a second click', () => {
      render(<TrackedPrs items={[]} headingLevel="h3" />);

      const toggle = screen.getByRole('button', { name: toggleName });
      fireEvent.click(toggle);
      fireEvent.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(
        screen.queryByText(
          "Open PRs CodeRabbit has not reviewed yet. Rabbit Maximizer only acts once CodeRabbit acknowledges a PR, so these are outside the queue's flow.",
        ),
      ).not.toBeInTheDocument();
    });
  });
});
