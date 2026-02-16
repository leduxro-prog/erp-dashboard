import { useState } from 'react';
import axios from 'axios';

export interface CrmClient {
    id: number;
    name: string;
    email: string;
    segment: string;
    ltv: number;
    last_order: string;
    status: string;
}

export const useAi = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const chat = async (message: string, context?: string): Promise<string | null> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post('/api/v1/ai-assistant/chat', { message, context });
            return response.data.response;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error communicating with AI');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const analyzeCrm = async (clients: CrmClient[]): Promise<string[]> => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await axios.post('/api/v1/ai-assistant/analyze-crm', { clients });
            return response.data.suggestions;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error analyzing CRM data');
            return [];
        } finally {
            setIsLoading(false);
        }
    };

    return { chat, analyzeCrm, isLoading, error };
};
