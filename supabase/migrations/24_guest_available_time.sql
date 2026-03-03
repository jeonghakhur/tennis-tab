-- Migration 24: Add available_from/until to club_session_guests
-- 게스트도 멤버처럼 참석 가능 시간을 등록할 수 있도록 컬럼 추가

ALTER TABLE club_session_guests
  ADD COLUMN available_from  TIME,
  ADD COLUMN available_until TIME;
