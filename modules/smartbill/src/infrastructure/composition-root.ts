// SmartBill composition root
//
// This module is primarily loaded via the Cypher ModuleLoader (modules/smartbill/src/index.ts)
// where dependencies are wired from the module context.
//
// For convenience and backwards compatibility, we re-export the Express routes factory
// that takes an already constructed SmartBillController.

export { createSmartBillRoutes } from '../api/routes/smartbill.routes';
