import assert from 'node:assert/strict';

import { parseAzzardoDocs } from '../providers/azzardo-provider';

const html = `
  <div>
    <a href="/files/AZ0311_manual.pdf">AZ0311 manual</a>
    <a href="https://www.en.azzardo.com/files/AZ1200-datasheet.pdf">AZ1200 data sheet</a>
    <a href="/files/AZ1200-technical-drawing.dwg">AZ1200 technical drawing</a>
    <a href="/files/AZ1200-photo.jpg">AZ1200 image</a>
    <a href="/files/AZ1200-3d-model.glb">AZ1200 3D model</a>
    <a href="/files/AZ1200-ce-certificate.pdf">AZ1200 CE certificate</a>
    <a href="/files/AZ1200-photometric.ies">AZ1200 photometric</a>
    <a href="/files/brochure.pdf">Catalog brochure</a>
    <a href="/files/AZ0999-assembly.PDF">AZ0999 installation guide</a>
  </div>
`;

const docs = parseAzzardoDocs(html);

assert.equal(docs.length, 8);

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
  supplierSku: 'AZ1200',
  docType: 'technical_drawing',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ1200-technical-drawing.dwg',
  fileName: 'AZ1200-technical-drawing.dwg',
});

assert.deepEqual(docs[3], {
  supplier: 'azzardo',
  supplierSku: 'AZ1200',
  docType: 'product_image',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ1200-photo.jpg',
  fileName: 'AZ1200-photo.jpg',
});

assert.deepEqual(docs[4], {
  supplier: 'azzardo',
  supplierSku: 'AZ1200',
  docType: 'model_3d',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ1200-3d-model.glb',
  fileName: 'AZ1200-3d-model.glb',
});

assert.deepEqual(docs[5], {
  supplier: 'azzardo',
  supplierSku: 'AZ1200',
  docType: 'certificate',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ1200-ce-certificate.pdf',
  fileName: 'AZ1200-ce-certificate.pdf',
});

assert.deepEqual(docs[6], {
  supplier: 'azzardo',
  supplierSku: 'AZ1200',
  docType: 'photometric_data',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ1200-photometric.ies',
  fileName: 'AZ1200-photometric.ies',
});

assert.deepEqual(docs[7], {
  supplier: 'azzardo',
  supplierSku: 'AZ0999',
  docType: 'installation_guide',
  sourceUrl: 'https://www.en.azzardo.com/files/AZ0999-assembly.PDF',
  fileName: 'AZ0999-assembly.PDF',
});
