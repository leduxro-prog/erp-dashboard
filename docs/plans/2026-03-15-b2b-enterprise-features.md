# B2B Enterprise Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement sub-account management, collaborative project folders, and technical product enhancements for the B2B portal.

**Architecture:** Extend the `b2b-portal` module with new entities and controllers following Clean Architecture. Use Redis for real-time budget tracking and React Query for optimistic UI in project management.

**Tech Stack:** Node.js, TypeScript, TypeORM, PostgreSQL, React, TanStack Query, Lucide Icons.

---

### Task 1: Database Schema & Entities

**Files:**
- Create: `modules/b2b-portal/src/infrastructure/entities/B2BSubAccountEntity.ts`
- Create: `modules/b2b-portal/src/infrastructure/entities/B2BProjectEntity.ts`
- Create: `modules/b2b-portal/src/infrastructure/entities/B2BProjectItemEntity.ts`
- Modify: `modules/catalog/src/infrastructure/entities/ProductSpecificationEntity.ts`

**Step 1: Define B2BSubAccountEntity**
Define the sub-account structure with permission flags and spending limits.

**Step 2: Define B2BProjectEntity & B2BProjectItemEntity**
Define the project container and its relation to products.

**Step 3: Add ies_file_url to ProductSpecification**
Add the column to the catalog specification model.

**Step 4: Generate and run migrations**
Run: `npm run migration:generate -- -n B2BEnterpriseFeatures` and `npm run migration:run`

**Step 5: Commit**

---

### Task 2: Sub-account API (Management & Hardening)

**Files:**
- Create: `modules/b2b-portal/src/api/controllers/B2BTeamController.ts`
- Modify: `modules/b2b-portal/src/api/index.ts`

**Step 1: Write TDD test for sub-account creation**
Test that only Master accounts can invite sub-accounts.

**Step 2: Implement B2BTeamController**
Implement `GET /team` and `POST /team/invite` logic.

**Step 3: Implement Permission Middleware**
Create a middleware that checks `req.subAccount.permissions` before sensitive operations.

**Step 4: Run tests and verify**
Run: `npm test modules/b2b-portal/tests/B2BTeam.test.ts`

**Step 5: Commit**

---

### Task 3: Collaborative Project Folders API

**Files:**
- Create: `modules/b2b-portal/src/api/controllers/B2BProjectController.ts`

**Step 1: Write TDD test for collaborative sharing**
Test that shared projects are visible to all company sub-accounts.

**Step 2: Implement Project CRUD**
Implement `POST /projects`, `GET /projects`, and `POST /projects/:id/items`.

**Step 3: Implement Project-to-Cart Conversion**
Logic to move all items from a project to the active B2B cart.

**Step 4: Run tests and verify**

**Step 5: Commit**

---

### Task 4: Tiered Pricing & Technical Data API

**Files:**
- Modify: `modules/b2b-portal/src/api/controllers/B2BCatalogController.ts`

**Step 1: Implement calculated pricing endpoint**
`GET /products/:id/pricing` should return the specific net price for the customer's tier + volume discount.

**Step 2: Update product detail response**
Include `ies_file_url` and `volume_discounts` in the detailed view.

**Step 3: Commit**

---

### Task 5: Frontend - Team Management UI

**Files:**
- Create: `frontend/src/pages/b2b-portal/B2BTeamPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/b2b-portal/B2BPortalLayout.tsx`

**Step 1: Create Sub-account List & Invite Modal**
Modern UI with spending limit progress bars.

**Step 2: Add "Team" to Portal Navigation**

**Step 3: Commit**

---

### Task 6: Frontend - Project Folders UI

**Files:**
- Create: `frontend/src/pages/b2b-portal/B2BProjectsPage.tsx`
- Modify: `frontend/src/pages/b2b-store/B2BStoreCatalogPage.tsx`

**Step 1: Add "Add to Project" button to Catalog**
Dropdown for project selection.

**Step 2: Create Project Dashboard**
List of projects with "Convert to Order" functionality.

**Step 3: Commit**

---

### Task 7: Frontend - Technical Hardening

**Files:**
- Modify: `frontend/src/pages/b2b-store/B2BProductDetailPage.tsx`

**Step 1: Implement Tiered Pricing Table**
Visual grid showing price breaks.

**Step 2: Add IES/LDT Download Buttons**
Protected by login status.

**Step 3: Final Build & Verification**
Run: `npm run build` in root.

**Step 4: Commit**
