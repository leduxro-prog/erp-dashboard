# Design Doc: B2B Enterprise Features

**Status:** Approved
**Date:** 2026-03-15
**Author:** Software Architect (Claude)

## 1. Overview
Implementation of high-level enterprise features for the LEDUX B2B Portal to support professional lighting contractors and wholesalers. This design focuses on scalability, collaborative workflows, and technical data accessibility.

## 2. Core Features

### 2.1 Sub-account Management (Configurable Permissions)
Allows a Master B2B account (Company Owner) to manage employee access and spending.
- **Permissions Matrix:**
    - `can_view_invoices`: Access to billing and payment history.
    - `can_place_orders`: Ability to submit orders.
    - `order_approval_required`: If true, orders placed by the sub-account must be reviewed by the Master account.
    - `monthly_spending_limit`: Hard or soft limit on monthly purchases.
- **Workflow:**
    - Invitation system via email.
    - Dashboard for Master accounts to monitor sub-account spending in real-time.
    - "Pending Approval" queue for restricted orders.

### 2.2 Collaborative Project Folders
Allows users to group products for specific projects (e.g., "Hospital Wing B") before purchasing.
- **Functionality:**
    - Add products to projects directly from the catalog.
    - Share folders with the entire company team for collaborative BOM building.
    - One-click "Convert Project to Order".
    - Export project lists as CSV/PDF for client proposals.

### 2.3 Product Data Enhancements
- **Photometric Data:** Support for `.ies` and `.ldt` file downloads in the product detail page.
- **Tiered Pricing Transparency:** Real-time display of volume-based discount tables on product pages.
- **EAN/Technical Specs:** Improved visibility of professional attributes (Wattage, Kelvin, IP, CRI).

## 3. Technical Architecture

### 3.1 Data Model (Database)
- **New Table `b2b_sub_accounts`:**
    - `id`, `master_customer_id`, `user_id`, `permissions` (JSONB), `monthly_limit`, `current_month_spend`.
- **New Table `b2b_projects`:**
    - `id`, `customer_id`, `creator_id`, `name`, `is_shared` (Boolean), `metadata` (JSONB).
- **New Table `b2b_project_items`:**
    - `id`, `project_id`, `product_id`, `quantity`, `notes`.
- **Alter Table `product_specifications`:**
    - Add `ies_file_url` (String/Nullable).

### 3.2 API Interface (Express)
- `GET /api/v1/b2b/team`: List sub-accounts.
- `POST /api/v1/b2b/team/invite`: Invite sub-account.
- `GET /api/v1/b2b/projects`: List projects.
- `POST /api/v1/b2b/projects`: Create project.
- `POST /api/v1/b2b/projects/:id/items`: Add items to project.
- `GET /api/v1/b2b/products/:id/pricing`: Get calculated tiered pricing for the current user.

### 3.3 Frontend (React + TanStack Query)
- **State Management:** Use React Query for caching project and team data.
- **Optimistic UI:** Implement for "Add to Project" actions to ensure a fluid experience.
- **Permission Guards:** Higher-order components (HOCs) to protect UI elements (e.g., "Place Order" button) based on sub-account permissions.

## 4. Success Criteria
1. Sub-accounts can log in and are restricted by their specific permissions.
2. Master accounts receive notifications for orders requiring approval.
3. Multiple users from the same company can contribute to a "Shared Project".
4. Photometric files are downloadable for relevant SKUs.
5. Volume discounts are clearly visible and correctly applied in the cart.
