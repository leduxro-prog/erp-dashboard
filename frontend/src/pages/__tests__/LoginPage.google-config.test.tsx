import { describe, expect, it, jest } from '@jest/globals';

import { resolveGoogleLoginClientId } from '../loginPage.google-config';

describe('resolveGoogleLoginClientId', () => {
  it('returns the backend client id when google auth is enabled', async () => {
    const loadConfig = jest.fn<() => Promise<any>>().mockResolvedValue({
      success: true,
      enabled: true,
      clientId: 'google-client-id',
    });

    await expect(resolveGoogleLoginClientId(loadConfig)).resolves.toBe('google-client-id');
  });

  it('returns empty when google auth is disabled', async () => {
    const loadConfig = jest.fn<() => Promise<any>>().mockResolvedValue({
      success: true,
      enabled: false,
      clientId: '',
    });

    await expect(resolveGoogleLoginClientId(loadConfig)).resolves.toBe('');
  });

  it('returns empty when loading google config fails', async () => {
    const loadConfig = jest.fn<() => Promise<any>>().mockRejectedValue(new Error('network error'));

    await expect(resolveGoogleLoginClientId(loadConfig)).resolves.toBe('');
  });
});
