import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const postMock = jest.fn<(...args: any[]) => Promise<any>>();
const setTokenMock = jest.fn<(...args: any[]) => void>();
const setUserMock = jest.fn<(...args: any[]) => void>();

jest.mock('../api', () => ({
  apiClient: {
    post: postMock,
    setToken: setTokenMock,
  },
}));

jest.mock('../../stores/auth.store', () => ({
  useAuthStore: {
    getState: () => ({
      setUser: setUserMock,
    }),
  },
}));

import authService from '../auth.service';

describe('authService Google avatar mapping', () => {
  beforeEach(() => {
    postMock.mockReset();
    setTokenMock.mockReset();
    setUserMock.mockReset();
  });

  it('maps avatar_url into the auth store when avatar is missing', async () => {
    postMock.mockResolvedValue({
      user: {
        id: '1',
        email: 'user@example.com',
        first_name: 'Test',
        last_name: 'User',
        role: 'admin',
        avatar_url: 'https://example.com/avatar.png',
      },
      token: 'token',
      refreshToken: 'refresh',
    });

    await authService.loginWithGoogleAccessToken('google-access-token');

    expect(setUserMock).toHaveBeenCalledWith({
      id: '1',
      email: 'user@example.com',
      name: 'Test User',
      avatar: 'https://example.com/avatar.png',
      role: 'admin',
      permissions: [],
    });
  });
});
