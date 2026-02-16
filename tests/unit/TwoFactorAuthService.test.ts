import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { TwoFactorAuthService } from '../../modules/users/src/application/services/TwoFactorAuthService';

// Mock otplib
jest.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: jest.fn(),
    keyuri: jest.fn(),
    verify: jest.fn(),
  },
}));

// Mock qrcode
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('TwoFactorAuthService', () => {
  let service: TwoFactorAuthService;
  let mockUserRepository: any;
  const originalTwofaKey = process.env.TWOFA_SECRET_ENCRYPTION_KEY;

  const mockUser = {
    id: 1,
    email: 'alice@example.com',
    first_name: 'Alice',
    last_name: 'Smith',
    role: 'admin',
    twofa_enabled: false,
    twofa_secret: undefined as string | undefined,
    twofa_backup_codes: undefined as string[] | undefined,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TWOFA_SECRET_ENCRYPTION_KEY = 'unit-test-twofa-key';
    mockUserRepository = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn(),
    };
    service = new TwoFactorAuthService(mockUserRepository);
  });

  afterAll(() => {
    if (originalTwofaKey === undefined) {
      delete process.env.TWOFA_SECRET_ENCRYPTION_KEY;
    } else {
      process.env.TWOFA_SECRET_ENCRYPTION_KEY = originalTwofaKey;
    }
  });

  // ── generateSecret ────────────────────────────────────────────────

  describe('generateSecret', () => {
    it('returns an object with secret, otpauthUrl, and qrCodeDataUrl', async () => {
      (authenticator.generateSecret as jest.Mock).mockReturnValue('JBSWY3DPEHPK3PXP');
      (authenticator.keyuri as jest.Mock).mockReturnValue(
        'otpauth://totp/CypherERP:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=CypherERP',
      );
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,QRDATA');

      const result = await service.generateSecret(mockUser as any);

      expect(result).toHaveProperty('secret', 'JBSWY3DPEHPK3PXP');
      expect(result).toHaveProperty('otpauthUrl');
      expect(result).toHaveProperty('qrCodeDataUrl', 'data:image/png;base64,QRDATA');
    });

    it('calls authenticator.generateSecret to produce the secret', async () => {
      (authenticator.generateSecret as jest.Mock).mockReturnValue('SECRET123');
      (authenticator.keyuri as jest.Mock).mockReturnValue('otpauth://...');
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:...');

      await service.generateSecret(mockUser as any);
      expect(authenticator.generateSecret).toHaveBeenCalledTimes(1);
    });

    it('passes user email and app name to keyuri', async () => {
      (authenticator.generateSecret as jest.Mock).mockReturnValue('S');
      (authenticator.keyuri as jest.Mock).mockReturnValue('otpauth://...');
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:...');

      await service.generateSecret(mockUser as any);
      expect(authenticator.keyuri).toHaveBeenCalledWith(mockUser.email, expect.any(String), 'S');
    });

    it('generates a QR code from the otpauth URL', async () => {
      const otpauthUrl = 'otpauth://totp/App:user@test.com?secret=XYZ';
      (authenticator.generateSecret as jest.Mock).mockReturnValue('XYZ');
      (authenticator.keyuri as jest.Mock).mockReturnValue(otpauthUrl);
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,QR');

      await service.generateSecret(mockUser as any);
      expect(QRCode.toDataURL).toHaveBeenCalledWith(otpauthUrl);
    });
  });

  // ── verifyToken ───────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('returns true when the token is valid', () => {
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      expect(service.verifyToken('123456', 'SECRET')).toBe(true);
    });

    it('passes correct token and secret to authenticator.verify', () => {
      (authenticator.verify as jest.Mock).mockReturnValue(true);
      service.verifyToken('654321', 'MYSECRET');
      expect(authenticator.verify).toHaveBeenCalledWith({
        token: '654321',
        secret: 'MYSECRET',
      });
    });

    it('returns false when the token is invalid', () => {
      (authenticator.verify as jest.Mock).mockReturnValue(false);
      expect(service.verifyToken('000000', 'SECRET')).toBe(false);
    });

    it('returns false when authenticator.verify throws', () => {
      (authenticator.verify as jest.Mock).mockImplementation(() => {
        throw new Error('invalid token');
      });
      expect(service.verifyToken('bad', 'SECRET')).toBe(false);
    });
  });

  // ── enable2FA ─────────────────────────────────────────────────────

  describe('enable2FA', () => {
    it('stores encrypted secret and hashed backup codes when enabling 2FA', async () => {
      const codes = ['CODE1', 'CODE2'];
      await service.enable2FA(42, 'SECRET', codes);

      const updatePayload = (mockUserRepository.update as jest.Mock).mock.calls[0][1];

      expect(mockUserRepository.update).toHaveBeenCalledWith(42, {
        twofa_enabled: true,
        twofa_secret: expect.any(String),
        twofa_backup_codes: expect.any(Array),
      });
      expect(updatePayload.twofa_secret).toMatch(/^enc:v1:/);
      expect(updatePayload.twofa_secret).not.toBe('SECRET');
      expect(updatePayload.twofa_backup_codes).toHaveLength(2);
      expect(updatePayload.twofa_backup_codes[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(updatePayload.twofa_backup_codes[1]).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(updatePayload.twofa_backup_codes).not.toEqual(codes);
    });
  });

  describe('encrypted secret verification', () => {
    it('decrypts encrypted secrets before calling authenticator.verify', async () => {
      (authenticator.verify as jest.Mock).mockReturnValue(true);

      await service.enable2FA(5, 'MYSECRET', ['AAAA1111']);
      const encryptedSecret = (mockUserRepository.update as jest.Mock).mock.calls[0][1]
        .twofa_secret;

      const result = service.verifyToken('123456', encryptedSecret);

      expect(result).toBe(true);
      expect(authenticator.verify).toHaveBeenCalledWith({ token: '123456', secret: 'MYSECRET' });
    });
  });

  // ── disable2FA ────────────────────────────────────────────────────

  describe('disable2FA', () => {
    it('clears 2FA fields on the user entity', async () => {
      await service.disable2FA(99);
      expect(mockUserRepository.update).toHaveBeenCalledWith(99, {
        twofa_enabled: false,
        twofa_secret: undefined,
        twofa_backup_codes: undefined,
      });
    });
  });

  // ── generateBackupCodes ───────────────────────────────────────────

  describe('generateBackupCodes', () => {
    it('returns an array with the default count (10)', () => {
      const codes = service.generateBackupCodes();
      expect(codes).toHaveLength(10);
    });

    it('respects a custom count', () => {
      const codes = service.generateBackupCodes(5);
      expect(codes).toHaveLength(5);
    });

    it('generates unique codes (no duplicates in reasonable set)', () => {
      // With 4 random bytes the collision space is 2^32; duplicates are astronomically unlikely
      const codes = service.generateBackupCodes(50);
      const unique = new Set(codes);
      expect(unique.size).toBe(codes.length);
    });

    it('produces uppercase hex strings of 8 characters', () => {
      const codes = service.generateBackupCodes(20);
      for (const code of codes) {
        expect(code).toMatch(/^[0-9A-F]{8}$/);
      }
    });

    it('returns strings (not buffers)', () => {
      const codes = service.generateBackupCodes();
      for (const code of codes) {
        expect(typeof code).toBe('string');
      }
    });
  });

  // ── verifyBackupCode ──────────────────────────────────────────────

  describe('verifyBackupCode', () => {
    it('returns true and removes the code when legacy plaintext code matches', async () => {
      const user = {
        ...mockUser,
        id: 7,
        twofa_backup_codes: ['AAAA1111', 'BBBB2222', 'CCCC3333'],
      };

      const result = await service.verifyBackupCode(user as any, 'BBBB2222');
      expect(result).toBe(true);

      const updatedCodes = (mockUserRepository.update as jest.Mock).mock.calls[0][1]
        .twofa_backup_codes;
      expect(updatedCodes).toHaveLength(2);
      expect(updatedCodes[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(updatedCodes[1]).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('returns true and removes the code when hashed code matches', async () => {
      const hash = (code: string) =>
        `sha256:${crypto.createHash('sha256').update(code).digest('hex')}`;
      const user = {
        ...mockUser,
        id: 8,
        twofa_backup_codes: [hash('AAAA1111'), hash('BBBB2222')],
      };

      const result = await service.verifyBackupCode(user as any, 'AAAA1111');
      expect(result).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(8, {
        twofa_backup_codes: [hash('BBBB2222')],
      });
    });

    it('returns false when the code does not match', async () => {
      const user = {
        ...mockUser,
        twofa_backup_codes: ['AAAA1111'],
      };
      const result = await service.verifyBackupCode(user as any, 'WRONG');
      expect(result).toBe(false);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('returns false when backup_codes is empty', async () => {
      const user = { ...mockUser, twofa_backup_codes: [] };
      const result = await service.verifyBackupCode(user as any, 'AAAA1111');
      expect(result).toBe(false);
    });

    it('returns false when backup_codes is undefined', async () => {
      const user = { ...mockUser, twofa_backup_codes: undefined };
      const result = await service.verifyBackupCode(user as any, 'AAAA1111');
      expect(result).toBe(false);
    });
  });
});
