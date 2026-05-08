-- Migration: Add is_group to conversas
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false;
