# Environment Intent and Host Topology

This repo serves the ERP API plus the current ERP/B2B frontend. It is not the separate Medusa storefront repo.

## Required intent model

- `DEPLOYMENT_INTENT=local` for laptop and local docker work.
- `DEPLOYMENT_INTENT=staging|rehearsal|production` for non-local environments.
- Non-local intents must set explicit `FRONTEND_URL` and `PUBLIC_BASE_URL` values. The backend no longer accepts mixed-intent production defaults for staging-like environments.

## Valid `NODE_ENV` / `DEPLOYMENT_INTENT` pairings

- `development` -> `local`
- `test` -> `local`
- `staging` -> `staging`
- `production` -> `rehearsal` or `production`

Invalid combinations are rejected by the backend, including omitted non-local intent values.

## Host ownership

- `FRONTEND_URL`: canonical browser origin for the ERP/B2B app served by this repo.
- `PUBLIC_BASE_URL`: canonical public API origin for this repo.
- `CANONICAL_SHOP_URL`: canonical customer-facing shop or marketing origin when that host is still part of the deployment topology.
- `LEGACY_STOREFRONT_URL`: optional legacy storefront origin kept alive during coexistence or cutover.

If `LEGACY_STOREFRONT_URL` is set, `CANONICAL_SHOP_URL` must also be set so cutover ownership stays explicit.

## Compose rules

- `docker-compose.yml` defaults to local-safe host values only.
- `docker-compose.prod.yml` requires explicit intent and explicit Traefik hosts.
- Use `TRAEFIK_FRONTEND_HOST` and `TRAEFIK_API_HOST` instead of hardcoded router hostnames.

## Example: staging

```env
NODE_ENV=staging
DEPLOYMENT_INTENT=staging
FRONTEND_URL=https://erp-staging.ledux.ro
PUBLIC_BASE_URL=https://api-staging.ledux.ro
CANONICAL_SHOP_URL=https://staging.ledux.ro
LEGACY_STOREFRONT_URL=
TRAEFIK_FRONTEND_HOST=erp-staging.ledux.ro
TRAEFIK_API_HOST=api-staging.ledux.ro
```

## Example: rehearsal

```env
NODE_ENV=production
DEPLOYMENT_INTENT=rehearsal
FRONTEND_URL=https://erp-rehearsal.ledux.ro
PUBLIC_BASE_URL=https://api-rehearsal.ledux.ro
CANONICAL_SHOP_URL=https://rehearsal.ledux.ro
LEGACY_STOREFRONT_URL=
TRAEFIK_FRONTEND_HOST=erp-rehearsal.ledux.ro
TRAEFIK_API_HOST=api-rehearsal.ledux.ro
```

## Example: production with coexistence

```env
NODE_ENV=production
DEPLOYMENT_INTENT=production
FRONTEND_URL=https://erp.ledux.ro
PUBLIC_BASE_URL=https://api.ledux.ro
CANONICAL_SHOP_URL=https://ledux.ro
LEGACY_STOREFRONT_URL=https://legacy.ledux.ro
TRAEFIK_FRONTEND_HOST=erp.ledux.ro
TRAEFIK_API_HOST=api.ledux.ro
```
