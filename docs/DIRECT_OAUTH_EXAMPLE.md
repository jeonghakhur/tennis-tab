# 직접 OAuth 구현 예시 (참고용)

> ⚠️ **주의**: 현재 프로젝트는 Supabase OAuth를 사용합니다.  
> 이 문서는 참고용이며, 직접 구현이 필요한 경우에만 사용하세요.

---

## 📋 네이버 API 직접 사용

### 1. 환경 변수 설정

```env
NAVER_CLIENT_ID=your_client_id
NAVER_CLIENT_SECRET=your_client_secret
NAVER_CALLBACK_URL=http://localhost:3000/api/auth/naver/callback
```

### 2. 네이버 개발자 센터 설정

1. https://developers.naver.com/apps 접속
2. **애플리케이션 등록**
3. 정보 입력:
   - 애플리케이션 이름: Tennis Tab
   - 사용 API: **네이버 로그인**
   - 로그인 오픈 API 서비스 환경: **PC 웹**
   - 서비스 URL: `http://localhost:3000`
   - **Callback URL**: `http://localhost:3000/api/auth/naver/callback`

### 3. API 라우트 생성

#### `/api/auth/naver/login/route.ts`

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.NAVER_CLIENT_ID
  const redirectUri = encodeURIComponent(process.env.NAVER_CALLBACK_URL!)
  const state = Math.random().toString(36).substring(7)

  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`

  return NextResponse.redirect(naverAuthUrl)
}
```

#### `/api/auth/naver/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error', request.url))
  }

  try {
    // 1. Access Token 받기
    const tokenResponse = await fetch(
      `https://nid.naver.com/oauth2.0/token?grant_type=authorization_code&client_id=${process.env.NAVER_CLIENT_ID}&client_secret=${process.env.NAVER_CLIENT_SECRET}&code=${code}&state=${state}`
    )
    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // 2. 사용자 정보 가져오기
    const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const userData = await userResponse.json()
    const profile = userData.response

    // 3. Supabase에 사용자 생성 또는 로그인
    const supabase = await createClient()
    
    // 이메일로 기존 사용자 확인
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', profile.email)
      .single()

    if (!existingUser) {
      // 신규 사용자 생성
      await supabase.from('profiles').insert({
        email: profile.email,
        name: profile.name,
        avatar_url: profile.profile_image,
      })
    }

    // 세션 생성 로직...
    
    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('Naver OAuth Error:', error)
    return NextResponse.redirect(new URL('/auth/error', request.url))
  }
}
```

### 4. 로그인 버튼

```typescript
'use client'

export function NaverLoginButton() {
  const handleLogin = () => {
    window.location.href = '/api/auth/naver/login'
  }

  return (
    <button
      onClick={handleLogin}
      className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl"
      style={{ backgroundColor: '#03C75A', color: '#FFFFFF' }}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
      </svg>
      <span>네이버 로그인</span>
    </button>
  )
}
```

---

## 📋 카카오 API 직접 사용

### 1. 환경 변수 설정

```env
KAKAO_REST_API_KEY=your_rest_api_key
KAKAO_CLIENT_SECRET=your_admin_key
KAKAO_REDIRECT_URI=http://localhost:3000/api/auth/kakao/callback
```

### 2. 카카오 개발자 센터 설정

1. https://developers.kakao.com 접속
2. **내 애플리케이션** > **애플리케이션 추가하기**
3. 설정:
   - **플랫폼** > **Web 플랫폼 등록**
   - 사이트 도메인: `http://localhost:3000`
   - **카카오 로그인** > **활성화 설정** ON
   - **Redirect URI**: `http://localhost:3000/api/auth/kakao/callback`
   - **동의 항목**: 프로필 정보, 카카오계정(이메일) 필수 동의

### 3. API 라우트 생성

#### `/api/auth/kakao/login/route.ts`

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.KAKAO_REST_API_KEY
  const redirectUri = encodeURIComponent(process.env.KAKAO_REDIRECT_URI!)

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`

  return NextResponse.redirect(kakaoAuthUrl)
}
```

#### `/api/auth/kakao/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/error', request.url))
  }

  try {
    // 1. Access Token 받기
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY!,
        client_secret: process.env.KAKAO_CLIENT_SECRET!,
        redirect_uri: process.env.KAKAO_REDIRECT_URI!,
        code,
      }),
    })
    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // 2. 사용자 정보 가져오기
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const userData = await userResponse.json()
    const { kakao_account } = userData

    // 3. Supabase에 사용자 생성 또는 로그인
    const supabase = await createClient()
    
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', kakao_account.email)
      .single()

    if (!existingUser) {
      await supabase.from('profiles').insert({
        email: kakao_account.email,
        name: kakao_account.profile.nickname,
        avatar_url: kakao_account.profile.profile_image_url,
      })
    }

    return NextResponse.redirect(new URL('/', request.url))
  } catch (error) {
    console.error('Kakao OAuth Error:', error)
    return NextResponse.redirect(new URL('/auth/error', request.url))
  }
}
```

### 4. 로그인 버튼

```typescript
'use client'

export function KakaoLoginButton() {
  const handleLogin = () => {
    window.location.href = '/api/auth/kakao/login'
  }

  return (
    <button
      onClick={handleLogin}
      className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl"
      style={{ backgroundColor: '#FEE500', color: '#000000' }}
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.78 1.784 5.22 4.465 6.606-.184.675-.625 2.37-.719 2.75-.107.438.159.432.335.314.14-.093 2.22-1.516 3.098-2.116.576.079 1.168.126 1.771.126 5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
      </svg>
      <span>카카오 로그인</span>
    </button>
  )
}
```

---

## 🆚 Supabase OAuth vs 직접 구현 비교

| 항목 | Supabase OAuth | 직접 구현 |
|------|---------------|----------|
| **구현 난이도** | 🟢 쉬움 | 🔴 어려움 |
| **보안** | 🟢 자동 관리 | 🟡 직접 관리 |
| **세션 관리** | 🟢 자동 | 🔴 직접 구현 |
| **토큰 갱신** | 🟢 자동 | 🔴 직접 구현 |
| **유지보수** | 🟢 낮음 | 🔴 높음 |
| **커스터마이징** | 🟡 제한적 | 🟢 자유로움 |
| **환경 변수** | 2개 (Supabase) | 4-6개 (각 제공자) |

---

## 🎯 권장사항

### Supabase OAuth 사용 (현재 방식) ✅

**장점:**
- ✅ 간단한 구현 (`signInWithOAuth()` 한 줄)
- ✅ 자동 세션 관리
- ✅ 자동 토큰 갱신
- ✅ 보안 베스트 프랙티스 자동 적용
- ✅ RLS와 완벽한 통합

**사용 예시:**
```typescript
await signInWithOAuth('naver')  // 끝!
```

### 직접 구현이 필요한 경우

다음의 경우에만 직접 구현 고려:
- 네이버/카카오 외 추가 API 사용 (친구 목록, 메시지 전송 등)
- 매우 세밀한 OAuth 플로우 커스터마이징 필요
- Supabase 없이 순수 Next.js 사용

---

## 📚 참고 문서

- [네이버 로그인 API](https://developers.naver.com/docs/login/api)
- [카카오 로그인 API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## 💡 결론

**현재 프로젝트는 Supabase OAuth를 사용하므로:**
- ✅ 환경 변수에 네이버/카카오 키 불필요
- ✅ Supabase 대시보드에서만 설정
- ✅ 코드 간결하고 유지보수 쉬움

**직접 구현은 특별한 이유가 있을 때만 고려하세요!**
