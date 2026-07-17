import { EventCountsMapper } from '../../src/mappers/EventCountsMapper.js';

import { describe, expect, it } from '@jest/globals';

describe('EventCountsMapper', () => {
  const mapper = new EventCountsMapper();

  describe('mapToResponse', () => {
    it('maps known active event types from input', () => {
      const result = mapper.mapToResponse({
        detected: 8,
        enqueued: 7,
        retriggered: 3,
        bypassed: 2,
        coderabbit_review_approved: 1,
        coderabbit_review_changes_requested: 1,
        failed: 1,
      });

      expect(result).toStrictEqual({ detected: 8, enqueued: 7, retriggered: 3, failed: 1 });
    });

    it('returns zero for absent active keys', () => {
      const result = mapper.mapToResponse({ detected: 1, enqueued: 2 });

      expect(result).toStrictEqual({ detected: 1, enqueued: 2, retriggered: 0, failed: 0 });
    });

    it('returns zero for all active keys when only deprecated types are present', () => {
      const result = mapper.mapToResponse({ bypassed: 5, coderabbit_review_approved: 2, coderabbit_review_changes_requested: 1 });

      expect(result).toStrictEqual({ detected: 0, enqueued: 0, retriggered: 0, failed: 0 });
    });

    it('returns zero for all keys on empty input', () => {
      const result = mapper.mapToResponse({});

      expect(result).toStrictEqual({ detected: 0, enqueued: 0, retriggered: 0, failed: 0 });
    });
  });
});
