import { jest } from "@jest/globals";

export const createResolvedMock = (value: any): jest.Mock<any> =>
  jest.fn<any>().mockResolvedValue(value);
