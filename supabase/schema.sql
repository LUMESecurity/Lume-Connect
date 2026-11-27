-- =========================================================
-- TravLume Connect - Complete Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ujhuxmfsvfnnmrspgkqc/sql/new
-- =========================================================

-- 1. Create the organizations table for tenant organization profiles
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT,
    role TEXT NOT NULL DEFAULT 'organization',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure user_id column exists when upgrading existing databases
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Ensure status column exists for tenant suspension tracking
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Tighten RLS on public.organizations:
-- Block direct anon/client-side mutations and deletes; only server-side service_role
-- bypasses RLS after verifying the Super Admin session.
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for organizations" ON public.organizations;
DROP POLICY IF EXISTS "Super admin can read organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organizations can read own profile" ON public.organizations;

CREATE POLICY "Super admin can read organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
    lower(auth.jwt() ->> 'email') = 'admin@lumeconnect.com'
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
);

CREATE POLICY "Organizations can read own profile"
ON public.organizations
FOR SELECT
TO authenticated
USING (
    lower(email) = lower(auth.jwt() ->> 'email')
);

REVOKE INSERT, UPDATE, DELETE ON public.organizations FROM anon, authenticated;

-- 2. Create the dedicated login_credentials table for ALL logins (Super Admin & Organizations)
CREATE TABLE IF NOT EXISTS public.login_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'super_admin',
    name TEXT,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tighten RLS on public.login_credentials:
-- Deny all direct anon/authenticated access; only server-side service_role accesses this table.
ALTER TABLE public.login_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for login_credentials" ON public.login_credentials;
REVOKE ALL ON public.login_credentials FROM anon, authenticated;

-- 3. Trigger to clean up login_credentials whenever an organization is deleted
CREATE OR REPLACE FUNCTION public.cleanup_login_credentials_on_org_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.login_credentials
    WHERE lower(email) = lower(OLD.email);
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_login_credentials_on_org_delete ON public.organizations;
CREATE TRIGGER trg_cleanup_login_credentials_on_org_delete
AFTER DELETE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_login_credentials_on_org_delete();

-- 4. Seed initial Super Admin credentials
INSERT INTO public.login_credentials (email, password, role, name)
VALUES ('admin@lumeconnect.com', 'admin123', 'super_admin', 'TravLume Super Admin')
ON CONFLICT (email) DO UPDATE
SET password = EXCLUDED.password, last_login = now();
