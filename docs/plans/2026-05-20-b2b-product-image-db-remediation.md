# B2B Product Image DB Remediation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Safely remediate unsafe B2B product image URLs in production data with reviewed candidates, backup, verification, and rollback path.

**Architecture:** The remediation is SQL-driven and approval-gated. First run read-only audit/dry-run scripts, export candidate rows for review, generate a populated apply script from approved rows only, then run the mutating apply script inside a transaction with backup table `ops_backup_product_images_20260510`.

**Tech Stack:** PostgreSQL, Docker Compose runtime, `psql`, existing SQL scripts under `scripts/product-images/`.

---

### Task 1: Read-Only Audit And Dry-Run

**Files:**
- Read: `scripts/product-images/audit-b2b-product-image-health.sql`
- Read: `scripts/product-images/dry-run-b2b-product-image-remediation.sql`
- Output: `/tmp/b2b-product-image-health-YYYYMMDD_HHMMSS.txt`
- Output: `/tmp/b2b-product-image-dry-run-YYYYMMDD_HHMMSS.txt`

**Step 1: Verify DB is reachable without exposing secrets**

Run: `docker exec cypher-erp-db pg_isready -U cypher_user -d cypher_erp`

Expected: `accepting connections`

**Step 2: Run health audit read-only**

Run: `docker exec -i cypher-erp-db psql -U cypher_user -d cypher_erp -v ON_ERROR_STOP=1 -f - < scripts/product-images/audit-b2b-product-image-health.sql > /tmp/b2b-product-image-health-YYYYMMDD_HHMMSS.txt`

Expected: exits `0`; output contains sections such as `section_table_health`, `section_url_categories`, and `section_unsafe_product_image_with_safe_asset`.

**Step 3: Run dry-run candidate query read-only**

Run: `docker exec -i cypher-erp-db psql -U cypher_user -d cypher_erp -v ON_ERROR_STOP=1 -f - < scripts/product-images/dry-run-b2b-product-image-remediation.sql > /tmp/b2b-product-image-dry-run-YYYYMMDD_HHMMSS.txt`

Expected: exits `0`; output contains `section_remediation_candidate_counts` and `section_remediation_candidate_rows`.

**Step 4: Review counts**

Check that automatic actions are limited to:
- `clear_image_url_only`
- `replace_with_safe_asset`

Do not apply rows marked `manual_review_required`.

### Task 2: Candidate Review Gate

**Files:**
- Read: `/tmp/b2b-product-image-dry-run-YYYYMMDD_HHMMSS.txt`
- Modify only after approval: `scripts/product-images/apply-b2b-product-image-remediation.sql` or a copied generated apply file

**Step 1: Summarize candidate counts**

Report counts by `remediation_category` and `action_recommendation`.

**Step 2: Ask for explicit approval**

Required approval text:

`I_APPROVE_B2B_PRODUCT_IMAGE_REMEDIATION_20260510`

Expected: no DB mutation until the user explicitly approves applying reviewed candidates.

**Step 3: Generate reviewed candidate rows**

Populate the `approved_candidates` CTE with only reviewed rows copied from dry-run output.

Each row must include exactly:
- `product_id`
- `action_recommendation`
- `current_image_url`
- `recommended_image_url`

### Task 3: Backup Before Mutation

**Files:**
- Output: `backups/pre-b2b-product-image-remediation-YYYYMMDD_HHMMSS.dump`

**Step 1: Create DB backup before mutation**

Run: `docker exec cypher-erp-db pg_dump -U cypher_user -d cypher_erp -Fc > backups/pre-b2b-product-image-remediation-YYYYMMDD_HHMMSS.dump`

Expected: dump file exists and is non-empty.

**Step 2: Validate dump list**

Run: `pg_restore --list backups/pre-b2b-product-image-remediation-YYYYMMDD_HHMMSS.dump > /tmp/pre-b2b-product-image-remediation-restore-list.txt`

Expected: exits `0` and lists database objects.

### Task 4: Apply Reviewed Remediation

**Files:**
- Execute: populated apply script
- Created/updated by script: `ops_backup_product_images_20260510`
- Mutates: `products.image_url`, `products.metadata`, `products.updated_at`

**Step 1: Run apply with approval variable**

Run: `docker exec -i cypher-erp-db psql -U cypher_user -d cypher_erp -v ON_ERROR_STOP=1 -v approved_b2b_product_image_remediation=I_APPROVE_B2B_PRODUCT_IMAGE_REMEDIATION_20260510 -f - < populated-apply.sql`

Expected: exits `0`; output includes `section_apply_summary` with updated counts.

**Step 2: Verify backup table rows match updates**

Run a read-only query counting backup rows with marker `b2bProductImageRemediation20260510` and products carrying the same metadata marker.

Expected: counts match the apply summary.

### Task 5: Post-Apply Verification

**Files:**
- Read: `scripts/product-images/audit-b2b-product-image-health.sql`
- Read: `scripts/product-images/dry-run-b2b-product-image-remediation.sql`

**Step 1: Re-run image health audit**

Run the same audit command from Task 1.

Expected: unsafe image counts decrease according to the apply summary.

**Step 2: Re-run dry-run**

Run the same dry-run command from Task 1.

Expected: approved automatic candidates no longer appear, or count decreases by applied count.

**Step 3: Smoke B2B catalog**

Run: `curl -fsS "https://b2b.ledux.ro/api/v1/b2b/products?page=1&limit=12&compact=true&sort=newest"`

Expected: HTTP 200 with product data.

### Task 6: Rollback If Needed

**Files:**
- Execute only after explicit approval: `scripts/product-images/rollback-b2b-product-image-remediation.sql`

**Step 1: Rollback approval gate**

Required approval text:

`I_APPROVE_B2B_PRODUCT_IMAGE_ROLLBACK_20260510`

**Step 2: Execute rollback**

Run: `docker exec -i cypher-erp-db psql -U cypher_user -d cypher_erp -v ON_ERROR_STOP=1 -v approved_b2b_product_image_rollback=I_APPROVE_B2B_PRODUCT_IMAGE_ROLLBACK_20260510 -f - < scripts/product-images/rollback-b2b-product-image-remediation.sql`

Expected: exits `0`; output includes `section_rollback_summary`.

---

## Hard Stops

- Do not run `apply-b2b-product-image-remediation.sql` while `approved_candidates` is empty or unreviewed.
- Do not apply rows with `manual_review_required`.
- Do not mutate DB without fresh backup and explicit approval text.
- Stop if dry-run and apply candidate matching disagree.
- Stop if B2B catalog smoke test fails after apply.

---

## Execution Evidence 2026-05-20

- Approval received: `I_APPROVE_B2B_PRODUCT_IMAGE_REMEDIATION_20260510`.
- Backup created: `backups/pre-b2b-product-image-remediation-20260520_143227.dump`.
- Reviewed automatic candidates: `7710` rows from `/tmp/b2b-product-image-auto-clear-20260520_140212.csv`.
- Applied action: `clear_image_url_only` for `7710` products.
- Backup table: `ops_backup_product_images_20260510` with `7710` rows.
- Verification query confirmed `7710` marked products and `7710` marked products with `image_url IS NULL`.
- Post-apply dry-run output: `/tmp/b2b-product-image-dry-run-post-20260520_143831.txt`.
- Post-apply audit output: `/tmp/b2b-product-image-health-post-20260520_143831.txt`.
- Public B2B catalog smoke passed for `/api/v1/b2b/products?page=1&limit=12&compact=true&sort=newest`.

Remaining rows are intentionally excluded from automatic remediation because they require manual review:

- `azzardo_code_mismatch`: `92`
- `azzardo_metadata_mismatch`: `5`
- `azzardo_placeholder`: `102`
