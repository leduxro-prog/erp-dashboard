#!/bin/bash
cd /opt/cypher-erp

# Add import at top of server.ts
sed -i '/^import { formatPrometheusMetrics/a import { createB2BCatalogRouter } from "../modules/b2b-portal/src/api/controllers/B2BCatalogController";' src/server.ts

# Add B2B catalog router mounting after "All module routers mounted"
sed -i "/bootstrapLogger.info('All module routers mounted');/a\\
\\
    // Step 20.1: Mount B2B Catalog API (direct SQL routes)\\
    bootstrapLogger.info('Mounting B2B Catalog API...');\\
    try {\\
      const b2bCatalogRouter = createB2BCatalogRouter(AppDataSource);\\
      app.use(\`\${apiPrefix}/b2b-catalog\`, b2bCatalogRouter);\\
      bootstrapLogger.info('B2B Catalog API mounted at ' + apiPrefix + '/b2b-catalog');\\
    } catch (error) {\\
      bootstrapLogger.error('Failed to mount B2B Catalog API', { error: error instanceof Error ? error.message : String(error) });\\
    }" src/server.ts

echo "Server.ts patched successfully"
