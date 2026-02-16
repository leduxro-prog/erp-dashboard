import { GoogleGenerativeAI } from '@google/generative-ai';
import { createModuleLogger } from '../../../shared/utils/logger';

export class AiService {
  private logger = createModuleLogger('AiService');
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined');
      throw new Error('GEMINI_API_KEY is not defined');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async chat(message: string, context: string): Promise<string> {
    try {
      this.logger.info('Generating chat response');
      const safeMessage = String(message).slice(0, 2000);
      const safeContext = String(context || '').slice(0, 8000);

      const prompt = `
        You are a helpful AI assistant for the Cypher ERP system.
        Use the following context to answer the user's question.
        If the answer is not in the context, use your general knowledge but mention that it might not be specific to the current data.
        
        Context:
        ${safeContext}
        
        User Question: ${safeMessage}
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Error generating chat response', error);
      throw new Error('Failed to generate chat response');
    }
  }

  async analyzeCrmData(clients: any[]): Promise<string[]> {
    try {
      this.logger.info(`Analyzing CRM data for ${clients.length} clients`);

      const sanitizedClients = clients
        .slice(0, 200)
        .map((client) => this.sanitizeClientForPrompt(client));

      const prompt = `
        Analyze the following CRM client list: ${JSON.stringify(sanitizedClients)}.
        Identify 3 strategic opportunities or priority actions.
        Focus on: valuable clients who haven't been contacted recently, promising leads, or inactive clients who can be reactivated.
        Respond strictly with a list of 3 short and concise bullet points in Romanian, separated by the "|" character. Do not use numbering.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      return text
        .split('|')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 5);
    } catch (error) {
      this.logger.error('Error analyzing CRM data', error);
      return ['Nu am putut genera sugestii relevante momentan.'];
    }
  }

  private sanitizeClientForPrompt(client: Record<string, any>): Record<string, any> {
    return {
      id: client?.id,
      segment: client?.segment,
      totalOrders: client?.totalOrders,
      totalRevenue: client?.totalRevenue,
      status: client?.status,
      lastContactAt: client?.lastContactAt,
      lastOrderAt: client?.lastOrderAt,
      leadScore: client?.leadScore,
      isActive: client?.isActive,
    };
  }
}
