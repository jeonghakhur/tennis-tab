import type { ChatEntities, HandlerResult } from '../types'

/** HELP 핸들러 — LLM 미호출, 하드코딩 응답 */
export async function handleHelp(
  _entities: ChatEntities,
  _userId?: string,
): Promise<HandlerResult> {
  return {
    success: true,
    message: `Tennis Tab에서 할 수 있는 것들이에요:

━━ 대회 정보 (누구나) ━━━━━━━━

🔍 대회 검색
  "이번 주 서울 대회", "모집중인 대회", "3월 대회"

📊 대진표 조회
  "서울 오픈 대진표 보여줘"

🏆 경기 결과
  "서울 오픈 결과 알려줘"

📋 참가 조건
  "서울 오픈 참가비 얼마야?"

━━ 내 정보 (로그인 필요) ━━━━━━

📝 내 신청 내역
  "내가 신청한 대회", "내 신청 내역"

📅 내 경기 일정
  "내 대진표", "내 다음 경기 언제?"

📊 내 경기 결과
  "내 경기 결과", "내 전적"

━━ 참가 신청 (로그인 필요) ━━━━━

✍️ 대회 참가 신청
  "신청 가능한 대회", "서울 오픈 신청하고 싶어"

  과정: 대회 선택 → 부서 선택 → 추가 정보 → 확인
  복식: 파트너 정보 입력 | 단체전: 클럽명 + 팀원 등록
  "취소" 입력으로 언제든 중단 가능`,
  }
}
