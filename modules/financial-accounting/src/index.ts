// Default export: runtime instance for module auto-discovery
import { FinancialAccountingModule } from './financial-accounting-module';
export { ApInvoiceRepository } from './infrastructure/repositories/ApInvoiceRepository';
export { FinancialAccountingModule };
const financialAccountingModule = new FinancialAccountingModule();
export default financialAccountingModule;
