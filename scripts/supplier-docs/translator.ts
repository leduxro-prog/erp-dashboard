import { copyFile } from 'node:fs/promises';
import path from 'node:path';

export interface TranslatorAdapter {
  translate(filePath: string, fromLang: string, toLang: string): Promise<string | null>;
}

export interface AutoTranslatorOptions {
  translateFile?: (
    sourcePath: string,
    translatedPath: string,
    fromLang: string,
    toLang: string,
  ) => Promise<void>;
}

export class AutoTranslatorAdapter implements TranslatorAdapter {
  private readonly translateFile: Required<AutoTranslatorOptions>['translateFile'];

  constructor(options: AutoTranslatorOptions = {}) {
    this.translateFile = options.translateFile ?? defaultTranslateFile;
  }

  async translate(filePath: string, fromLang: string, toLang: string): Promise<string | null> {
    const translatedPath = path.join(path.dirname(filePath), buildTranslatedName(path.basename(filePath)));

    try {
      await this.translateFile(filePath, translatedPath, fromLang, toLang);
      return translatedPath;
    } catch {
      return null;
    }
  }
}

export function buildTranslatedName(fileName: string): string {
  const parsed = path.parse(fileName);
  return parsed.ext ? `${parsed.name}-ro-auto${parsed.ext}` : `${parsed.name}-ro-auto`;
}

async function defaultTranslateFile(sourcePath: string, translatedPath: string): Promise<void> {
  await copyFile(sourcePath, translatedPath);
}
