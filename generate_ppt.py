"""Tennis-Tab 프로젝트 소개 PPT 생성 스크립트"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE

# 색상 정의
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x1A, 0x1A, 0x2E)
DARK_BG = RGBColor(0x16, 0x21, 0x3E)
ACCENT_GREEN = RGBColor(0x10, 0xB9, 0x81)  # emerald-500
ACCENT_BLUE = RGBColor(0x38, 0x82, 0xF6)
LIGHT_GRAY = RGBColor(0x94, 0xA3, 0xB8)
CARD_BG = RGBColor(0x1E, 0x29, 0x3B)
SOFT_WHITE = RGBColor(0xF1, 0xF5, 0xF9)
ORANGE = RGBColor(0xF9, 0x73, 0x16)
PURPLE = RGBColor(0xA7, 0x8B, 0xFA)
YELLOW = RGBColor(0xFB, 0xBF, 0x24)
RED = RGBColor(0xEF, 0x44, 0x44)

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)


def set_slide_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_shape(slide, left, top, width, height, fill_color, corner_radius=None):
    shape = slide.shapes.add_shape(
        MSO_SHAPE.ROUNDED_RECTANGLE if corner_radius else MSO_SHAPE.RECTANGLE,
        left, top, width, height
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.fill.background()
    if corner_radius:
        shape.adjustments[0] = corner_radius
    return shape


def add_text(slide, left, top, width, height, text, font_size=18,
             color=WHITE, bold=False, alignment=PP_ALIGN.LEFT, font_name="맑은 고딕"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox


def add_card(slide, left, top, width, height, title, items, icon="",
             title_color=ACCENT_GREEN, bg_color=CARD_BG):
    card = add_shape(slide, left, top, width, height, bg_color, 0.05)

    # 타이틀
    add_text(slide, left + Inches(0.3), top + Inches(0.2), width - Inches(0.6), Inches(0.5),
             f"{icon}  {title}", font_size=16, color=title_color, bold=True)

    # 항목
    y = top + Inches(0.7)
    for item in items:
        add_text(slide, left + Inches(0.4), y, width - Inches(0.8), Inches(0.35),
                 f"•  {item}", font_size=12, color=SOFT_WHITE)
        y += Inches(0.32)


def add_badge(slide, left, top, text, color=ACCENT_GREEN):
    w = Inches(len(text) * 0.13 + 0.4)
    shape = add_shape(slide, left, top, w, Inches(0.35), color, 0.3)
    shape.fill.fore_color.rgb = color
    tf = shape.text_frame
    tf.word_wrap = False
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(10)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.font.name = "맑은 고딕"
    return w


# ========== 슬라이드 1: 표지 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

# 장식 요소
add_shape(slide, Inches(0), Inches(0), Inches(13.333), Inches(0.06), ACCENT_GREEN)

# 서브텍스트
add_text(slide, Inches(1.5), Inches(2.0), Inches(10), Inches(0.5),
         "종합 테니스 플랫폼", font_size=20, color=ACCENT_GREEN, bold=True,
         alignment=PP_ALIGN.CENTER)

# 메인 타이틀
add_text(slide, Inches(1.5), Inches(2.6), Inches(10), Inches(1.5),
         "Tennis-Tab", font_size=60, color=WHITE, bold=True,
         alignment=PP_ALIGN.CENTER)

# 설명
add_text(slide, Inches(2), Inches(4.2), Inches(9), Inches(0.8),
         "대회 관리  ·  클럽 운영  ·  레슨 시스템  ·  커뮤니티  ·  AI 챗봇",
         font_size=18, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

# 기술 스택 배지
badges = ["Next.js 16", "React 19", "Supabase", "TypeScript", "Tailwind CSS"]
start_x = Inches(3.2)
y = Inches(5.2)
for badge_text in badges:
    w = add_badge(slide, start_x, y, badge_text, DARK_BG)
    start_x += w + Inches(0.15)

add_text(slide, Inches(1.5), Inches(6.5), Inches(10), Inches(0.4),
         "2026.03", font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)


# ========== 슬라이드 2: 프로젝트 개요 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_text(slide, Inches(0.8), Inches(0.5), Inches(10), Inches(0.6),
         "프로젝트 개요", font_size=32, color=WHITE, bold=True)
add_shape(slide, Inches(0.8), Inches(1.1), Inches(1.5), Inches(0.05), ACCENT_GREEN)

# 왼쪽: 핵심 기능 카드
features = [
    ("대회 관리", ["단식/복식/단체전 지원", "예선·본선 대진표 자동 생성", "참가 신청 & 결제 통합"], "🏆", ACCENT_GREEN),
    ("클럽 운영", ["회원 관리 & 역할 체계", "정기 모임 & 자동 대진", "경기 결과 & 통계"], "🎾", ACCENT_BLUE),
    ("레슨 시스템", ["코치 등록 & 프로그램 관리", "수강 신청 & 일정 관리", "출석 & 결제 추적"], "📚", ORANGE),
]

x_pos = Inches(0.8)
for title, items, icon, color in features:
    add_card(slide, x_pos, Inches(1.6), Inches(3.7), Inches(2.4),
             title, items, icon, color)
    x_pos += Inches(3.9)

# 하단 카드
bottom_features = [
    ("커뮤니티", ["공지·자유·정보·후기 게시판", "댓글, 좋아요, 파일 첨부"], "💬", PURPLE),
    ("AI 챗봇", ["대회 검색 & 참가 신청 자동화", "의도 분류 기반 대화 처리"], "🤖", YELLOW),
    ("알림 시스템", ["15가지 알림 유형", "카카오 알림톡 연동 (Solapi)"], "🔔", RED),
]

x_pos = Inches(0.8)
for title, items, icon, color in bottom_features:
    add_card(slide, x_pos, Inches(4.3), Inches(3.7), Inches(2.0),
             title, items, icon, color)
    x_pos += Inches(3.9)


# ========== 슬라이드 3: 기술 아키텍처 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_text(slide, Inches(0.8), Inches(0.5), Inches(10), Inches(0.6),
         "기술 아키텍처", font_size=32, color=WHITE, bold=True)
add_shape(slide, Inches(0.8), Inches(1.1), Inches(1.5), Inches(0.05), ACCENT_GREEN)

# 아키텍처 레이어
layers = [
    ("프론트엔드", ACCENT_BLUE, [
        "Next.js 16 (App Router, Turbopack)",
        "React 19 (Server Components)",
        "Tailwind CSS + 다크모드",
        "DnD Kit (드래그앤드롭)",
        "Tiptap (리치 텍스트 에디터)",
    ]),
    ("백엔드", ACCENT_GREEN, [
        "Server Actions (인증·권한 체크)",
        "Supabase (PostgreSQL + RLS)",
        "Supabase Realtime (실시간)",
        "Supabase Storage (파일 업로드)",
        "Redis (세션 캐시)",
    ]),
    ("외부 서비스", ORANGE, [
        "Toss Payments (결제/환불)",
        "Naver OAuth (소셜 로그인)",
        "Solapi (카카오 알림톡)",
        "Google GenAI (AI 챗봇)",
        "Vercel (배포 & CDN)",
    ]),
]

x_pos = Inches(0.8)
for title, color, items in layers:
    # 헤더
    header = add_shape(slide, x_pos, Inches(1.6), Inches(3.7), Inches(0.5), color, 0.03)
    tf = header.text_frame
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(16)
    p.font.color.rgb = WHITE
    p.font.bold = True
    p.font.name = "맑은 고딕"

    # 항목들
    y = Inches(2.3)
    for item in items:
        item_card = add_shape(slide, x_pos + Inches(0.1), y,
                              Inches(3.5), Inches(0.45), CARD_BG, 0.05)
        add_text(slide, x_pos + Inches(0.3), y + Inches(0.05),
                 Inches(3.1), Inches(0.35), item, font_size=12, color=SOFT_WHITE)
        y += Inches(0.55)

    x_pos += Inches(3.9)

# 보안 섹션
add_text(slide, Inches(0.8), Inches(5.4), Inches(11), Inches(0.4),
         "보안 패턴", font_size=18, color=WHITE, bold=True)

security_items = [
    "Server Actions — 모든 mutation에 인증/권한 체크 필수",
    "입력값 3단계 검증 — 클라이언트 sanitize → 서버 validate → DB 제약조건",
    "TypeScript strict — any 타입 금지, XSS 방지 sanitize",
    "환경변수 — 미설정 시 throw (fallback 키 금지)"
]

x_pos = Inches(0.8)
for item in security_items:
    w = Inches(2.8) if len(item) < 30 else Inches(3.2)
    badge_shape = add_shape(slide, x_pos, Inches(5.9), w, Inches(0.4), CARD_BG, 0.05)
    add_text(slide, x_pos + Inches(0.15), Inches(5.93), w - Inches(0.3), Inches(0.35),
             item, font_size=9, color=SOFT_WHITE)
    x_pos += w + Inches(0.15)


# ========== 슬라이드 4: 대회 관리 상세 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_text(slide, Inches(0.8), Inches(0.5), Inches(10), Inches(0.6),
         "대회 관리 시스템", font_size=32, color=WHITE, bold=True)
add_shape(slide, Inches(0.8), Inches(1.1), Inches(1.5), Inches(0.05), ACCENT_GREEN)

# 대회 상태 흐름
add_text(slide, Inches(0.8), Inches(1.5), Inches(5), Inches(0.4),
         "대회 상태 흐름", font_size=16, color=ACCENT_GREEN, bold=True)

statuses = ["DRAFT", "UPCOMING", "OPEN", "CLOSED", "IN_PROGRESS", "COMPLETED"]
status_colors = [LIGHT_GRAY, ACCENT_BLUE, ACCENT_GREEN, ORANGE, PURPLE, YELLOW]

x = Inches(0.8)
for i, (status, color) in enumerate(zip(statuses, status_colors)):
    add_badge(slide, x, Inches(2.0), status, color)
    if i < len(statuses) - 1:
        add_text(slide, x + Inches(len(status) * 0.13 + 0.45), Inches(1.97),
                 Inches(0.3), Inches(0.35), "→", font_size=14, color=LIGHT_GRAY)
    x += Inches(len(status) * 0.13 + 0.7)

# 참가 신청 흐름
add_text(slide, Inches(0.8), Inches(2.7), Inches(5), Inches(0.4),
         "참가 신청 프로세스", font_size=16, color=ACCENT_GREEN, bold=True)

entry_flow = ["신청 (PENDING)", "심사", "승인/거절", "결제", "확정 (CONFIRMED)"]
x = Inches(0.8)
for i, step in enumerate(entry_flow):
    add_badge(slide, x, Inches(3.2), step, CARD_BG)
    w = Inches(len(step) * 0.13 + 0.4)
    if i < len(entry_flow) - 1:
        add_text(slide, x + w + Inches(0.05), Inches(3.17),
                 Inches(0.3), Inches(0.35), "→", font_size=14, color=LIGHT_GRAY)
    x += w + Inches(0.35)

# 대진표 시스템
add_card(slide, Inches(0.8), Inches(3.9), Inches(5.5), Inches(3.0),
         "대진표 시스템", [
             "조편성: 드래그앤드롭으로 팀 배치",
             "예선: 조별 풀리그 → 상위팀 본선 진출",
             "본선: Single/Double Elimination 자동 생성",
             "매치 페이즈: 128강 → 64강 → ... → 결승",
             "3/4위전 지원 (선택)",
             "단체전: Best-of-N 세트별 상세 결과 관리",
             "DEV: 자동 결과 입력 (랜덤 점수 생성)"
         ], "📊", ACCENT_BLUE)

# 경기 유형
add_card(slide, Inches(6.8), Inches(3.9), Inches(5.5), Inches(3.0),
         "지원 경기 유형", [
             "개인전 단식 (Singles)",
             "개인전 복식 (Doubles) — 파트너 정보 관리",
             "단체전 단식 (Team Singles)",
             "단체전 복식 (Team Doubles)",
             "세트별 선수 배정 + 점수 기록",
             "결제: Toss Payments 연동",
             "환불: 관리자 처리 + 알림톡 발송"
         ], "🎾", ORANGE)


# ========== 슬라이드 5: 클럽 & 레슨 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_text(slide, Inches(0.8), Inches(0.5), Inches(10), Inches(0.6),
         "클럽 운영 & 레슨 시스템", font_size=32, color=WHITE, bold=True)
add_shape(slide, Inches(0.8), Inches(1.1), Inches(1.5), Inches(0.05), ACCENT_GREEN)

# 클럽 관리
add_card(slide, Inches(0.8), Inches(1.5), Inches(5.8), Inches(2.5),
         "클럽 관리", [
             "가입 유형: OPEN / APPROVAL / INVITE_ONLY",
             "회원 역할: OWNER > ADMIN > MEMBER",
             "회원 상태: ACTIVE / PENDING / INVITED / LEFT",
             "지역 기반 검색 (시·군·구)",
             "협회 소속 연결",
         ], "🏠", ACCENT_BLUE)

add_card(slide, Inches(7.0), Inches(1.5), Inches(5.8), Inches(2.5),
         "클럽 모임", [
             "RSVP: ATTENDING / NOT_ATTENDING / UNDECIDED",
             "자동 대진: 성별·시간 가용성 고려",
             "경기 종류: 단식 / 복식(남/여/혼합)",
             "게스트 참석 지원",
             "분쟁 해결: 점수 불일치 시 관리자 결정",
         ], "📅", ACCENT_GREEN)

# 레슨 시스템
add_card(slide, Inches(0.8), Inches(4.3), Inches(5.8), Inches(2.8),
         "레슨 프로그램", [
             "코치 등록: 경력, 자격증, 프로필",
             "프로그램: 레벨별 (입문~고급)",
             "요금: 평일/주말, 1인/2인 차등",
             "수강 상태: PENDING → CONFIRMED → WAITLISTED",
             "슬롯 기반 일정 관리",
             "레슨 문의: 슬롯 없을 때 희망 일정 신청",
         ], "📚", ORANGE)

add_card(slide, Inches(7.0), Inches(4.3), Inches(5.8), Inches(2.8),
         "레슨 운영", [
             "출석 관리: PRESENT / ABSENT / LATE",
             "일정 변경 요청 & 승인 프로세스",
             "월별 결제 기록 (계좌이체/현금/기타)",
             "패키지 연장: 월별 독립 관리",
             "연장 알림톡: Solapi 카카오 알림톡",
             "코치 어드민: 코치별 레슨 관리 페이지",
         ], "⚙️", PURPLE)


# ========== 슬라이드 6: 사용자 경험 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_text(slide, Inches(0.8), Inches(0.5), Inches(10), Inches(0.6),
         "사용자 경험 & 부가 기능", font_size=32, color=WHITE, bold=True)
add_shape(slide, Inches(0.8), Inches(1.1), Inches(1.5), Inches(0.05), ACCENT_GREEN)

# AI 챗봇
add_card(slide, Inches(0.8), Inches(1.5), Inches(3.7), Inches(3.0),
         "AI 챗봇", [
             "Google GenAI 기반 의도 분류",
             "대회 검색 & 정보 조회",
             "참가 신청 대화형 플로우",
             "복식 파트너 검색",
             "단체전 팀원 추가",
             "참가 취소 자동 처리",
             "수상 기록 & 대진표 조회",
         ], "🤖", YELLOW)

# 커뮤니티
add_card(slide, Inches(4.8), Inches(1.5), Inches(3.7), Inches(3.0),
         "커뮤니티", [
             "카테고리: 공지/자유/정보/후기",
             "Tiptap 리치 텍스트 에디터",
             "이미지 & 문서 파일 첨부",
             "댓글 & 좋아요",
             "조회수 추적",
             "관리자 상단 고정",
             "카카오톡 공유 버튼",
         ], "💬", PURPLE)

# 마이페이지
add_card(slide, Inches(8.8), Inches(1.5), Inches(3.7), Inches(3.0),
         "마이페이지", [
             "프로필 조회 & 수정",
             "내 참가 내역 관리",
             "내 클럽 & 회원 전적",
             "내 레슨 수강 현황",
             "레슨 연장 신청",
             "알림 센터",
             "예약 현황",
         ], "👤", ACCENT_BLUE)

# 하단 카드
add_card(slide, Inches(0.8), Inches(4.8), Inches(3.7), Inches(2.2),
         "알림 시스템", [
             "15가지 알림 유형 (사용자 10 + 관리자 5)",
             "카카오 알림톡 (Solapi)",
             "인앱 알림 센터",
             "실시간 읽음 처리",
         ], "🔔", RED)

add_card(slide, Inches(4.8), Inches(4.8), Inches(3.7), Inches(2.2),
         "결제 & 정산", [
             "Toss Payments SDK 연동",
             "참가비 결제 & 상태 추적",
             "관리자 환불 처리",
             "레슨비 월별 결제 기록",
         ], "💳", ACCENT_GREEN)

add_card(slide, Inches(8.8), Inches(4.8), Inches(3.7), Inches(2.2),
         "SEO & 공유", [
             "OG / Twitter Card 메타태그",
             "JSON-LD 구조화 데이터",
             "Sitemap & Robots.txt",
             "카카오톡 공유 (범용)",
         ], "🔍", ORANGE)


# ========== 슬라이드 7: 권한 체계 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_text(slide, Inches(0.8), Inches(0.5), Inches(10), Inches(0.6),
         "권한 체계 & 관리자 기능", font_size=32, color=WHITE, bold=True)
add_shape(slide, Inches(0.8), Inches(1.1), Inches(1.5), Inches(0.05), ACCENT_GREEN)

# 권한 레벨
add_text(slide, Inches(0.8), Inches(1.5), Inches(11), Inches(0.4),
         "시스템 권한 레벨 (5단계)", font_size=18, color=ACCENT_GREEN, bold=True)

roles = [
    ("SUPER_ADMIN", "Lv.4", "전체 시스템 관리, 권한 변경", RED),
    ("ADMIN", "Lv.3", "대회 생성/관리, 참가자 관리", ORANGE),
    ("MANAGER", "Lv.2", "자신의 대회만 관리", YELLOW),
    ("USER", "Lv.1", "대회 참가, 클럽 활동", ACCENT_GREEN),
    ("RESTRICTED", "Lv.0", "일부 서비스 제한", LIGHT_GRAY),
]

x = Inches(0.8)
for role, level, desc, color in roles:
    card = add_shape(slide, x, Inches(2.1), Inches(2.3), Inches(1.5), CARD_BG, 0.05)
    add_badge(slide, x + Inches(0.15), Inches(2.25), level, color)
    add_text(slide, x + Inches(0.15), Inches(2.7), Inches(2.0), Inches(0.4),
             role, font_size=13, color=WHITE, bold=True)
    add_text(slide, x + Inches(0.15), Inches(3.1), Inches(2.0), Inches(0.5),
             desc, font_size=10, color=LIGHT_GRAY)
    x += Inches(2.4)

# 관리자 기능
add_text(slide, Inches(0.8), Inches(3.9), Inches(11), Inches(0.4),
         "관리자 대시보드", font_size=18, color=ACCENT_GREEN, bold=True)

admin_features = [
    ("대회 관리", ["대회 CRUD", "부서 설정", "참가자 심사", "대진표 관리", "결과 입력"]),
    ("클럽 관리", ["클럽 CRUD", "회원 관리", "모임 관리", "코치 등록", "레슨 관리"]),
    ("시스템 관리", ["협회 관리", "FAQ 관리", "문의 답변", "사용자 권한", "알림 관리"]),
    ("고객 지원", ["문의 접수/답변", "환불 처리", "공지사항 관리", "가이드 관리", "온보딩"]),
]

x = Inches(0.8)
for title, items in admin_features:
    add_card(slide, x, Inches(4.4), Inches(2.9), Inches(2.7),
             title, items, "", ACCENT_BLUE, CARD_BG)
    x += Inches(3.05)


# ========== 슬라이드 8: 마무리 ==========
slide = prs.slides.add_slide(prs.slide_layouts[6])
set_slide_bg(slide, BLACK)

add_shape(slide, Inches(0), Inches(7.44), Inches(13.333), Inches(0.06), ACCENT_GREEN)

add_text(slide, Inches(1.5), Inches(1.5), Inches(10), Inches(0.6),
         "Tennis-Tab", font_size=48, color=WHITE, bold=True,
         alignment=PP_ALIGN.CENTER)

add_text(slide, Inches(1.5), Inches(2.3), Inches(10), Inches(0.5),
         "종합 테니스 플랫폼", font_size=22, color=ACCENT_GREEN,
         alignment=PP_ALIGN.CENTER)

# 핵심 수치 카드
stats = [
    ("6+", "핵심 도메인", "대회·클럽·레슨·커뮤니티·알림·결제"),
    ("15+", "알림 유형", "사용자 & 관리자 맞춤 알림"),
    ("5단계", "권한 체계", "SUPER_ADMIN → RESTRICTED"),
    ("AI", "챗봇 통합", "대화형 대회 참가 & 검색"),
]

x = Inches(1.2)
for num, title, desc in stats:
    card = add_shape(slide, x, Inches(3.5), Inches(2.6), Inches(1.8), CARD_BG, 0.05)
    add_text(slide, x, Inches(3.65), Inches(2.6), Inches(0.6),
             num, font_size=32, color=ACCENT_GREEN, bold=True,
             alignment=PP_ALIGN.CENTER)
    add_text(slide, x, Inches(4.2), Inches(2.6), Inches(0.4),
             title, font_size=16, color=WHITE, bold=True,
             alignment=PP_ALIGN.CENTER)
    add_text(slide, x, Inches(4.6), Inches(2.6), Inches(0.5),
             desc, font_size=11, color=LIGHT_GRAY,
             alignment=PP_ALIGN.CENTER)
    x += Inches(2.8)

add_text(slide, Inches(1.5), Inches(5.8), Inches(10), Inches(0.5),
         "Next.js 16  ·  React 19  ·  Supabase  ·  TypeScript  ·  Tailwind CSS",
         font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

add_text(slide, Inches(1.5), Inches(6.3), Inches(10), Inches(0.5),
         "Toss Payments  ·  Google GenAI  ·  Solapi  ·  Vercel",
         font_size=14, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)


# 저장
output_path = "/home/user/tennis-tab/Tennis-Tab_소개.pptx"
prs.save(output_path)
print(f"PPT 생성 완료: {output_path}")
