import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DataSource } from 'typeorm';
import { SeoQueueAutoTriggerJob } from '../../src/infrastructure/jobs';

describe('SeoQueueAutoTriggerJob', () => {
  let dataSource: any;
  let enqueueSeoDrafts: any;

  beforeEach(() => {
    dataSource = {
      query: jest.fn(async () => []),
    };

    enqueueSeoDrafts = {
      execute: jest.fn(async () => ({ created: true, changeset: { id: 1 } })),
    };
  });

  it('enqueues on product created/updated payload with deterministic fingerprint', async () => {
    const job = new SeoQueueAutoTriggerJob({
      dataSource: dataSource as DataSource,
      enqueueSeoDrafts,
      enabled: true,
    });

    const payload = {
      payload: {
        woo_product_id: 101,
        name: 'Bec LED 12W',
        short_description: 'Descriere scurta',
        slug: 'bec-led-12w',
      },
      locale: 'ro',
    };

    await job.handleProductEvent(payload);
    await job.handleProductEvent(payload);

    expect(enqueueSeoDrafts.execute).toHaveBeenCalledTimes(2);
    expect(enqueueSeoDrafts.execute).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        productId: 101,
        locale: 'ro',
      }),
    );
    expect(enqueueSeoDrafts.execute).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        productId: 101,
        locale: 'ro',
      }),
    );

    const firstFingerprint = (enqueueSeoDrafts.execute.mock.calls[0][0] as any).fingerprint;
    const secondFingerprint = (enqueueSeoDrafts.execute.mock.calls[1][0] as any).fingerprint;
    expect(firstFingerprint).toBe(secondFingerprint);
  });

  it('runs catch-up and enqueues only eligible products', async () => {
    (dataSource.query as jest.Mock<any>).mockResolvedValue([
      {
        entity_id: 111,
        locale: 'ro',
        meta_title: 'Titlu SEO',
        meta_description: 'Descriere SEO',
        slug: 'titlu-seo',
        focus_keyword: 'titlu',
        canonical_url: null,
        og_title: null,
        og_description: null,
        og_image: null,
        last_fingerprint: null,
      },
      {
        entity_id: 222,
        locale: 'ro',
        meta_title: '',
        meta_description: 'Descriere lipsa titlu',
        slug: 'invalid',
        focus_keyword: null,
        canonical_url: null,
        og_title: null,
        og_description: null,
        og_image: null,
        last_fingerprint: null,
      },
    ]);

    const job = new SeoQueueAutoTriggerJob({
      dataSource: dataSource as DataSource,
      enqueueSeoDrafts,
      enabled: true,
      intervalMs: 60_000,
    });

    await job.runCatchUp();

    expect(dataSource.query).toHaveBeenCalledTimes(1);
    expect(enqueueSeoDrafts.execute).toHaveBeenCalledTimes(1);
    expect(enqueueSeoDrafts.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 111,
        locale: 'ro',
      }),
    );
  });
  it('feature-flag guard disables scheduler and event autorun', async () => {
    const job = new SeoQueueAutoTriggerJob({
      dataSource: dataSource as DataSource,
      enqueueSeoDrafts,
      enabled: false,
      intervalMs: 50,
    });

    await job.start();
    await job.handleProductEvent({ payload: { woo_product_id: 10, name: 'X', slug: 'x' } });
    await job.runCatchUp();

    expect(dataSource.query).not.toHaveBeenCalled();
    expect(enqueueSeoDrafts.execute).not.toHaveBeenCalled();
  });

  it('starts periodic catch-up scheduler when enabled', async () => {
    jest.useFakeTimers();

    (dataSource.query as jest.Mock<any>).mockResolvedValue([]);
    const job = new SeoQueueAutoTriggerJob({
      dataSource: dataSource as DataSource,
      enqueueSeoDrafts,
      enabled: true,
      intervalMs: 100,
    });

    await job.start();
    await jest.advanceTimersByTimeAsync(100);
    await job.stop();

    expect(dataSource.query).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  it('logs periodic catch-up failures for observability', async () => {
    jest.useFakeTimers();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    (dataSource.query as jest.Mock<any>)
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('db down'));

    const job = new SeoQueueAutoTriggerJob({
      dataSource: dataSource as DataSource,
      enqueueSeoDrafts,
      enabled: true,
      intervalMs: 100,
    });

    await job.start();
    await jest.advanceTimersByTimeAsync(100);
    await job.stop();

    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0][1])).toContain('SEO queue catch-up run failed');

    errorSpy.mockRestore();
    jest.useRealTimers();
  });
});
