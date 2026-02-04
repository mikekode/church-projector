-- Creenly Usage-Based Pricing Migration
-- Run this in your Supabase SQL Editor for project: ejqzexdkoqbvgmjtbbwd
-- 
-- This adds usage tracking columns to support hour-based licensing:
--   - Monthly: 40 hours
--   - 6-Month: 240 hours  
--   - Annual: 480 hours

-- Add usage tracking columns
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS usage_hours_limit DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS usage_hours_used DECIMAL(10,2) DEFAULT 0;

-- Add plan column if it doesn't exist (for existing tables)
ALTER TABLE public.licenses 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly';

-- Create RPC function for secure usage increment
-- This prevents clients from directly manipulating usage values
CREATE OR REPLACE FUNCTION increment_usage(
    p_license_key TEXT,
    p_hours DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result BOOLEAN;
BEGIN
    UPDATE public.licenses 
    SET usage_hours_used = COALESCE(usage_hours_used, 0) + p_hours,
        updated_at = NOW()
    WHERE license_key = p_license_key
      AND status = 'active'
      AND (usage_hours_limit IS NULL OR COALESCE(usage_hours_used, 0) + p_hours <= usage_hours_limit);
    
    GET DIAGNOSTICS v_result = ROW_COUNT;
    RETURN v_result > 0;
END;
$$;

-- Grant execute permission to anon role (for client access)
GRANT EXECUTE ON FUNCTION increment_usage(TEXT, DECIMAL) TO anon;

-- Create function to check remaining hours
CREATE OR REPLACE FUNCTION get_remaining_hours(p_license_key TEXT)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limit DECIMAL;
    v_used DECIMAL;
BEGIN
    SELECT usage_hours_limit, COALESCE(usage_hours_used, 0)
    INTO v_limit, v_used
    FROM public.licenses
    WHERE license_key = p_license_key;
    
    IF v_limit IS NULL THEN
        RETURN NULL; -- Unlimited (legacy license)
    END IF;
    
    RETURN GREATEST(0, v_limit - v_used);
END;
$$;

GRANT EXECUTE ON FUNCTION get_remaining_hours(TEXT) TO anon;

-- Update check constraint to include new plan type
ALTER TABLE public.licenses DROP CONSTRAINT IF EXISTS licenses_status_check;
ALTER TABLE public.licenses ADD CONSTRAINT licenses_status_check 
    CHECK (status IN ('active', 'expired', 'cancelled', 'demo'));

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_licenses_usage ON public.licenses(license_key, usage_hours_used, usage_hours_limit);

-- Success message
DO $$ BEGIN RAISE NOTICE 'Usage tracking migration completed successfully!'; END $$;
