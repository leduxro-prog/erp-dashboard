import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { UserEntity } from '../../domain/entities/UserEntity';
import { Repository } from 'typeorm';

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export class TwoFactorAuthService {
  private static readonly BACKUP_CODE_HASH_PREFIX = 'sha256:';
  private static readonly SECRET_ENCRYPTION_PREFIX = 'enc:v1:';

  constructor(private readonly userRepository: Repository<UserEntity>) {
    // TOTP verification window: number of steps to check before/after current step.
    // Default 1 (allows 30s drift). Configurable via TWOFA_WINDOW env var.
    const totpWindow = parseInt(process.env.TWOFA_WINDOW || '1', 10);
    authenticator.options = {
      window: Math.max(0, Math.min(totpWindow, 5)), // Clamp between 0 and 5
    };
  }

  /**
   * Generate a new 2FA secret for a user
   */
  async generateSecret(user: UserEntity): Promise<TwoFactorSetupResponse> {
    const secret = authenticator.generateSecret();
    const appName = process.env.TWOFA_ISSUER || 'Cypher ERP';
    const otpauthUrl = authenticator.keyuri(user.email, appName, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
    };
  }

  /**
   * Verify a TOTP token against a secret
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      const resolvedSecret = this.resolveSecretForVerification(secret);

      return authenticator.verify({
        token,
        secret: resolvedSecret,
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Enable 2FA for a user after successful verification
   */
  async enable2FA(userId: number, secret: string, backupCodes: string[]): Promise<void> {
    const hashedBackupCodes = backupCodes.map((code) => this.hashBackupCode(code));
    const secretToStore = this.encryptSecret(secret);

    await this.userRepository.update(userId, {
      twofa_enabled: true,
      twofa_secret: secretToStore,
      twofa_backup_codes: hashedBackupCodes,
    });
  }

  /**
   * Disable 2FA for a user
   */
  async disable2FA(userId: number): Promise<void> {
    await this.userRepository.update(userId, {
      twofa_enabled: false,
      twofa_secret: undefined,
      twofa_backup_codes: undefined,
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase()); // e.g., 8A2B3C4D
    }
    return codes;
  }

  /**
   * Verify a backup code
   */
  async verifyBackupCode(user: UserEntity, code: string): Promise<boolean> {
    if (!user.twofa_backup_codes || user.twofa_backup_codes.length === 0) {
      return false;
    }

    const index = user.twofa_backup_codes.findIndex((storedCode) =>
      this.matchesBackupCode(storedCode, code),
    );

    if (index !== -1) {
      const remainingCodes = [...user.twofa_backup_codes];
      remainingCodes.splice(index, 1);

      const normalizedRemainingCodes = remainingCodes.map((storedCode) =>
        this.isHashedBackupCode(storedCode) ? storedCode : this.hashBackupCode(storedCode),
      );

      await this.userRepository.update(user.id, {
        twofa_backup_codes: normalizedRemainingCodes,
      });

      return true;
    }

    return false;
  }

  private normalizeBackupCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private hashBackupCode(code: string): string {
    const normalizedCode = this.normalizeBackupCode(code);
    const digest = crypto.createHash('sha256').update(normalizedCode).digest('hex');
    return `${TwoFactorAuthService.BACKUP_CODE_HASH_PREFIX}${digest}`;
  }

  private isHashedBackupCode(code: string): boolean {
    return code.startsWith(TwoFactorAuthService.BACKUP_CODE_HASH_PREFIX);
  }

  private matchesBackupCode(storedCode: string, inputCode: string): boolean {
    if (this.isHashedBackupCode(storedCode)) {
      const expected = this.hashBackupCode(inputCode);
      const storedBuffer = Buffer.from(storedCode, 'utf8');
      const expectedBuffer = Buffer.from(expected, 'utf8');

      if (storedBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(storedBuffer, expectedBuffer);
    }

    return storedCode === this.normalizeBackupCode(inputCode);
  }

  private getSecretEncryptionKey(): Buffer | null {
    const keyMaterial = process.env.TWOFA_SECRET_ENCRYPTION_KEY || process.env.JWT_SECRET;

    if (!keyMaterial) {
      return null;
    }

    return crypto.createHash('sha256').update(keyMaterial).digest();
  }

  private encryptSecret(secret: string): string {
    const key = this.getSecretEncryptionKey();

    if (!key) {
      return secret;
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${TwoFactorAuthService.SECRET_ENCRYPTION_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptSecret(secret: string): string {
    const key = this.getSecretEncryptionKey();

    if (!key) {
      throw new Error('2FA secret encryption key is missing');
    }

    const payload = secret.slice(TwoFactorAuthService.SECRET_ENCRYPTION_PREFIX.length);
    const [ivHex, authTagHex, encryptedHex] = payload.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Invalid encrypted 2FA secret format');
    }

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private resolveSecretForVerification(secret: string): string {
    if (!secret.startsWith(TwoFactorAuthService.SECRET_ENCRYPTION_PREFIX)) {
      return secret;
    }

    return this.decryptSecret(secret);
  }
}
