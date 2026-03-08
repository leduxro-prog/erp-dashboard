import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import SeoPage from '../SeoPage';

const serviceMocks = {
  getAuditList: vi.fn(),
  getAuditSummary: vi.fn(),
  getQueueChangesets: vi.fn(),
  getQueueChangeset: vi.fn(),
  approveQueue: vi.fn(),
  rejectQueue: vi.fn(),
  applyQueue: vi.fn(),
};

vi.mock('../../services/seo.service', () => ({
  seoService: serviceMocks,
  default: serviceMocks,
}));

const renderPage = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <SeoPage />
    </QueryClientProvider>,
  );
};

describe('Seo Queue view', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    serviceMocks.getAuditList.mockResolvedValue({ data: [], pagination: { totalPages: 1 } });
    serviceMocks.getAuditSummary.mockResolvedValue({
      totalAudits: 0,
      passed: 0,
      warning: 0,
      failed: 0,
      avgScore: 0,
      issueSummary: [],
    });

    serviceMocks.getQueueChangesets.mockResolvedValue([
      {
        id: 101,
        productId: 2001,
        locale: 'ro',
        fingerprint: 'fp-101',
        status: 'pending',
        isActive: true,
        items: [
          {
            fieldName: 'meta_title',
            currentValue: 'Titlu vechi',
            proposedValue: 'Titlu nou',
            aiConfidence: 0.91,
            reason: 'Improve CTR',
            isSelected: true,
          },
        ],
      },
    ]);

    serviceMocks.getQueueChangeset.mockResolvedValue({
      id: 101,
      productId: 2001,
      locale: 'ro',
      fingerprint: 'fp-101',
      status: 'pending',
      isActive: true,
      items: [
        {
          fieldName: 'meta_title',
          currentValue: 'Titlu vechi',
          proposedValue: 'Titlu nou',
          aiConfidence: 0.91,
          reason: 'Improve CTR',
          isSelected: true,
        },
      ],
    });

    serviceMocks.approveQueue.mockResolvedValue({ matchedCount: 1, eligibleCount: 1, updatedCount: 1 });
    serviceMocks.rejectQueue.mockResolvedValue({ matchedCount: 1, eligibleCount: 1, updatedCount: 1 });
    serviceMocks.applyQueue.mockResolvedValue({ appliedCount: 1 });
  });

  it('loads queue tab, shows status/reason, and runs bulk + field actions', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /queue/i }));

    await waitFor(() => {
      expect(serviceMocks.getQueueChangesets).toHaveBeenCalled();
      expect(screen.getByText('Improve CTR')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /approve all filtered/i }));
    await userEvent.click(screen.getByRole('button', { name: /reject all filtered/i }));
    await userEvent.click(screen.getByRole('button', { name: /apply approved/i }));

    expect(serviceMocks.approveQueue).toHaveBeenCalledWith({
      productId: undefined,
      locale: undefined,
      status: 'pending',
      applyAll: true,
    });
    expect(serviceMocks.rejectQueue).toHaveBeenCalledWith({
      productId: undefined,
      locale: undefined,
      status: 'pending',
      applyAll: true,
    });
    expect(serviceMocks.applyQueue).toHaveBeenCalledWith({
      productId: undefined,
      locale: undefined,
      applyAll: true,
    });

    await userEvent.click(screen.getByText('#101'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /approve pending scope/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /approve pending scope/i }));
    await userEvent.click(screen.getByRole('button', { name: /reject pending scope/i }));

    expect(serviceMocks.getQueueChangeset).toHaveBeenCalledWith(101);
    expect(serviceMocks.approveQueue).toHaveBeenLastCalledWith({
      productId: 2001,
      locale: 'ro',
      status: 'pending',
    });
    expect(serviceMocks.rejectQueue).toHaveBeenLastCalledWith({
      productId: 2001,
      locale: 'ro',
      status: 'pending',
    });
  });
});
