/**
 * DEV 전용 더미 데이터 생성기
 * @faker-js/faker 한국어 로케일 사용
 * production 빌드에서는 import하지 않으므로 tree-shaking 됨
 */
import { faker } from '@faker-js/faker/locale/ko'
import type { CreateAssociationInput } from '@/lib/associations/types'
import type { CreateClubInput, UnregisteredMemberInput, ClubJoinType } from '@/lib/clubs/types'

// 테니스 관련 상수
const TENNIS_VENUES = [
  '구민체육센터 테니스장', '종합운동장 테니스코트', '시민공원 테니스장',
  '생활체육관 테니스코트', '문화체육센터 테니스장', '올림픽공원 테니스코트',
]

const CLUB_SUFFIXES = ['테니스클럽', '테니스회', 'TC', '테니스동호회', '테니스사랑']
const ASSOC_SUFFIXES = ['테니스협회', '테니스연합회', '테니스연맹']

const DESCRIPTIONS_CLUB = [
  '매주 토요일 오전 정기 모임을 진행합니다. 초보부터 고수까지 환영합니다.',
  '평일 저녁과 주말에 활동하는 동호회입니다. 친목과 실력 향상을 동시에!',
  '주 3회 이상 활동하는 열정적인 테니스 클럽입니다.',
  '레슨과 리그전을 병행하며 체계적으로 운영되는 클럽입니다.',
  '가족 단위 회원도 환영하는 가족 친화형 테니스 클럽입니다.',
]

const DESCRIPTIONS_ASSOC = [
  '관내 테니스 동호인을 위한 협회입니다. 매년 구민 테니스 대회를 개최합니다.',
  '지역 테니스 발전을 위해 각종 대회 운영 및 동호인 지원을 하고 있습니다.',
  '테니스 저변 확대와 동호인 친목을 위한 협회입니다.',
  '매년 봄/가을 정기 대회와 각종 친선 경기를 주관합니다.',
]

const CITIES = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시',
  '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
  '경기도', '강원도', '충청북도', '충청남도',
]

const DISTRICTS: Record<string, string[]> = {
  '서울특별시': ['강남구', '서초구', '마포구', '송파구', '용산구', '영등포구', '종로구', '강서구', '성동구', '동작구'],
  '부산광역시': ['해운대구', '수영구', '남구', '동래구', '연제구', '사하구'],
  '대구광역시': ['수성구', '달서구', '중구', '북구', '동구'],
  '인천광역시': ['연수구', '남동구', '부평구', '서구', '미추홀구'],
  '경기도': ['수원시', '성남시', '고양시', '용인시', '안양시', '부천시', '화성시', '평택시'],
}

// ── 헬퍼 ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function koreanPhone(): string {
  const mid = faker.string.numeric(4)
  const last = faker.string.numeric(4)
  return `010${mid}${last}`
}

function koreanEmail(name: string): string {
  const romanized = faker.internet.username().toLowerCase()
  return `${romanized}@${faker.internet.domainName()}`
}

function cityAndDistrict(): { city: string; district: string } {
  const city = pick(CITIES)
  const districtList = DISTRICTS[city]
  const district = districtList ? pick(districtList) : faker.location.county()
  return { city, district }
}

// ── 정상 더미 데이터 생성 ──

/** 협회 정상 더미 데이터 */
export function generateAssociationDummy(): CreateAssociationInput {
  const { city, district } = cityAndDistrict()
  const name = `${district}${pick(ASSOC_SUFFIXES)}`
  const presidentName = faker.person.fullName()
  const secretaryName = faker.person.fullName()

  return {
    name,
    region: city,
    district,
    description: pick(DESCRIPTIONS_ASSOC),
    president_name: presidentName,
    president_phone: koreanPhone(),
    president_email: koreanEmail(presidentName),
    secretary_name: secretaryName,
    secretary_phone: koreanPhone(),
    secretary_email: koreanEmail(secretaryName),
  }
}

/** 클럽 정상 더미 데이터 */
export function generateClubDummy(): CreateClubInput {
  const { city, district } = cityAndDistrict()
  const name = `${district}${pick(CLUB_SUFFIXES)}`
  const repName = faker.person.fullName()

  return {
    name,
    representative_name: repName,
    description: pick(DESCRIPTIONS_CLUB),
    city,
    district,
    address: `${district} ${faker.location.streetAddress()} ${pick(TENNIS_VENUES)}`,
    contact_phone: koreanPhone(),
    contact_email: koreanEmail(repName),
    join_type: pick<ClubJoinType>(['APPROVAL', 'OPEN', 'INVITE_ONLY']),
    max_members: pick([30, 40, 50, 60, 80, 100, undefined]),
  }
}

/** 클럽 회원 정상 더미 데이터 */
export function generateMemberDummy(): UnregisteredMemberInput {
  const currentYear = new Date().getFullYear()
  const birthYear = faker.number.int({ min: 1960, max: 2005 })
  const birthMonth = String(faker.number.int({ min: 1, max: 12 })).padStart(2, '0')
  const startYear = faker.number.int({ min: 2000, max: currentYear })

  return {
    name: faker.person.fullName(),
    birth_date: `${birthYear}-${birthMonth}`,
    gender: pick(['MALE', 'FEMALE'] as const),
    phone: koreanPhone(),
    start_year: String(startYear),
    rating: faker.number.int({ min: 100, max: 3000 }),
  }
}

// ── 잘못된 더미 데이터 생성 (밸리데이션 테스트용) ──
// 각 필드마다 여러 종류의 잘못된 값 중 랜덤 선택

const INVALID_NAMES = ['', '가', ' ', 'a'] // 빈값, 1자, 공백만, 영문 1자
const INVALID_PHONES = ['123', 'abc가나다', '99999999999', '555-abc', '01012', '+82-000']
const INVALID_EMAILS = [
  'invalid-email', '@no-local.com', 'no-at-sign', 'spaces in@email.com',
  'missing-domain@', '.starts-with-dot@mail.com', 'double@@at.com',
]
const INVALID_BIRTH_DATES = ['1990-13', '2025-00', '99-01', 'not-a-date', '1800-06']
const INVALID_START_YEARS = ['2030', '1899', 'abcd', '20', '99999']
const INVALID_RATINGS = [99999, -100, 0, 10000, -1]
const INVALID_MAX_MEMBERS = [-5, -100, 0, -999]

/** 협회 잘못된 더미 데이터 */
export function generateAssociationInvalidDummy(): CreateAssociationInput {
  return {
    name: pick(INVALID_NAMES),
    region: pick(['', ' ']),
    district: pick(['', ' ']),
    description: '',
    president_name: pick(['', '김', ' ']),
    president_phone: pick(INVALID_PHONES),
    president_email: pick(INVALID_EMAILS),
    secretary_name: pick(['', '이', ' ']),
    secretary_phone: pick(INVALID_PHONES),
    secretary_email: pick(INVALID_EMAILS),
  }
}

/** 클럽 잘못된 더미 데이터 */
export function generateClubInvalidDummy(): CreateClubInput {
  return {
    name: pick(INVALID_NAMES),
    representative_name: pick(INVALID_NAMES),
    description: '',
    city: pick(['', ' ']),
    district: pick(['', ' ']),
    address: '',
    contact_phone: pick(INVALID_PHONES),
    contact_email: pick(INVALID_EMAILS),
    join_type: 'OPEN',
    max_members: pick(INVALID_MAX_MEMBERS),
  }
}

/** 회원 잘못된 더미 데이터 */
export function generateMemberInvalidDummy(): UnregisteredMemberInput {
  return {
    name: pick(INVALID_NAMES),
    birth_date: pick(INVALID_BIRTH_DATES),
    gender: undefined,
    phone: pick(INVALID_PHONES),
    start_year: pick(INVALID_START_YEARS),
    rating: pick(INVALID_RATINGS),
  }
}
