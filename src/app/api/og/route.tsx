import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')
  const date = searchParams.get('date')
  const type = searchParams.get('type') || 'default'

  if (type === 'tournament' && title) {
    // 2. 대회형
    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            background: 'linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 50%, #2d5a27 100%)',
            display: 'flex',
            flexDirection: 'column',
            padding: '64px 72px',
            fontFamily: 'sans-serif',
            position: 'relative',
          }}
        >
          {/* 상단: 협회명 배지 */}
          <div style={{
            display: 'flex', alignItems: 'center',
            marginBottom: 'auto',
          }}>
            <div style={{
              background: '#ccff00', borderRadius: '10px',
              padding: '8px 20px', fontSize: '22px',
              fontWeight: '900', color: '#0f1f0f',
              letterSpacing: '-0.5px',
            }}>
              마포구테니스협회
            </div>
          </div>

          {/* 대회명 — 매우 크고 굵게 */}
          <div style={{
            fontSize: title.length > 16 ? '72px' : '88px',
            fontWeight: '900',
            color: '#ffffff',
            lineHeight: 1.15,
            marginBottom: '28px',
            maxWidth: '900px',
            letterSpacing: '-2px',
          }}>
            {title}
          </div>

          {/* 날짜 — 크고 accent 색 */}
          {date && (
            <div style={{
              fontSize: '36px',
              fontWeight: '700',
              color: '#ccff00',
              marginBottom: '40px',
              letterSpacing: '-0.5px',
            }}>
              {date}
            </div>
          )}

          {/* 하단 */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{
              fontSize: '24px',
              fontWeight: '600',
              color: 'rgba(255,255,255,0.4)',
              letterSpacing: '0.5px',
            }}>
              mapo-tennis.com
            </div>
            <div style={{
              background: '#ccff00', color: '#0f1f0f',
              padding: '14px 36px', borderRadius: '100px',
              fontSize: '22px', fontWeight: '900',
              letterSpacing: '-0.5px',
            }}>
              참가 신청하기 →
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    )
  }

  // 1. 기본형
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 40%, #2d5a27 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 원 */}
        <div style={{
          position: 'absolute', width: '700px', height: '700px',
          borderRadius: '50%', border: '1px solid rgba(204,255,0,0.08)',
          top: '-150px', right: '-150px',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', width: '500px', height: '500px',
          borderRadius: '50%', border: '1px solid rgba(204,255,0,0.06)',
          bottom: '-150px', left: '-80px',
          display: 'flex',
        }} />

        {/* accent 라인 */}
        <div style={{
          width: '100px', height: '6px',
          background: '#ccff00', borderRadius: '3px',
          marginBottom: '36px',
          display: 'flex',
        }} />

        {/* 메인 타이틀 — 엄청 크게 */}
        <div style={{
          fontSize: '96px',
          fontWeight: '900',
          color: '#ffffff',
          marginBottom: '20px',
          letterSpacing: '-3px',
          lineHeight: 1,
          display: 'flex',
        }}>
          마포구테니스협회
        </div>

        {/* URL 배지 */}
        <div style={{
          background: 'rgba(204,255,0,0.12)',
          border: '2px solid rgba(204,255,0,0.4)',
          borderRadius: '100px',
          padding: '14px 36px',
          fontSize: '26px',
          fontWeight: '700',
          color: '#ccff00',
          letterSpacing: '0.5px',
          display: 'flex',
        }}>
          mapo-tennis.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
