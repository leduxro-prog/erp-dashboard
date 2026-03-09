import { describe, expect, it, jest } from '@jest/globals';

const loggerMock = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/utils/logger', () => ({
  createModuleLogger: () => loggerMock,
}));

import { AiService } from './AiService';

describe('AiService', () => {
  it('throws missing key error without error-level log noise', () => {
    expect(() => new AiService('')).toThrow('GEMINI_API_KEY is not defined');
    expect(loggerMock.warn).toHaveBeenCalledWith('GEMINI_API_KEY is not defined');
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});
