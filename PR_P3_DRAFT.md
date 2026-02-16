Title:
fix(p3): harden auth/finance flows and close critical consistency gaps

## Summary

- Hardened security-sensitive flows:
  - Secured B2B redirect handling (open-redirect prevention)
  - Enforced auth + role checks on AI endpoints
  - Reduced AI prompt/log exposure of sensitive data
  - Encrypted 2FA secrets and hashed backup codes (with legacy compatibility)

- Fixed business logic and financial integrity issues:
  - Enforced order status transition validation in API layer
  - Added SmartBill invoice idempotency by `orderId` (including race fallback)
  - Added atomic discount usage increment to prevent over-redemption at max usage
  - Switched GL posting to transactional entry+balance updates to avoid partial postings

- Updated and expanded tests for changed behavior:
  - 2FA service tests (hashed backup codes + encrypted secret verification)
  - SmartBill idempotency test scenarios
  - Orders/marketing regression expectations aligned with current VAT/domain logic

## Why

These changes close P3 risks that could allow redirect abuse, inconsistent auth boundaries,
duplicate invoice creation under retries/races, overuse of discount codes, and non-atomic
ledger writes leading to accounting drift.

## Validation

- `npx tsc --noEmit`
- `npx jest modules/orders/tests tests/unit/TwoFactorAuthService.test.ts modules/smartbill/tests/application/CreateInvoice.test.ts modules/marketing/tests/application/ValidateDiscountCode.test.ts --passWithNoTests`

## Key Files

- `frontend/src/pages/b2b-store/B2BLoginPage.tsx`
- `modules/users/src/application/services/TwoFactorAuthService.ts`
- `tests/unit/TwoFactorAuthService.test.ts`
- `modules/orders/src/api/controllers/OrderController.ts`
- `modules/smartbill/src/application/use-cases/CreateInvoice.ts`
- `modules/smartbill/tests/application/CreateInvoice.test.ts`
- `modules/marketing/src/domain/repositories/IDiscountCodeRepository.ts`
- `modules/marketing/src/infrastructure/repositories/TypeOrmDiscountCodeRepository.ts`
- `modules/marketing/src/application/use-cases/ApplyDiscountCode.ts`
- `modules/ai-assistant/src/AiController.ts`
- `modules/ai-assistant/src/AiService.ts`
- `modules/ai-assistant/src/AiModule.ts`
- `modules/financial-accounting/src/domain/repositories/IJournalEntryRepository.ts`
- `modules/financial-accounting/src/infrastructure/repositories/JournalEntryRepository.ts`
- `modules/financial-accounting/src/domain/services/GeneralLedgerService.ts`
