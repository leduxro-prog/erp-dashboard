# Task 7 - B2B as First-Class Governed Surface

## Objective

Model B2B explicitly as a first-class governed surface aligned with approved boundaries: separate from retail surface, sharing commerce core where appropriate, without collapsing into storefront flags.

## Decision

B2B is **in-platform first-class surface** with formal boundary contract to commerce core and ERP publication controls.

It is not:

- a hidden mode in retail storefront
- an undocumented external dependency
- a sidecar without release governance

## Ownership Model

- ERP owns master catalog, stock, technical/compliance metadata, and B2B assortment controls.
- Commerce core owns transactional capabilities (cart/checkout/orders/payments/returns).
- B2B surface owns B2B UX/workflow layer and policy enforcement (visibility, pricing presentation, account gating, quote/project flows).

## Release Path

- B2B has independent release track and readiness checks.
- Shared commerce core changes require compatibility validation against both retail and B2B.
- B2B cutover cannot be inferred from retail readiness; it has its own gate.

## Authentication Model

- B2B authentication is tenant/account-scoped.
- SSO and account policies are B2B-governed.
- Customer identity lifecycle remains in commerce identity domain, but B2B roles/policies are surface-specific.

## Pricing Model

- ERP remains source for pricing inputs/rules.
- B2B applies contract/account-specific commercial views through publication and pricing policy contracts.
- No direct B2B writes to commerce transactional DB for catalog source fields.

## Visibility Model

- Published catalog projection includes `visibility.b2b` independent from `visibility.retail`.
- B2B assortment/segmentation controlled by ERP publication policy and consumed by B2B surface.

## Quote/Project Flow Expectations

B2B surface supports first-class workflows:

- quote request and negotiation states
- project lists / BOM-like product grouping
- account-level pricing and approval gates
- conversion path quote -> order through commerce core

## Boundary Contract Artifact

Schema defining B2B governance contract:

- `contracts/b2b-surface-contract-v1.schema.json`

## Guardrails

- Retail and B2B are separate runtime surfaces and release artifacts.
- Shared commerce core is allowed, but shared surface behavior is not assumed.
- ERP browse direct path remains transitional and not final architecture.
