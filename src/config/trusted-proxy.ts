const namedRanges: Record<string, string[]> = {
  loopback: ['127.0.0.1/32'],
  linklocal: ['169.254.0.0/16'],
  uniquelocal: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
};

function isBareIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d+$/.test(part)) {
      return false;
    }
    const octet = Number(part);
    return octet >= 0 && octet <= 255;
  });
}

function normalizeBareIpEntry(value: string): string[] {
  if (isBareIpv4(value)) {
    return [`${value}/32`];
  }

  if (value.includes(':')) {
    return [`${value}/128`];
  }

  return [];
}

export function parseTrustedProxyCidrs(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .flatMap((entry) => {
      if (entry.includes('/')) {
        return [entry];
      }

      if (namedRanges[entry]) {
        return namedRanges[entry];
      }

      return normalizeBareIpEntry(entry);
    });
}
