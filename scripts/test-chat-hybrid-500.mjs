/**
 * Chat Hybrid 500건 통합 테스트 (DEV 전용)
 * 실행: node scripts/test-chat-hybrid-500.mjs
 */

const BASE_URL = 'http://localhost:3000/api/chat/dev-test'
const TEST_USER_ID = 'e472e215-dfa2-4215-a996-4cb29b66e073'
const CONCURRENCY = 4   // 동시 요청 수 (Gemini rate limit 고려)
const TIMEOUT_MS = 20000

// ─── 테스트 케이스 500건 ─────────────────────────────────────────────────────

const TEST_CASES = [

  // ════════════════════════════════════════════════════════════
  // A. 대회 검색 — 기본 (30건)
  // ════════════════════════════════════════════════════════════
  { id:'A01', g:'검색-기본', msg:'대회 목록 알려줘' },
  { id:'A02', g:'검색-기본', msg:'대회 있어?' },
  { id:'A03', g:'검색-기본', msg:'대회 있냐' },
  { id:'A04', g:'검색-기본', msg:'테니스 대회 알려줘' },
  { id:'A05', g:'검색-기본', msg:'어떤 대회 있어?' },
  { id:'A06', g:'검색-기본', msg:'대회 검색해줘' },
  { id:'A07', g:'검색-기본', msg:'요즘 무슨 대회 있어?' },
  { id:'A08', g:'검색-기본', msg:'대회 정보 알려줘' },
  { id:'A09', g:'검색-기본', msg:'테니스 대회 목록' },
  { id:'A10', g:'검색-기본', msg:'대회 뭐 있어?' },
  { id:'A11', g:'검색-기본', msg:'신청 가능한 대회 있어?' },
  { id:'A12', g:'검색-기본', msg:'지금 신청 가능한 대회' },
  { id:'A13', g:'검색-기본', msg:'모집 중인 대회 알려줘' },
  { id:'A14', g:'검색-기본', msg:'지금 모집중인 대회 뭐 있어?' },
  { id:'A15', g:'검색-기본', msg:'접수 중인 대회' },
  { id:'A16', g:'검색-기본', msg:'참가 신청 받는 대회 있어?' },
  { id:'A17', g:'검색-기본', msg:'진행 중인 대회 알려줘' },
  { id:'A18', g:'검색-기본', msg:'현재 진행 중인 대회' },
  { id:'A19', g:'검색-기본', msg:'지금 하고 있는 대회 있어?' },
  { id:'A20', g:'검색-기본', msg:'끝난 대회 알려줘' },
  { id:'A21', g:'검색-기본', msg:'완료된 대회 뭐 있어?' },
  { id:'A22', g:'검색-기본', msg:'종료된 대회 목록' },
  { id:'A23', g:'검색-기본', msg:'접수 예정인 대회 있어?' },
  { id:'A24', g:'검색-기본', msg:'곧 신청 가능한 대회' },
  { id:'A25', g:'검색-기본', msg:'가장 가까운 대회 알려줘' },
  { id:'A26', g:'검색-기본', msg:'다음 대회 언제야?' },
  { id:'A27', g:'검색-기본', msg:'무료 대회 있어?' },
  { id:'A28', g:'검색-기본', msg:'참가비 없는 대회 알려줘' },
  { id:'A29', g:'검색-기본', msg:'저렴한 대회 있어?' },
  { id:'A30', g:'검색-기본', msg:'5만원 이하 대회 있어?' },

  // ════════════════════════════════════════════════════════════
  // B. 지역 검색 (30건)
  // ════════════════════════════════════════════════════════════
  { id:'B01', g:'검색-지역', msg:'서울 대회 있어?' },
  { id:'B02', g:'검색-지역', msg:'서울쪽 대회 알려줘' },
  { id:'B03', g:'검색-지역', msg:'서울에서 하는 대회' },
  { id:'B04', g:'검색-지역', msg:'마포구 대회 있어?' },
  { id:'B05', g:'검색-지역', msg:'마포에서 열리는 대회' },
  { id:'B06', g:'검색-지역', msg:'마포대회 뭐 있어?' },
  { id:'B07', g:'검색-지역', msg:'마포구에서 하는 테니스 대회' },
  { id:'B08', g:'검색-지역', msg:'강남 대회 있어?' },
  { id:'B09', g:'검색-지역', msg:'강남구 테니스 대회' },
  { id:'B10', g:'검색-지역', msg:'송파 쪽 대회 알려줘' },
  { id:'B11', g:'검색-지역', msg:'노원구 대회 있어?' },
  { id:'B12', g:'검색-지역', msg:'은평구 대회 알려줘' },
  { id:'B13', g:'검색-지역', msg:'동작구에서 하는 대회' },
  { id:'B14', g:'검색-지역', msg:'성북구 대회 있냐?' },
  { id:'B15', g:'검색-지역', msg:'광진구 테니스 대회' },
  { id:'B16', g:'검색-지역', msg:'중랑구 대회 있어?' },
  { id:'B17', g:'검색-지역', msg:'도봉구 대회 알려줘' },
  { id:'B18', g:'검색-지역', msg:'용산 대회 있어?' },
  { id:'B19', g:'검색-지역', msg:'종로구 대회 있냐' },
  { id:'B20', g:'검색-지역', msg:'관악구 대회 뭐 있어?' },
  { id:'B21', g:'검색-지역', msg:'부산 대회 있어?' },
  { id:'B22', g:'검색-지역', msg:'대구 테니스 대회' },
  { id:'B23', g:'검색-지역', msg:'인천 대회 알려줘' },
  { id:'B24', g:'검색-지역', msg:'경기도 대회 있어?' },
  { id:'B25', g:'검색-지역', msg:'수원 대회 있냐?' },
  { id:'B26', g:'검색-지역', msg:'성남시 대회 알려줘' },
  { id:'B27', g:'검색-지역', msg:'고양시 테니스 대회' },
  { id:'B28', g:'검색-지역', msg:'마포 모집중 대회 있어?' },
  { id:'B29', g:'검색-지역', msg:'서울 모집중 대회 알려줘' },
  { id:'B30', g:'검색-지역', msg:'마표구 대회 있어?' },  // 오타

  // ════════════════════════════════════════════════════════════
  // C. 날짜/기간 검색 (40건)
  // ════════════════════════════════════════════════════════════
  { id:'C01', g:'검색-날짜', msg:'이번 주 대회 있어?' },
  { id:'C02', g:'검색-날짜', msg:'이번 주말 대회' },
  { id:'C03', g:'검색-날짜', msg:'다음 주 대회 알려줘' },
  { id:'C04', g:'검색-날짜', msg:'이번 달 대회 일정' },
  { id:'C05', g:'검색-날짜', msg:'이번 달 어떤 대회 있어?' },
  { id:'C06', g:'검색-날짜', msg:'다음 달 대회 있어?' },
  { id:'C07', g:'검색-날짜', msg:'다음 달 대회 일정 알려줘' },
  { id:'C08', g:'검색-날짜', msg:'3월 대회 알려줘' },
  { id:'C09', g:'검색-날짜', msg:'3월에 있는 대회' },
  { id:'C10', g:'검색-날짜', msg:'4월 대회 뭐 있어?' },
  { id:'C11', g:'검색-날짜', msg:'5월 테니스 대회' },
  { id:'C12', g:'검색-날짜', msg:'6월 대회 일정' },
  { id:'C13', g:'검색-날짜', msg:'7월에 하는 대회 있어?' },
  { id:'C14', g:'검색-날짜', msg:'8월 대회 알려줘' },
  { id:'C15', g:'검색-날짜', msg:'봄 대회 있어?' },
  { id:'C16', g:'검색-날짜', msg:'봄에 하는 대회 알려줘' },
  { id:'C17', g:'검색-날짜', msg:'여름 대회 있어?' },
  { id:'C18', g:'검색-날짜', msg:'여름철 테니스 대회' },
  { id:'C19', g:'검색-날짜', msg:'가을 대회 있어?' },
  { id:'C20', g:'검색-날짜', msg:'겨울 대회 알려줘' },
  { id:'C21', g:'검색-날짜', msg:'상반기 대회 목록' },
  { id:'C22', g:'검색-날짜', msg:'올해 상반기 대회 뭐 있어?' },
  { id:'C23', g:'검색-날짜', msg:'하반기 대회 일정' },
  { id:'C24', g:'검색-날짜', msg:'올해 하반기 대회 있어?' },
  { id:'C25', g:'검색-날짜', msg:'내일 대회 있어?' },
  { id:'C26', g:'검색-날짜', msg:'이번 주 마포구 대회' },
  { id:'C27', g:'검색-날짜', msg:'다음 달 서울 대회 있어?' },
  { id:'C28', g:'검색-날짜', msg:'3월에 마포에서 하는 대회' },
  { id:'C29', g:'검색-날짜', msg:'봄에 신청 가능한 대회' },
  { id:'C30', g:'검색-날짜', msg:'이번 주 모집 중인 대회' },
  { id:'C31', g:'검색-날짜', msg:'4월 마포 대회 있어?' },
  { id:'C32', g:'검색-날짜', msg:'올 상반기 무료 대회 있어?' },
  { id:'C33', g:'검색-날짜', msg:'이번 달 서울 대회 일정' },
  { id:'C34', g:'검색-날짜', msg:'다음 달 신청 가능한 대회' },
  { id:'C35', g:'검색-날짜', msg:'올여름 대회 일정 알려줘' },
  { id:'C36', g:'검색-날짜', msg:'내년 봄 대회 있어?' },
  { id:'C37', g:'검색-날짜', msg:'이번 달 마감 대회' },
  { id:'C38', g:'검색-날짜', msg:'3월 단식 대회' },
  { id:'C39', g:'검색-날짜', msg:'이번 주 안에 신청해야 하는 대회' },
  { id:'C40', g:'검색-날짜', msg:'올해 대회 일정 전체' },

  // ════════════════════════════════════════════════════════════
  // D. 대회 상세 / 참가 조건 (50건)
  // ════════════════════════════════════════════════════════════
  { id:'D01', g:'상세-요건', msg:'마포구청장기 참가비 얼마야?' },
  { id:'D02', g:'상세-요건', msg:'구협회장기 참가비 알려줘' },
  { id:'D03', g:'상세-요건', msg:'마포구청장기 요강 알려줘' },
  { id:'D04', g:'상세-요건', msg:'마포구청장기 어디서 해?' },
  { id:'D05', g:'상세-요건', msg:'마포구청장기 어떤 부서 있어?' },
  { id:'D06', g:'상세-요건', msg:'마포구청장기 접수 언제까지야?' },
  { id:'D07', g:'상세-요건', msg:'마포구청장기 자세히 알려줘' },
  { id:'D08', g:'상세-요건', msg:'마포구청장기 정보 알려줘' },
  { id:'D09', g:'상세-요건', msg:'마포구청장기 신청 자격 뭐야?' },
  { id:'D10', g:'상세-요건', msg:'구협회장기 어디서 하는 대회야?' },
  { id:'D11', g:'상세-요건', msg:'구협회장기 자세히 알려줘' },
  { id:'D12', g:'상세-요건', msg:'구협회장기 접수 기간 알려줘' },
  { id:'D13', g:'상세-요건', msg:'구협회장기 주최가 어디야?' },
  { id:'D14', g:'상세-요건', msg:'마포구체육회장기 참가 조건' },
  { id:'D15', g:'상세-요건', msg:'마포구체육회장기 어떤 대회야?' },
  { id:'D16', g:'상세-요건', msg:'마포구체육회장기 날짜 알려줘' },
  { id:'D17', g:'상세-요건', msg:'마포구체육회장기 참가비는?' },
  { id:'D18', g:'상세-요건', msg:'대회 참가비가 얼마야?' },
  { id:'D19', g:'상세-요건', msg:'참가 조건 알려줘' },
  { id:'D20', g:'상세-요건', msg:'마포구청장기 복식 있어?' },
  { id:'D21', g:'상세-요건', msg:'구협회장기 단식 부서 있어?' },
  { id:'D22', g:'상세-요건', msg:'마포구청장기 상금 있어?' },
  { id:'D23', g:'상세-요건', msg:'마포구청장기 사용구 뭐야?' },
  { id:'D24', g:'상세-요건', msg:'마포구청장기 개회식 언제야?' },
  { id:'D25', g:'상세-요건', msg:'마포구청장기 최대 몇 명?' },
  { id:'D26', g:'상세-요건', msg:'마포구청장기 토너먼트 방식이야?' },
  { id:'D27', g:'상세-요건', msg:'마포구청장기 리그전이야 토너먼트야?' },
  { id:'D28', g:'상세-요건', msg:'마포구청장기 진행 방식 알려줘' },
  { id:'D29', g:'상세-요건', msg:'마포구청장기 팀전 있어?' },
  { id:'D30', g:'상세-요건', msg:'협회장기 어떤 대회야?' },
  { id:'D31', g:'상세-요건', msg:'협회장기 요강 보여줘' },
  { id:'D32', g:'상세-요건', msg:'협회장기 일정 알려줘' },
  { id:'D33', g:'상세-요건', msg:'협회장기 장소 어디야?' },
  { id:'D34', g:'상세-요건', msg:'협회장기 접수 마감 언제야?' },
  { id:'D35', g:'상세-요건', msg:'협회장기 참가비 얼마야?' },
  { id:'D36', g:'상세-요건', msg:'구청장기 상세 정보' },
  { id:'D37', g:'상세-요건', msg:'구청장기 날짜랑 장소 알려줘' },
  { id:'D38', g:'상세-요건', msg:'구청장기 참가 신청 기간' },
  { id:'D39', g:'상세-요건', msg:'존재하지않는대회ABC 참가비' },  // 없는 대회
  { id:'D40', g:'상세-요건', msg:'마포구청장기 챌린저부 상금' },
  { id:'D41', g:'상세-요건', msg:'마포구청장기 오픈부 있어?' },
  { id:'D42', g:'상세-요건', msg:'마포구청장기 참가 자격 제한 있어?' },
  { id:'D43', g:'상세-요건', msg:'마포구청장기 몇 부 있어?' },
  { id:'D44', g:'상세-요건', msg:'마포구청장기 복식 파트너 필요해?' },
  { id:'D45', g:'상세-요건', msg:'마포구청장기 이번 주에 열려?' },
  { id:'D46', g:'상세-요건', msg:'구협회장기 오늘 접수 가능해?' },
  { id:'D47', g:'상세-요건', msg:'가장 빠른 대회 상세 알려줘' },
  { id:'D48', g:'상세-요건', msg:'마포구청장기 2026 일정' },
  { id:'D49', g:'상세-요건', msg:'협회장기 vs 구청장기 차이 뭐야?' },
  { id:'D50', g:'상세-요건', msg:'마포구청장기 프로그램 알려줘' },

  // ════════════════════════════════════════════════════════════
  // E. 내 신청 내역 (40건)
  // ════════════════════════════════════════════════════════════
  { id:'E01', g:'내신청', msg:'내 신청 내역 보여줘', u:TEST_USER_ID },
  { id:'E02', g:'내신청', msg:'내가 신청한 대회 알려줘', u:TEST_USER_ID },
  { id:'E03', g:'내신청', msg:'내가 참가 신청한 것들 보여줘', u:TEST_USER_ID },
  { id:'E04', g:'내신청', msg:'내 대회 신청 목록', u:TEST_USER_ID },
  { id:'E05', g:'내신청', msg:'신청한 대회 뭐 있어?', u:TEST_USER_ID },
  { id:'E06', g:'내신청', msg:'내 참가 내역', u:TEST_USER_ID },
  { id:'E07', g:'내신청', msg:'나 어떤 대회 신청했어?', u:TEST_USER_ID },
  { id:'E08', g:'내신청', msg:'내 등록 내역 알려줘', u:TEST_USER_ID },
  { id:'E09', g:'내신청', msg:'내 신청 상태 보여줘', u:TEST_USER_ID },
  { id:'E10', g:'내신청', msg:'지금 신청된 대회 있어?', u:TEST_USER_ID },
  { id:'E11', g:'내신청', msg:'승인된 신청 있어?', u:TEST_USER_ID },
  { id:'E12', g:'내신청', msg:'승인 완료된 신청 알려줘', u:TEST_USER_ID },
  { id:'E13', g:'내신청', msg:'대기 중인 신청 있어?', u:TEST_USER_ID },
  { id:'E14', g:'내신청', msg:'아직 승인 안 된 신청', u:TEST_USER_ID },
  { id:'E15', g:'내신청', msg:'거절된 신청 있어?', u:TEST_USER_ID },
  { id:'E16', g:'내신청', msg:'확정된 신청 보여줘', u:TEST_USER_ID },
  { id:'E17', g:'내신청', msg:'대기자 명단에 있어?', u:TEST_USER_ID },
  { id:'E18', g:'내신청', msg:'결제 안 한 신청 있어?', u:TEST_USER_ID },
  { id:'E19', g:'내신청', msg:'참가비 미납인 신청', u:TEST_USER_ID },
  { id:'E20', g:'내신청', msg:'결제 완료된 신청 보여줘', u:TEST_USER_ID },
  { id:'E21', g:'내신청', msg:'참가비 낸 신청 목록', u:TEST_USER_ID },
  { id:'E22', g:'내신청', msg:'미납인 것들 알려줘', u:TEST_USER_ID },
  { id:'E23', g:'내신청', msg:'내 신청 중 결제 안 한 것', u:TEST_USER_ID },
  { id:'E24', g:'내신청', msg:'나 지금 어느 대회 신청 중이야?', u:TEST_USER_ID },
  { id:'E25', g:'내신청', msg:'내 신청 내역 알려줘', u:TEST_USER_ID },
  { id:'E26', g:'내신청', msg:'내 신청 내역 보여줘' },            // 비로그인
  { id:'E27', g:'내신청', msg:'내가 신청한 대회 있어?' },         // 비로그인
  { id:'E28', g:'내신청', msg:'신청 내역 조회', u:TEST_USER_ID },
  { id:'E29', g:'내신청', msg:'나 요즘 어떤 대회 참가 중이야?', u:TEST_USER_ID },
  { id:'E30', g:'내신청', msg:'내 참가 현황', u:TEST_USER_ID },
  { id:'E31', g:'내신청', msg:'내 신청 몇 개야?', u:TEST_USER_ID },
  { id:'E32', g:'내신청', msg:'최근 신청한 대회 알려줘', u:TEST_USER_ID },
  { id:'E33', g:'내신청', msg:'내 신청 전부 보여줘', u:TEST_USER_ID },
  { id:'E34', g:'내신청', msg:'내 신청 확인해줘', u:TEST_USER_ID },
  { id:'E35', g:'내신청', msg:'내 대회 참가 현황', u:TEST_USER_ID },
  { id:'E36', g:'내신청', msg:'내 신청 상황 어때?', u:TEST_USER_ID },
  { id:'E37', g:'내신청', msg:'신청 완료된 거 있어?', u:TEST_USER_ID },
  { id:'E38', g:'내신청', msg:'내 신청 리스트', u:TEST_USER_ID },
  { id:'E39', g:'내신청', msg:'신청 현황 알려줘', u:TEST_USER_ID },
  { id:'E40', g:'내신청', msg:'내 신청 내역 전체 보여줘', u:TEST_USER_ID },

  // ════════════════════════════════════════════════════════════
  // F. 대진표 조회 (35건)
  // ════════════════════════════════════════════════════════════
  { id:'F01', g:'대진표', msg:'구협회장기 대진표 보여줘' },
  { id:'F02', g:'대진표', msg:'마포구청장기 대진표 어떻게 돼?' },
  { id:'F03', g:'대진표', msg:'협회장기 대진표 알려줘' },
  { id:'F04', g:'대진표', msg:'구협회장기 대진표' },
  { id:'F05', g:'대진표', msg:'마포구체육회장기 대진표 있어?' },
  { id:'F06', g:'대진표', msg:'구협회장기 진행 상황 어때?' },
  { id:'F07', g:'대진표', msg:'구협회장기 몇 강이야?' },
  { id:'F08', g:'대진표', msg:'구협회장기 8강 됐어?' },
  { id:'F09', g:'대진표', msg:'구협회장기 결승 언제야?' },
  { id:'F10', g:'대진표', msg:'대진표 보여줘' },
  { id:'F11', g:'대진표', msg:'진행중인 대회 대진표 알려줘' },
  { id:'F12', g:'대진표', msg:'완료된 대회 대진표 있어?' },
  { id:'F13', g:'대진표', msg:'내 대진표 보여줘', u:TEST_USER_ID },
  { id:'F14', g:'대진표', msg:'내 경기 일정 알려줘', u:TEST_USER_ID },
  { id:'F15', g:'대진표', msg:'내 다음 경기 언제야?', u:TEST_USER_ID },
  { id:'F16', g:'대진표', msg:'내 경기 언제야?', u:TEST_USER_ID },
  { id:'F17', g:'대진표', msg:'다음 경기 상대 누구야?', u:TEST_USER_ID },
  { id:'F18', g:'대진표', msg:'내 경기 몇 코트야?', u:TEST_USER_ID },
  { id:'F19', g:'대진표', msg:'내 대회 일정 보여줘', u:TEST_USER_ID },
  { id:'F20', g:'대진표', msg:'내 경기 일정' },                   // 비로그인
  { id:'F21', g:'대진표', msg:'나 언제 경기야?', u:TEST_USER_ID },
  { id:'F22', g:'대진표', msg:'오늘 경기 있어?', u:TEST_USER_ID },
  { id:'F23', g:'대진표', msg:'이번 주 내 경기 일정', u:TEST_USER_ID },
  { id:'F24', g:'대진표', msg:'구협회장기 챌린저부 대진표' },
  { id:'F25', g:'대진표', msg:'구협회장기 오픈부 현황' },
  { id:'F26', g:'대진표', msg:'없는대회999 대진표' },             // 없는 대회
  { id:'F27', g:'대진표', msg:'마포구청장기 16강 결과' },
  { id:'F28', g:'대진표', msg:'대진표 전체 보여줘' },
  { id:'F29', g:'대진표', msg:'구협회장기 준결승 결과' },
  { id:'F30', g:'대진표', msg:'구협회장기 결승 누가 올라갔어?' },
  { id:'F31', g:'대진표', msg:'토너먼트 진행 상황' },
  { id:'F32', g:'대진표', msg:'내 대진 어떻게 돼?', u:TEST_USER_ID },
  { id:'F33', g:'대진표', msg:'경기 일정 보여줘', u:TEST_USER_ID },
  { id:'F34', g:'대진표', msg:'구협회장기 대진 현황' },
  { id:'F35', g:'대진표', msg:'현재 진행 중인 대회 대진표' },

  // ════════════════════════════════════════════════════════════
  // G. 경기 결과 (35건)
  // ════════════════════════════════════════════════════════════
  { id:'G01', g:'경기결과', msg:'구협회장기 경기 결과 알려줘' },
  { id:'G02', g:'경기결과', msg:'마포구청장기 결과 어때?' },
  { id:'G03', g:'경기결과', msg:'협회장기 누가 이겼어?' },
  { id:'G04', g:'경기결과', msg:'구협회장기 최근 결과' },
  { id:'G05', g:'경기결과', msg:'마포구청장기 경기 결과' },
  { id:'G06', g:'경기결과', msg:'구협회장기 우승자 누구야?' },
  { id:'G07', g:'경기결과', msg:'협회장기 우승 누가 했어?' },
  { id:'G08', g:'경기결과', msg:'마포구청장기 결과 보여줘' },
  { id:'G09', g:'경기결과', msg:'구협회장기 스코어 알려줘' },
  { id:'G10', g:'경기결과', msg:'마포구체육회장기 결과' },
  { id:'G11', g:'경기결과', msg:'내 경기 결과 알려줘', u:TEST_USER_ID },
  { id:'G12', g:'경기결과', msg:'내 경기 결과', u:TEST_USER_ID },
  { id:'G13', g:'경기결과', msg:'나 지금까지 몇 승 몇 패야?', u:TEST_USER_ID },
  { id:'G14', g:'경기결과', msg:'내 전적 알려줘', u:TEST_USER_ID },
  { id:'G15', g:'경기결과', msg:'나 승률 어때?', u:TEST_USER_ID },
  { id:'G16', g:'경기결과', msg:'내가 이긴 경기 있어?', u:TEST_USER_ID },
  { id:'G17', g:'경기결과', msg:'내 경기 기록 보여줘', u:TEST_USER_ID },
  { id:'G18', g:'경기결과', msg:'나 몇 경기 했어?', u:TEST_USER_ID },
  { id:'G19', g:'경기결과', msg:'내 전적 어때?', u:TEST_USER_ID },
  { id:'G20', g:'경기결과', msg:'내 경기 결과' },               // 비로그인
  { id:'G21', g:'경기결과', msg:'구협회장기 8강 결과' },
  { id:'G22', g:'경기결과', msg:'구협회장기 4강 결과' },
  { id:'G23', g:'경기결과', msg:'구협회장기 결승 결과' },
  { id:'G24', g:'경기결과', msg:'없는대회999 결과' },           // 없는 대회
  { id:'G25', g:'경기결과', msg:'최근 완료된 경기 결과 알려줘' },
  { id:'G26', g:'경기결과', msg:'나 이번 대회 몇 위야?', u:TEST_USER_ID },
  { id:'G27', g:'경기결과', msg:'내 최근 경기 결과', u:TEST_USER_ID },
  { id:'G28', g:'경기결과', msg:'구협회장기 챌린저부 결과' },
  { id:'G29', g:'경기결과', msg:'마포구청장기 복식 결과' },
  { id:'G30', g:'경기결과', msg:'나 이겼어 졌어?', u:TEST_USER_ID },
  { id:'G31', g:'경기결과', msg:'협회장기 준우승 누구야?' },
  { id:'G32', g:'경기결과', msg:'구협회장기 전체 결과' },
  { id:'G33', g:'경기결과', msg:'내 경기 스코어 알려줘', u:TEST_USER_ID },
  { id:'G34', g:'경기결과', msg:'나 오늘 경기 이겼어?', u:TEST_USER_ID },
  { id:'G35', g:'경기결과', msg:'대회 결과 알려줘' },

  // ════════════════════════════════════════════════════════════
  // H. 입상 기록 (35건)
  // ════════════════════════════════════════════════════════════
  { id:'H01', g:'입상', msg:'최근 입상자 누구야?' },
  { id:'H02', g:'입상', msg:'명예의 전당 보여줘' },
  { id:'H03', g:'입상', msg:'입상 기록 알려줘' },
  { id:'H04', g:'입상', msg:'역대 우승자 알려줘' },
  { id:'H05', g:'입상', msg:'최근 우승한 사람 알려줘' },
  { id:'H06', g:'입상', msg:'대회 우승자 목록' },
  { id:'H07', g:'입상', msg:'입상 기록 전체 보여줘' },
  { id:'H08', g:'입상', msg:'명예의 전당 전체 보기' },
  { id:'H09', g:'입상', msg:'우승자 명단 알려줘' },
  { id:'H10', g:'입상', msg:'입상자 명단' },
  { id:'H11', g:'입상', msg:'2025년 입상자 알려줘' },
  { id:'H12', g:'입상', msg:'2024년 우승자 누구야?' },
  { id:'H13', g:'입상', msg:'올해 입상 기록' },
  { id:'H14', g:'입상', msg:'작년 우승자 알려줘' },
  { id:'H15', g:'입상', msg:'2023년 입상 기록 있어?' },
  { id:'H16', g:'입상', msg:'구협회장기 역대 우승자' },
  { id:'H17', g:'입상', msg:'마포구청장기 우승 기록' },
  { id:'H18', g:'입상', msg:'협회장기 입상 이력' },
  { id:'H19', g:'입상', msg:'마포구체육회장기 역대 입상자' },
  { id:'H20', g:'입상', msg:'구협회장기 챌린저부 우승 이력' },
  { id:'H21', g:'입상', msg:'내 입상 기록 있어?', u:TEST_USER_ID },
  { id:'H22', g:'입상', msg:'내가 입상한 적 있어?', u:TEST_USER_ID },
  { id:'H23', g:'입상', msg:'내 우승 이력 알려줘', u:TEST_USER_ID },
  { id:'H24', g:'입상', msg:'나 우승한 적 있어?', u:TEST_USER_ID },
  { id:'H25', g:'입상', msg:'내 입상 기록' },                   // 비로그인
  { id:'H26', g:'입상', msg:'홍길동 입상 기록' },
  { id:'H27', g:'입상', msg:'김철수 선수 우승 이력' },
  { id:'H28', g:'입상', msg:'이영희 입상한 적 있어?' },
  { id:'H29', g:'입상', msg:'박민수 전적 알려줘' },
  { id:'H30', g:'입상', msg:'2025년 챌린저부 우승자 누구야?' },
  { id:'H31', g:'입상', msg:'올해 복식 우승팀' },
  { id:'H32', g:'입상', msg:'단식 역대 챔피언 알려줘' },
  { id:'H33', g:'입상', msg:'마포구청장기 2025 우승자' },
  { id:'H34', g:'입상', msg:'구협회장기 역대 준우승자' },
  { id:'H35', g:'입상', msg:'최근 3년 우승 이력' },

  // ════════════════════════════════════════════════════════════
  // I. 참가 신청 플로우 (40건)
  // ════════════════════════════════════════════════════════════
  { id:'I01', g:'신청', msg:'대회 신청하고 싶어', u:TEST_USER_ID },
  { id:'I02', g:'신청', msg:'신청할게', u:TEST_USER_ID },
  { id:'I03', g:'신청', msg:'참가 신청할래', u:TEST_USER_ID },
  { id:'I04', g:'신청', msg:'대회 참가 신청', u:TEST_USER_ID },
  { id:'I05', g:'신청', msg:'신청해줘', u:TEST_USER_ID },
  { id:'I06', g:'신청', msg:'참가하고 싶어', u:TEST_USER_ID },
  { id:'I07', g:'신청', msg:'지원하고 싶어', u:TEST_USER_ID },
  { id:'I08', g:'신청', msg:'대회 등록할게', u:TEST_USER_ID },
  { id:'I09', g:'신청', msg:'신청 도와줘', u:TEST_USER_ID },
  { id:'I10', g:'신청', msg:'대회 참가 신청하려고', u:TEST_USER_ID },
  { id:'I11', g:'신청', msg:'구협회장기 신청할게', u:TEST_USER_ID, flowCheck:true },
  { id:'I12', g:'신청', msg:'마포구청장기 신청하고 싶어', u:TEST_USER_ID, flowCheck:true },
  { id:'I13', g:'신청', msg:'협회장기 참가 신청할래', u:TEST_USER_ID, flowCheck:true },
  { id:'I14', g:'신청', msg:'마포구청장기 참가하고 싶어', u:TEST_USER_ID, flowCheck:true },
  { id:'I15', g:'신청', msg:'구협회장기 지원할게', u:TEST_USER_ID, flowCheck:true },
  { id:'I16', g:'신청', msg:'구협회장기 등록하고 싶어', u:TEST_USER_ID, flowCheck:true },
  { id:'I17', g:'신청', msg:'다음 대회 신청하고 싶어', u:TEST_USER_ID },
  { id:'I18', g:'신청', msg:'가장 빠른 대회 신청할게', u:TEST_USER_ID },
  { id:'I19', g:'신청', msg:'모집 중인 대회 신청할래', u:TEST_USER_ID },
  { id:'I20', g:'신청', msg:'구협회장기 챌린저부 신청할게', u:TEST_USER_ID, flowCheck:true },
  { id:'I21', g:'신청', msg:'대회 신청하고 싶어' },             // 비로그인
  { id:'I22', g:'신청', msg:'구협회장기 신청하고 싶어' },       // 비로그인
  { id:'I23', g:'신청', msg:'신청하려고 하는데 어떻게 해?', u:TEST_USER_ID },
  { id:'I24', g:'신청', msg:'대회 참가 신청 방법', u:TEST_USER_ID },
  { id:'I25', g:'신청', msg:'신청 도와줘', u:TEST_USER_ID },
  { id:'I26', g:'신청', msg:'구협회장기 신청하고 싶은데', u:TEST_USER_ID, flowCheck:true },
  { id:'I27', g:'신청', msg:'마포구체육회장기 신청할게', u:TEST_USER_ID, flowCheck:true },
  { id:'I28', g:'신청', msg:'이번 대회 참가 신청할래', u:TEST_USER_ID },
  { id:'I29', g:'신청', msg:'지금 신청 가능한 대회 신청할게', u:TEST_USER_ID },
  { id:'I30', g:'신청', msg:'대회 신청 진행해줘', u:TEST_USER_ID },
  { id:'I31', g:'신청', msg:'구협회장기 참가 등록', u:TEST_USER_ID, flowCheck:true },
  { id:'I32', g:'신청', msg:'내가 신청 가능한 대회 신청할게', u:TEST_USER_ID },
  { id:'I33', g:'신청', msg:'대회 나가고 싶어', u:TEST_USER_ID },
  { id:'I34', g:'신청', msg:'테니스 대회 참가 신청', u:TEST_USER_ID },
  { id:'I35', g:'신청', msg:'마포구청장기 복식 신청할게', u:TEST_USER_ID, flowCheck:true },
  { id:'I36', g:'신청', msg:'신청 좀 해줘', u:TEST_USER_ID },
  { id:'I37', g:'신청', msg:'대회 신청이요', u:TEST_USER_ID },
  { id:'I38', g:'신청', msg:'참가 신청하고 싶은데요', u:TEST_USER_ID },
  { id:'I39', g:'신청', msg:'구협회장기 신청할게요', u:TEST_USER_ID, flowCheck:true },
  { id:'I40', g:'신청', msg:'대회 접수하고 싶어', u:TEST_USER_ID },

  // ════════════════════════════════════════════════════════════
  // J. 참가 취소 (30건)
  // ════════════════════════════════════════════════════════════
  { id:'J01', g:'취소', msg:'신청 취소하고 싶어', u:TEST_USER_ID },
  { id:'J02', g:'취소', msg:'참가 취소할게', u:TEST_USER_ID },
  { id:'J03', g:'취소', msg:'취소하고 싶어', u:TEST_USER_ID },
  { id:'J04', g:'취소', msg:'신청 취소해줘', u:TEST_USER_ID },
  { id:'J05', g:'취소', msg:'대회 취소할래', u:TEST_USER_ID },
  { id:'J06', g:'취소', msg:'등록 취소하고 싶어', u:TEST_USER_ID },
  { id:'J07', g:'취소', msg:'참가 신청 취소', u:TEST_USER_ID },
  { id:'J08', g:'취소', msg:'대회 참가 취소할게', u:TEST_USER_ID },
  { id:'J09', g:'취소', msg:'참가 철회하고 싶어', u:TEST_USER_ID },
  { id:'J10', g:'취소', msg:'신청 취소 도와줘', u:TEST_USER_ID },
  { id:'J11', g:'취소', msg:'구협회장기 취소하고 싶어', u:TEST_USER_ID },
  { id:'J12', g:'취소', msg:'마포구청장기 신청 취소할게', u:TEST_USER_ID },
  { id:'J13', g:'취소', msg:'신청 취소하는 방법', u:TEST_USER_ID },
  { id:'J14', g:'취소', msg:'참가 취소 진행해줘', u:TEST_USER_ID },
  { id:'J15', g:'취소', msg:'대회 신청 취소 방법', u:TEST_USER_ID },
  { id:'J16', g:'취소', msg:'신청 취소하고 싶어' },             // 비로그인
  { id:'J17', g:'취소', msg:'신청 철회할게', u:TEST_USER_ID },
  { id:'J18', g:'취소', msg:'대회 등록 취소', u:TEST_USER_ID },
  { id:'J19', g:'취소', msg:'참가 신청 취소해줘', u:TEST_USER_ID },
  { id:'J20', g:'취소', msg:'취소 진행해줘', u:TEST_USER_ID },
  { id:'J21', g:'취소', msg:'신청 취소하고 싶은데요', u:TEST_USER_ID },
  { id:'J22', g:'취소', msg:'참가 취소해줘요', u:TEST_USER_ID },
  { id:'J23', g:'취소', msg:'대회 취소 신청', u:TEST_USER_ID },
  { id:'J24', g:'취소', msg:'신청 취소 부탁해', u:TEST_USER_ID },
  { id:'J25', g:'취소', msg:'취소할래요', u:TEST_USER_ID },
  { id:'J26', g:'취소', msg:'나 대회 빠질래', u:TEST_USER_ID },
  { id:'J27', g:'취소', msg:'대회 안 나갈래', u:TEST_USER_ID },
  { id:'J28', g:'취소', msg:'신청 취소 좀 해줘', u:TEST_USER_ID },
  { id:'J29', g:'취소', msg:'취소 신청할게', u:TEST_USER_ID },
  { id:'J30', g:'취소', msg:'참가 취소하고 싶습니다', u:TEST_USER_ID },

  // ════════════════════════════════════════════════════════════
  // K. 복합 질의 (40건)
  // ════════════════════════════════════════════════════════════
  { id:'K01', g:'복합', msg:'마포구에서 4월에 하는 대회 있어?' },
  { id:'K02', g:'복합', msg:'서울에서 모집 중인 대회 있어?' },
  { id:'K03', g:'복합', msg:'다음 달 마포구 대회 알려줘' },
  { id:'K04', g:'복합', msg:'이번 주 서울 대회 있어?' },
  { id:'K05', g:'복합', msg:'봄에 서울에서 하는 대회' },
  { id:'K06', g:'복합', msg:'서울에서 무료 대회 있어?' },
  { id:'K07', g:'복합', msg:'마포구 신청 가능한 대회' },
  { id:'K08', g:'복합', msg:'이번 달 모집 중인 서울 대회' },
  { id:'K09', g:'복합', msg:'5만원 이하 서울 대회 있어?' },
  { id:'K10', g:'복합', msg:'강남구에서 다음 달 하는 대회' },
  { id:'K11', g:'복합', msg:'서울 단식 대회 있어?' },
  { id:'K12', g:'복합', msg:'마포구 복식 대회 신청 가능해?' },
  { id:'K13', g:'복합', msg:'이번 달 무료 대회 있어?' },
  { id:'K14', g:'복합', msg:'서울 이번 주 신청 가능한 대회' },
  { id:'K15', g:'복합', msg:'마포구청장기 참가비랑 일정 알려줘' },
  { id:'K16', g:'복합', msg:'마포구청장기 어디서 언제 해?' },
  { id:'K17', g:'복합', msg:'구협회장기 참가비랑 부서 알려줘' },
  { id:'K18', g:'복합', msg:'신청 가능한 대회 중 가장 빠른 거' },
  { id:'K19', g:'복합', msg:'서울 대회 중 무료인 것 있어?' },
  { id:'K20', g:'복합', msg:'마포구 모집 중인 대회 참가비 알려줘' },
  { id:'K21', g:'복합', msg:'다음 주 서울에서 신청 가능한 대회' },
  { id:'K22', g:'복합', msg:'이번 달 마포구 대회 일정' },
  { id:'K23', g:'복합', msg:'서울 가을 대회 있어?' },
  { id:'K24', g:'복합', msg:'봄 시즌 신청 가능한 대회 알려줘' },
  { id:'K25', g:'복합', msg:'서울 4월 모집 중인 대회' },
  { id:'K26', g:'복합', msg:'마포 이번 달 대회 일정이랑 참가비' },
  { id:'K27', g:'복합', msg:'서울 이번 주말 대회 있어?' },
  { id:'K28', g:'복합', msg:'5월 마포구 대회 신청 가능해?' },
  { id:'K29', g:'복합', msg:'서울 무료 단식 대회 있어?' },
  { id:'K30', g:'복합', msg:'마포구 6월 복식 대회' },
  { id:'K31', g:'복합', msg:'이번 달 모집중이고 서울인 대회' },
  { id:'K32', g:'복합', msg:'마포구 여름 대회 있어?' },
  { id:'K33', g:'복합', msg:'강남에서 무료로 하는 대회 있어?' },
  { id:'K34', g:'복합', msg:'서울에서 다음달에 신청 가능한 단식 대회' },
  { id:'K35', g:'복합', msg:'이번 주 마감 마포 대회' },
  { id:'K36', g:'복합', msg:'구청장기 일정이랑 참가비' },
  { id:'K37', g:'복합', msg:'봄 마포구 신청 가능 대회' },
  { id:'K38', g:'복합', msg:'서울 이번달 완료된 대회' },
  { id:'K39', g:'복합', msg:'마포구 모집 중인 대회 자세히 알려줘' },
  { id:'K40', g:'복합', msg:'서울 진행 중인 대회 대진표' },

  // ════════════════════════════════════════════════════════════
  // L. 도움말 & 엣지 케이스 (45건)
  // ════════════════════════════════════════════════════════════
  { id:'L01', g:'엣지', msg:'뭘 도와줄 수 있어?' },
  { id:'L02', g:'엣지', msg:'도움말' },
  { id:'L03', g:'엣지', msg:'어떤 기능 있어?' },
  { id:'L04', g:'엣지', msg:'뭘 할 수 있어?' },
  { id:'L05', g:'엣지', msg:'사용법 알려줘' },
  { id:'L06', g:'엣지', msg:'Tennis Tab 기능 뭐 있어?' },
  { id:'L07', g:'엣지', msg:'안녕!' },
  { id:'L08', g:'엣지', msg:'안녕하세요' },
  { id:'L09', g:'엣지', msg:'반가워요' },
  { id:'L10', g:'엣지', msg:'고마워' },
  { id:'L11', g:'엣지', msg:'감사합니다' },
  { id:'L12', g:'엣지', msg:'What tournaments are available?' },
  { id:'L13', g:'엣지', msg:'How can I register for a tournament?' },
  { id:'L14', g:'엣지', msg:'Show me my entries' },
  { id:'L15', g:'엣지', msg:'Cancel my registration' },
  { id:'L16', g:'엣지', msg:'부산 대회 있어?' },               // 없는 지역
  { id:'L17', g:'엣지', msg:'제주도 대회 있냐?' },             // 없는 지역
  { id:'L18', g:'엣지', msg:'강남오픈 2099 있어?' },           // 없는 대회
  { id:'L19', g:'엣지', msg:'존재하지않는대회XYZ 알려줘' },   // 없는 대회
  { id:'L20', g:'엣지', msg:'마표구 대회 있어?' },             // 오타
  { id:'L21', g:'엣지', msg:'테니쓰 대회' },                   // 오타
  { id:'L22', g:'엣지', msg:'구헙회장기' },                    // 오타
  { id:'L23', g:'엣지', msg:'서우 대회' },                     // 오타
  { id:'L24', g:'엣지', msg:'테니스 대회 있냐' },              // 줄임말
  { id:'L25', g:'엣지', msg:'대회 있냐?' },
  { id:'L26', g:'엣지', msg:'대회?' },
  { id:'L27', g:'엣지', msg:'신청?' },
  { id:'L28', g:'엣지', msg:'취소?' },
  { id:'L29', g:'엣지', msg:'오늘 날씨 어때?' },               // 무관 질문
  { id:'L30', g:'엣지', msg:'주식 정보 알려줘' },              // 무관 질문
  { id:'L31', g:'엣지', msg:'축구 대회 있어?' },               // 다른 스포츠
  { id:'L32', g:'엣지', msg:'배드민턴 대회 신청하고 싶어' },  // 다른 스포츠
  { id:'L33', g:'엣지', msg:'ㅎㅎ' },                          // 의미 없는 입력
  { id:'L34', g:'엣지', msg:'ㅇㅇ' },
  { id:'L35', g:'엣지', msg:'1234' },
  { id:'L36', g:'엣지', msg:'테니스 레슨 받고 싶어' },        // 관련 없는 서비스
  { id:'L37', g:'엣지', msg:'코트 예약하고 싶어' },           // 관련 없는 서비스
  { id:'L38', g:'엣지', msg:'전화번호 알려줘' },
  { id:'L39', g:'엣지', msg:'이메일 주소가 뭐야?' },
  { id:'L40', g:'엣지', msg:'a'.repeat(500) },                // 최대 길이
  { id:'L41', g:'엣지', msg:'내가 신청한 대회 알려줘' },      // 비로그인 내 정보 → 로그인 안내
  { id:'L42', g:'엣지', msg:'내 경기 결과' },                 // 비로그인 내 정보
  { id:'L43', g:'엣지', msg:'내 전적 알려줘' },               // 비로그인 내 정보
  { id:'L44', g:'엣지', msg:'신청 가능한 대회 신청할래' },    // 검색+신청 혼합
  { id:'L45', g:'엣지', msg:'마포 대회 참가비랑 신청 방법' }, // 상세+신청 혼합
]

// ─── 검증 함수 ───────────────────────────────────────────────────────────────

const TOOL_NAMES = [
  'search_tournaments', 'get_tournament_detail', 'get_my_entries',
  'get_bracket', 'get_match_results', 'get_my_schedule', 'get_my_results',
  'get_awards', 'initiate_apply_flow', 'initiate_cancel_flow',
]

const RAW_STATUS_VALUES = [
  'PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED', 'WAITLISTED',
  'UNPAID', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'CANCELLED', 'DRAFT',
]

function assess(tc, status, result, elapsed, error) {
  const issues = []

  if (error) { issues.push(`네트워크 오류: ${error}`); return { pass: false, issues } }
  if (status !== 200) { issues.push(`HTTP ${status}: ${result?.error ?? ''}`); return { pass: false, issues } }
  if (!result?.success) { issues.push(`success=false: ${result?.error ?? ''}`); return { pass: false, issues } }
  if (!result.message?.trim()) { issues.push('빈 응답'); return { pass: false, issues } }

  const msg = result.message

  // 도구명 노출 검사
  for (const t of TOOL_NAMES) {
    if (msg.includes(t)) issues.push(`도구명 노출: "${t}"`)
  }

  // 영어 상태값 노출 검사
  for (const s of RAW_STATUS_VALUES) {
    if (msg.includes(s)) issues.push(`영어 상태값 노출: "${s}"`)
  }

  // 신청 플로우 시작 여부 검사
  if (tc.flowCheck && result.flow_active !== true) {
    issues.push('신청 플로우 미시작 (flow_active !== true)')
  }

  // 비로그인 내 정보 → 로그인 안내 확인
  const authRequired = ['E26','E27','F20','G20','H25','I21','I22','J16','L41','L42','L43']
  if (authRequired.includes(tc.id) && !msg.includes('로그인')) {
    issues.push('비로그인에 로그인 안내 없음')
  }

  // 응답 지연
  if (elapsed > 15000) issues.push(`응답 지연 ${elapsed}ms`)

  return { pass: issues.length === 0, issues }
}

// ─── 실행 엔진 ───────────────────────────────────────────────────────────────

async function runOne(tc) {
  const body = { message: tc.msg }
  if (tc.u) body.user_id = tc.u

  const start = Date.now()
  let status = 0, result = null, error = null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    status = res.status
    result = await res.json()
  } catch (e) {
    clearTimeout(timer)
    error = e.name === 'AbortError' ? `타임아웃 ${TIMEOUT_MS}ms` : e.message
  }

  const elapsed = Date.now() - start
  return { tc, status, result, error, elapsed, ...assess(tc, status, result, elapsed, error) }
}

async function runBatch(cases) {
  const results = []
  for (let i = 0; i < cases.length; i += CONCURRENCY) {
    const batch = cases.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(runOne))
    results.push(...batchResults)
  }
  return results
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  const line = '═'.repeat(70)
  console.log(line)
  console.log('Tennis Tab Chat Hybrid 500건 통합 테스트')
  console.log(`대상: ${BASE_URL}`)
  console.log(`동시 요청: ${CONCURRENCY}  |  타임아웃: ${TIMEOUT_MS}ms`)
  console.log(`총 케이스: ${TEST_CASES.length}건`)
  console.log(line)

  // 서버 상태 확인
  try {
    const ping = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '안녕' }),
    })
    if (ping.status === 404) { console.error('\n❌ 서버가 실행 중이지 않습니다. `yarn dev`를 먼저 실행하세요.\n'); process.exit(1) }
  } catch {
    console.error('\n❌ 서버에 연결할 수 없습니다. `yarn dev`를 먼저 실행하세요.\n')
    process.exit(1)
  }

  console.log('\n테스트 시작...\n')
  const startTime = Date.now()
  const allResults = []
  let currentGroup = ''

  // CONCURRENCY씩 처리하되 그룹별 출력
  for (let i = 0; i < TEST_CASES.length; i += CONCURRENCY) {
    const batch = TEST_CASES.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map(runOne))

    for (const r of batchResults) {
      if (r.tc.g !== currentGroup) {
        currentGroup = r.tc.g
        console.log(`\n── ${currentGroup} ${'─'.repeat(Math.max(0, 40 - currentGroup.length))}`)
      }

      const mark = r.pass ? '✅' : '❌'
      const idPad = r.tc.id.padEnd(4)
      const msgPreview = r.tc.msg.length > 28 ? r.tc.msg.slice(0, 27) + '…' : r.tc.msg.padEnd(28)
      process.stdout.write(`  [${idPad}] ${msgPreview} ${mark} (${r.elapsed}ms)\n`)

      if (!r.pass) {
        for (const issue of r.issues) {
          console.log(`        ⚠️  ${issue}`)
        }
      }

      // 응답 미리보기 (실패 케이스만)
      if (!r.pass && r.result?.message) {
        const preview = r.result.message.replace(/\n/g, ' ').slice(0, 80)
        console.log(`        💬 ${preview}${r.result.message.length > 80 ? '…' : ''}`)
      }

      allResults.push(r)
    }

    // 진행률 표시
    const pct = Math.round(((i + batch.length) / TEST_CASES.length) * 100)
    process.stdout.write(`\r  진행: ${i + batch.length}/${TEST_CASES.length} (${pct}%)`)
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)

  // ─── 최종 리포트 ────────────────────────────────────────────────
  const passed = allResults.filter(r => r.pass).length
  const failed = allResults.filter(r => !r.pass).length
  const avgMs = Math.round(allResults.reduce((s, r) => s + r.elapsed, 0) / allResults.length)
  const maxMs = Math.max(...allResults.map(r => r.elapsed))
  const timeouts = allResults.filter(r => r.error?.includes('타임아웃')).length

  console.log('\n\n' + line)
  console.log('최종 결과 요약')
  console.log(line)
  console.log(`총 케이스:   ${allResults.length}건`)
  console.log(`✅ 통과:     ${passed}건 (${((passed/allResults.length)*100).toFixed(1)}%)`)
  console.log(`❌ 실패:     ${failed}건 (${((failed/allResults.length)*100).toFixed(1)}%)`)
  console.log(`⏱  평균 응답: ${avgMs}ms`)
  console.log(`⏱  최대 응답: ${maxMs}ms`)
  console.log(`⏳ 타임아웃:  ${timeouts}건`)
  console.log(`🕐 총 소요:  ${totalTime}초`)

  // 그룹별 통계
  console.log('\n그룹별 결과:')
  const groups = [...new Set(allResults.map(r => r.tc.g))]
  for (const g of groups) {
    const gResults = allResults.filter(r => r.tc.g === g)
    const gPassed = gResults.filter(r => r.pass).length
    const bar = '█'.repeat(Math.round((gPassed / gResults.length) * 10)) + '░'.repeat(10 - Math.round((gPassed / gResults.length) * 10))
    console.log(`  ${g.padEnd(12)} ${bar} ${gPassed}/${gResults.length} (${((gPassed/gResults.length)*100).toFixed(0)}%)`)
  }

  // 실패 케이스 상세
  const failedResults = allResults.filter(r => !r.pass)
  if (failedResults.length > 0) {
    console.log('\n실패 케이스 상세:')
    for (const r of failedResults) {
      console.log(`  [${r.tc.id}] "${r.tc.msg}" → ${r.issues.join(' / ')}`)
    }
  }

  // 이슈 유형 집계
  const allIssues = failedResults.flatMap(r => r.issues)
  const issueCounts = allIssues.reduce((acc, i) => {
    const key = i.includes('도구명') ? '도구명 노출' :
                i.includes('영어 상태값') ? '영어 상태값 노출' :
                i.includes('플로우') ? '플로우 미시작' :
                i.includes('로그인') ? '비로그인 안내 없음' :
                i.includes('지연') ? '응답 지연' :
                i.includes('타임아웃') ? '타임아웃' : '기타'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  if (Object.keys(issueCounts).length > 0) {
    console.log('\n이슈 유형별 집계:')
    for (const [k, v] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}건`)
    }
  }

  console.log(line)
  process.exit(failed > 0 ? 1 : 0)
}

main()
