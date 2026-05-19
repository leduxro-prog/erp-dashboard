export type GoogleAuthConfigResponse = {
  success: boolean;
  enabled: boolean;
  clientId: string;
  policy?: { source?: string; hasAllowedEmails?: boolean; hasAllowedDomains?: boolean };
};

export async function resolveGoogleLoginClientId(
  loadConfig: () => Promise<GoogleAuthConfigResponse>,
): Promise<string> {
  try {
    const config = await loadConfig();
    return config.enabled && config.clientId ? config.clientId : '';
  } catch {
    return '';
  }
}
