import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Module page smoke coverage', () => {
  it('keeps target frontend routes wired in the main app shell', () => {
    const appSource = read(path.join(projectRoot, 'frontend/src/App.tsx'));

    expect(appSource).toContain('path="checkout"');
    expect(appSource).toContain('path="configurators/*"');
    expect(appSource).toContain('path="marketing/*"');
    expect(appSource).toContain('path="hr/*"');
  });

  it('keeps target frontend pages present in source tree', () => {
    expect(fs.existsSync(path.join(projectRoot, 'frontend/src/pages/ConfiguratorsPage.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'frontend/src/pages/MarketingPage.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'frontend/src/pages/HRPage.tsx'))).toBe(true);
  });

  it('keeps backend dependency routes discoverable for hr and configurators', () => {
    const hrRoutes = read(path.join(projectRoot, 'modules/hr/src/api/routes/index.ts'));
    const configuratorRoutes = read(
      path.join(projectRoot, 'modules/configurators/src/api/routes/configurator.routes.ts'),
    );

    expect(hrRoutes).toContain('/health');
    expect(configuratorRoutes).toContain('/api/v1/configurators/sessions');
  });
});
