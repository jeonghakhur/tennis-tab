# Supabase 연동 가이드

## 📋 목차

1. [Supabase 프로젝트 생성](#1-supabase-프로젝트-생성)
2. [데이터베이스 스키마 적용](#2-데이터베이스-스키마-적용)
3. [OAuth 설정 (네이버/카카오)](#3-oauth-설정)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [테스트](#5-테스트)

---

## 1. Supabase 프로젝트 생성

### 1.1 계정 생성
1. https://supabase.com 접속
2. "Start your project" 클릭
3. GitHub 계정으로 로그인

### 1.2 새 프로젝트 생성
1. "New Project" 클릭
2. 프로젝트 정보 입력:
   - **Organization**: 기존 organization 선택 또는 새로 생성
   - **Name**: `tennis-tab`
   - **Database Password**: 강력한 비밀번호 생성 (꼭 저장!)
   - **Region**: `Northeast Asia (Seoul)` 선택
   - **Pricing Plan**: Free tier 선택
3. "Create new project" 클릭 (약 2분 소요)

---

## 2. 데이터베이스 스키마 적용

### 2.1 SQL Editor 열기
1. Supabase 대시보드에서 **SQL Editor** 메뉴 클릭
2. "New query" 클릭

### 2.2 스키마 SQL 실행
1. `supabase/migrations/00_initial_schema.sql` 파일 내용 복사
2. SQL Editor에 붙여넣기
3. **Run** 버튼 클릭
4. 성공 메시지 확인

### 2.3 테이블 확인
1. **Table Editor** 메뉴에서 생성된 테이블 확인:
   - **profiles** (사용자 프로필)
   - tournaments
   - tournament_entries
   - matches
   - chat_logs

### 2.4 첫 번째 SUPER_ADMIN 설정
첫 관리자를 설정하려면 SQL Editor에서:

```sql
-- 본인 이메일을 SUPER_ADMIN으로 설정
UPDATE profiles
SET role = 'SUPER_ADMIN'
WHERE email = 'your-email@example.com';
```

---

## 3. OAuth 설정

### 3.1 네이버 OAuth 설정

#### 네이버 개발자 센터 설정
1. https://developers.naver.com/apps 접속
2. **애플리케이션 등록** 클릭
3. 애플리케이션 정보 입력:
   - **애플리케이션 이름**: Tennis Tab
   - **사용 API**: 네이버 로그인
   - **로그인 오픈 API 서비스 환경**: PC 웹
   - **서비스 URL**: `http://localhost:3000`
   - **Callback URL**: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
4. **등록하기** 클릭
5. **Client ID**와 **Client Secret** 복사

#### Supabase에 네이버 설정
1. Supabase 대시보드 > **Authentication** > **Providers**
2. **Naver** 찾아서 클릭
3. Enable 토글 켜기
4. 네이버에서 복사한 정보 입력:
   - Client ID
   - Client Secret
5. **Save** 클릭

### 3.2 카카오 OAuth 설정

#### 카카오 개발자 센터 설정
1. https://developers.kakao.com 접속
2. **내 애플리케이션** > **애플리케이션 추가하기**
3. 앱 정보 입력:
   - **앱 이름**: Tennis Tab
   - **사업자명**: 개인 또는 회사명
4. 생성 후 **앱 키** > **REST API 키** 복사
5. **플랫폼** > **Web 플랫폼 등록**:
   - **사이트 도메인**: `http://localhost:3000`
6. **카카오 로그인** > **활성화 설정** ON
7. **Redirect URI** 등록:
   - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
8. **동의 항목** 설정:
   - 프로필 정보(닉네임/프로필 사진): 필수 동의
   - 카카오계정(이메일): 필수 동의

#### Supabase에 카카오 설정
1. Supabase 대시보드 > **Authentication** > **Providers**
2. **Kakao** 찾아서 클릭
3. Enable 토글 켜기
4. 카카오에서 복사한 정보 입력:
   - Client ID (REST API 키)
   - Client Secret (Admin 키 - 고급 탭에서 확인)
5. **Save** 클릭

---

## 4. 환경 변수 설정

### 4.1 Supabase API 키 확인
1. Supabase 대시보드 > **Settings** > **API**
2. 다음 정보 복사:
   - **Project URL**
   - **anon public** (공개 키)
   - **service_role** (서비스 키, 비공개!)

### 4.2 .env.local 파일 설정
1. 프로젝트 루트에 `.env.local` 파일 생성 (이미 생성됨)
2. 다음 내용 입력:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Site URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OpenAI (나중에 설정)
OPENAI_API_KEY=sk-your-openai-api-key
```

3. YOUR_PROJECT와 키 값들을 실제 값으로 교체

### 4.3 OAuth Redirect URL 업데이트
1. 네이버/카카오 개발자 센터에서 Callback URL을 실제 Supabase URL로 변경
2. 형식: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

---

## 5. 테스트

### 5.1 개발 서버 실행
```bash
yarn dev
```

### 5.2 로그인 테스트
1. http://localhost:3000/auth/login 접속
2. 네이버 또는 카카오 로그인 버튼 클릭
3. OAuth 인증 진행
4. 성공 시 홈으로 리다이렉트 확인

### 5.3 데이터베이스 확인
1. Supabase > **Table Editor** > **profiles** 테이블
2. 로그인한 사용자 정보가 자동으로 추가되었는지 확인
3. role이 'USER'로 설정되었는지 확인

### 5.4 관리자 권한 부여
필요한 경우 SQL Editor에서:

```sql
-- 특정 사용자를 ADMIN으로 설정
UPDATE profiles
SET role = 'ADMIN'
WHERE email = 'admin@example.com';
```

---

## 🔧 트러블슈팅

### OAuth 리다이렉트 실패
- Callback URL이 정확한지 확인
- Supabase와 네이버/카카오에 동일한 URL이 등록되었는지 확인

### "Invalid API key" 에러
- `.env.local` 파일의 키 값이 정확한지 확인
- 개발 서버 재시작 (환경 변수 변경 시 필수)

### 사용자 프로필이 생성되지 않음
- SQL 마이그레이션이 제대로 실행되었는지 확인
- `handle_new_user()` 함수와 트리거가 생성되었는지 확인
- SQL Editor에서 확인:
  ```sql
  SELECT * FROM profiles WHERE email = 'your-email@example.com';
  ```

### 권한이 제대로 설정되지 않음
- profiles 테이블에서 role 컬럼 확인
- NULL이면 USER로 업데이트:
  ```sql
  UPDATE profiles SET role = 'USER' WHERE role IS NULL;
  ```

---

## 📚 다음 단계

1. ✅ Supabase 연동 완료
2. ⏳ OpenAI API 연동 (자연어 처리)
3. ⏳ 대회 관리 기능 구현
4. ⏳ 대진표 생성 기능 구현
5. ⏳ 채팅 인터페이스 연동

---

## 📞 문의

문제가 발생하면 다음을 확인하세요:
- Supabase 문서: https://supabase.com/docs
- 네이버 로그인 API: https://developers.naver.com/docs/login
- 카카오 로그인 API: https://developers.kakao.com/docs/latest/ko/kakaologin
