import B2BPortalModule from './b2b-module';

const b2bPortalModule = new B2BPortalModule();

export default b2bPortalModule;

// Export composition root
export { createB2BPortalRouter } from './infrastructure/composition-root';

export * from './domain';
export * from './application';
export * from './infrastructure';
export * from './api';
