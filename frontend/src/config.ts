/// <reference types="vite/client" />

const normalizeUrl = (url: string): string => (url.endsWith('/') ? url.slice(0, -1) : url);

const resolvedApiUrl = import.meta.env.VITE_API_URL || '/api/v1';
const resolvedAiApiUrl = import.meta.env.VITE_AI_API_URL || '/api/v1/ai-assistant';

export const API_URL = normalizeUrl(resolvedApiUrl);

export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host;

export const AI_API_URL = normalizeUrl(resolvedAiApiUrl);
