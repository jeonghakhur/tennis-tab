# 구글 OAuth 설정 가이드

> ✅ 구글은 Supabase에서 공식 지원하므로 간단하게 설정할 수 있습니다.

---

## 📋 Google Cloud Console 설정

### 1. 프로젝트 생성

1. https://console.cloud.google.com 접속
2. **새 프로젝트 만들기** 클릭
3. 프로젝트 정보 입력:
   - **프로젝트 이름**: Tennis Tab
   - **조직**: 없음 (개인 프로젝트)

### 2. OAuth 동의 화면 구성

1. 좌측 메뉴 > **API 및 서비스** > **OAuth 동의 화면**
2. **User Type**: 외부 선택
3. **앱 정보** 입력:
   - **앱 이름**: Tennis Tab
   - **사용자 지원 이메일**: your-email@gmail.com
   - **앱 로고**: (선택사항)
   - **앱 도메인**:
     - 애플리케이션 홈페이지: `http://localhost:3000`
     - 개인정보처리방침: (선택사항)
     - 서비스 약관: (선택사항)
   - **승인된 도메인**: 프로덕션 도메인 추가 시 입력
   - **개발자 연락처 정보**: your-email@gmail.com

4. **범위** 설정:
   - **범위 추가 또는 삭제** 클릭
   - 다음 범위 선택:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
   - **업데이트** 클릭

5. **테스트 사용자** 추가 (개발 중):
   - 테스트할 구글 계정 이메일 추가

### 3. OAuth 클라이언트 ID 생성

1. 좌측 메뉴 > **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** > **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 정보 입력:
   - **이름**: Tennis Tab Web
   - **승인된 자바스크립트 원본**:
     ```
     http://localhost:3000
     ```
   - **승인된 리디렉션 URI**:
     ```
     https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
     ```
     (Supabase 프로젝트 URL 사용)

5. **만들기** 클릭
6. **클라이언트 ID**와 **클라이언트 보안 비밀** 복사

---

## 🔧 Supabase 설정

### 1. Authentication Provider 활성화

1. Supabase Dashboard 접속
2. **Authentication** > **Providers**
3. **Google** 찾아서 클릭
4. **Enable** 토글 켜기

### 2. Google 인증 정보 입력

- **Client ID (for OAuth)**: Google에서 복사한 클라이언트 ID 입력
- **Client Secret (for OAuth)**: Google에서 복사한 클라이언트 보안 비밀 입력

### 3. Callback URL 확인

Supabase에서 제공하는 Callback URL 확인:
```
https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
```

이 URL을 Google Cloud Console의 **승인된 리디렉션 URI**에 추가했는지 확인!

---

## 🧪 테스트

### 1. 개발 서버 실행

```bash
yarn dev
```

### 2. 로그인 테스트

1. http://localhost:3000/auth/login 접속
2. "구글 로그인" 버튼 클릭
3. 구글 계정 선택
4. 권한 동의
5. 홈으로 리다이렉트 확인

### 3. 데이터베이스 확인

Supabase > Table Editor > profiles 테이블에서 사용자 확인:

```sql
SELECT id, email, name, avatar_url, role
FROM profiles
WHERE email = 'your-gmail@gmail.com';
```

---

## 🔧 트러블슈팅

### "리디렉션 URI 불일치" 에러

**원인**: Google Cloud Console에 등록한 리디렉션 URI와 실제 URI가 다름

**해결**:
1. Google Cloud Console > OAuth 클라이언트 ID
2. **승인된 리디렉션 URI** 확인:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```
3. Supabase 대시보드에서 정확한 URL 복사하여 입력

### "앱이 확인되지 않음" 경고

**원인**: 앱이 아직 Google의 검증을 받지 않음

**해결** (개발 중):
- **고급** > **Tennis Tab(으)로 이동(안전하지 않음)** 클릭
- 또는 OAuth 동의 화면에서 **테스트 사용자** 추가

**해결** (프로덕션):
- Google에 앱 검증 신청
- 또는 **게시 상태**를 "프로덕션"으로 변경

### 프로필이 생성되지 않음

**원인**: `handle_new_user()` 트리거가 실행되지 않음

**해결**:
```sql
-- 트리거 확인
SELECT * FROM pg_trigger
WHERE tgname = 'on_auth_user_created';

-- 트리거 없으면 마이그레이션 재실행
-- supabase/migrations/00_initial_schema.sql
```

---

## 🚀 프로덕션 배포

### 1. 도메인 추가

**Google Cloud Console**:
1. OAuth 동의 화면 > **승인된 도메인** 추가:
   ```
   your-domain.com
   ```

2. OAuth 클라이언트 ID > **승인된 자바스크립트 원본** 추가:
   ```
   https://your-domain.com
   ```

3. **승인된 리디렉션 URI**는 그대로 Supabase URL 사용:
   ```
   https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
   ```

### 2. 테스트 사용자 제거

OAuth 동의 화면 > **게시 상태** > **프로덕션으로 게시**

⚠️ **주의**: 프로덕션 게시 전 개인정보처리방침과 서비스 약관 URL 필수!

---

## 📊 OAuth 제공자 비교

| 제공자 | Supabase 지원 | 구현 방식 | 설정 난이도 |
|--------|-------------|----------|----------|
| **구글** | ✅ 지원 | Supabase OAuth | 🟢 쉬움 |
| **카카오** | ✅ 지원 | Supabase OAuth | 🟢 쉬움 |
| **네이버** | ❌ 미지원 | 직접 구현 | 🟡 보통 |

---

## 🎯 사용 예시

### 로그인 버튼

```typescript
'use client'

import { signInWithOAuth } from '@/lib/auth/actions'

export function GoogleLoginButton() {
  const handleLogin = async () => {
    await signInWithOAuth('google')
  }

  return (
    <button onClick={handleLogin}>
      구글 로그인
    </button>
  )
}
```

### 한 줄로 끝!

```typescript
await signInWithOAuth('google')
```

Supabase가 모든 것을 처리합니다:
- OAuth 플로우
- 토큰 교환
- 세션 생성
- 사용자 정보 저장

---

## 📚 관련 문서

- [Google OAuth 2.0 가이드](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth - Google](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Google Cloud Console](https://console.cloud.google.com)

---

## 💡 요약

### 설정 단계
1. ✅ Google Cloud Console에서 OAuth 클라이언트 ID 생성
2. ✅ Supabase Dashboard에서 Google Provider 활성화
3. ✅ Client ID & Secret 입력
4. ✅ 테스트!

### 장점
- ✅ Supabase가 자동 처리
- ✅ 한 줄 코드로 구현
- ✅ 세션 자동 관리
- ✅ 보안 베스트 프랙티스 적용

구글 로그인은 Supabase 덕분에 가장 쉽게 구현할 수 있습니다! 🎉
