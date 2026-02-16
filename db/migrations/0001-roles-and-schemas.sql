-- ================================================================
-- Migration: 0001 - Roles and Schemas
-- Author: AI 2 (Data/DB)
-- Date: 2026-02-13
-- ================================================================
-- Description: Create schemas, roles, and grants for B2B/ERP separation
-- Impact: Creates foundational security structure
-- Rollback: DROP SCHEMA IF EXISTS b2b, erp, shared CASCADE; DROP ROLE IF EXISTS ...
-- ================================================================

-- ================================================================
-- EXTENSIONS
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable JSONB utilities
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- ROLES
-- ================================================================

-- Application roles for schema access
-- Note: Passwords should be set via environment variables, not hardcoded

-- B2B Read/Write role - has full access to b2b schema only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'b2b_rw') THEN
        CREATE ROLE b2b_rw WITH NOINHERIT NOLOGIN;
    END IF;
END
$$;

-- ERP Read/Write role - has full access to erp schema only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_rw') THEN
        CREATE ROLE erp_rw WITH NOINHERIT NOLOGIN;
    END IF;
END
$$;

-- Report Read-Only role - SELECT access via views only
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'report_ro') THEN
        CREATE ROLE report_ro WITH NOINHERIT NOLOGIN;
    END IF;
END
$$;

-- Application user roles (these will have LOGIN privilege)
-- The actual passwords should be set via ALTER ROLE in deployment

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'b2b_app') THEN
        CREATE ROLE b2b_app WITH LOGIN PASSWORD 'CHANGE_ME_B2B';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'erp_app') THEN
        CREATE ROLE erp_app WITH LOGIN PASSWORD 'CHANGE_ME_ERP';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'report_app') THEN
        CREATE ROLE report_app WITH LOGIN PASSWORD 'CHANGE_ME_REPORT';
    END IF;
END
$$;

-- Grant schema roles to app roles
GRANT b2b_rw TO b2b_app;
GRANT erp_rw TO erp_app;
GRANT report_ro TO report_app;

-- ================================================================
-- SCHEMAS
-- ================================================================

-- Create B2B schema
CREATE SCHEMA IF NOT EXISTS b2b;

-- Create ERP schema
CREATE SCHEMA IF NOT EXISTS erp;

-- Create Shared schema for cross-cutting concerns
CREATE SCHEMA IF NOT EXISTS shared;

-- ================================================================
-- SCHEMA OWNERSHIP AND PERMISSIONS
-- ================================================================

-- Set default privileges
ALTER SCHEMA b2b OWNER TO postgres;
ALTER SCHEMA erp OWNER TO postgres;
ALTER SCHEMA shared OWNER TO postgres;

-- ================================================================
-- REVOKE PUBLIC ACCESS
-- ================================================================

-- Revoke all privileges on public schema from public
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Revoke default create privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- Revoke default create privileges on b2b schema
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- Revoke default create privileges on erp schema
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- Revoke default create privileges on shared schema
ALTER DEFAULT PRIVILEGES IN SCHEMA shared REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- ================================================================
-- GRANT USAGE ON SCHEMAS
-- ================================================================

-- b2b_rw: Full access to b2b schema, usage on shared
GRANT USAGE ON SCHEMA b2b TO b2b_rw;
GRANT USAGE ON SCHEMA shared TO b2b_rw;

-- erp_rw: Full access to erp schema, usage on shared
GRANT USAGE ON SCHEMA erp TO erp_rw;
GRANT USAGE ON SCHEMA shared TO erp_rw;

-- report_ro: Usage on all schemas (for views), no direct table access
GRANT USAGE ON SCHEMA b2b TO report_ro;
GRANT USAGE ON SCHEMA erp TO report_ro;
GRANT USAGE ON SCHEMA shared TO report_ro;
GRANT USAGE ON SCHEMA public TO report_ro;

-- ================================================================
-- GRANT TABLE PRIVILEGES
-- ================================================================

-- B2B_RW: All privileges on b2b schema tables, read-only on shared
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b GRANT ALL ON TABLES TO b2b_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b GRANT ALL ON SEQUENCES TO b2b_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b GRANT ALL ON FUNCTIONS TO b2b_rw;

ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT SELECT ON TABLES TO b2b_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT USAGE ON SEQUENCES TO b2b_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT EXECUTE ON FUNCTIONS TO b2b_rw;

-- ERP_RW: All privileges on erp schema tables, read-only on shared
ALTER DEFAULT PRIVILEGES IN SCHEMA erp GRANT ALL ON TABLES TO erp_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp GRANT ALL ON SEQUENCES TO erp_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp GRANT ALL ON FUNCTIONS TO erp_rw;

ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT SELECT ON TABLES TO erp_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT USAGE ON SEQUENCES TO erp_rw;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT EXECUTE ON FUNCTIONS TO erp_rw;

-- REPORT_RO: SELECT only (via views, but granting as base)
ALTER DEFAULT PRIVILEGES IN SCHEMA b2b GRANT SELECT ON TABLES TO report_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA erp GRANT SELECT ON TABLES TO report_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA shared GRANT SELECT ON TABLES TO report_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO report_ro;

-- ================================================================
-- GRANT EXISTING TABLES (for existing tables after schema creation)
-- ================================================================

-- Function to grant permissions on existing tables
CREATE OR REPLACE FUNCTION grant_schema_permissions()
RETURNS void AS $$
DECLARE
    tbl record;
BEGIN
    -- Grant b2b_rw permissions on existing b2b tables
    FOR tbl IN SELECT table_name FROM information_schema.tables
               WHERE table_schema = 'b2b'
    LOOP
        EXECUTE format('GRANT ALL ON TABLE b2b.%I TO b2b_rw', tbl.table_name);
        EXECUTE format('GRANT ALL ON SEQUENCE b2b.%I TO b2b_rw', tbl.table_name);
    END LOOP;

    -- Grant erp_rw permissions on existing erp tables
    FOR tbl IN SELECT table_name FROM information_schema.tables
               WHERE table_schema = 'erp'
    LOOP
        EXECUTE format('GRANT ALL ON TABLE erp.%I TO erp_rw', tbl.table_name);
        EXECUTE format('GRANT ALL ON SEQUENCE erp.%I TO erp_rw', tbl.table_name);
    END LOOP;

    -- Grant shared permissions on existing shared tables
    FOR tbl IN SELECT table_name FROM information_schema.tables
               WHERE table_schema = 'shared'
    LOOP
        EXECUTE format('GRANT SELECT ON TABLE shared.%I TO b2b_rw', tbl.table_name);
        EXECUTE format('GRANT SELECT ON TABLE shared.%I TO erp_rw', tbl.table_name);
        EXECUTE format('GRANT SELECT ON TABLE shared.%I TO report_ro', tbl.table_name);
        EXECUTE format('GRANT ALL ON SEQUENCE shared.%I TO b2b_rw', tbl.table_name);
        EXECUTE format('GRANT ALL ON SEQUENCE shared.%I TO erp_rw', tbl.table_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function
SELECT grant_schema_permissions();

-- ================================================================
-- SECURITY FUNCTIONS
-- ================================================================

-- Function to check if user has access to schema
CREATE OR REPLACE FUNCTION has_schema_access(schema_name text)
RETURNS boolean AS $$
BEGIN
    RETURN has_schema_privilege(current_user, schema_name, 'USAGE');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- AUDIT TRIGGER FUNCTIONS
-- ================================================================

-- Function to set created_at and updated_at automatically
CREATE OR REPLACE FUNCTION b2b.set_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at := NOW();
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at on update
CREATE OR REPLACE FUNCTION b2b.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- COMMENTS
-- ================================================================

COMMENT ON SCHEMA b2b IS 'B2B module schema - products, customers, orders, credit';
COMMENT ON SCHEMA erp IS 'ERP module schema - existing ERP tables';
COMMENT ON SCHEMA shared IS 'Shared schema - outbox events, processed events, observability';

COMMENT ON ROLE b2b_rw IS 'B2B read/write role - has full access to b2b schema only';
COMMENT ON ROLE erp_rw IS 'ERP read/write role - has full access to erp schema only';
COMMENT ON ROLE report_ro IS 'Report read-only role - SELECT access via views';

COMMENT ON ROLE b2b_app IS 'B2B application user with login privilege';
COMMENT ON ROLE erp_app IS 'ERP application user with login privilege';
COMMENT ON ROLE report_app IS 'Reporting application user with login privilege';

-- ================================================================
-- VERIFICATION QUERIES (for manual verification)
-- ================================================================

-- Check schemas exist
-- SELECT nspname FROM pg_namespace WHERE nspname IN ('b2b', 'erp', 'shared');

-- Check roles exist
-- SELECT rolname FROM pg_roles WHERE rolname LIKE '%_rw' OR rolname LIKE '%_app';

-- Check privileges on schemas
-- SELECT * FROM information_schema.role_table_grants WHERE table_schema IN ('b2b', 'erp', 'shared');

-- Check that public has no privileges
-- SELECT * FROM information_schema.role_table_grants WHERE grantee = 'public' AND table_schema IN ('b2b', 'erp', 'shared');

\echo 'Migration 0001 completed successfully - Roles and schemas created'

-- ================================================================
-- DOWN (Rollback) - Uncomment to rollback
-- ================================================================
-- DROP FUNCTION IF EXISTS b2b.set_timestamps() CASCADE;
-- DROP FUNCTION IF EXISTS b2b.update_updated_at() CASCADE;
-- DROP FUNCTION IF EXISTS grant_schema_permissions() CASCADE;
-- DROP FUNCTION IF EXISTS has_schema_access(text) CASCADE;
--
-- DROP ROLE IF EXISTS b2b_app;
-- DROP ROLE IF EXISTS erp_app;
-- DROP ROLE IF EXISTS report_app;
-- DROP ROLE IF EXISTS b2b_rw;
-- DROP ROLE IF EXISTS erp_rw;
-- DROP ROLE IF EXISTS report_ro;
--
-- DROP SCHEMA IF EXISTS b2b CASCADE;
-- DROP SCHEMA IF EXISTS erp CASCADE;
-- DROP SCHEMA IF EXISTS shared CASCADE;
--
-- -- Optionally drop extensions (be careful with shared resources)
-- -- DROP EXTENSION IF EXISTS "uuid-ossp";
-- -- DROP EXTENSION IF EXISTS "pgcrypto";
