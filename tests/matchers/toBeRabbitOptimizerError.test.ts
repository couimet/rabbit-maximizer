import { beforeEach, describe, it, expect } from "@jest/globals";
import { getRandomString } from "@couimet/dynamic-testing";
import { RabbitOptimizerError } from "../../src/errors/RabbitOptimizerError.js";
import { RabbitOptimizerErrorCodes } from "../../src/errors/RabbitOptimizerErrorCodes.js";

import {
  toBeRabbitOptimizerError,
  toThrowRabbitOptimizerError,
  toThrowRabbitOptimizerErrorAsync,
} from "./toBeRabbitOptimizerError.js";

describe("toBeRabbitOptimizerError matcher", () => {
  let msg: string;
  let fn: string;
  let detailKey: string;
  let detailVal: string;

  beforeEach(() => {
    msg = getRandomString();
    fn = getRandomString({ charset: "alpha" });
    detailKey = getRandomString({ charset: "alpha" });
    detailVal = getRandomString();
  });

  describe("negative validation for details", () => {
    it("fails when error has details but expected does not specify it", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: msg,
        functionName: fn,
        details: { [detailKey]: detailVal },
      });

      const result = toBeRabbitOptimizerError(error, "GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        `Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Details: expected undefined, received ${JSON.stringify({ [detailKey]: detailVal })}`,
      );
    });

    it("passes when both error and expected have undefined details", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: msg,
        functionName: fn,
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
      });
    });

    it("passes when expected specifies details and error has matching details", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: msg,
        functionName: fn,
        details: { [detailKey]: detailVal },
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
        details: { [detailKey]: detailVal },
      });
    });
  });

  describe("negative validation for cause", () => {
    it("fails when error has cause but expected does not specify it", () => {
      const causeError = new Error(msg);
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: msg,
        functionName: fn,
        cause: causeError,
      });

      const result = toBeRabbitOptimizerError(error, "GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        `Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Cause: expected undefined, received error with message "${msg}"`,
      );
    });

    it("passes when both error and expected have undefined cause", () => {
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: msg,
        functionName: fn,
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
      });
    });

    it("passes when expected specifies cause and error has matching cause", () => {
      const causeError = new Error(msg);
      const error = new RabbitOptimizerError({
        code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
        message: msg,
        functionName: fn,
        cause: causeError,
      });

      expect(error).toBeRabbitOptimizerError("GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
        cause: causeError,
      });
    });
  });
});

describe("toThrowRabbitOptimizerError matcher", () => {
  let msg: string;
  let fn: string;
  let detailKey: string;
  let detailVal: string;

  beforeEach(() => {
    msg = getRandomString();
    fn = getRandomString({ charset: "alpha" });
    detailKey = getRandomString({ charset: "alpha" });
    detailVal = getRandomString();
  });

  describe("negative validation for details", () => {
    it("fails when thrown error has details but expected does not specify it", () => {
      const throwFn = () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: msg,
          functionName: fn,
          details: { [detailKey]: detailVal },
        });
      };

      const result = toThrowRabbitOptimizerError(throwFn, "GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        `Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Details: expected undefined, received ${JSON.stringify({ [detailKey]: detailVal })}`,
      );
    });
  });

  describe("negative validation for cause", () => {
    it("fails when thrown error has cause but expected does not specify it", () => {
      const causeError = new Error(msg);
      const throwFn = () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: msg,
          functionName: fn,
          cause: causeError,
        });
      };

      const result = toThrowRabbitOptimizerError(throwFn, "GITHUB_API_ERROR", {
        message: msg,
        functionName: fn,
      });

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        `Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Cause: expected undefined, received error with message "${msg}"`,
      );
    });
  });
});

describe("toThrowRabbitOptimizerErrorAsync matcher", () => {
  let msg: string;
  let fn: string;
  let detailKey: string;
  let detailVal: string;

  beforeEach(() => {
    msg = getRandomString();
    fn = getRandomString({ charset: "alpha" });
    detailKey = getRandomString({ charset: "alpha" });
    detailVal = getRandomString();
  });

  describe("negative validation for details", () => {
    it("fails when thrown error has details but expected does not specify it", async () => {
      const throwFn = async () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: msg,
          functionName: fn,
          details: { [detailKey]: detailVal },
        });
      };

      const result = await toThrowRabbitOptimizerErrorAsync(
        throwFn,
        "GITHUB_API_ERROR",
        {
          message: msg,
          functionName: fn,
        },
      );

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        `Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Details: expected undefined, received ${JSON.stringify({ [detailKey]: detailVal })}`,
      );
    });
  });

  describe("negative validation for cause", () => {
    it("fails when thrown error has cause but expected does not specify it", async () => {
      const causeError = new Error(msg);
      const throwFn = async () => {
        throw new RabbitOptimizerError({
          code: RabbitOptimizerErrorCodes.GITHUB_API_ERROR,
          message: msg,
          functionName: fn,
          cause: causeError,
        });
      };

      const result = await toThrowRabbitOptimizerErrorAsync(
        throwFn,
        "GITHUB_API_ERROR",
        {
          message: msg,
          functionName: fn,
        },
      );

      expect(result.pass).toBe(false);
      expect(result.message()).toBe(
        `Expected RabbitOptimizerError("GITHUB_API_ERROR") to match:\n  Cause: expected undefined, received error with message "${msg}"`,
      );
    });
  });
});
