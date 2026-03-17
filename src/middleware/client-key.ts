import { Request } from 'express';
import crypto from 'crypto';

export interface ClientKeyConfig {
  trustedProxyCidrs?: string[];
}

function normalizeIp(raw?: string): string {
  if (!raw) {
    return 'unknown';
  }

  const withoutPort = raw.replace(/^\[|\]$/g, '').split(':').length > 2 ? raw : raw.split(':')[0];
  const trimmed = withoutPort.trim();
  if (trimmed.startsWith('::ffff:')) {
    return trimmed.slice(7);
  }
  return trimmed;
}

function toIpv4Int(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return null;
  }

  return (((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3]) >>> 0;
}

function matchesCidr(ip: string, cidr: string): boolean {
  const [range, maskBitsRaw] = cidr.split('/');
  const maskBits = Number(maskBitsRaw);
  if (!range || Number.isNaN(maskBits) || maskBits < 0 || maskBits > 32) {
    return false;
  }

  const ipInt = toIpv4Int(ip);
  const rangeInt = toIpv4Int(range);
  if (ipInt === null || rangeInt === null) {
    return false;
  }

  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function isTrustedProxyIp(ip: string, trustedCidrs: string[]): boolean {
  if (trustedCidrs.length === 0) {
    return false;
  }
  return trustedCidrs.some((cidr) => matchesCidr(ip, cidr));
}

function firstForwardedIp(req: Request): string | null {
  const header = req.headers['x-forwarded-for'];
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) {
    return null;
  }

  const [first] = value.split(',');
  if (!first) {
    return null;
  }

  return normalizeIp(first);
}

function getRemoteIp(req: Request): string {
  return normalizeIp(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress);
}

export function extractClientIp(req: Request, cfg: ClientKeyConfig = {}): string {
  const trustedCidrs = cfg.trustedProxyCidrs ?? [];
  const remoteIp = getRemoteIp(req);

  if (!isTrustedProxyIp(remoteIp, trustedCidrs)) {
    return remoteIp;
  }

  return firstForwardedIp(req) || remoteIp;
}

export function extractClientKey(req: Request, cfg: ClientKeyConfig = {}): string {
  return extractClientIp(req, cfg);
}

export function hashClientKey(clientKey: string): string {
  return crypto.createHash('sha256').update(clientKey).digest('hex').slice(0, 24);
}
