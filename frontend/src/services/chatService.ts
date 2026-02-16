import axios from 'axios';
import { AI_API_URL } from '../config';


export interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: Date;
}

export interface ChatResponse {
    response: string;
    session_id?: string;
}

class ChatService {
    private sessionId: string | null = null;

    async sendMessage(message: string): Promise<string> {
        try {
            const response = await axios.post<ChatResponse>(`${AI_API_URL}/chatbot/chat`, {
                message,
                session_id: this.sessionId,
            });

            if (response.data.session_id) {
                this.sessionId = response.data.session_id;
            }

            return response.data.response;
        } catch (error) {
            console.error('Error sending message:', error);
            throw new Error('Failed to send message to AI agent');
        }
    }

    clearSession() {
        this.sessionId = null;
    }
}

export const chatService = new ChatService();
