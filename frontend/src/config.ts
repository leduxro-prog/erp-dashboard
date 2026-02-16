/// <reference types="vite/client" />

export const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const WS_URL = import.meta.env.VITE_WS_URL ||
    ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host);

export const AI_API_URL = import.meta.env.VITE_AI_API_URL || '/api/v1/ai-assistant';
