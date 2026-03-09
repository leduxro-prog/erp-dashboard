import path from 'path';
import express from 'express';
import request from 'supertest';

const frontendRoot = path.resolve(__dirname, '../../frontend');
const publicDir = path.join(frontendRoot, 'public');
const indexFile = path.join(frontendRoot, 'index.html');

function buildStaticApp() {
  const app = express();

  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(indexFile);
  });

  return app;
}

describe('Static asset smoke policy', () => {
  const app = buildStaticApp();

  it('serves /favicon.ico as a static asset and not as HTML', async () => {
    const response = await request(app).get('/favicon.ico');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).not.toMatch(/text\/html/i);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('serves /manifest.webmanifest as manifest JSON and not as HTML', async () => {
    const response = await request(app).get('/manifest.webmanifest');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json|application\/manifest\+json/i);
    expect(response.text).toContain('"name"');
  });

  it('serves branded ERP and B2B icon URLs directly', async () => {
    const [erpIcon, b2bIcon] = await Promise.all([
      request(app).get('/erp/favicon.svg'),
      request(app).get('/b2b/favicon.svg'),
    ]);

    expect(erpIcon.status).toBe(200);
    expect(erpIcon.headers['content-type']).toMatch(/image\/svg\+xml/i);
    expect(erpIcon.body.toString('utf8')).toContain('<svg');

    expect(b2bIcon.status).toBe(200);
    expect(b2bIcon.headers['content-type']).toMatch(/image\/svg\+xml/i);
    expect(b2bIcon.body.toString('utf8')).toContain('<svg');
  });
});
