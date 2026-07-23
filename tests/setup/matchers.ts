import '@couimet/detailed-error-testing/setup';
import '@testing-library/jest-dom';
import { afterEach, jest } from '@jest/globals';

afterEach(() => {
  jest.useRealTimers();
});
