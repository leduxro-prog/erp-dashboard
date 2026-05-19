# Launch Validation - 2026-03-08

## Baseline Capture

- Time: 2026-03-08 UTC
- Context: enterprise launch hardening batch started against brownfield production surface
- Google Auth policy: frozen, read-only verification only
- Repo state: dirty working tree, no worktree used for this batch

## Public Surface Baseline

### `GET /health`

```json
{"status":"ok"}
```

### `GET /api/v1/settings`

```json
{"general":{"companyName":"LEDUX INTERNATIONAL SRL","taxId":"RO35194414","address":"STR AUREL VLAICU NR 48 AP 44","phone":"0752427978","email":"LEDUX.RO@GMAIL.COM","currency":"RON","vatRate":0.21,"company_name":"CONT-1772313347"},"b2b":{"catalogVisibility":"login_only","approvalMode":"auto","showPrices":true,"showStock":true,"allowRegistration":true,"autoApprove":true,"minOrderValue":"100","defaultCreditLimit":"5000"},"brandStrategy":{"selectedDirection":"hybrid_commerce","brandName":"LEDUX","website":"https://ledux.ro","promise":"Iluminat potrivit, livrare rapida, recomandari tehnice clare.","toneOfVoice":["clar","aplicat","tehnic","prietenos"],"valuePillars":["expertiza tehnica","stoc real","livrare rapida","suport post-vanzare"],"forbiddenPhrases":["cel mai ieftin garantat","promisiuni absolute","fara limita"],"seo":{"titleSuffix":"Ledux.ro","metaDescriptionCta":"Verifica stocul si primeste recomandare rapida de la specialistii LEDUX.","focusKeywords":["iluminat led","corpuri de iluminat","benzi led","profile led"],"categoryIntentMap":{"corpuri-de-iluminat-interior":"transactional","corpuri-de-iluminat-exterior":"transactional","benzi-led-si-surse":"commercial"}},"ai":{"enforceBrandGuardrails":true,"defaultTemperature":0.2,"maxTokens":900,"preferredModel":"gemini-2.5-flash"}}}
```

### `GET /api/v1/b2b/products?limit=1`

```json
{"success":true,"data":{"products":[{"id":"2586003","sku":"NZ1013","name":"LED Profiles 24V 200W IP20 LED Sursa de alimentare","description":"Produs importat automat de la LED Profiles (B2B).","price":111.57,"currency":"RON","image_url":"/uploads/optimized/products/2586003/51748.webp","category":"Profile LED","subcategory":"Diverse","brand":"LED Profiles","manufacturer":"LED Profiles","mounting_type":null,"ip_rating":"IP20","color_temperature":null,"supplier_name":"LED Profiles","stock_local":10,"stock_supplier":35,"stock_total":45,"supplier_lead_time":3,"supplier_lead_time_label":"5-10"}],"pagination":{"page":1,"limit":1,"total":31257,"total_pages":31257}}}
```

## Initial Findings

- Health is up.
- Public settings are sanitized at top level, but still expose business configuration that needs re-evaluation in implementation tasks.
- B2B catalog is publicly readable while `catalogVisibility` reports `login_only`; server-side policy remains inconsistent and must be fixed.

## Launch smoke and gate policy

- `scripts/tests/launch-smoke.sh` is the reproducible smoke harness for ERP + B2B launch validation.
- `scripts/go-live-gate.sh` is the final one-command gate and now runs backup -> T0 gate -> launch smoke -> post-launch watch.
- The launch smoke matrix must cover `/health`, public settings policy, B2B visibility policy, ERP login shell, B2B storefront shell, static asset correctness, and SEO status/config parity.
- ERP and B2B shell checks validate production `/assets/*.js` bootstrap output rather than the Vite dev entrypoint `/src/main.tsx`.
- Raw IP/localhost curl smoke validates route availability and production bootstrap only; host-identity and branding assertions require explicit FQDN/browser validation and are tracked separately.
- `scripts/tests/launch-smoke.sh` keeps launch-critical public settings and B2B visibility assertions inline; `scripts/tests/public-surface-smoke.sh` remains a broader regression suite outside the final go/no-go gate.
- `scripts/tests/launch-smoke.sh` still delegates to `scripts/tests/seo-smoke.sh` and `scripts/tests/bundle-budget-check.sh` so the gate remains one-command reproducible.
- Google Auth remains frozen and is not part of the mutable smoke matrix; only read-only health verification is allowed.
