import type { ChatEntities, HandlerResult } from '../types'

/** HELP 핸들러 — LLM 미호출, 하드코딩 응답 */
export async function handleHelp(
  _entities: ChatEntities,
  _userId?: string,
): Promise<HandlerResult> {
  return {
    success: true,
    message: `Tennis Tab에서 할 수 있는 것들이에요:

🔍 "이번 주 서울 대회 뭐 있어?" → 대회 검색
📊 "서울 오픈 대진표 보여줘" → 대진표 조회
🏆 "서울 오픈 결과 알려줘" → 경기 결과 확인
📋 "서울 오픈 참가 조건이 뭐야?" → 참가 정보 조회

날짜, 지역, 대회명을 자유롭게 조합해서 질문해보세요!`,
  }
}
