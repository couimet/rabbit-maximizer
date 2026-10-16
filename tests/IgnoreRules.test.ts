import { IgnoreRuleField } from '../src/domain.js';
import { IgnoreRules } from '../src/services.js';

import { generateConfigData } from './helpers/index.js';

import { getUniqueString } from '@couimet/dynamic-testing';
import { describe, expect, it } from '@jest/globals';

const buildRules = (ignoreAuthors: readonly string[], ignoreTitles: readonly string[]): IgnoreRules =>
  new IgnoreRules(generateConfigData({ IGNORE_AUTHORS: [...ignoreAuthors], IGNORE_TITLES: [...ignoreTitles] }));

describe('IgnoreRules', () => {
  describe('hasRules', () => {
    it('returns false when both lists are empty', () => {
      expect(buildRules([], []).hasRules()).toBe(false);
    });

    it('returns true when only the author list holds a rule', () => {
      expect(buildRules(['renovate'], []).hasRules()).toBe(true);
    });

    it('returns true when only the title list holds a rule', () => {
      expect(buildRules([], ['^chore']).hasRules()).toBe(true);
    });
  });

  describe('match', () => {
    it('returns undefined when no rule matches', () => {
      const result = buildRules(['renovate'], ['^chore']).match({ authorLogin: 'octocat', title: 'Fix the build' });

      expect(result).toBeUndefined();
    });

    it('returns undefined when the rule lists are empty', () => {
      const result = buildRules([], []).match({ authorLogin: 'octocat', title: 'Fix the build' });

      expect(result).toBeUndefined();
    });

    it('matches an author rule anywhere in the login', () => {
      const result = buildRules(['dependabot'], []).match({ authorLogin: 'dependabot[bot]', title: getUniqueString() });

      expect(result).toStrictEqual({ field: 'author', pattern: 'dependabot' });
    });

    it('matches a title rule anywhere in the title', () => {
      const result = buildRules([], ['^chore\\(']).match({ authorLogin: getUniqueString(), title: 'chore(deps): bump lodash' });

      expect(result).toStrictEqual({ field: 'title', pattern: '^chore\\(' });
    });

    it('reports the earlier author rule when both an author rule and a title rule match', () => {
      const result = buildRules(['renovate'], ['renovate']).match({ authorLogin: 'renovate-bot', title: 'renovate the config' });

      expect(result).toStrictEqual({ field: 'author', pattern: 'renovate' });
    });

    it('reports the first author rule when two author rules match', () => {
      const result = buildRules(['renovate', 'bot'], []).match({ authorLogin: 'renovate-bot', title: getUniqueString() });

      expect(result).toStrictEqual({ field: 'author', pattern: 'renovate' });
    });

    it('reports the first title rule when two title rules match', () => {
      const result = buildRules([], ['WIP', 'work in progress']).match({ authorLogin: getUniqueString(), title: 'WIP: work in progress' });

      expect(result).toStrictEqual({ field: 'title', pattern: 'WIP' });
    });

    it('does not confuse the two fields', () => {
      const rules = buildRules(['renovate'], []);

      const authorMatch = rules.match({ authorLogin: 'renovate', title: getUniqueString() });
      const titleMatch = rules.match({ authorLogin: getUniqueString(), title: 'renovate' });

      expect(authorMatch).toStrictEqual({ field: 'author', pattern: 'renovate' });
      expect(titleMatch).toBeUndefined();
    });
  });

  describe('IgnoreRuleField', () => {
    it('has the correct values', () => {
      expect(IgnoreRuleField).toStrictEqual({ author: 'author', title: 'title' });
    });
  });
});
