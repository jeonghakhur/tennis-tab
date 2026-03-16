-- Migration 40: coaches 스토리지 버킷 + RLS 정책

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'coaches',
  'coaches',
  true,
  10485760,  -- 10MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

-- 공개 읽기
CREATE POLICY "coaches_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'coaches');

-- 관리자 업로드
CREATE POLICY "coaches_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'coaches'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );

-- 관리자 삭제
CREATE POLICY "coaches_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'coaches'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );
