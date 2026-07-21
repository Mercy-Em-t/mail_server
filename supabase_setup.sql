-- Run this entire script in the Supabase SQL Editor

-- 1. Create mail_clients table
CREATE TABLE IF NOT EXISTS public.mail_clients (
    client_id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    domain TEXT NOT NULL,
    secret TEXT NOT NULL,
    allowed_message_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_quota INTEGER NOT NULL DEFAULT 500,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create mail_templates table
CREATE TABLE IF NOT EXISTS public.mail_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    message_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    html TEXT NOT NULL,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create system_logs table (replaces logs.txt)
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure audit_logs table exists (from previous implementation, just to be safe)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client TEXT,
    recipient TEXT,
    subject TEXT,
    template TEXT,
    message_type TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: No RLS needed for these if accessed purely via backend Service Role Key
