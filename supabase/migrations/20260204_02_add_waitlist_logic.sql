-- Migration: Add Waitlist Logic (Constraints and Functions)
-- Description: Adds unique constraints and RPCs for atomic registration/cancellation.
-- Depends on 20260204_01_add_waitlist_enums.sql

-- 1. Add Unique Constraint
-- Prevent duplicate entries for same user in same tournament
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uniq_tournament_user'
    ) THEN
        ALTER TABLE public.tournament_entries 
        ADD CONSTRAINT uniq_tournament_user UNIQUE (tournament_id, user_id);
    END IF;
END $$;

-- 2. Functions (RPC)

-- 2.1 register_team
CREATE OR REPLACE FUNCTION public.register_team(
  p_tournament_id uuid,
  p_user_id uuid,
  p_division_id uuid,
  p_player_name text,
  p_phone text,
  p_player_rating numeric DEFAULT NULL,
  p_club_name text DEFAULT NULL,
  p_team_order text DEFAULT NULL,
  p_partner_data jsonb DEFAULT NULL,
  p_team_members jsonb DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_capacity int;
  v_current_count int;
  v_status public.entry_status;
  v_entry_id uuid;
  v_wait_number int;
  v_entry_number int;
BEGIN
  -- Check tournament status
  IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = p_tournament_id AND status = 'OPEN') THEN
      RETURN jsonb_build_object('status', 'ERROR', 'message', 'Tournament is not open for registration');
  END IF;

  -- 1. Lock tournament row (Advisory lock to prevent race condition on capacity check)
  -- Perform advisory lock based on tournament_id part
  PERFORM pg_advisory_xact_lock(hashtext('register_' || p_tournament_id::text));

  -- Get max participants (capacity)
  SELECT max_participants INTO v_capacity
  FROM public.tournaments
  WHERE id = p_tournament_id;

  -- 2. Count currently CONFIRMED entries
  SELECT count(*) INTO v_current_count
  FROM public.tournament_entries
  WHERE tournament_id = p_tournament_id
  AND status = 'CONFIRMED';

  -- 3. Determine Status
  IF v_current_count < v_capacity THEN
    v_status := 'CONFIRMED';
    v_wait_number := NULL;
  ELSE
    v_status := 'WAITLISTED';
    -- Calculate wait number
    SELECT count(*) + 1 INTO v_wait_number
    FROM public.tournament_entries
    WHERE tournament_id = p_tournament_id
    AND status = 'WAITLISTED';
  END IF;

  -- Calculate entry_number (visual ID for the tournament)
  SELECT COALESCE(MAX(entry_number), 0) + 1 INTO v_entry_number
  FROM public.tournament_entries
  WHERE tournament_id = p_tournament_id;

  -- 4. Insert Entry
  INSERT INTO public.tournament_entries (
    tournament_id, 
    user_id, 
    division_id, 
    status, 
    player_name, 
    phone, 
    created_at,
    player_rating,
    club_name,
    team_order,
    partner_data,
    team_members,
    entry_number,
    payment_status
  ) VALUES (
    p_tournament_id, 
    p_user_id, 
    p_division_id, 
    v_status, 
    p_player_name, 
    p_phone, 
    now(),
    p_player_rating,
    p_club_name,
    p_team_order,
    CASE WHEN p_partner_data IS NULL THEN NULL ELSE p_partner_data END,
    CASE WHEN p_team_members IS NULL THEN NULL ELSE p_team_members END,
    v_entry_number,
    'PENDING'
  ) RETURNING id INTO v_entry_id;

  RETURN jsonb_build_object(
    'entry_id', v_entry_id,
    'status', v_status,
    'wait_number', v_wait_number,
    'message', CASE WHEN v_status = 'CONFIRMED' THEN 'Registration confirmed' ELSE 'Added to waitlist' END
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'ERROR', 'message', 'Already registered');
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in register_team: %', SQLERRM;
    RETURN jsonb_build_object('status', 'ERROR', 'message', 'Internal server error');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 cancel_entry
CREATE OR REPLACE FUNCTION public.cancel_entry(
  p_entry_id uuid,
  p_user_id uuid
) RETURNS jsonb AS $$
DECLARE
  v_tournament_id uuid;
  v_old_status public.entry_status;
  v_promoted_entry_id uuid;
  v_promoted_user_id uuid;
BEGIN
  -- 1. Lock and Get Entry Info
  SELECT tournament_id, status 
  INTO v_tournament_id, v_old_status
  FROM public.tournament_entries
  WHERE id = p_entry_id AND user_id = p_user_id
  FOR UPDATE; -- Lock this row

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'ERROR', 'message', 'Entry not found or unauthorized');
  END IF;

  -- 2. Update status to CANCELLED
  UPDATE public.tournament_entries
  SET status = 'CANCELLED', updated_at = now()
  WHERE id = p_entry_id;

  -- 3. If it was CONFIRMED, promote the next WAITLISTED person
  v_promoted_entry_id := NULL;
  
  IF v_old_status = 'CONFIRMED' THEN
    -- Lock potential next candidate
    WITH next_in_line AS (
      SELECT id
      FROM public.tournament_entries
      WHERE tournament_id = v_tournament_id
      AND status = 'WAITLISTED'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.tournament_entries
    SET status = 'CONFIRMED', updated_at = now()
    FROM next_in_line
    WHERE public.tournament_entries.id = next_in_line.id
    RETURNING public.tournament_entries.id, public.tournament_entries.user_id 
    INTO v_promoted_entry_id, v_promoted_user_id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'CANCELLED',
    'promoted_entry_id', v_promoted_entry_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.3 get_waitlist_number
CREATE OR REPLACE FUNCTION public.get_waitlist_number(p_entry_id uuid)
RETURNS int AS $$
  SELECT count(*)::int + 1
  FROM public.tournament_entries
  WHERE tournament_id = (SELECT tournament_id FROM public.tournament_entries WHERE id = p_entry_id)
  AND status = 'WAITLISTED'
  AND created_at < (SELECT created_at FROM public.tournament_entries WHERE id = p_entry_id);
$$ LANGUAGE sql STABLE;
