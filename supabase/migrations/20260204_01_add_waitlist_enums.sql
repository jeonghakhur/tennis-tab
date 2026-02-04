-- Migration: Add Waitlist Enums
-- Description: Adds WAITLISTED/CONFIRMED/CANCELLED status values.
-- Split into separate file to allow transaction commit before usage in functions.

ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'WAITLISTED';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE public.entry_status ADD VALUE IF NOT EXISTS 'CANCELLED';
