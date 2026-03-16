-- 기존 활성 클럽 전체를 모집 중으로 설정
UPDATE clubs SET is_recruiting = true WHERE is_active = true;
