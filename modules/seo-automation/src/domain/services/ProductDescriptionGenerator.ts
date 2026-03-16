import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { Logger } from 'winston';

export interface ProductContext {
  name: string;
  category?: string;
  brand?: string;
  specs: Record<string, any>;
}

/**
 * AI Product Description Generator
 * Uses Gemini 2.0 to generate rich, SEO-optimized Romanian descriptions for lighting products.
 */
export class ProductDescriptionGenerator {
  private model: GenerativeModel;

  constructor(
    apiKey: string,
    private readonly logger: Logger
  ) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  /**
   * Generate a professional product description in Romanian
   */
  async generateDescription(product: ProductContext): Promise<string> {
    try {
      this.logger.info(`Generating AI description for product: ${product.name}`);

      const prompt = `
        Ești un expert în copywriting pentru e-commerce specializat pe domeniul iluminatului LED și echipamentelor electrice pentru site-ul Ledux.ro.
        Generează o descriere profesională, convingătoare și optimizată SEO pentru următorul produs:
        
        Nume Produs: ${product.name}
        Categorie: ${product.category || 'Iluminat LED'}
        Brand: ${product.brand || 'Ledux'}
        Specificații Tehnice: ${JSON.stringify(product.specs)}
        
        Cerințe:
        1. Limba: Română (profesională, fără greșeli).
        2. Lungime: Aproximativ 150-250 cuvinte.
        3. Structură: Introducere captivantă, beneficii cheie, detalii despre montaj/utilizare și o concluzie.
        4. Ton: Autoritar, de încredere, tehnic dar accesibil.
        5. Evită clișeele exagerate. Concentrează-te pe eficiență energetică, durabilitate și calitatea luminii.
        
        Răspunde DOAR cu textul descrierii, fără alte comentarii.
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text().trim();
    } catch (error) {
      this.logger.error('Failed to generate product description', {
        productName: product.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('AI Description generation failed');
    }
  }
}
