import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createSeoRoutes } from '../../src/api/routes/seo.routes';
import { SeoController } from '../../src/api/controllers/SeoController';

describe('Seo queue admin contract', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  const makeToken = (role: string, id: string = '99') =>
    jwt.sign({ id, email: `${role}@example.com`, role }, process.env.JWT_SECRET as string);

  const queueChangesets = [
    {
      id: 11,
      productId: 1001,
      locale: 'ro',
      fingerprint: 'fp-11',
      status: 'pending',
      isActive: true,
      items: [
        {
          fieldName: 'meta_title',
          currentValue: 'Titlu vechi',
          proposedValue: 'Titlu nou',
          aiConfidence: 0.92,
          reason: 'Improve CTR',
          isSelected: true,
        },
      ],
    },
    {
      id: 12,
      productId: 1002,
      locale: 'ro',
      fingerprint: 'fp-12',
      status: 'approved',
      isActive: false,
      items: [],
    },
  ];

  let root: any;

  const createApp = () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/seo', createSeoRoutes(new SeoController(root)));
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
    return app;
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'seo-queue-contract-secret';

    root = {
      enqueueSeoDrafts: {
        execute: jest.fn(async () => ({
          created: true,
          changeset: {
            id: 100,
            productId: 1001,
            locale: 'ro',
            fingerprint: 'fp-100',
            status: 'pending',
            isActive: true,
            items: [{ fieldName: 'metaTitle', isSelected: true, proposedValue: 'Titlu nou' }],
          },
        })),
      },
      approveSeoDraftItems: {
        execute: jest.fn(async () => ({ matchedCount: 2, eligibleCount: 1, updatedCount: 1 })),
      },
      applyApprovedSeoDrafts: {
        execute: jest.fn(async () => ({ appliedCount: 1 })),
      },
      seoDraftQueueRepository: {
        findByFilter: jest.fn(async () => queueChangesets),
        findById: jest.fn(async (id: number) =>
          queueChangesets.find((changeset) => changeset.id === id) ?? null,
        ),
      },
    };
  });

  afterEach(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
  });

  it('rejects queue endpoint for non-admin user', async () => {
    const app = createApp();
    const token = makeToken('manager');

    const response = await request(app).get('/api/v1/seo/queue').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Insufficient permissions');
  });

  it('validates and forwards refresh requests to enqueue use-case', async () => {
    const app = createApp();
    const token = makeToken('admin', '321');

    const payload = {
      product_id: 1001,
      locale: 'ro',
      fingerprint: 'fp-100',
      items: [{ field_name: 'meta_title', current_value: 'Titlu vechi', proposed_value: 'Titlu nou' }],
      metadata: { source: 'manual' },
    };

    const response = await request(app)
      .post('/api/v1/seo/queue/refresh')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(200);
    expect(root.enqueueSeoDrafts.execute).toHaveBeenCalledWith({
      productId: 1001,
      locale: 'ro',
      fingerprint: 'fp-100',
      createdBy: 321,
      items: [
        {
          fieldName: 'meta_title',
          currentValue: 'Titlu vechi',
          proposedValue: 'Titlu nou',
          aiConfidence: null,
          reason: null,
          isSelected: true,
        },
      ],
      metadata: { source: 'manual' },
    });
    expect(response.body.success).toBe(true);
  });

  it('rejects queue refresh payload that tries to set created_by', async () => {
    const app = createApp();
    const token = makeToken('admin', '321');

    const response = await request(app)
      .post('/api/v1/seo/queue/refresh')
      .set('Authorization', `Bearer ${token}`)
      .send({
        product_id: 1001,
        locale: 'ro',
        fingerprint: 'fp-100',
        created_by: 999999,
        items: [{ field_name: 'meta_title', proposed_value: 'Titlu nou' }],
      });

    expect(response.status).toBe(400);
    expect(root.enqueueSeoDrafts.execute).not.toHaveBeenCalled();
  });

  it('returns validation error for malformed queue refresh payload', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .post('/api/v1/seo/queue/refresh')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'ro' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('lists queue changesets with detailed payload for admin', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .get('/api/v1/seo/queue?product_id=1001&locale=ro&status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(root.seoDraftQueueRepository.findByFilter).toHaveBeenCalledWith({
      productId: 1001,
      locale: 'ro',
      status: 'pending',
      page: 1,
      limit: 50,
    });
    expect(response.body.success).toBe(true);
    expect(response.body.data[0]).toEqual({
      id: 11,
      product_id: 1001,
      locale: 'ro',
      fingerprint: 'fp-11',
      status: 'pending',
      is_active: true,
      items: [
        {
          field_name: 'meta_title',
          current_value: 'Titlu vechi',
          proposed_value: 'Titlu nou',
          ai_confidence: 0.92,
          reason: 'Improve CTR',
          is_selected: true,
        },
      ],
    });
  });

  it('returns one queue changeset by id', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .get('/api/v1/seo/queue/11')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(root.seoDraftQueueRepository.findById).toHaveBeenCalledWith(11);
    expect(response.body.data).toEqual({
      id: 11,
      product_id: 1001,
      locale: 'ro',
      fingerprint: 'fp-11',
      status: 'pending',
      is_active: true,
      items: [
        {
          field_name: 'meta_title',
          current_value: 'Titlu vechi',
          proposed_value: 'Titlu nou',
          ai_confidence: 0.92,
          reason: 'Improve CTR',
          is_selected: true,
        },
      ],
    });
  });

  it('approves queue items through approve use-case', async () => {
    const app = createApp();
    const token = makeToken('admin', '41');

    const response = await request(app)
      .post('/api/v1/seo/queue/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 1001, locale: 'ro' });

    expect(response.status).toBe(200);
    expect(root.approveSeoDraftItems.execute).toHaveBeenCalledWith({
      filter: { productId: 1001, locale: 'ro' },
      decision: 'approved',
      approvedBy: 41,
    });
  });

  it('rejects queue items through approve use-case', async () => {
    const app = createApp();
    const token = makeToken('admin', '42');

    const response = await request(app)
      .post('/api/v1/seo/queue/reject')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'ro' });

    expect(response.status).toBe(200);
    expect(root.approveSeoDraftItems.execute).toHaveBeenCalledWith({
      filter: { locale: 'ro' },
      decision: 'rejected',
      approvedBy: 42,
    });
  });

  it('rejects unscoped approve requests without apply_all', async () => {
    const app = createApp();
    const token = makeToken('admin', '41');

    const response = await request(app)
      .post('/api/v1/seo/queue/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(root.approveSeoDraftItems.execute).not.toHaveBeenCalled();
  });

  it('rejects approve payload with apply_all=false and no scope', async () => {
    const app = createApp();
    const token = makeToken('admin', '41');

    const response = await request(app)
      .post('/api/v1/seo/queue/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ apply_all: false });

    expect(response.status).toBe(400);
    expect(root.approveSeoDraftItems.execute).not.toHaveBeenCalled();
  });

  it('allows bulk approve when apply_all=true', async () => {
    const app = createApp();
    const token = makeToken('admin', '41');

    const response = await request(app)
      .post('/api/v1/seo/queue/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ apply_all: true });

    expect(response.status).toBe(200);
    expect(root.approveSeoDraftItems.execute).toHaveBeenCalledWith({
      filter: {},
      decision: 'approved',
      approvedBy: 41,
    });
  });

  it('rejects approve payload that tries to set approved_by', async () => {
    const app = createApp();
    const token = makeToken('admin', '41');

    const response = await request(app)
      .post('/api/v1/seo/queue/approve')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'ro', approved_by: 999999 });

    expect(response.status).toBe(400);
    expect(root.approveSeoDraftItems.execute).not.toHaveBeenCalled();
  });

  it('applies approved queue items through apply use-case', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .post('/api/v1/seo/queue/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 1001, locale: 'ro' });

    expect(response.status).toBe(200);
    expect(root.applyApprovedSeoDrafts.execute).toHaveBeenCalledWith({
      productId: 1001,
      locale: 'ro',
    });
  });

  it('rejects unscoped apply requests without apply_all', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .post('/api/v1/seo/queue/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(root.applyApprovedSeoDrafts.execute).not.toHaveBeenCalled();
  });

  it('rejects apply payload with apply_all=false and no scope', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .post('/api/v1/seo/queue/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ apply_all: false });

    expect(response.status).toBe(400);
    expect(root.applyApprovedSeoDrafts.execute).not.toHaveBeenCalled();
  });

  it('allows bulk apply when apply_all=true', async () => {
    const app = createApp();
    const token = makeToken('admin');

    const response = await request(app)
      .post('/api/v1/seo/queue/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ apply_all: true });

    expect(response.status).toBe(200);
    expect(root.applyApprovedSeoDrafts.execute).toHaveBeenCalledWith({
      productId: undefined,
      locale: undefined,
    });
  });
});
