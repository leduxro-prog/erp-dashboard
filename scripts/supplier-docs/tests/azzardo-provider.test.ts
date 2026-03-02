import assert from 'node:assert/strict';

import { parseAzzardoDocs } from '../providers/azzardo-provider';

const html = `
  <div>
    <a href="/files/AZ0311_manual.pdf">AZ0311 manual</a>
    <a href="https://www.en.azzardo.com/files/AZ1200-datasheet.pdf">AZ1200 data sheet</a>
    <a href="/files/brochure.pdf">Catalog brochure</a>
    <a href="/files/AZ0999-assembly.PDF">AZ0999 installation guide</a>
  </div>
`;

const docs = parseAzzardoDocs(html);

assert.equal(docs.length, 3);

assert.deepEqual(docs[0], {
  supplier: 'azzardo',
  supplierSku: 'AZ0311',
  docType: 'installation_guide',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ0311_manual.pdf',
  fileName: 'AZ0311_manual.pdf',
});

assert.deepEqual(docs[1], {
  supplier: 'azzardo',
  supplierSku: 'AZ1200',
  docType: 'datasheet',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ1200-datasheet.pdf',
  fileName: 'AZ1200-datasheet.pdf',
});

assert.deepEqual(docs[2], {
  supplier: 'azzardo',
  supplierSku: 'AZ0999',
  docType: 'installation_guide',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ0999-assembly.PDF',
  fileName: 'AZ0999-assembly.PDF',
});
