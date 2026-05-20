import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');
const b2bApiPath = path.join(projectRoot, 'frontend/src/services/b2b-api.ts');

describe('B2B API refresh recursion policy', () => {
  it('uses a dedicated refresh client instead of the interceptor-backed API client', () => {
    const source = fs.readFileSync(b2bApiPath, 'utf8');

    expect(source).toContain('private refreshClient: AxiosInstance');
    expect(source).toContain('this.refreshClient = axios.create');
    expect(source).toContain('this.refreshClient.post');
    expect(source).not.toContain("this.client.post('/b2b-auth/refresh'");
  });

  it('guards retried 401 responses to avoid refresh loops', () => {
    const source = fs.readFileSync(b2bApiPath, 'utf8');

    expect(source).toContain('_retry');
    expect(source).toContain("includes('/b2b-auth/refresh')");
  });
});
