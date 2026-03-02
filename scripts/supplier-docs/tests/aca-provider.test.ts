import assert from 'node:assert/strict';

import {
  buildAcaSearchUrl,
  fetchAcaDocsForSku,
  parseAcaProductDocs,
  parseAcaSearchProductUrls,
} from '../providers/aca-provider';

async function run(): Promise<void> {
  testParseAcaProductDocs();
  testBuildAcaSearchUrl();
  testParseAcaSearchProductUrls();
  await testFetchAcaDocsForSkuPrefersSkuMatches();
  await testFetchAcaDocsForSkuFallsBackWithoutSkuMatches();
}

function testParseAcaProductDocs(): void {
  const html = `
    <div>
      <a href="https://acalight.gr/wp-content/uploads/A6015NW-datasheet.pdf">Datasheet PDF</a>
      <a href="/wp-content/uploads/A6015NW-installation-guide.docx">Installation guide</a>
      <a href="/wp-content/uploads/general-catalog.pdf">Catalog</a>
    </div>
  `;

  const docs = parseAcaProductDocs(html, 'A6015NW');
  assert.equal(docs.length, 2);

  assert.deepEqual(docs[0], {
    supplier: 'aca',
    supplierSku: 'A6015NW',
    docType: 'datasheet',
    sourceUrl: 'https://acalight.gr/wp-content/uploads/A6015NW-datasheet.pdf',
    fileName: 'A6015NW-datasheet.pdf',
  });

  assert.deepEqual(docs[1], {
    supplier: 'aca',
    supplierSku: 'A6015NW',
    docType: 'installation_guide',
    sourceUrl: 'https://acalight.gr/wp-content/uploads/A6015NW-installation-guide.docx',
    fileName: 'A6015NW-installation-guide.docx',
  });
}

function testBuildAcaSearchUrl(): void {
  assert.equal(
    buildAcaSearchUrl('A 6015/NW'),
    'https://acalight.gr/en/?s=A+6015%2FNW&post_type=product',
  );
}

function testParseAcaSearchProductUrls(): void {
  const html = `
    <div>
      <a href="https://acalight.gr/en/product/alpha/">Alpha</a>
      <a href="https://www.acalight.gr/en/product/beta/">Beta</a>
      <a href="/en/product/gamma/">Gamma</a>
      <a href="https://www.acalight.gr/en/product/beta/">Beta duplicate</a>
      <a href="https://acalight.gr/en/blog/update/">Blog</a>
      <a href="https://example.com/en/product/external/">External</a>
    </div>
  `;

  assert.deepEqual(parseAcaSearchProductUrls(html), [
    'https://acalight.gr/en/product/alpha/',
    'https://www.acalight.gr/en/product/beta/',
    'https://acalight.gr/en/product/gamma/',
  ]);
}

async function testFetchAcaDocsForSkuPrefersSkuMatches(): Promise<void> {
  await withMockFetch(
    {
      'https://acalight.gr/en/?s=A6015NW&post_type=product': ok(`
        <a href="https://acalight.gr/en/product/with-sku/">With SKU</a>
        <a href="https://acalight.gr/en/product/no-sku/">No SKU</a>
      `),
      'https://acalight.gr/en/product/with-sku/': ok(`
        <h1>Product A6015NW</h1>
        <a href="/wp-content/uploads/with-sku-datasheet.pdf">Datasheet</a>
      `),
      'https://acalight.gr/en/product/no-sku/': ok(`
        <h1>Different Product</h1>
        <a href="/wp-content/uploads/no-sku-installation.pdf">Installation Manual</a>
      `),
    },
    async () => {
      const docs = await fetchAcaDocsForSku('A6015NW');
      assert.equal(docs.length, 1);
      assert.equal(docs[0]?.sourceUrl, 'https://acalight.gr/wp-content/uploads/with-sku-datasheet.pdf');
      assert.equal(docs[0]?.docType, 'datasheet');
    },
  );
}

async function testFetchAcaDocsForSkuFallsBackWithoutSkuMatches(): Promise<void> {
  await withMockFetch(
    {
      'https://acalight.gr/en/?s=A6015NW&post_type=product': ok(`
        <a href="https://acalight.gr/en/product/one/">One</a>
        <a href="https://www.acalight.gr/en/product/two/">Two</a>
      `),
      'https://acalight.gr/en/product/one/': ok(`
        <h1>First Product</h1>
        <a href="/wp-content/uploads/first-installation.pdf">Installation guide</a>
      `),
      'https://www.acalight.gr/en/product/two/': ok(`
        <h1>Second Product</h1>
        <a href="/wp-content/uploads/second-datasheet.pdf">Data sheet</a>
      `),
    },
    async () => {
      const docs = await fetchAcaDocsForSku('A6015NW');
      assert.equal(docs.length, 2);
      assert.deepEqual(
        docs.map((doc) => doc.sourceUrl).sort(),
        [
          'https://acalight.gr/wp-content/uploads/first-installation.pdf',
          'https://acalight.gr/wp-content/uploads/second-datasheet.pdf',
        ],
      );
    },
  );
}

function ok(body: string): Response {
  return {
    ok: true,
    status: 200,
    text: async () => body,
  } as Response;
}

async function withMockFetch(
  responsesByUrl: Record<string, Response>,
  callback: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const response = responsesByUrl[url];

    if (!response) {
      throw new Error(`Unexpected fetch URL in test: ${url}`);
    }

    return response;
  }) as typeof fetch;

  try {
    await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
