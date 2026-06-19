import { RabbitOptimizerError } from "../../src/errors/RabbitOptimizerError.js";
import { RabbitOptimizerErrorCodes } from "../../src/errors/RabbitOptimizerErrorCodes.js";

import {
  toBeRabbitOptimizerError,
  toThrowRabbitOptimizerError,
  toThrowRabbitOptimizerErrorAsync,
} from "./toBeRabbitOptimizerError.js";

describe("toBeRabbitOptimizerError matcher", () => {
  describe("negative validation for details", () => {
    it("fails when error has details but expected does not specify it", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: "Test error",
        functionName: "testFn",
        details: { key: "value" },
      });

      const result = toBeRabbitOptimizerError(error, "GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        'Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Details: expected undefined, received {"key":"value"}',
      );
    });

    it("passes when both error and expected have undefined details", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: "Test error",
        functionName: "testFn",
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
      });
    });

    it("passes when expected specifies details and error has matching details", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: "Test error",
        functionName: "testFn",
        details: { key: "value" },
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
        details: { key: "value" },
      });
    });
  });

  describe("negative validation for cause", () => {
    it("fails when error has cause but expected does not specify it", () => {
      const causeError = new Error("Original error");
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: "Test error",
        functionName: "testFn",
        cause: causeError,
      });

      const result = toBeRabbitOptimizerError(error, "GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        'Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Cause: expected undefined, received error with message "Original error"',
      );
    });

    it("passes when both error and expected have undefined cause", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: "Test error",
        functionName: "testFn",
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
      });
    });

    it("passes when expected specifies cause and error has matching cause", () => {
      const causeError = new Error("Original error");
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: "Test error",
        functionName: "testFn",
        cause: causeError,
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
        cause: causeError,
      });
    });
  });
});

describe("toThrowRabbitOptimizerError matcher", () => {
  describe("negative validation for details", () => {
    it("fails when thrown error has details but expected does not specify it", () => {
      const throwFn = () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: "Test error",
          functionName: "testFn",
          details: { key: "value" },
        });
      };

      const result = toThrowRabbitOptimizerError(throwFn, "GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        'Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Details: expected undefined, received {"key":"value"}',
      );
    });
  });

  describe("negative validation for cause", () => {
    it("fails when thrown error has cause but expected does not specify it", () => {
      const causeError = new Error("Original error");
      const throwFn = () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: "Test error",
          functionName: "testFn",
          cause: causeError,
        });
      };

      const result = toThrowRabbitOptimizerError(throwFn, "GITHUB_API_ERROR", {
        message: "Test error",
        functionName: "testFn",
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        'Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Cause: expected undefined, received error with message "Original error"',
      );
    });
  });
});

describe("toThrowRabbitOptimizerErrorAsync matcher", () => {
  describe("negative validation for details", () => {
    it("fails when thrown error has details but expected does not specify it", async () => {
      const throwFn = async () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: "Test error",
          functionName: "testFn",
          details: { key: "value" },
        });
      };

      const result = await toThrowRabbitOptimizerErrorAsync(
        throwFn,
        "GITHUB_API_ERROR",
        {
          message: "Test error",
          functionName: "testFn",
        },
      );

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        'Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Details: expected undefined, received {"key":"value"}',
      );
    });
  });

  describe("negative validation for cause", () => {
    it("fails when thrown error has cause but expected does not specify it", async () => {
      const causeError = new Error("Original error");
      const throwFn = async () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: "Test error",
          functionName: "testFn",
          cause: causeError,
        });
      };

      const result = await toThrowRabbitOptimizerErrorAsync(
        throwFn,
        "GITHUB_API_ERROR",
        {
          message: "Test error",
          functionName: "testFn",
        },
      );

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        'Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Cause: expected undefined, received error with message "Original error"',
      );
    });
  });
});
