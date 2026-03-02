import assert from 'node:assert/strict';

import { parseArgs, runOrchestrator } from '../../backfill-supplier-docs';
import type {
  CliArgs,
  OrchestratorDependencies,
  OrchestratorSummary,
  SupplierDocCandidate,
} from '../../backfill-supplier-docs';

async function run(): Promise<void> {
  testParseArgsSupportsCommaSupplierList();
  testParseArgsSupportsAllAndResume();
  testParseArgsSupportsSingleSupplierAndLimit();
  await testOrchestratorDryRunCounters();
  await testOrchestratorSkipsTranslationForMediaTypes();
  await testOrchestratorAttachesExpandedCollectionDocsBySku();
  await testOrchestratorContinuesAfterProviderFailure();
  await testOrchestratorContinuesAfterSupplierIdLookupFailure();
  await testOrchestratorPrintsSummaryAndCleansUpOnFatalError();
}

async function testOrchestratorAttachesExpandedCollectionDocsBySku(): Promise<void> {
  const summary = await runOrchestrator(
    {
      suppliers: ['azzardo'],
      dryRun: false,
      limit: null,
      resume: false,
    },
    createDeps({
      docsBySupplier: {
        azzardo: [
          {
            supplier: 'azzardo',
            supplierSku: 'AZZARDO_COLLECTION',
            docType: 'product_image',
            sourceUrl: 'https://docs.local/photos.zip',
            fileName: 'photos.zip',
          },
        ],
      },
      expandCollectionDocs: async () => [
        {
          supplierSku: 'AZ0311',
          docType: 'product_image',
          sourceUrl: 'https://docs.local/photos.zip',
          checksum: 'img-1',
          originalPath: '/tmp/az0311.jpg',
          translatedPath: null,
          translationMode: 'none',
        },
        {
          supplierSku: 'AZ1200',
          docType: 'product_image',
          sourceUrl: 'https://docs.local/photos.zip',
          checksum: 'img-2',
          originalPath: '/tmp/az1200.jpg',
          translatedPath: null,
          translationMode: 'none',
        },
      ],
    }),
  );

  assert.equal(summary.downloaded, 1);
  assert.equal(summary.attached, 2);
  assert.equal(summary.productNotFound, 0);
}

async function testOrchestratorSkipsTranslationForMediaTypes(): Promise<void> {
  const summary = await runOrchestrator(
    {
      suppliers: ['azzardo'],
      dryRun: false,
      limit: null,
      resume: false,
    },
    createDeps({
      docsBySupplier: {
        azzardo: [
          {
            supplier: 'azzardo',
            supplierSku: 'AZZARDO_COLLECTION',
            docType: 'model_3d',
            sourceUrl: 'https://docs.local/model.glb',
            fileName: 'model.glb',
          },
        ],
      },
    }),
  );

  assert.equal(summary.downloaded, 1);
  assert.equal(summary.translated, 0);
  assert.equal(summary.attached, 1);
}

function testParseArgsSupportsCommaSupplierList(): void {
  const args = parseArgs(['--supplier=azzardo,aca', '--dry-run']);
  assert.equal(args.dryRun, true);
  assert.deepEqual(args.suppliers, ['azzardo', 'aca']);
  assert.equal(args.limit, null);
  assert.equal(args.resume, false);
}

function testParseArgsSupportsAllAndResume(): void {
  const args = parseArgs(['--supplier=all', '--resume']);
  assert.deepEqual(args.suppliers, ['azzardo', 'aca']);
  assert.equal(args.resume, true);
  assert.equal(args.dryRun, false);
}

function testParseArgsSupportsSingleSupplierAndLimit(): void {
  const args = parseArgs(['--supplier=aca', '--limit=12']);
  assert.deepEqual(args.suppliers, ['aca']);
  assert.equal(args.limit, 12);
}

async function testOrchestratorDryRunCounters(): Promise<void> {
  const summary = await runOrchestrator(
    {
      suppliers: ['azzardo'],
      dryRun: true,
      limit: null,
      resume: false,
    },
    createDeps({
      docsBySupplier: {
        azzardo: [
          {
            supplier: 'azzardo',
            supplierSku: 'AZ1',
            docType: 'datasheet',
            sourceUrl: 'https://docs.local/az1-ds.pdf',
            fileName: 'az1-ds.pdf',
          },
          {
            supplier: 'azzardo',
            supplierSku: 'AZ1',
            docType: 'installation_guide',
            sourceUrl: 'https://docs.local/az1-manual.pdf',
            fileName: 'az1-manual.pdf',
          },
        ],
      },
    }),
  );

  assert.equal(summary.discovered, 2);
  assert.equal(summary.downloaded, 0);
  assert.equal(summary.translated, 0);
  assert.equal(summary.attached, 0);
  assert.equal(summary.failures, 0);
}

async function testOrchestratorContinuesAfterProviderFailure(): Promise<void> {
  const summary = await runOrchestrator(
    {
      suppliers: ['azzardo', 'aca'],
      dryRun: false,
      limit: null,
      resume: true,
    },
    createDeps({
      failSuppliers: ['azzardo'],
      docsBySupplier: {
        aca: [
          {
            supplier: 'aca',
            supplierSku: 'A1',
            docType: 'datasheet',
            sourceUrl: 'https://docs.local/a1-ds.pdf',
            fileName: 'a1-ds.pdf',
          },
        ],
      },
    }),
  );

  assert.equal(summary.discovered, 1);
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.translated, 1);
  assert.equal(summary.attached, 1);
  assert.equal(summary.failures, 1);
}

async function testOrchestratorContinuesAfterSupplierIdLookupFailure(): Promise<void> {
  const summary = await runOrchestrator(
    {
      suppliers: ['azzardo', 'aca'],
      dryRun: false,
      limit: null,
      resume: false,
    },
    createDeps({
      docsBySupplier: {
        azzardo: [
          {
            supplier: 'azzardo',
            supplierSku: 'AZ1',
            docType: 'datasheet',
            sourceUrl: 'https://docs.local/az1-ds.pdf',
            fileName: 'az1-ds.pdf',
          },
        ],
        aca: [
          {
            supplier: 'aca',
            supplierSku: 'A1',
            docType: 'datasheet',
            sourceUrl: 'https://docs.local/a1-ds.pdf',
            fileName: 'a1-ds.pdf',
          },
        ],
      },
      getSupplierId: async (supplier) => {
        if (supplier === 'azzardo') {
          throw new Error('forced supplier id failure for azzardo');
        }

        return 10;
      },
    }),
  );

  assert.equal(summary.suppliersSucceeded, 2);
  assert.equal(summary.suppliersFailed, 1);
  assert.equal(summary.discovered, 2);
  assert.equal(summary.downloaded, 1);
  assert.equal(summary.attached, 1);
  assert.equal(summary.failures, 1);
}

async function testOrchestratorPrintsSummaryAndCleansUpOnFatalError(): Promise<void> {
  let summaryCalls = 0;
  let cleanupCalls = 0;

  await assert.rejects(
    () =>
      runOrchestrator(
        {
          suppliers: ['azzardo'],
          dryRun: false,
          limit: null,
          resume: false,
        },
        createDeps({
          docsBySupplier: {
            azzardo: [
              {
                supplier: 'azzardo',
                supplierSku: Symbol('bad-sku') as unknown as string,
                docType: 'datasheet',
                sourceUrl: 'https://docs.local/az1-ds.pdf',
                fileName: 'az1-ds.pdf',
              },
            ],
          },
          printSummary: () => {
            summaryCalls += 1;
          },
          cleanup: async () => {
            cleanupCalls += 1;
          },
        }),
      ),
    /symbol/i,
  );

  assert.equal(summaryCalls, 1);
  assert.equal(cleanupCalls, 1);
}

type DepsOptions = {
  failSuppliers?: Array<'azzardo' | 'aca'>;
  docsBySupplier: Partial<Record<'azzardo' | 'aca', SupplierDocCandidate[]>>;
  getSupplierId?: OrchestratorDependencies['getSupplierId'];
  printSummary?: OrchestratorDependencies['printSummary'];
  cleanup?: OrchestratorDependencies['cleanup'];
  expandCollectionDocs?: OrchestratorDependencies['expandCollectionDocs'];
};

function createDeps(options: DepsOptions): OrchestratorDependencies {
  const failSuppliers = new Set(options.failSuppliers ?? []);

  return {
    discoverDocsForSupplier: async ({ supplier }) => {
      if (failSuppliers.has(supplier)) {
        throw new Error(`forced provider failure for ${supplier}`);
      }

      return options.docsBySupplier[supplier] ?? [];
    },
    downloadDoc: async () => ({ destinationPath: '/tmp/original.pdf', bytesWritten: 12, attempts: 1 }),
    computeChecksum: async () => 'checksum-1',
    translateDoc: async () => '/tmp/original-ro-auto.pdf',
    toPublicUrl: (filePath) => filePath,
    getSupplierId: options.getSupplierId ?? (async () => 10),
    attachDocs: async () => ({
      status: 'attached',
      productId: 25,
      datasheetUrl: '/tmp/original-ro-auto.pdf',
      installationGuideUrl: null,
      attachedDocsCount: 1,
    }),
    expandCollectionDocs: options.expandCollectionDocs,
    buildOriginalPath: ({ supplier, supplierSku, fileName }) => `/tmp/${supplier}/${supplierSku}/${fileName}`,
    printSummary:
      options.printSummary ??
      ((_summary: OrchestratorSummary) => {
        return;
      }),
    cleanup: options.cleanup,
  };
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
