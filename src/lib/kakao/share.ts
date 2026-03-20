/**
 * 카카오톡 공유 유틸리티
 * - Kakao JavaScript SDK 동적 로드
 * - 피드형 메시지 공유
 */

// Kakao SDK 타입 (최소한만 정의)
interface KakaoShareContent {
  title: string
  description: string
  imageUrl?: string
  link: { mobileWebUrl: string; webUrl: string }
}

interface KakaoShareParams {
  objectType: 'feed'
  content: KakaoShareContent
  buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[]
}

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void
      isInitialized: () => boolean
      Share: {
        sendDefault: (params: KakaoShareParams) => void
      }
    }
  }
}

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'

let sdkLoadPromise: Promise<void> | null = null

/** SDK 스크립트 로드 + 초기화 (1회만) */
function loadKakaoSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise

  sdkLoadPromise = new Promise((resolve, reject) => {
    // 이미 로드됨
    if (window.Kakao) {
      initKakao()
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = KAKAO_SDK_URL
    script.async = true
    script.onload = () => {
      initKakao()
      resolve()
    }
    script.onerror = () => {
      sdkLoadPromise = null
      reject(new Error('카카오 SDK 로드 실패'))
    }
    document.head.appendChild(script)
  })

  return sdkLoadPromise
}

function initKakao() {
  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  if (!appKey) return
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(appKey)
  }
}

/** 카카오톡 피드형 공유 */
export async function shareKakao(params: {
  title: string
  description: string
  imageUrl?: string
  pageUrl: string
}) {
  // 상대경로 전달 시 현재 origin으로 절대경로 변환 (모든 경로에서 공통 사용)
  const absoluteUrl = params.pageUrl.startsWith('http')
    ? params.pageUrl
    : `${window.location.origin}${params.pageUrl}`

  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  if (!appKey) {
    // 앱 키 미설정 시 URL 복사 폴백
    await copyToClipboard(absoluteUrl)
    return { fallback: true }
  }

  try {
    await loadKakaoSdk()
  } catch {
    // SDK 로드 실패 시 URL 복사 폴백
    await copyToClipboard(absoluteUrl)
    return { fallback: true }
  }

  if (!window.Kakao) {
    await copyToClipboard(absoluteUrl)
    return { fallback: true }
  }

  window.Kakao.Share.sendDefault({
    objectType: 'feed',
    content: {
      title: params.title,
      description: params.description,
      ...(params.imageUrl ? { imageUrl: params.imageUrl } : {}),
      link: {
        mobileWebUrl: absoluteUrl,
        webUrl: absoluteUrl,
      },
    },
    buttons: [
      {
        title: '자세히 보기',
        link: {
          mobileWebUrl: absoluteUrl,
          webUrl: absoluteUrl,
        },
      },
    ],
  })

  return { fallback: false }
}

/** 클립보드 복사 (폴백) */
async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard API 미지원 시 무시
  }
}
