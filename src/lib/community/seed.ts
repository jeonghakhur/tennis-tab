'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { PostCategory } from './types'

/** 테니스 관련 Unsplash 이미지 URL (landscape, 800x600) */
const TENNIS_IMAGES = [
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1530915534664-4ac6423816b7?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1551773188-d4f247dd7399?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1542144582-1ba00456b5e3?w=800&h=600&fit=crop',
  'https://images.unsplash.com/photo-1560012057-4372e14c5085?w=800&h=600&fit=crop',
]

interface SeedPost {
  category: PostCategory
  title: string
  content: string
  attachments: { url: string; name: string; size: number; type: 'image' }[]
}

const SEED_POSTS: SeedPost[] = [
  {
    category: 'NOTICE',
    title: '2026 상반기 대회 일정 안내',
    content: '<p>안녕하세요, 2026년 상반기 대회 일정을 공유합니다.</p><p>3월 서울오픈, 4월 부산챌린저, 5월 대전마스터즈가 예정되어 있습니다. 참가 신청은 각 대회 2주 전부터 가능합니다.</p><p>많은 관심과 참여 부탁드립니다!</p>',
    attachments: [],
  },
  {
    category: 'NOTICE',
    title: '커뮤니티 이용 규칙 안내',
    content: '<p>커뮤니티를 이용해주셔서 감사합니다.</p><p>1. 상호 존중하는 언어를 사용해주세요.<br/>2. 광고성 게시글은 삭제됩니다.<br/>3. 테니스와 관련된 건전한 정보 공유를 환영합니다.</p>',
    attachments: [],
  },
  {
    category: 'FREE',
    title: '오늘 첫 레슨 다녀왔습니다!',
    content: '<p>테니스 시작한 지 일주일 된 초보입니다 😊</p><p>오늘 처음으로 레슨을 받았는데, 포핸드 그립부터 차근차근 알려주셔서 너무 좋았어요. 서브는 아직 공이 네트도 못 넘기지만... 열심히 해보겠습니다!</p><p>다들 처음 시작할 때 어떠셨나요?</p>',
    attachments: [{ url: TENNIS_IMAGES[0], name: '첫레슨.jpg', size: 102400, type: 'image' }],
  },
  {
    category: 'FREE',
    title: '주말 번개 치실 분?',
    content: '<p>이번 주 토요일 오전 10시 잠실 테니스장에서 번개 치실 분 구합니다.</p><p>실력 무관, 즐겁게 치실 분이면 됩니다! 코트는 이미 예약해놨어요.</p><p>관심 있으신 분은 댓글 남겨주세요~</p>',
    attachments: [],
  },
  {
    category: 'INFO',
    title: '라켓 스트링 텐션 가이드',
    content: '<p>스트링 텐션에 대해 정리해봤습니다.</p><p><strong>낮은 텐션 (40-50lbs)</strong>: 파워 증가, 스윗스팟 확대. 초보자에게 추천.<br/><strong>중간 텐션 (50-55lbs)</strong>: 파워와 컨트롤의 균형.<br/><strong>높은 텐션 (55-65lbs)</strong>: 컨트롤 극대화, 스핀 증가. 상급자용.</p><p>본인의 플레이 스타일에 맞게 조절하는 것이 중요합니다!</p>',
    attachments: [{ url: TENNIS_IMAGES[1], name: '스트링가이드.jpg', size: 89000, type: 'image' }],
  },
  {
    category: 'INFO',
    title: '서울 실내 테니스장 추천 TOP 5',
    content: '<p>비 오는 날에도 테니스를 즐길 수 있는 서울 실내 코트를 정리했습니다.</p><p>1. 올림픽공원 테니스코트 - 하드코트 6면<br/>2. 잠실 실내테니스장 - 접근성 최고<br/>3. 방이 테니스센터 - 레슨 프로그램 다양<br/>4. 강남 인도어클럽 - 시설 최신<br/>5. 마포 테니스아카데미 - 가격 합리적</p>',
    attachments: [
      { url: TENNIS_IMAGES[2], name: '실내코트1.jpg', size: 75000, type: 'image' },
      { url: TENNIS_IMAGES[3], name: '실내코트2.jpg', size: 82000, type: 'image' },
    ],
  },
  {
    category: 'REVIEW',
    title: '서울오픈 관전 후기',
    content: '<p>지난 주말 서울오픈 결승전 관전하고 왔습니다!</p><p>결승전은 정말 명승부였어요. 두 선수 모두 수준 높은 랠리를 보여줬고, 특히 3세트 타이브레이크는 손에 땀을 쥐게 했습니다.</p><p>다음에도 꼭 가야겠어요. 현장 분위기가 TV로 보는 것과 차원이 다릅니다!</p>',
    attachments: [{ url: TENNIS_IMAGES[4], name: '서울오픈.jpg', size: 120000, type: 'image' }],
  },
  {
    category: 'REVIEW',
    title: '부산챌린저 참가 후기 (B조 준우승)',
    content: '<p>부산챌린저 B조에 출전해서 준우승했습니다! 🎾🏆</p><p>첫 대회라 너무 떨렸는데, 조별리그에서 2승 1패로 통과하고 결승까지 올라갔어요. 결승에서는 아쉽게 졌지만 정말 좋은 경험이었습니다.</p><p>대회 참가를 망설이시는 분들, 일단 신청하세요! 후회 없을 겁니다.</p>',
    attachments: [
      { url: TENNIS_IMAGES[5], name: '부산챌린저1.jpg', size: 95000, type: 'image' },
      { url: TENNIS_IMAGES[6], name: '부산챌린저2.jpg', size: 88000, type: 'image' },
    ],
  },
  {
    category: 'FREE',
    title: '테니스 엘보 극복기',
    content: '<p>3개월간 테니스 엘보로 고생했던 경험을 공유합니다.</p><p>처음에는 무시하고 계속 쳤는데, 결국 라켓도 못 잡을 정도가 됐어요. 병원에서 물리치료 받으면서 스트레칭을 꾸준히 했더니 지금은 완전히 회복했습니다.</p><p>통증이 느껴지면 절대 무리하지 마세요. 쉬는 것도 실력입니다.</p>',
    attachments: [],
  },
  {
    category: 'INFO',
    title: '2026 윔블던 일정 및 시청 방법',
    content: '<p>2026 윔블던이 6월 30일부터 시작됩니다!</p><p>한국에서는 SPOTV를 통해 생중계로 시청 가능합니다. 주요 경기는 SPOTV2에서도 중계합니다.</p><p>시차가 있어서 결승전은 보통 밤 10시쯤 시작하니 참고하세요.</p>',
    attachments: [],
  },
  {
    category: 'FREE',
    title: '새 라켓 구매 고민 중입니다',
    content: '<p>현재 윌슨 블레이드 v8을 사용 중인데, 바볼랏 퓨어 드라이브로 바꿀까 고민 중입니다.</p><p>블레이드는 컨트롤이 좋지만 파워가 부족한 느낌이고, 퓨어 드라이브는 파워가 좋다고 들었어요.</p><p>혹시 두 라켓 다 쳐보신 분 계시면 비교 후기 좀 부탁드립니다!</p>',
    attachments: [{ url: TENNIS_IMAGES[7], name: '라켓비교.jpg', size: 67000, type: 'image' }],
  },
  {
    category: 'INFO',
    title: '초보자를 위한 서브 연습법',
    content: '<p>서브가 잘 안 되시는 분들을 위한 연습법을 공유합니다.</p><p>1. 토스 연습: 라켓 없이 토스만 100번 연습<br/>2. 트로피 자세 만들기: 거울 앞에서 자세 확인<br/>3. 던지기 동작: 공을 던지듯 자연스럽게<br/>4. 프로나이션: 팔꿈치부터 회전하는 느낌</p><p>서브는 가장 어렵지만, 꾸준히 연습하면 반드시 늡니다!</p>',
    attachments: [],
  },
  {
    category: 'REVIEW',
    title: '대전마스터즈 복식 우승 후기',
    content: '<p>파트너와 함께 대전마스터즈 복식에서 우승했습니다! 🏆🏆</p><p>준결승에서 시드 1번 팀을 이긴 것이 가장 기억에 남습니다. 네트 플레이에서 파트너와 호흡이 정말 잘 맞았어요.</p><p>복식은 소통이 정말 중요하다는 걸 다시 한번 느꼈습니다.</p>',
    attachments: [{ url: TENNIS_IMAGES[0], name: '대전마스터즈.jpg', size: 110000, type: 'image' }],
  },
  {
    category: 'FREE',
    title: '비 올 때 뭐하시나요?',
    content: '<p>오늘도 비가 와서 테니스를 못 치네요 ☔</p><p>비 오는 날에는 보통 뭐 하시나요? 저는 테니스 경기 영상 보면서 분석하는 편입니다. 최근에는 유튜브에서 프로 선수들의 슬로모션 영상을 보면서 폼을 공부하고 있어요.</p>',
    attachments: [],
  },
  {
    category: 'INFO',
    title: '테니스 신발 선택 가이드',
    content: '<p>코트 종류별 추천 테니스 신발을 정리했습니다.</p><p><strong>하드코트</strong>: 내구성과 쿠션이 중요. 아식스 젤 레졸루션 추천.<br/><strong>클레이코트</strong>: 슬라이딩에 적합한 패턴. 아디다스 바리케이드 추천.<br/><strong>잔디코트</strong>: 그립력이 중요. 나이키 에어줌 추천.</p><p>잘못된 신발은 부상의 원인이 되니 코트에 맞는 신발을 선택하세요!</p>',
    attachments: [{ url: TENNIS_IMAGES[1], name: '테니스신발.jpg', size: 73000, type: 'image' }],
  },
  {
    category: 'FREE',
    title: '테니스 치고 맥주 한잔 🍺',
    content: '<p>오늘 3시간 동안 신나게 치고, 근처 맥주집에서 한잔 했습니다.</p><p>운동 후 마시는 맥주가 이렇게 맛있을 수가 없네요. 이 맛에 테니스 합니다 ㅎㅎ</p><p>다들 운동 후 회식 문화가 있으신가요?</p>',
    attachments: [],
  },
  {
    category: 'REVIEW',
    title: '생애 첫 대회 참가 후기',
    content: '<p>테니스 시작한 지 8개월 만에 처음으로 대회에 나갔습니다.</p><p>결과는 1승 2패로 조별리그 탈락이었지만, 정말 값진 경험이었어요. 연습 때와는 완전히 다른 긴장감, 심판이 있는 경기의 긴장감은 말로 표현할 수 없었습니다.</p><p>다음 대회에서는 조별리그 통과가 목표입니다!</p>',
    attachments: [{ url: TENNIS_IMAGES[2], name: '첫대회.jpg', size: 98000, type: 'image' }],
  },
  {
    category: 'INFO',
    title: '그립 교체 시기와 방법',
    content: '<p>오버그립은 얼마나 자주 교체하시나요?</p><p>일반적으로 주 3회 이상 치시는 분은 매주 교체를 권장합니다. 그립이 미끄러워지면 악력에 힘이 들어가면서 테니스 엘보의 원인이 됩니다.</p><p>리플레이스먼트 그립은 6개월에 한 번, 오버그립은 5~10회 사용 후 교체가 적당합니다.</p>',
    attachments: [],
  },
  {
    category: 'FREE',
    title: '동호회 추천해주세요 (강남 지역)',
    content: '<p>강남 근처에서 활동하는 테니스 동호회를 찾고 있습니다.</p><p>NTRP 3.5 수준이고, 주말 오전에 활동하는 곳이면 좋겠어요. 매주 정기적으로 모임이 있는 곳이면 더 좋고요.</p><p>추천 부탁드립니다!</p>',
    attachments: [],
  },
  {
    category: 'REVIEW',
    title: '제주 테니스 여행 다녀왔습니다',
    content: '<p>3박 4일로 제주도 테니스 여행을 다녀왔어요! 🌴🎾</p><p>제주 테니스파크에서 아침에 2시간씩 치고, 오후에는 관광하는 일정이었습니다. 바다 보이는 코트에서 치는 테니스는 정말 최고였어요!</p><p>테니스 좋아하시는 분들, 제주 테니스 여행 강추합니다.</p>',
    attachments: [
      { url: TENNIS_IMAGES[3], name: '제주테니스1.jpg', size: 135000, type: 'image' },
      { url: TENNIS_IMAGES[4], name: '제주테니스2.jpg', size: 128000, type: 'image' },
      { url: TENNIS_IMAGES[5], name: '제주테니스3.jpg', size: 115000, type: 'image' },
    ],
  },
]

/** DEV 전용: 더미 포스트 20개 시드 */
export async function seedPosts(): Promise<{ count: number; error?: string }> {
  if (process.env.NODE_ENV !== 'development') {
    return { count: 0, error: '개발 환경에서만 실행 가능합니다.' }
  }

  const admin = createAdminClient()

  // 시드용 유저 확인 (profiles에서 아무나 1명)
  const { data: profiles } = await admin
    .from('profiles')
    .select('id')
    .limit(5)

  if (!profiles || profiles.length === 0) {
    return { count: 0, error: '시드할 유저가 없습니다. 먼저 회원가입을 해주세요.' }
  }

  let inserted = 0
  for (let i = 0; i < SEED_POSTS.length; i++) {
    const seed = SEED_POSTS[i]
    // 프로필을 순환하며 배정
    const authorId = profiles[i % profiles.length].id

    // created_at을 i일 전으로 설정 (최신→오래된 순)
    const createdAt = new Date(Date.now() - i * 86400000 - Math.random() * 43200000).toISOString()

    const { error } = await admin.from('posts').insert({
      category: seed.category,
      title: seed.title,
      content: seed.content,
      attachments: seed.attachments,
      author_id: authorId,
      view_count: Math.floor(Math.random() * 200),
      comment_count: Math.floor(Math.random() * 15),
      like_count: Math.floor(Math.random() * 30),
      created_at: createdAt,
      updated_at: createdAt,
    })

    if (!error) inserted++
  }

  return { count: inserted }
}
