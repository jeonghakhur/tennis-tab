# 자연어 질의 테스트 리포트

> 실행 시간: 2026. 2. 27. PM 10:30:42

## 요약

| 항목 | 값 |
|------|----|
| 총 테스트 수 | 500 |
| 성공 | 376 |
| 실패 | 124 |
| 성공률 | 75.2% |

## 카테고리별 성공률

| 카테고리 | 성공/전체 | 성공률 |
|----------|-----------|--------|
| 대회 조회 (일반) | 0/10 | 0.0% |
| 모집 중인 대회 | 0/15 | 0.0% |
| 접수 예정 대회 | 0/10 | 0.0% |
| 지역별 대회 | 11/15 | 73.3% |
| 날짜별 대회 | 9/15 | 60.0% |
| 진행 중인 대회 | 4/5 | 80.0% |
| 완료된 대회 | 0/5 | 0.0% |
| 대회 상세 조회 | 19/20 | 95.0% |
| 참가비 관련 | 6/8 | 75.0% |
| 참가 신청 | 15/15 | 100.0% |
| 참가 신청 - 특정 대회 지정 | 8/10 | 80.0% |
| 참가 신청 취소 | 10/10 | 100.0% |
| 내 신청 내역 | 10/10 | 100.0% |
| 내 신청 내역 - 상태별 | 10/10 | 100.0% |
| 내 경기 일정 | 10/10 | 100.0% |
| 내 전적 | 10/10 | 100.0% |
| 대진표 | 10/10 | 100.0% |
| 경기 결과 | 10/10 | 100.0% |
| 입상자 / 명예의 전당 | 4/16 | 25.0% |
| 선수별 입상 기록 | 6/6 | 100.0% |
| 복합 조건 검색 | 6/10 | 60.0% |
| 일상적인 표현 | 3/10 | 30.0% |
| 줄임말 / 비공식 표현 | 6/10 | 60.0% |
| 재질문 / 확인 요청 | 10/10 | 100.0% |
| 신청 플로우 중 표현 | 25/25 | 100.0% |
| 시간 표현 다양화 | 8/10 | 80.0% |
| 부서 관련 질문 | 10/10 | 100.0% |
| 비교 / 선택 질문 | 4/5 | 80.0% |
| 상태 확인 | 9/10 | 90.0% |
| 시설 / 장소 관련 | 10/10 | 100.0% |
| 대회 운영 관련 | 10/10 | 100.0% |
| 결과 / 점수 관련 | 10/10 | 100.0% |
| 개인화 표현 | 8/10 | 80.0% |
| 오타 / 비표준 입력 | 6/10 | 60.0% |
| 정중한 표현 | 7/10 | 70.0% |
| 감탄 / 반응 포함 표현 | 8/10 | 80.0% |
| 연속 대화 패턴 | 7/10 | 70.0% |
| 혼합형 복합 질의 | 5/10 | 50.0% |
| 시스템 한계 테스트 표현 | 8/8 | 100.0% |
| 엣지케이스 표현 | 10/12 | 83.3% |
| 영어 혼용 | 8/10 | 80.0% |
| 숫자 관련 응답 | 10/10 | 100.0% |
| 대회명 변형 | 3/10 | 30.0% |
| 반복 질의 패턴 | 7/10 | 70.0% |
| 감정 표현 포함 | 7/10 | 70.0% |
| 가족 / 지인 대신 신청 표현 | 5/5 | 100.0% |
| 결제 관련 | 5/5 | 100.0% |
| 취소 플로우 중 표현 | 9/10 | 90.0% |

## 실패 케이스 (124건)

| # | 카테고리 | 질의 | 에러 |
|---|----------|------|------|
| 1 | 대회 조회 (일반) | 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 2 | 대회 조회 (일반) | 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 3 | 대회 조회 (일반) | 대회 뭐 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 4 | 대회 조회 (일반) | 요즘 대회 뭐 있냐 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 5 | 대회 조회 (일반) | 테니스 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 6 | 대회 조회 (일반) | 어떤 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 7 | 대회 조회 (일반) | 대회 목록 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 8 | 대회 조회 (일반) | 대회 리스트 줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 9 | 대회 조회 (일반) | 전체 대회 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 10 | 대회 조회 (일반) | 현재 대회 현황 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 11 | 모집 중인 대회 | 지금 신청 가능한 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 12 | 모집 중인 대회 | 모집 중인 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 13 | 모집 중인 대회 | 접수 중인 대회 뭐 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 14 | 모집 중인 대회 | 지금 참가 신청 가능한 거 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 15 | 모집 중인 대회 | 신청 받는 대회 있냐 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 16 | 모집 중인 대회 | 지금 등록 가능한 대회? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 17 | 모집 중인 대회 | 열려있는 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 18 | 모집 중인 대회 | 모집 중인 거 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 19 | 모집 중인 대회 | 지금 당장 신청 가능한 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 20 | 모집 중인 대회 | 오픈된 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 21 | 모집 중인 대회 | 참가 접수 중인 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 22 | 모집 중인 대회 | 신청 가능한 대회 목록 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 23 | 모집 중인 대회 | 현재 모집중인 대회 뭐야? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 24 | 모집 중인 대회 | 참가할 수 있는 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 25 | 모집 중인 대회 | 지금 신청할 수 있는 거 뭐야? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 26 | 접수 예정 대회 | 곧 열리는 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 27 | 접수 예정 대회 | 접수 예정 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 28 | 접수 예정 대회 | 다음에 신청 가능한 대회? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 29 | 접수 예정 대회 | 곧 모집 시작하는 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 30 | 접수 예정 대회 | 예정된 대회 뭐 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 31 | 접수 예정 대회 | 다가오는 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 32 | 접수 예정 대회 | 조만간 신청받는 대회? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 33 | 접수 예정 대회 | 앞으로 열릴 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 34 | 접수 예정 대회 | 대기 중인 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 35 | 접수 예정 대회 | 접수 예정인 거 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 36 | 지역별 대회 | 서울 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 37 | 지역별 대회 | 마포구 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 40 | 지역별 대회 | 마포 근처 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 49 | 지역별 대회 | 중랑구 대회 알려줘 | Gemini quota exceeded |
| 55 | 날짜별 대회 | 4월에 참가할 대회? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 56 | 날짜별 대회 | 봄에 하는 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 57 | 날짜별 대회 | 여름 대회 뭐 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 58 | 날짜별 대회 | 상반기 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 61 | 날짜별 대회 | 오늘 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 63 | 날짜별 대회 | 6월 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 67 | 진행 중인 대회 | 현재 열리고 있는 대회? | {"error":{"code":500,"message":"Unable to submit request because the service is  |
| 71 | 완료된 대회 | 끝난 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 72 | 완료된 대회 | 완료된 대회 목록 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 73 | 완료된 대회 | 지난 대회 뭐 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 74 | 완료된 대회 | 이미 끝난 대회 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 75 | 완료된 대회 | 과거 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 92 | 대회 상세 조회 | 마포구청장기 장소 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 99 | 참가비 관련 | 3만원 이하 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 100 | 참가비 관련 | 참가비 5만원 이하 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 124 | 참가 신청 - 특정 대회 지정 | 마포 대회 참가 신청 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 125 | 참가 신청 - 특정 대회 지정 | 서울 대회 신청하고 싶어 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 199 | 입상자 / 명예의 전당 | 입상자 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 200 | 입상자 / 명예의 전당 | 명예의 전당 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 201 | 입상자 / 명예의 전당 | 마포구청장기 우승자 누구야? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 202 | 입상자 / 명예의 전당 | 최근 우승자 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 203 | 입상자 / 명예의 전당 | 역대 입상자 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 204 | 입상자 / 명예의 전당 | 작년 우승자 누구야? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 208 | 입상자 / 명예의 전당 | 입상 기록 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 209 | 입상자 / 명예의 전당 | 명예의 전당 어디서 봐? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 210 | 입상자 / 명예의 전당 | 최근 수상자 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 211 | 입상자 / 명예의 전당 | 2025년 우승자 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 213 | 입상자 / 명예의 전당 | 챌린저부 입상자 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 214 | 입상자 / 명예의 전당 | 퓨처스부 우승자 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 223 | 복합 조건 검색 | 3만원 이하 서울 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 227 | 복합 조건 검색 | 봄에 하는 서울 대회? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 228 | 복합 조건 검색 | 모집 중인 마포구 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 229 | 복합 조건 검색 | 접수 예정인 서울 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 232 | 일상적인 표현 | 요즘 뭔 대회 있냐 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 233 | 일상적인 표현 | 주변에 대회 없어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 234 | 일상적인 표현 | 대회 좀 알려줘봐 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 235 | 일상적인 표현 | 대회 정보 좀 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 237 | 일상적인 표현 | 참가할 만한 거 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 238 | 일상적인 표현 | 나갈 만한 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 239 | 일상적인 표현 | 좋은 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 241 | 줄임말 / 비공식 표현 | 대회 있냐 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 242 | 줄임말 / 비공식 표현 | 신청 가능? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 243 | 줄임말 / 비공식 표현 | 뭐 있어 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 244 | 줄임말 / 비공식 표현 | 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 286 | 시간 표현 다양화 | 오늘 대회? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 295 | 시간 표현 다양화 | 4월 말 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 308 | 비교 / 선택 질문 | 더 가까운 대회는? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 317 | 상태 확인 | 거절됐어? | Gemini quota exceeded |
| 351 | 개인화 표현 | 나 어떤 대회에 나갈 수 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 354 | 개인화 표현 | 나 언제 경기야? | Gemini quota exceeded |
| 361 | 오타 / 비표준 입력 | 마포구처장기 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 364 | 오타 / 비표준 입력 | 태니스 대회 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 367 | 오타 / 비표준 입력 | 신청 가능한거 있나요 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 368 | 오타 / 비표준 입력 | 대회 있나요 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 371 | 정중한 표현 | 대회 조회해주세요 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 374 | 정중한 표현 | 입상자 알려주세요 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 380 | 정중한 표현 | 명예의 전당 보여주세요 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 381 | 감탄 / 반응 포함 표현 | 오 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 386 | 감탄 / 반응 포함 표현 | 잠깐 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 391 | 연속 대화 패턴 | 더 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 392 | 연속 대화 패턴 | 다른 대회는? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 400 | 연속 대화 패턴 | 비슷한 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 403 | 혼합형 복합 질의 | 제일 가까운 대회 신청해줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 404 | 혼합형 복합 질의 | 모집 중인 대회 중에 마포구 있으면 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 406 | 혼합형 복합 질의 | 지금 신청 가능한 서울 대회 알려주고 신청도 해줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 408 | 혼합형 복합 질의 | 구협회장기 정보 보고 싶은데 신청도 할 수 있어? | {"error":{"code":400,"message":"Please ensure that the number of function respon |
| 409 | 혼합형 복합 질의 | 마포구청장기 우승자 보고 나서 신청할게 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 423 | 엣지케이스 표현 | 테니스 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 424 | 엣지케이스 표현 | 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 431 | 영어 혼용 | 테니스 tournament 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 432 | 영어 혼용 | registration 가능해? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 451 | 대회명 변형 | 마포 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 452 | 대회명 변형 | 마포구청 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 455 | 대회명 변형 | 구협 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 456 | 대회명 변형 | 구협회 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 458 | 대회명 변형 | 구협회장기 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 459 | 대회명 변형 | 체육회 대회 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 460 | 대회명 변형 | 구체육회장기 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 461 | 반복 질의 패턴 | 대회 또 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 468 | 반복 질의 패턴 | 전체 다시 보여줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 470 | 반복 질의 패턴 | 전 대회 다시 알려줘 | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 473 | 감정 표현 포함 | 이번엔 꼭 우승하고 싶어, 좋은 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 476 | 감정 표현 포함 | 긴장되는데 대회 있어? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 478 | 감정 표현 포함 | 너무 늦었나, 아직 신청 가능해? | {"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"re |
| 496 | 취소 플로우 중 표현 | 아니 취소 안 할게 | Gemini quota exceeded |

## 전체 결과

| # | 카테고리 | 질의 | 성공 | intent | 응답 (50자) | 시간(ms) |
|---|----------|------|------|--------|-------------|----------|
| 1 | 대회 조회 (일반) | 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 3514 |
| 2 | 대회 조회 (일반) | 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2202 |
| 3 | 대회 조회 (일반) | 대회 뭐 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2117 |
| 4 | 대회 조회 (일반) | 요즘 대회 뭐 있냐 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1787 |
| 5 | 대회 조회 (일반) | 테니스 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2168 |
| 6 | 대회 조회 (일반) | 어떤 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2819 |
| 7 | 대회 조회 (일반) | 대회 목록 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 4318 |
| 8 | 대회 조회 (일반) | 대회 리스트 줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2382 |
| 9 | 대회 조회 (일반) | 전체 대회 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1529 |
| 10 | 대회 조회 (일반) | 현재 대회 현황 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2975 |
| 11 | 모집 중인 대회 | 지금 신청 가능한 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1514 |
| 12 | 모집 중인 대회 | 모집 중인 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2524 |
| 13 | 모집 중인 대회 | 접수 중인 대회 뭐 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2958 |
| 14 | 모집 중인 대회 | 지금 참가 신청 가능한 거 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2746 |
| 15 | 모집 중인 대회 | 신청 받는 대회 있냐 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2198 |
| 16 | 모집 중인 대회 | 지금 등록 가능한 대회? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2167 |
| 17 | 모집 중인 대회 | 열려있는 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1370 |
| 18 | 모집 중인 대회 | 모집 중인 거 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2172 |
| 19 | 모집 중인 대회 | 지금 당장 신청 가능한 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1474 |
| 20 | 모집 중인 대회 | 오픈된 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1506 |
| 21 | 모집 중인 대회 | 참가 접수 중인 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1465 |
| 22 | 모집 중인 대회 | 신청 가능한 대회 목록 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 3371 |
| 23 | 모집 중인 대회 | 현재 모집중인 대회 뭐야? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2451 |
| 24 | 모집 중인 대회 | 참가할 수 있는 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 3103 |
| 25 | 모집 중인 대회 | 지금 신청할 수 있는 거 뭐야? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1418 |
| 26 | 접수 예정 대회 | 곧 열리는 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1942 |
| 27 | 접수 예정 대회 | 접수 예정 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1438 |
| 28 | 접수 예정 대회 | 다음에 신청 가능한 대회? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1993 |
| 29 | 접수 예정 대회 | 곧 모집 시작하는 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2669 |
| 30 | 접수 예정 대회 | 예정된 대회 뭐 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2233 |
| 31 | 접수 예정 대회 | 다가오는 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1885 |
| 32 | 접수 예정 대회 | 조만간 신청받는 대회? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2981 |
| 33 | 접수 예정 대회 | 앞으로 열릴 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1392 |
| 34 | 접수 예정 대회 | 대기 중인 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2088 |
| 35 | 접수 예정 대회 | 접수 예정인 거 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1424 |
| 36 | 지역별 대회 | 서울 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1425 |
| 37 | 지역별 대회 | 마포구 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1943 |
| 38 | 지역별 대회 | 강남 테니스 대회 있어? | ✅ | - | 강남 지역에서 열리는 테니스 대회는 현재 없습니다. | 2157 |
| 39 | 지역별 대회 | 이번 주 서울 대회 뭐 있어? | ✅ | - | 이번 주 서울에서 열리는 대회는 없습니다. | 2507 |
| 40 | 지역별 대회 | 마포 근처 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1610 |
| 41 | 지역별 대회 | 강동구 대회 있나? | ✅ | - | 강동구에서 열리는 대회는 현재 없습니다. | 3647 |
| 42 | 지역별 대회 | 송파구 테니스 대회 | ✅ | - | 송파구에서 열리는 테니스 대회가 없습니다. | 4371 |
| 43 | 지역별 대회 | 용산 대회 있어? | ✅ | - | 용산에서 열리는 대회는 현재 없습니다. | 2214 |
| 44 | 지역별 대회 | 서초구 대회 알려줘 | ✅ | - | 서초구에서 열리는 대회는 현재 없습니다. | 2232 |
| 45 | 지역별 대회 | 노원구 대회 있냐 | ✅ | - | 노원구에서 열리는 대회는 현재 없습니다. | 2301 |
| 46 | 지역별 대회 | 은평구 대회 뭐 있어? | ✅ | - | 등록된 대회가 없습니다. | 4787 |
| 47 | 지역별 대회 | 성북구 근처 대회 | ✅ | - | 성북구 근처에는 현재 등록된 대회가 없습니다. | 3841 |
| 48 | 지역별 대회 | 동대문구 대회 있어? | ✅ | - | 동대문구에서 진행되는 대회는 현재 없습니다. | 2321 |
| 49 | 지역별 대회 | 중랑구 대회 알려줘 | ❌ | - | Gemini quota exceeded | 2487 |
| 50 | 지역별 대회 | 도봉구 테니스 대회 | ✅ | - | 도봉구에서 열리는 테니스 대회가 없습니다. | 4687 |
| 51 | 날짜별 대회 | 이번 주 대회 있어? | ✅ | - | 이번 주에 해당하는 대회는 없습니다. | 3409 |
| 52 | 날짜별 대회 | 이번 달 대회 뭐 있어? | ✅ | - | 이번 달에 열리는 대회는 없습니다. | 3555 |
| 53 | 날짜별 대회 | 다음 달 대회 알려줘 | ✅ | - | 다음 달에 해당하는 대회는 없습니다. | 2337 |
| 54 | 날짜별 대회 | 3월 대회 있어? | ✅ | - | 3월에 열리는 대회는 현재 없습니다. | 2297 |
| 55 | 날짜별 대회 | 4월에 참가할 대회? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1551 |
| 56 | 날짜별 대회 | 봄에 하는 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1475 |
| 57 | 날짜별 대회 | 여름 대회 뭐 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1567 |
| 58 | 날짜별 대회 | 상반기 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1597 |
| 59 | 날짜별 대회 | 주말 대회 있어? | ✅ | - | 주말에 열리는 대회는 없습니다. | 3658 |
| 60 | 날짜별 대회 | 이번 주말 대회? | ✅ | - | 이번 주말에 열리는 대회는 없습니다. | 2418 |
| 61 | 날짜별 대회 | 오늘 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2595 |
| 62 | 날짜별 대회 | 내일 대회 있나? | ✅ | - | 내일은 등록된 대회가 없습니다. | 2411 |
| 63 | 날짜별 대회 | 6월 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2539 |
| 64 | 날짜별 대회 | 하반기 대회 뭐 있어? | ✅ | - | 조건에 맞는 대회가 없습니다. | 2429 |
| 65 | 날짜별 대회 | 연말 대회 있어? | ✅ | - | 연말에 맞는 대회는 없습니다. | 2392 |
| 66 | 진행 중인 대회 | 지금 진행 중인 대회 있어? | ✅ | - | 현재 진행 중인 대회가 없습니다. | 3405 |
| 67 | 진행 중인 대회 | 현재 열리고 있는 대회? | ❌ | - | {"error":{"code":500,"message":"Unable to submit r | 4458 |
| 68 | 진행 중인 대회 | 지금 하고 있는 대회 알려줘 | ✅ | - | 현재 진행 중인 대회가 없습니다. | 4261 |
| 69 | 진행 중인 대회 | 오늘 경기 있어? | ✅ | - | 참가 중인 대회가 없습니다. | 2287 |
| 70 | 진행 중인 대회 | 진행 중인 대회 목록 | ✅ | - | 현재 진행 중인 대회가 없습니다. | 3227 |
| 71 | 완료된 대회 | 끝난 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1932 |
| 72 | 완료된 대회 | 완료된 대회 목록 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1442 |
| 73 | 완료된 대회 | 지난 대회 뭐 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1452 |
| 74 | 완료된 대회 | 이미 끝난 대회 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1488 |
| 75 | 완료된 대회 | 과거 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1482 |
| 76 | 대회 상세 조회 | 마포구청장기 대회 자세히 알려줘 | ✅ | - | 제38회 마포구청장기 테니스대회 상세 정보입니다.  - 참가비: 50000원 - 장소: 서 | 5470 |
| 77 | 대회 상세 조회 | 구협회장기 정보 알려줘 | ✅ | - | 제37회 구협회장기 테니스대회는 마포구 망원나들목 테니스장 외 보조 경기장에서 2026년  | 4105 |
| 78 | 대회 상세 조회 | 마포구청장기 참가 조건이 뭐야? | ✅ | - | 2026년 1월 31일 기준 마포구테니스협회 등록 클럽 소속 동호인이어야 합니다. 적용 부 | 2769 |
| 79 | 대회 상세 조회 | 참가비 얼마야? | ✅ | - | 어떤 대회의 참가비를 알고 싶으신가요? 대회 이름을 알려주세요. | 1282 |
| 80 | 대회 상세 조회 | 어디서 해? | ✅ | - | 어떤 대회를 찾으시나요? 지역을 알려주시면 해당 지역에서 열리는 대회를 찾아볼 수 있습니다 | 3185 |
| 81 | 대회 상세 조회 | 장소가 어디야? | ✅ | - | 어떤 대회의 장소를 알고 싶으신가요? | 1148 |
| 82 | 대회 상세 조회 | 날짜가 언제야? | ✅ | - | 어떤 대회의 날짜를 알고 싶으신가요? | 2118 |
| 83 | 대회 상세 조회 | 일정 알려줘 | ✅ | - | 참가 중인 대회가 없습니다. | 2083 |
| 84 | 대회 상세 조회 | 마포구청장기 요강 알려줘 | ✅ | - | 제38회 마포구청장기 테니스대회 요강입니다.  대회는 2026년 10월 17일에 시작하여  | 3560 |
| 85 | 대회 상세 조회 | 마포구청장기 상세 정보 | ✅ | - | 제38회 마포구청장기 테니스대회 상세 정보입니다.  - 참가비: 50000원 - 장소: 서 | 5703 |
| 86 | 대회 상세 조회 | 어떤 부서가 있어? | ✅ | - | 어떤 대회의 부서를 찾으시는 건가요? 대회명을 알려주세요. | 1315 |
| 87 | 대회 상세 조회 | 부서 종류 알려줘 | ✅ | - | 죄송합니다. 부서 종류를 알려드릴 수 없습니다. | 1967 |
| 88 | 대회 상세 조회 | 참가 자격이 뭐야? | ✅ | - | 어떤 대회의 참가 자격을 알고 싶으신가요? 대회 이름을 알려주세요. | 1180 |
| 89 | 대회 상세 조회 | 몇 팀 참가할 수 있어? | ✅ | - | 어떤 대회를 말씀하시는 건가요? 대회 이름을 알려주시면 상세 정보를 찾아 알려드릴 수 있습 | 1275 |
| 90 | 대회 상세 조회 | 정원이 몇 명이야? | ✅ | - | 어떤 대회를 찾으시는 건가요? 대회명을 알려주시면 상세 정보를 찾아볼 수 있습니다. | 2358 |
| 91 | 대회 상세 조회 | 마포구청장기 몇 월에 해? | ✅ | - | 등록된 정보가 없습니다. | 2400 |
| 92 | 대회 상세 조회 | 마포구청장기 장소 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2104 |
| 93 | 대회 상세 조회 | 공이 뭐 써? | ✅ | - | 어떤 종류의 공을 찾으시나요? 테니스 공, 배드민턴 공, 탁구 공 등 종류를 уточнит | 1852 |
| 94 | 대회 상세 조회 | 볼 종류가 뭐야? | ✅ | - | 죄송합니다. 어떤 종류의 정보를 찾으시는지 좀 더 구체적으로 말씀해 주시겠어요? | 1862 |
| 95 | 대회 상세 조회 | 경기 방식이 어떻게 돼? | ✅ | - | 어떤 대회의 경기 방식을 알고 싶으신가요? | 1555 |
| 96 | 참가비 관련 | 무료 대회 있어? | ✅ | - | 무료 대회는 현재 없습니다. | 3234 |
| 97 | 참가비 관련 | 참가비 없는 대회? | ✅ | - | 무료 대회는 현재 없습니다. | 2370 |
| 98 | 참가비 관련 | 저렴한 대회 있어? | ✅ | - | 최대 참가비용을 얼마로 설정하시겠습니까? | 1124 |
| 99 | 참가비 관련 | 3만원 이하 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1557 |
| 100 | 참가비 관련 | 참가비 5만원 이하 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2113 |
| 101 | 참가비 관련 | 가성비 좋은 대회 있어? | ✅ | - | 최대 참가비 얼마까지 생각하세요? | 1725 |
| 102 | 참가비 관련 | 무료로 참가할 수 있는 대회? | ✅ | - | 무료로 참가할 수 있는 대회가 없습니다. | 3633 |
| 103 | 참가비 관련 | 참가비 얼마짜리 대회 있어? | ✅ | - | 최대 참가비를 얼마로 설정하시겠습니까? | 1126 |
| 104 | 참가 신청 | 대회 참가 신청하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1784 |
| 105 | 참가 신청 | 대회 신청할게 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2140 |
| 106 | 참가 신청 | 신청하려고 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 4534 |
| 107 | 참가 신청 | 대회 등록하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2123 |
| 108 | 참가 신청 | 참가 신청해줘 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1887 |
| 109 | 참가 신청 | 마포구청장기 신청할게 | ✅ | - | "제38회 마포구청장기 테니스대회"은(는) 현재 신청할 수 없습니다. 현재 상태: 접수 예 | 4330 |
| 110 | 참가 신청 | 구협회장기 신청하고 싶어 | ✅ | - | 제37회 구협회장기 테니스대회 참가 가능한 부서: 1. 마스터부 (0/30팀) - 참가비  | 2405 |
| 111 | 참가 신청 | 이번 대회 신청하려고 | ✅ | - | 어떤 대회를 신청하시겠습니까? | 1304 |
| 112 | 참가 신청 | 참가 등록하고 싶은데 | ✅ | - | 어떤 대회에 참가 신청하고 싶으신가요? | 1210 |
| 113 | 참가 신청 | 대회 나가고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2219 |
| 114 | 참가 신청 | 신청하고 싶은 대회 있어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2860 |
| 115 | 참가 신청 | 대회 나가려면 어떻게 해? | ✅ | - | 어떤 대회를 신청하고 싶으신가요? 대회명을 알려주시거나, 현재 모집 중인 대회 목록에서 선 | 1502 |
| 116 | 참가 신청 | 참가하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2247 |
| 117 | 참가 신청 | 출전하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2520 |
| 118 | 참가 신청 | 등록하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 3184 |
| 119 | 참가 신청 - 특정 대회 지정 | 마포구청장기 신청할게 | ✅ | - | "제38회 마포구청장기 테니스대회"은(는) 현재 신청할 수 없습니다. 현재 상태: 접수 예 | 3952 |
| 120 | 참가 신청 - 특정 대회 지정 | 구협회장기 나가고 싶어 | ✅ | - | 제37회 구협회장기 테니스대회 참가 가능한 부서: 1. 마스터부 (0/30팀) - 참가비  | 2406 |
| 121 | 참가 신청 - 특정 대회 지정 | 첫 번째 대회 신청할게 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1928 |
| 122 | 참가 신청 - 특정 대회 지정 | 2번 대회 신청할게 | ✅ | - | 2번 대회를 찾을 수 없습니다. 현재 접수 중인 대회만 신청 가능합니다. | 4650 |
| 123 | 참가 신청 - 특정 대회 지정 | 방금 나온 대회 신청하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 3320 |
| 124 | 참가 신청 - 특정 대회 지정 | 마포 대회 참가 신청 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 3722 |
| 125 | 참가 신청 - 특정 대회 지정 | 서울 대회 신청하고 싶어 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 3061 |
| 126 | 참가 신청 - 특정 대회 지정 | 이번 주 대회 신청할게 | ✅ | - | 이번 주에 신청 가능한 대회가 없습니다. | 2448 |
| 127 | 참가 신청 - 특정 대회 지정 | 구협회장기 출전 신청 | ✅ | - | 제37회 구협회장기 테니스대회 참가 가능한 부서: 1. 마스터부 (0/30팀) - 참가비  | 2163 |
| 128 | 참가 신청 - 특정 대회 지정 | 마포구청장기 등록할게 | ✅ | - | "제38회 마포구청장기 테니스대회"은(는) 현재 신청할 수 없습니다. 현재 상태: 접수 예 | 2967 |
| 129 | 참가 신청 취소 | 신청 취소하고 싶어 | ✅ | - | 취소할 참가 신청이 없습니다. | 3138 |
| 130 | 참가 신청 취소 | 참가 취소할게 | ✅ | - | 취소할 참가 신청이 없습니다. | 2035 |
| 131 | 참가 신청 취소 | 등록 취소하려고 | ✅ | - | 취소할 참가 신청이 없습니다. | 2213 |
| 132 | 참가 신청 취소 | 신청한 거 취소해줘 | ✅ | - | 취소할 참가 신청이 없습니다. | 2265 |
| 133 | 참가 신청 취소 | 대회 취소할게 | ✅ | - | 취소할 참가 신청이 없습니다. | 2254 |
| 134 | 참가 신청 취소 | 참가 취소해줘 | ✅ | - | 취소할 참가 신청이 없습니다. | 3289 |
| 135 | 참가 신청 취소 | 신청 철회하고 싶어 | ✅ | - | 취소할 참가 신청이 없습니다. | 2299 |
| 136 | 참가 신청 취소 | 나 대회 못 나가게 됐어 취소해줘 | ✅ | - | 취소할 참가 신청이 없습니다. | 3175 |
| 137 | 참가 신청 취소 | 참가 신청 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 2254 |
| 138 | 참가 신청 취소 | 대회 등록 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 3301 |
| 139 | 내 신청 내역 | 내가 신청한 대회 알려줘 | ✅ | - | 신청 내역이 없습니다. | 3518 |
| 140 | 내 신청 내역 | 내 신청 내역 보여줘 | ✅ | - | 참가 신청 내역이 없습니다. | 2375 |
| 141 | 내 신청 내역 | 내가 참가 신청한 거 뭐야? | ✅ | - | 참가 신청 내역이 없습니다. | 3261 |
| 142 | 내 신청 내역 | 내 대회 신청 현황 | ✅ | - | 참가 신청 내역이 없습니다. | 2214 |
| 143 | 내 신청 내역 | 신청한 거 목록 보여줘 | ✅ | - | 참가 신청 내역이 없습니다. | 3772 |
| 144 | 내 신청 내역 | 내 신청 확인하고 싶어 | ✅ | - | 신청 내역이 없습니다. | 2278 |
| 145 | 내 신청 내역 | 내가 등록한 대회 있어? | ✅ | - | 등록된 참가 신청 내역이 없습니다. | 3150 |
| 146 | 내 신청 내역 | 참가 신청 현황 알려줘 | ✅ | - | 참가 신청 내역이 없습니다. | 2968 |
| 147 | 내 신청 내역 | 내 신청 상태 어때? | ✅ | - | 신청 내역이 없습니다. | 2253 |
| 148 | 내 신청 내역 | 지금까지 신청한 대회 알려줘 | ✅ | - | 신청한 대회 내역이 없습니다. | 2270 |
| 149 | 내 신청 내역 - 상태별 | 승인된 신청 있어? | ✅ | - | 승인된 신청 내역이 없습니다. | 3405 |
| 150 | 내 신청 내역 - 상태별 | 대기 중인 신청 있어? | ✅ | - | 대기 중인 신청 내역이 없습니다. | 3378 |
| 151 | 내 신청 내역 - 상태별 | 아직 미납인 거 있어? | ✅ | - | 미납 내역이 없습니다. | 2184 |
| 152 | 내 신청 내역 - 상태별 | 결제 안 한 거 있어? | ✅ | - | 결제 미납 상태인 신청 내역이 없습니다. | 2327 |
| 153 | 내 신청 내역 - 상태별 | 거절된 신청 있어? | ✅ | - | 거절된 신청 내역이 없습니다. | 2368 |
| 154 | 내 신청 내역 - 상태별 | 확정된 대회 있어? | ✅ | - | 확정된 대회는 없습니다. | 3327 |
| 155 | 내 신청 내역 - 상태별 | 취소된 신청 알려줘 | ✅ | - | 취소된 신청 내역이 없습니다. | 2348 |
| 156 | 내 신청 내역 - 상태별 | 승인 대기 중인 거 있어? | ✅ | - | 승인 대기 중인 신청 내역이 없습니다. | 2217 |
| 157 | 내 신청 내역 - 상태별 | 완납한 대회 있어? | ✅ | - | 완납한 대회 신청 내역이 없습니다. | 3172 |
| 158 | 내 신청 내역 - 상태별 | 결제 완료된 신청 보여줘 | ✅ | - | 결제 완료된 참가 신청 내역이 없습니다. | 3914 |
| 159 | 내 경기 일정 | 내 경기 일정 알려줘 | ✅ | - | 참가 중인 대회가 없습니다. | 2084 |
| 160 | 내 경기 일정 | 다음 경기 언제야? | ✅ | - | 참가 중인 대회가 없습니다. | 3464 |
| 161 | 내 경기 일정 | 내 경기 있어? | ✅ | - | 참가 중인 대회가 없습니다. | 3246 |
| 162 | 내 경기 일정 | 나 언제 경기해? | ✅ | - | 참가 중인 대회가 없습니다. | 2208 |
| 163 | 내 경기 일정 | 경기 일정 확인하고 싶어 | ✅ | - | 참가 중인 대회가 없습니다. | 3292 |
| 164 | 내 경기 일정 | 오늘 내 경기 있어? | ✅ | - | 참가 중인 대회가 없습니다. | 4223 |
| 165 | 내 경기 일정 | 이번 주 내 경기? | ✅ | - | 이번 주에 참가 예정인 경기가 없습니다. | 3282 |
| 166 | 내 경기 일정 | 내 다음 경기 알려줘 | ✅ | - | 참가 중인 대회가 없습니다. | 2088 |
| 167 | 내 경기 일정 | 경기 언제 어디서 해? | ✅ | - | 참가 중인 대회가 없습니다. | 2224 |
| 168 | 내 경기 일정 | 상대 누구야? | ✅ | - | 어떤 대회의 상대 선수를 찾으시는 건가요? | 1185 |
| 169 | 내 전적 | 내 전적 알려줘 | ✅ | - | 참가한 대회가 없습니다. | 2210 |
| 170 | 내 전적 | 몇 승 몇 패야? | ✅ | - | 참가한 대회가 없습니다. | 3964 |
| 171 | 내 전적 | 내 경기 결과 보여줘 | ✅ | - | 참가한 대회가 없습니다. | 2113 |
| 172 | 내 전적 | 승률이 얼마야? | ✅ | - | 참가한 대회가 없습니다. | 2207 |
| 173 | 내 전적 | 최근 경기 결과 | ✅ | - | 참가한 대회가 없습니다. | 2328 |
| 174 | 내 전적 | 내 성적 알려줘 | ✅ | - | 참가한 대회가 없습니다. | 2252 |
| 175 | 내 전적 | 이기고 있어 지고 있어? | ✅ | - | 참가한 대회가 없습니다. | 3485 |
| 176 | 내 전적 | 내 승패 기록 보여줘 | ✅ | - | 참가한 대회가 없습니다. | 3272 |
| 177 | 내 전적 | 전적 확인하고 싶어 | ✅ | - | 참가한 대회가 없습니다. | 2183 |
| 178 | 내 전적 | 마지막 경기 결과 | ✅ | - | 참가한 대회가 없습니다. | 2181 |
| 179 | 대진표 | 마포구청장기 대진표 보여줘 | ✅ | - | "제38회 마포구청장기 테니스대회" 대진표가 아직 생성되지 않았습니다. | 2792 |
| 180 | 대진표 | 구협회장기 토너먼트 현황 | ✅ | - | 구협회장기 토너먼트 대회를 찾을 수 없습니다. | 3688 |
| 181 | 대진표 | 대진표 어떻게 돼? | ✅ | - | 어떤 대회의 대진표를 보고 싶으신가요? | 1907 |
| 182 | 대진표 | 경기 배치 알려줘 | ✅ | - | 어떤 대회의 경기 배치를 알고 싶으신가요? | 1804 |
| 183 | 대진표 | 몇 라운드까지 진행됐어? | ✅ | - | 어떤 대회의 진행 상황을 알고 싶으신가요? | 1895 |
| 184 | 대진표 | 진행 상황 어때? | ✅ | - | 어떤 대회의 진행 상황을 알고 싶으신가요? 대회 이름을 알려주세요. | 1907 |
| 185 | 대진표 | 마포구청장기 현재 상황 | ✅ | - | 현재 진행 중인 마포구청장기 대회가 없습니다. | 2185 |
| 186 | 대진표 | 대진표 확인하고 싶어 | ✅ | - | 어떤 대회의 대진표를 보고 싶으신가요? | 1155 |
| 187 | 대진표 | 누가 붙어? | ✅ | - | 어떤 대회의 대진표를 보고 싶으신가요? | 1678 |
| 188 | 대진표 | 몇 강이야? | ✅ | - | 어떤 대회의 대진표를 보고 싶으신가요? | 1143 |
| 189 | 경기 결과 | 마포구청장기 결과 알려줘 | ✅ | - | 제38회 마포구청장기 테니스대회 경기 기록이 없습니다. | 2546 |
| 190 | 경기 결과 | 어제 경기 결과 어떻게 됐어? | ✅ | - | 어제 어떤 대회의 경기 결과를 알고 싶으신가요? | 1965 |
| 191 | 경기 결과 | 결승 결과 알려줘 | ✅ | - | 어떤 대회의 결승 결과를 원하시나요? | 1166 |
| 192 | 경기 결과 | 경기 스코어 어때? | ✅ | - | 어떤 대회의 경기 스코어를 원하시나요? | 1134 |
| 193 | 경기 결과 | 마포구청장기 경기 결과 | ✅ | - | 제38회 마포구청장기 테니스대회 경기 기록이 없습니다. | 3784 |
| 194 | 경기 결과 | 구협회장기 누가 이겼어? | ✅ | - | 구협회장기 테니스대회 경기 기록이 없습니다. | 4266 |
| 195 | 경기 결과 | 최근 경기 결과 보여줘 | ✅ | - | 참가한 대회가 없습니다. | 3186 |
| 196 | 경기 결과 | 오늘 경기 결과? | ✅ | - | 참가한 대회가 없습니다. | 2344 |
| 197 | 경기 결과 | 준결승 결과 알려줘 | ✅ | - | 어떤 대회의 준결승 결과를 원하시나요? | 1892 |
| 198 | 경기 결과 | 결과 확인하고 싶어 | ✅ | - | 어떤 대회의 결과를 확인하고 싶으신가요? | 1051 |
| 199 | 입상자 / 명예의 전당 | 입상자 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1537 |
| 200 | 입상자 / 명예의 전당 | 명예의 전당 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1485 |
| 201 | 입상자 / 명예의 전당 | 마포구청장기 우승자 누구야? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1425 |
| 202 | 입상자 / 명예의 전당 | 최근 우승자 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1313 |
| 203 | 입상자 / 명예의 전당 | 역대 입상자 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1480 |
| 204 | 입상자 / 명예의 전당 | 작년 우승자 누구야? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1931 |
| 205 | 입상자 / 명예의 전당 | 올해 우승자 알려줘 | ✅ | - | 올해 입상 기록이 없습니다. | 3363 |
| 206 | 입상자 / 명예의 전당 | 준우승자 누구야? | ✅ | - | 어떤 대회의 준우승자를 찾으시나요? | 1808 |
| 207 | 입상자 / 명예의 전당 | 3위는 누가 했어? | ✅ | - | 어떤 대회의 입상자를 찾으시나요? | 1138 |
| 208 | 입상자 / 명예의 전당 | 입상 기록 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2030 |
| 209 | 입상자 / 명예의 전당 | 명예의 전당 어디서 봐? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2032 |
| 210 | 입상자 / 명예의 전당 | 최근 수상자 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2344 |
| 211 | 입상자 / 명예의 전당 | 2025년 우승자 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1405 |
| 212 | 입상자 / 명예의 전당 | 마스터부 우승자 누구야? | ✅ | - | 어떤 대회의 마스터부 우승자를 찾으시나요? | 1114 |
| 213 | 입상자 / 명예의 전당 | 챌린저부 입상자 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2067 |
| 214 | 입상자 / 명예의 전당 | 퓨처스부 우승자 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1395 |
| 215 | 선수별 입상 기록 | 홍길동 입상 기록 있어? | ✅ | - | 홍길동 선수의 입상 기록이 없습니다. | 2323 |
| 216 | 선수별 입상 기록 | 김철수 전적 어떻게 돼? | ✅ | - | 참가한 대회가 없습니다. | 2233 |
| 217 | 선수별 입상 기록 | 박영희 우승한 적 있어? | ✅ | - | 박영희 선수의 입상 기록은 없습니다. | 3424 |
| 218 | 선수별 입상 기록 | 이름으로 기록 검색할 수 있어? | ✅ | - | 어떤 이름으로 입상 기록을 검색하고 싶으신가요? | 1128 |
| 219 | 선수별 입상 기록 | 내 입상 기록 있어? | ✅ | - | 입상 기록이 없습니다. | 3601 |
| 220 | 선수별 입상 기록 | 나 수상한 적 있어? | ✅ | - | 입상 기록이 없습니다. | 7464 |
| 221 | 복합 조건 검색 | 이번 달 서울 대회 있어? | ✅ | - | 이번 달 서울에서 열리는 대회는 없습니다. | 3358 |
| 222 | 복합 조건 검색 | 마포구에서 다음 달 열리는 대회? | ✅ | - | 다음 달 마포구에서 열리는 대회는 없습니다. | 3390 |
| 223 | 복합 조건 검색 | 3만원 이하 서울 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2084 |
| 224 | 복합 조건 검색 | 무료인 강남 대회 있어? | ✅ | - | 무료인 강남 대회가 없습니다. | 2174 |
| 225 | 복합 조건 검색 | 이번 주 신청 가능한 대회 | ✅ | - | 이번 주 신청 가능한 대회가 없습니다. | 3800 |
| 226 | 복합 조건 검색 | 다음 달 마포구 대회 알려줘 | ✅ | - | 다음 달 마포구에서 열리는 대회는 현재 없습니다. | 2371 |
| 227 | 복합 조건 검색 | 봄에 하는 서울 대회? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1976 |
| 228 | 복합 조건 검색 | 모집 중인 마포구 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1471 |
| 229 | 복합 조건 검색 | 접수 예정인 서울 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1490 |
| 230 | 복합 조건 검색 | 5월 강남 대회 있어? | ✅ | - | 5월에 강남에서 열리는 대회는 현재 없습니다. | 3109 |
| 231 | 일상적인 표현 | 나 테니스 대회 나가고 싶은데 | ✅ | - | 어떤 대회를 찾으시나요? | 1046 |
| 232 | 일상적인 표현 | 요즘 뭔 대회 있냐 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1412 |
| 233 | 일상적인 표현 | 주변에 대회 없어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2052 |
| 234 | 일상적인 표현 | 대회 좀 알려줘봐 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1953 |
| 235 | 일상적인 표현 | 대회 정보 좀 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2196 |
| 236 | 일상적인 표현 | 뭐 신청할 수 있어? | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2154 |
| 237 | 일상적인 표현 | 참가할 만한 거 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1618 |
| 238 | 일상적인 표현 | 나갈 만한 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1438 |
| 239 | 일상적인 표현 | 좋은 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2843 |
| 240 | 일상적인 표현 | 추천해줘 | ✅ | - | 어떤 종류의 대회를 추천해 드릴까요? | 1037 |
| 241 | 줄임말 / 비공식 표현 | 대회 있냐 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2432 |
| 242 | 줄임말 / 비공식 표현 | 신청 가능? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 3199 |
| 243 | 줄임말 / 비공식 표현 | 뭐 있어 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1512 |
| 244 | 줄임말 / 비공식 표현 | 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1412 |
| 245 | 줄임말 / 비공식 표현 | 대회 신청 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2179 |
| 246 | 줄임말 / 비공식 표현 | 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 3297 |
| 247 | 줄임말 / 비공식 표현 | 내 신청 | ✅ | - | 참가 신청 내역이 없습니다. | 2171 |
| 248 | 줄임말 / 비공식 표현 | 전적 | ✅ | - | 참가한 대회가 없습니다. | 3081 |
| 249 | 줄임말 / 비공식 표현 | 일정 | ✅ | - | 참가 중인 대회가 없습니다. | 2070 |
| 250 | 줄임말 / 비공식 표현 | 결과 | ✅ | - | 어떤 결과를 원하시나요? | 1842 |
| 251 | 재질문 / 확인 요청 | 다시 알려줘 | ✅ | - | 어떤 정보를 다시 알려드릴까요? | 2580 |
| 252 | 재질문 / 확인 요청 | 한 번 더 보여줘 | ✅ | - | 어떤 정보를 다시 보여드릴까요? | 1884 |
| 253 | 재질문 / 확인 요청 | 좀 더 자세히 | ✅ | - | 어떤 대회의 상세 정보가 필요하신가요? 대회 이름을 알려주세요. | 2230 |
| 254 | 재질문 / 확인 요청 | 더 알고 싶어 | ✅ | - | 어떤 대회의 정보를 더 알고 싶으신가요? 대회 이름을 알려주세요. | 1174 |
| 255 | 재질문 / 확인 요청 | 추가 정보 있어? | ✅ | - | 어떤 대회에 대한 추가 정보를 원하시나요? 대회 이름을 알려주세요. | 1172 |
| 256 | 재질문 / 확인 요청 | 그 대회 더 자세히 | ✅ | - | 어떤 대회를 자세히 보고 싶으신가요? 대회 이름을 알려주세요. | 1185 |
| 257 | 재질문 / 확인 요청 | 참가비는? | ✅ | - | 어떤 대회의 참가비를 알고 싶으신가요? 대회 이름을 알려주세요. | 1154 |
| 258 | 재질문 / 확인 요청 | 날짜는? | ✅ | - | 오늘 날짜는 2026년 02월 27일입니다. | 2157 |
| 259 | 재질문 / 확인 요청 | 장소는? | ✅ | - | 어느 대회를 찾으시나요? | 1136 |
| 260 | 재질문 / 확인 요청 | 신청 방법은? | ✅ | - | 어떤 대회를 신청하고 싶으신가요? | 1114 |
| 261 | 신청 플로우 중 표현 | 1번 | ✅ | - | 어떻게 도와드릴까요? | 1022 |
| 262 | 신청 플로우 중 표현 | 2번 | ✅ | - | 어떻게 도와드릴까요? | 1020 |
| 263 | 신청 플로우 중 표현 | 1 | ✅ | - | 어떻게 도와드릴까요? | 1006 |
| 264 | 신청 플로우 중 표현 | 2 | ✅ | - | 네? | 1808 |
| 265 | 신청 플로우 중 표현 | 3 | ✅ | - | 어떻게 도와드릴까요? | 1716 |
| 266 | 신청 플로우 중 표현 | 첫 번째 | ✅ | - | 어떤 종류의 정보를 원하시나요? | 1811 |
| 267 | 신청 플로우 중 표현 | 두 번째 | ✅ | - | 어떤 것을 다시 찾으시나요? | 1175 |
| 268 | 신청 플로우 중 표현 | 마포구청장기로 | ✅ | - | 조건에 맞는 대회가 없습니다. | 2365 |
| 269 | 신청 플로우 중 표현 | 마스터부 | ✅ | - | 어떤 정보를 찾으시는 건가요? | 1082 |
| 270 | 신청 플로우 중 표현 | 챌린저부 | ✅ | - | 어떤 대회를 찾으시나요? | 1021 |
| 271 | 신청 플로우 중 표현 | 퓨처스부 | ✅ | - | 어떤 지역의 퓨처스 대회를 찾으시나요? | 1187 |
| 272 | 신청 플로우 중 표현 | 응 | ✅ | - | 대회 정보를 알려드릴까요? | 1064 |
| 273 | 신청 플로우 중 표현 | 네 | ✅ | - | 어떤 도움이 필요하신가요? | 2181 |
| 274 | 신청 플로우 중 표현 | 어 | ✅ | - | 네? | 1090 |
| 275 | 신청 플로우 중 표현 | ㅇㅇ | ✅ | - | 어떤 것을 도와드릴까요? | 1047 |
| 276 | 신청 플로우 중 표현 | 좋아 | ✅ | - | 어떻게 도와드릴까요? | 1088 |
| 277 | 신청 플로우 중 표현 | 그래 | ✅ | - | 어떤 것을 도와드릴까요? | 1842 |
| 278 | 신청 플로우 중 표현 | 맞아 | ✅ | - | 어떤 작업을 도와드릴까요? | 2104 |
| 279 | 신청 플로우 중 표현 | ok | ✅ | - | 어떻게 도와드릴까요? | 1067 |
| 280 | 신청 플로우 중 표현 | yes | ✅ | - | 어떻게 도와드릴까요? | 1997 |
| 281 | 신청 플로우 중 표현 | 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 4129 |
| 282 | 신청 플로우 중 표현 | 그만 | ✅ | - | 참가 신청 취소 플로우를 시작합니다. | 1787 |
| 283 | 신청 플로우 중 표현 | 중단 | ✅ | - | 취소할 참가 신청이 없습니다. | 2714 |
| 284 | 신청 플로우 중 표현 | cancel | ✅ | - | 취소할 참가 신청이 없습니다. | 2092 |
| 285 | 신청 플로우 중 표현 | 안 할래 | ✅ | - | 취소할 참가 신청이 없습니다. | 3377 |
| 286 | 시간 표현 다양화 | 오늘 대회? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1461 |
| 287 | 시간 표현 다양화 | 내일 대회? | ✅ | - | 내일은 예정된 대회가 없습니다. | 2357 |
| 288 | 시간 표현 다양화 | 이번 주 금요일 대회 | ✅ | - | 이번 주 금요일에 열리는 대회는 없습니다. | 2511 |
| 289 | 시간 표현 다양화 | 다음 주 대회 있어? | ✅ | - | 다음 주에 열리는 대회는 없습니다. | 3130 |
| 290 | 시간 표현 다양화 | 이번 주말 대회 | ✅ | - | 이번 주말에 열리는 대회는 없습니다. | 3178 |
| 291 | 시간 표현 다양화 | 다음 주말 대회 | ✅ | - | 다음 주말에 열리는 대회는 없습니다. | 2288 |
| 292 | 시간 표현 다양화 | 이번 달 말에 대회 있어? | ✅ | - | 이번 달 말일에 해당하는 대회는 없습니다. | 3405 |
| 293 | 시간 표현 다양화 | 다음 달 초 대회 | ✅ | - | 다음 달 초에 열리는 대회는 현재 없습니다. | 3385 |
| 294 | 시간 표현 다양화 | 3월 중순 대회 | ✅ | - | 3월 11일부터 3월 20일까지의 대회는 없습니다. | 3326 |
| 295 | 시간 표현 다양화 | 4월 말 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2329 |
| 296 | 부서 관련 질문 | 어떤 부서에 신청할 수 있어? | ✅ | - | 어떤 대회를 찾으시는 건가요? 대회 이름을 알려주시면 해당 대회에 어떤 부서가 있는지 안내 | 1882 |
| 297 | 부서 관련 질문 | 부서 종류가 뭐야? | ✅ | - | 어떤 대회의 부서 종류를 알고 싶으신가요? 대회 이름을 알려주세요. | 1180 |
| 298 | 부서 관련 질문 | 마스터부가 뭐야? | ✅ | - | 어떤 종류의 정보를 찾으시나요? 마스터즈 대회에 대해 알아보고 싶으신가요? | 1132 |
| 299 | 부서 관련 질문 | 챌린저부 참가 조건? | ✅ | - | 대회 이름을 알려주시면 참가 조건을 포함한 상세 정보를 알려드릴 수 있습니다. | 1115 |
| 300 | 부서 관련 질문 | 어느 부서가 나한테 맞아? | ✅ | - | 등록된 정보가 없습니다. | 2052 |
| 301 | 부서 관련 질문 | 초보자 부서 있어? | ✅ | - | 어떤 지역의 대회를 찾으시나요? | 1101 |
| 302 | 부서 관련 질문 | 중급 부서 있어? | ✅ | - | 어떤 대회를 찾으시나요? | 1106 |
| 303 | 부서 관련 질문 | 고급 부서 있어? | ✅ | - | 어떤 종류의 대회를 찾으시나요? | 1116 |
| 304 | 부서 관련 질문 | 단식 부서 있어? | ✅ | - | 어떤 대회를 찾으시나요? 대회 이름을 알려주시면 해당 대회에 단식 부서가 있는지 확인해 드 | 1174 |
| 305 | 부서 관련 질문 | 복식 부서 있어? | ✅ | - | 어떤 대회를 찾으시나요? | 1115 |
| 306 | 비교 / 선택 질문 | 마포구청장기랑 구협회장기 중 뭐가 더 좋아? | ✅ | - | 두 대회 중 어떤 정보를 알고 싶으신가요? (예: 참가비, 일정, 부서) | 1221 |
| 307 | 비교 / 선택 질문 | 둘 다 신청 가능해? | ✅ | - | 어떤 대회를 말씀하시는 건가요? | 2526 |
| 308 | 비교 / 선택 질문 | 더 가까운 대회는? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2226 |
| 309 | 비교 / 선택 질문 | 더 빠른 대회는? | ✅ | - | 날짜를 기준으로 대회를 검색해 드릴까요? | 2202 |
| 310 | 비교 / 선택 질문 | 참가비가 더 싼 건 어디야? | ✅ | - | 최대 참가비는 얼마까지 생각하고 계신가요? | 1645 |
| 311 | 상태 확인 | 내 신청 승인됐어? | ✅ | - | 신청 내역이 없습니다. | 3731 |
| 312 | 상태 확인 | 아직 대기 중이야? | ✅ | - | 대기 중인 참가 신청 내역이 없습니다. | 3062 |
| 313 | 상태 확인 | 결제해야 해? | ✅ | - | 결제해야 할 내역이 없습니다. | 2395 |
| 314 | 상태 확인 | 언제까지 결제해야 해? | ✅ | - | 어떤 대회의 결제 기한을 알고 싶으신가요? 대회 이름을 알려주세요. | 4055 |
| 315 | 상태 확인 | 결제 방법이 뭐야? | ✅ | - | 죄송합니다. 해당 기능은 아직 지원하지 않습니다. | 2675 |
| 316 | 상태 확인 | 신청 확정됐어? | ✅ | - | 신청 확정된 내역이 없습니다. | 4145 |
| 317 | 상태 확인 | 거절됐어? | ❌ | - | Gemini quota exceeded | 737 |
| 318 | 상태 확인 | 왜 거절됐어? | ✅ | - | 어떤 대회 신청이 거절되었는지 확인하려면, 참가 신청 내역을 조회해야 합니다. | 1466 |
| 319 | 상태 확인 | 대기자 명단에 있어? | ✅ | - | 대기자 명단에 등록된 신청 내역이 없습니다. | 4073 |
| 320 | 상태 확인 | 몇 번째야? | ✅ | - | 어떤 정보에 대한 순서를 알고 싶으신가요? | 1680 |
| 321 | 시설 / 장소 관련 | 실내 코트야? | ✅ | - | 어떤 지역의 실내 코트를 찾으시나요? | 1138 |
| 322 | 시설 / 장소 관련 | 실외 코트야? | ✅ | - | 실외 코트에서 진행하는 대회를 찾으시는 건가요? | 2148 |
| 323 | 시설 / 장소 관련 | 주차 가능해? | ✅ | - | 어떤 대회를 찾으시는 건가요? 대회 이름을 알려주시면 주차 가능 여부를 포함한 상세 정보를 | 1316 |
| 324 | 시설 / 장소 관련 | 지하철로 갈 수 있어? | ✅ | - | 어떤 대회를 찾으시나요? | 1136 |
| 325 | 시설 / 장소 관련 | 주소 알려줘 | ✅ | - | 죄송합니다. 주소를 알려드릴 기능은 없습니다. | 1140 |
| 326 | 시설 / 장소 관련 | 어떻게 가? | ✅ | - | 어떤 대회를 찾으시나요? | 1983 |
| 327 | 시설 / 장소 관련 | 지도 보여줘 | ✅ | - | 죄송합니다. 지도를 보여주는 기능은 아직 지원하지 않습니다. | 1156 |
| 328 | 시설 / 장소 관련 | 코트 몇 개야? | ✅ | - | 어떤 대회의 코트 수를 알고 싶으신가요? 대회 이름을 알려주세요. | 2284 |
| 329 | 시설 / 장소 관련 | 어떤 코트야? | ✅ | - | 어떤 대회의 코트를 찾으시는 건가요? 대회 이름을 알려주세요. | 1260 |
| 330 | 시설 / 장소 관련 | 하드코트야 클레이야? | ✅ | - | 어떤 종류의 코트를 찾으시나요? | 3550 |
| 331 | 대회 운영 관련 | 주최가 어디야? | ✅ | - | 어떤 대회를 찾으시는 건가요? 대회 이름을 알려주시면 상세 정보를 찾아볼 수 있습니다. | 1878 |
| 332 | 대회 운영 관련 | 누가 주관해? | ✅ | - | 어떤 대회를 찾으시나요? 대회 이름을 알려주시면 상세 정보를 찾아볼 수 있습니다. | 1156 |
| 333 | 대회 운영 관련 | 심판 있어? | ✅ | - | 어떤 종류의 심판을 찾으시나요? 테니스 대회 심판을 말씀하시는 건가요? | 1249 |
| 334 | 대회 운영 관련 | 공인 대회야? | ✅ | - | 어떤 종류의 공인 대회를 찾으시나요? 테니스 대회 이름을 알려주시거나, 아니면 지역, 날짜 | 2097 |
| 335 | 대회 운영 관련 | 시드 배정 있어? | ✅ | - | 어떤 대회의 시드 배정 정보를 찾으시나요? | 1662 |
| 336 | 대회 운영 관련 | 몇 명 신청했어? | ✅ | - | 어떤 대회를 말씀하시는 건가요? 대회명을 알려주시면 참가자 수를 알려드릴 수 있습니다. | 2396 |
| 337 | 대회 운영 관련 | 남은 자리 있어? | ✅ | - | 어떤 대회를 찾으시나요? | 1876 |
| 338 | 대회 운영 관련 | 자리 몇 개 남았어? | ✅ | - | 어떤 대회를 찾으시나요? | 1020 |
| 339 | 대회 운영 관련 | 정원이 얼마야? | ✅ | - | 어떤 대회의 정원을 알고 싶으신가요? 대회 이름을 알려주세요. | 3171 |
| 340 | 대회 운영 관련 | 마감됐어? | ✅ | - | 어떤 대회를 찾으시나요? 대회명을 알려주시면, 해당 대회의 현재 상태를 확인해 드리겠습니다 | 1255 |
| 341 | 결과 / 점수 관련 | 스코어 알려줘 | ✅ | - | 어떤 대회의 스코어를 원하시나요? | 1702 |
| 342 | 결과 / 점수 관련 | 몇 대 몇이야? | ✅ | - | 어떤 대회의 경기 결과를 보고 싶으신가요? | 1662 |
| 343 | 결과 / 점수 관련 | 세트 스코어? | ✅ | - | 어떤 대회의 세트 스코어를 찾으시나요? | 1172 |
| 344 | 결과 / 점수 관련 | 몇 세트로 이겼어? | ✅ | - | 어떤 대회의 경기 결과를 보고 싶으신가요? | 1169 |
| 345 | 결과 / 점수 관련 | 타이브레이크 있었어? | ✅ | - | 타이브레이크 대회는 없는 것 같아요. | 3803 |
| 346 | 결과 / 점수 관련 | 기권이야? | ✅ | - | 취소할 참가 신청이 없습니다. | 2190 |
| 347 | 결과 / 점수 관련 | 부전승이야? | ✅ | - | 어떤 대회 대진표를 보시겠어요? | 1154 |
| 348 | 결과 / 점수 관련 | 결승 점수? | ✅ | - | 어떤 대회의 결승 점수를 알고 싶으신가요? | 2197 |
| 349 | 결과 / 점수 관련 | 3위 결정전 결과? | ✅ | - | 어떤 대회의 3위 결정전 결과를 원하시나요? | 2426 |
| 350 | 결과 / 점수 관련 | 조별 순위? | ✅ | - | 어떤 대회의 조별 순위를 보고 싶으신가요? | 2010 |
| 351 | 개인화 표현 | 나 어떤 대회에 나갈 수 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1517 |
| 352 | 개인화 표현 | 내 레벨에 맞는 대회 있어? | ✅ | - | 죄송합니다. 레벨에 맞는 대회 검색 기능은 아직 지원하지 않습니다. | 1206 |
| 353 | 개인화 표현 | 내가 신청한 거 현황이 어때? | ✅ | - | 참가 신청 내역이 없습니다. | 3987 |
| 354 | 개인화 표현 | 나 언제 경기야? | ❌ | - | Gemini quota exceeded | 10692 |
| 355 | 개인화 표현 | 내 상대 누구야? | ✅ | - | 참가 중인 대회가 없습니다. | 2121 |
| 356 | 개인화 표현 | 내 코트 번호가 뭐야? | ✅ | - | 참가 중인 대회가 없습니다. | 2175 |
| 357 | 개인화 표현 | 내가 이기고 있어? | ✅ | - | 참가한 대회가 없습니다. | 2931 |
| 358 | 개인화 표현 | 내 성적 어때? | ✅ | - | 참가한 대회가 없습니다. | 3766 |
| 359 | 개인화 표현 | 나 몇 강까지 갔어? | ✅ | - | 어떤 대회에 참가하셨는지 알려주시면, 해당 대회에서 몇 강까지 진출했는지 알려드릴 수 있습 | 1356 |
| 360 | 개인화 표현 | 나 탈락했어? | ✅ | - | 참가한 대회가 없습니다. | 5045 |
| 361 | 오타 / 비표준 입력 | 마포구처장기 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1643 |
| 362 | 오타 / 비표준 입력 | 구협회장끼 신청할게 | ✅ | - | 구협회장끼 대회를 찾을 수 없습니다. 현재 접수 중인 대회만 신청 가능합니다. | 2558 |
| 363 | 오타 / 비표준 입력 | 참가 신처하고 싶어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2421 |
| 364 | 오타 / 비표준 입력 | 태니스 대회 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2498 |
| 365 | 오타 / 비표준 입력 | 대회 신처 | ✅ | - | 어떤 대회를 신청하시겠습니까? | 1148 |
| 366 | 오타 / 비표준 입력 | 참가비 얼마에요 | ✅ | - | 어떤 대회의 참가비를 알고 싶으신가요? 대회 이름을 알려주세요. | 1246 |
| 367 | 오타 / 비표준 입력 | 신청 가능한거 있나요 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2044 |
| 368 | 오타 / 비표준 입력 | 대회 있나요 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1406 |
| 369 | 오타 / 비표준 입력 | 신청하고십어 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1708 |
| 370 | 오타 / 비표준 입력 | 취소하고십어 | ✅ | - | 취소할 참가 신청이 없습니다. | 3707 |
| 371 | 정중한 표현 | 대회 조회해주세요 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2166 |
| 372 | 정중한 표현 | 참가 신청하고 싶습니다 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1710 |
| 373 | 정중한 표현 | 신청 취소 부탁드립니다 | ✅ | - | 취소할 참가 신청이 없습니다. | 3438 |
| 374 | 정중한 표현 | 입상자 알려주세요 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2556 |
| 375 | 정중한 표현 | 내 신청 내역 확인하고 싶습니다 | ✅ | - | 참가 신청 내역이 없습니다. | 4979 |
| 376 | 정중한 표현 | 대회 일정 문의드립니다 | ✅ | - | 어떤 대회의 일정이 궁금하신가요? | 1121 |
| 377 | 정중한 표현 | 참가비 알려주세요 | ✅ | - | 어떤 대회의 참가비를 알고 싶으신가요? 대회 이름을 알려주세요. | 1167 |
| 378 | 정중한 표현 | 대진표 보여주세요 | ✅ | - | 어떤 대회의 대진표를 보고 싶으신가요? | 1998 |
| 379 | 정중한 표현 | 경기 결과 확인하고 싶습니다 | ✅ | - | 어떤 대회의 경기 결과를 확인하고 싶으신가요? | 1999 |
| 380 | 정중한 표현 | 명예의 전당 보여주세요 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2357 |
| 381 | 감탄 / 반응 포함 표현 | 오 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1388 |
| 382 | 감탄 / 반응 포함 표현 | 아 신청하고 싶다 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2282 |
| 383 | 감탄 / 반응 포함 표현 | 헐 벌써 마감이야? | ✅ | - | 어떤 대회를 찾으시나요? | 1945 |
| 384 | 감탄 / 반응 포함 표현 | 완전 좋은 대회 있네, 신청할게 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2245 |
| 385 | 감탄 / 반응 포함 표현 | 이번엔 꼭 나가야지, 신청해줘 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2370 |
| 386 | 감탄 / 반응 포함 표현 | 잠깐 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1603 |
| 387 | 감탄 / 반응 포함 표현 | 어 그럼 신청할게 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1668 |
| 388 | 감탄 / 반응 포함 표현 | 진짜? 그럼 1번으로 | ✅ | - | 어떤 작업에 대해 1번으로 진행하시겠습니까? | 4003 |
| 389 | 감탄 / 반응 포함 표현 | 아 취소하고 싶어 | ✅ | - | 취소할 참가 신청이 없습니다. | 3049 |
| 390 | 감탄 / 반응 포함 표현 | 음... 2번 신청할게 | ✅ | - | 어떤 대회를 신청하시겠습니까? 대회명을 알려주세요. | 3075 |
| 391 | 연속 대화 패턴 | 더 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1550 |
| 392 | 연속 대화 패턴 | 다른 대회는? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1516 |
| 393 | 연속 대화 패턴 | 마포 말고 다른 지역은? | ✅ | - | 어떤 종류의 대회를 찾으시나요? 지역, 날짜, 참가비 등 구체적인 조건을 알려주시면 더욱  | 1772 |
| 394 | 연속 대화 패턴 | 이것 말고 더? | ✅ | - | 어떤 것을 더 찾으시는 건가요? 찾고 싶은 대회 종류나, 지역, 날짜 등 구체적인 조건을  | 1237 |
| 395 | 연속 대화 패턴 | 그 다음은? | ✅ | - | 어떤 작업을 원하시나요? | 1707 |
| 396 | 연속 대화 패턴 | 또? | ✅ | - | 어떤 종류의 대회를 찾으시나요? 지역, 날짜, 참가비 등 구체적인 조건을 알려주시면 더욱  | 1729 |
| 397 | 연속 대화 패턴 | 다른 부서는? | ✅ | - | 어떤 대회의 부서를 찾으시는 건가요? 대회 이름을 알려주세요. | 1139 |
| 398 | 연속 대화 패턴 | 참가비 더 싼 건? | ✅ | - | 최대 참가비를 얼마까지 생각하시나요? | 1711 |
| 399 | 연속 대화 패턴 | 더 빠른 건? | ✅ | - | 어떤 종류의 정보를 찾으시는 건가요? | 1156 |
| 400 | 연속 대화 패턴 | 비슷한 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2037 |
| 401 | 혼합형 복합 질의 | 이번 달 마포구 모집 중인 대회 신청하고 싶어 | ✅ | - | 이번 달 마포구에서 모집 중인 대회가 없습니다. | 3340 |
| 402 | 혼합형 복합 질의 | 무료 대회 있으면 신청할게 | ✅ | - | 무료로 신청 가능한 대회가 현재는 없습니다. | 3429 |
| 403 | 혼합형 복합 질의 | 제일 가까운 대회 신청해줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1960 |
| 404 | 혼합형 복합 질의 | 모집 중인 대회 중에 마포구 있으면 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1523 |
| 405 | 혼합형 복합 질의 | 다음 달 대회 미리 신청 가능해? | ✅ | - | 다음 달에 접수 예정인 대회는 아직 없습니다. | 2655 |
| 406 | 혼합형 복합 질의 | 지금 신청 가능한 서울 대회 알려주고 신청도 해줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2601 |
| 407 | 혼합형 복합 질의 | 내가 신청한 대회 취소하고 새로 신청하고 싶어 | ✅ | - | 취소할 참가 신청이 없습니다. | 2172 |
| 408 | 혼합형 복합 질의 | 구협회장기 정보 보고 싶은데 신청도 할 수 있어? | ❌ | - | {"error":{"code":400,"message":"Please ensure that | 2518 |
| 409 | 혼합형 복합 질의 | 마포구청장기 우승자 보고 나서 신청할게 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2051 |
| 410 | 혼합형 복합 질의 | 5만원 이하 대회 중에 이번 달 거 있어? | ✅ | - | 이번 달에 5만원 이하인 대회는 없습니다. | 2455 |
| 411 | 시스템 한계 테스트 표현 | 내일 주식 시세 알려줘 | ✅ | - | 주식 시세는 제가 알 수 없는 정보입니다. 테니스 대회 관련 문의만 가능합니다. | 1122 |
| 412 | 시스템 한계 테스트 표현 | 날씨 어때? | ✅ | - | 저는 테니스 대회 정보를 제공하는 AI 어시스턴트입니다. 날씨 정보는 알 수 없습니다. | 2175 |
| 413 | 시스템 한계 테스트 표현 | 테니스 코칭 받고 싶어 | ✅ | - | 죄송합니다. 테니스 코칭은 현재 Tennis Tab에서 제공하지 않는 기능입니다. | 2361 |
| 414 | 시스템 한계 테스트 표현 | 라켓 추천해줘 | ✅ | - | 죄송합니다. 라켓 추천 기능은 아직 지원하지 않습니다. | 2291 |
| 415 | 시스템 한계 테스트 표현 | 스트링 어디서 쳐? | ✅ | - | 어떤 종류의 정보를 찾으시나요? 지역을 말씀해주시면 해당 지역에서 열리는 대회를 찾아볼 수 | 1287 |
| 416 | 시스템 한계 테스트 표현 | 회원탈퇴하고 싶어 | ✅ | - | 죄송합니다. 회원 탈퇴 기능은 아직 지원하지 않습니다. | 1871 |
| 417 | 시스템 한계 테스트 표현 | 비밀번호 바꾸고 싶어 | ✅ | - | 죄송합니다. 비밀번호 변경 기능은 아직 지원하지 않습니다. | 1145 |
| 418 | 시스템 한계 테스트 표현 | 프로필 수정하고 싶어 | ✅ | - | 죄송합니다. 프로필 수정 기능은 아직 지원하지 않습니다. | 1162 |
| 419 | 엣지케이스 표현 | (빈 메시지) | ✅ | - | 대회를 찾으시나요? | 1039 |
| 420 | 엣지케이스 표현 | ㅎ | ✅ | - | 어떻게 도와드릴까요? | 1117 |
| 421 | 엣지케이스 표현 | 안녕 | ✅ | - | 무엇을 도와드릴까요? | 1991 |
| 422 | 엣지케이스 표현 | 뭐해 | ✅ | - | 테니스 대회 정보를 검색하거나, 신청/취소, 경기 정보 확인 등 다양한 기능을 수행할 수  | 1136 |
| 423 | 엣지케이스 표현 | 테니스 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2404 |
| 424 | 엣지케이스 표현 | 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2161 |
| 425 | 엣지케이스 표현 | 신청 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2814 |
| 426 | 엣지케이스 표현 | 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 3552 |
| 427 | 엣지케이스 표현 | . | ✅ | - | 네. 무엇을 도와드릴까요? | 1965 |
| 428 | 엣지케이스 표현 | ??? | ✅ | - | 어떻게 도와드릴까요? | 1742 |
| 429 | 엣지케이스 표현 | 도움말 | ✅ | - | 어떤 도움이 필요하신가요? 대회 정보를 찾아드릴까요, 아니면 다른 기능을 원하시나요? | 1243 |
| 430 | 엣지케이스 표현 | 뭐할 수 있어? | ✅ | - | 테니스 대회 정보를 찾아보거나, 대회 신청/취소, 경기 일정 확인, 전적 조회, 입상 기록 | 3067 |
| 431 | 영어 혼용 | 테니스 tournament 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2311 |
| 432 | 영어 혼용 | registration 가능해? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2872 |
| 433 | 영어 혼용 | cancel 하고 싶어 | ✅ | - | 취소할 참가 신청이 없습니다. | 3345 |
| 434 | 영어 혼용 | 내 schedule 알려줘 | ✅ | - | 참가 중인 대회가 없습니다. | 3552 |
| 435 | 영어 혼용 | ranking 있어? | ✅ | - | 어떤 랭킹 정보를 찾으시는 건가요? | 2070 |
| 436 | 영어 혼용 | draw sheet 보여줘 | ✅ | - | 어떤 대회의 대진표를 보시겠어요? | 1961 |
| 437 | 영어 혼용 | entry fee 얼마야? | ✅ | - | 어떤 대회의 참가비를 알고 싶으신가요? 대회 이름을 알려주세요. | 1834 |
| 438 | 영어 혼용 | deadline 언제야? | ✅ | - | 어떤 대회의 마감일을 알고 싶으신가요? | 1723 |
| 439 | 영어 혼용 | 나 withdraw 하고 싶어 | ✅ | - | 취소할 참가 신청이 없습니다. | 2396 |
| 440 | 영어 혼용 | bracket 보여줘 | ✅ | - | 어떤 대회의 대진표를 보시겠어요? | 2631 |
| 441 | 숫자 관련 응답 | 1번 신청할게 | ✅ | - | 1번 대회를 찾을 수 없습니다. 현재 접수 중인 대회만 신청 가능합니다. | 2744 |
| 442 | 숫자 관련 응답 | 2번으로 | ✅ | - | 어떻게 도와드릴까요? | 1728 |
| 443 | 숫자 관련 응답 | 3 | ✅ | - | 어떻게 도와드릴까요? | 1838 |
| 444 | 숫자 관련 응답 | 두 번째 | ✅ | - | 어떤 것을 다시 찾으시는 건가요? | 1163 |
| 445 | 숫자 관련 응답 | 세 번째 | ✅ | - | 어떤 종류의 세 번째 정보를 원하시나요? 대회를 찾고 계신다면, 어떤 대회인지 알려주세요. | 1385 |
| 446 | 숫자 관련 응답 | 첫 번째 것으로 | ✅ | - | 어떤 것에 대한 첫 번째 정보를 원하시나요? | 1279 |
| 447 | 숫자 관련 응답 | 마지막 것으로 | ✅ | - | 어떤 것을 원하시는지 구체적으로 말씀해 주시겠어요? | 2285 |
| 448 | 숫자 관련 응답 | 위에 첫 번째 | ✅ | - | 어떤 내용의 첫 번째 정보를 원하시나요? | 1724 |
| 449 | 숫자 관련 응답 | 아래 것 | ✅ | - | 어떤 것을 도와드릴까요? | 1954 |
| 450 | 숫자 관련 응답 | 중간 것 | ✅ | - | 어떤 종류의 정보를 원하시나요? | 1153 |
| 451 | 대회명 변형 | 마포 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1481 |
| 452 | 대회명 변형 | 마포구청 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2575 |
| 453 | 대회명 변형 | 마포구청장 대회 | ✅ | - | 마포구에서 열리는 구청장배 대회가 없습니다. | 2263 |
| 454 | 대회명 변형 | 마포구청장기 | ✅ | - | 조건에 맞는 대회가 없습니다. | 3098 |
| 455 | 대회명 변형 | 구협 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2846 |
| 456 | 대회명 변형 | 구협회 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2419 |
| 457 | 대회명 변형 | 구협회장 대회 | ✅ | - | 조건에 맞는 대회가 없습니다. | 2202 |
| 458 | 대회명 변형 | 구협회장기 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1472 |
| 459 | 대회명 변형 | 체육회 대회 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1425 |
| 460 | 대회명 변형 | 구체육회장기 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1507 |
| 461 | 반복 질의 패턴 | 대회 또 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 4838 |
| 462 | 반복 질의 패턴 | 아까 그 대회 다시 | ✅ | - | 어떤 대회를 말씀하시는지 알려주시겠어요? | 1275 |
| 463 | 반복 질의 패턴 | 다시 보여줘 | ✅ | - | 어떤 정보를 다시 보여드릴까요? | 1064 |
| 464 | 반복 질의 패턴 | 한 번 더 | ✅ | - | 어떤 종류의 정보를 원하시나요? | 2542 |
| 465 | 반복 질의 패턴 | 아까 뭐라 했지? | ✅ | - | 이전 대화 내용이 없습니다. | 2652 |
| 466 | 반복 질의 패턴 | 방금 나온 대회 이름이 뭐야? | ✅ | - | 최근에 어떤 대회를 검색했는지 알려주시겠어요? | 1168 |
| 467 | 반복 질의 패턴 | 다시 정리해줘 | ✅ | - | 어떤 내용을 다시 정리해드릴까요? | 1074 |
| 468 | 반복 질의 패턴 | 전체 다시 보여줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2375 |
| 469 | 반복 질의 패턴 | 처음부터 다시 | ✅ | - | 무엇을 도와드릴까요? | 1665 |
| 470 | 반복 질의 패턴 | 전 대회 다시 알려줘 | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1465 |
| 471 | 감정 표현 포함 | 대회 신청하고 싶은데 뭐가 있는지 너무 궁금해 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2636 |
| 472 | 감정 표현 포함 | 빨리 신청하고 싶어! | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2578 |
| 473 | 감정 표현 포함 | 이번엔 꼭 우승하고 싶어, 좋은 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 1678 |
| 474 | 감정 표현 포함 | 아쉽게 취소해야 할 것 같아 | ✅ | - | 취소할 참가 신청이 없습니다. | 2213 |
| 475 | 감정 표현 포함 | 설레는데 신청할게 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 2149 |
| 476 | 감정 표현 포함 | 긴장되는데 대회 있어? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2145 |
| 477 | 감정 표현 포함 | 드디어 신청한다! | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1597 |
| 478 | 감정 표현 포함 | 너무 늦었나, 아직 신청 가능해? | ❌ | - | {"error":{"code":400,"message":"Invalid JSON paylo | 2069 |
| 479 | 감정 표현 포함 | 역시 취소 못 하겠다 | ✅ | - | 알겠습니다. | 1089 |
| 480 | 감정 표현 포함 | 너무 어렵다, 신청 어떻게 해? | ✅ | - | 어떤 대회를 신청하고 싶으신가요? 대회 이름을 알려주시면 신청을 시작할 수 있습니다. 아직 | 2175 |
| 481 | 가족 / 지인 대신 신청 표현 | 친구 대신 신청할 수 있어? | ✅ | - | 본인만 신청 가능합니다. | 2057 |
| 482 | 가족 / 지인 대신 신청 표현 | 아버지 대회 신청하고 싶어 | ✅ | - | 아버지 대회를 찾을 수 없습니다. 현재 접수 중인 대회만 신청 가능합니다. | 2978 |
| 483 | 가족 / 지인 대신 신청 표현 | 우리 팀 신청하려고 | ✅ | - | 현재 참가 신청 가능한 대회: 1. 제37회 구협회장기 테니스대회 (2026.04.25)  | 1683 |
| 484 | 가족 / 지인 대신 신청 표현 | 같이 신청할 수 있어? | ✅ | - | 어떤 대회를 같이 신청하고 싶으신가요? | 3429 |
| 485 | 가족 / 지인 대신 신청 표현 | 단체 신청 가능해? | ✅ | - | 어떤 대회를 말씀하시는 건가요? 대회명을 알려주시면 상세 정보를 안내해 드릴 수 있습니다. | 1111 |
| 486 | 결제 관련 | 어떻게 결제해? | ✅ | - | 참가 신청을 먼저 해주셔야 결제 안내를 받을 수 있습니다. 어떤 대회를 신청하시겠습니까? | 1225 |
| 487 | 결제 관련 | 카드로 낼 수 있어? | ✅ | - | 죄송합니다. 어떤 대회를 말씀하시는 건가요? 대회 이름을 알려주시면 참가비 정보를 찾아볼  | 1280 |
| 488 | 결제 관련 | 계좌이체 가능해? | ✅ | - | 죄송합니다. 해당 기능은 아직 지원하지 않습니다. | 1162 |
| 489 | 결제 관련 | 언제까지 결제해야 해? | ✅ | - | 어떤 대회의 결제 기한을 알고 싶으신가요? 대회 이름을 알려주세요. | 1942 |
| 490 | 결제 관련 | 결제했어, 확인해줘 | ✅ | - | 결제 완료된 참가 신청 내역이 없습니다. | 3309 |
| 491 | 취소 플로우 중 표현 | 1번 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 3190 |
| 492 | 취소 플로우 중 표현 | 마포구청장기 취소할게 | ✅ | - | 취소할 참가 신청이 없습니다. | 2269 |
| 493 | 취소 플로우 중 표현 | 이 대회 취소 | ✅ | - | 취소할 참가 신청이 없습니다. | 2296 |
| 494 | 취소 플로우 중 표현 | 응 취소할게 | ✅ | - | 취소할 참가 신청이 없습니다. | 3908 |
| 495 | 취소 플로우 중 표현 | 맞아 취소해줘 | ✅ | - | 취소할 참가 신청이 없습니다. | 3087 |
| 496 | 취소 플로우 중 표현 | 아니 취소 안 할게 | ❌ | - | Gemini quota exceeded | 7290 |
| 497 | 취소 플로우 중 표현 | 기다려봐 | ✅ | - | 무엇을 도와드릴까요? | 1162 |
| 498 | 취소 플로우 중 표현 | 잠깐, 취소 재고할게 | ✅ | - | 취소할 참가 신청이 없습니다. | 2304 |
| 499 | 취소 플로우 중 표현 | 역시 취소 안 할래 | ✅ | - | 취소 플로우를 종료합니다. | 1045 |
| 500 | 취소 플로우 중 표현 | 그냥 유지할게 | ✅ | - | 어떤 것을 유지하고 싶으신가요? | 1176 |
