-- tournaments 버킷 파일 크기 제한 5MB → 10MB 상향
UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10MB
WHERE id = 'tournaments';
