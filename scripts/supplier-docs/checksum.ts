import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export async function computeFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve();
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });

  return hash.digest('hex');
}
