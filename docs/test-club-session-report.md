# Club Session E2E 테스트 보고서

- **실행 일시**: 2026-02-28 03:38:28
- **결과**: 36 PASS / 0 FAIL (총 36건)
- **테스트 계정**: e2e.admin@mapo-tennis-test.dev
- **클럽 ID**: 3084ca9f-c86c-4365-917a-b25cd36e2291

## 상세 결과

| # | 테스트 | 결과 | 상세 |
|---|--------|------|------|
| 1 | A1-로그인 | ✅ PASS | access_token 획득 (user_id: e472e215-dfa2-4215-a996-4cb29b66e073) |
| 2 | A2-멤버준비 | ✅ PASS | OWNER: E2E 테스터, M2: E2E_멤버2_1772249899039, M3: E2E_멤버3_1772249899039 |
| 3 | B1-세션생성 | ✅ PASS | session_id: 9c067356-f51e-4a2e-ae7f-3d7479ec1484, title: E2E 테스트 모임 1772249899401 |
| 4 | C1-목록조회 | ✅ PASS | 1건 중 생성한 세션 발견 |
| 5 | C2-상세조회 | ✅ PASS | title: E2E 테스트 모임 1772249899401, venue: 마포 테니스장 |
| 6 | D1-세션수정 | ✅ PASS | 제목 변경: E2E 수정된 모임 1772249899947 |
| 7 | D2-수정확인 | ✅ PASS | title: E2E 수정된 모임 1772249899947, notes: E2E 테스트 메모 |
| 8 | E1-OWNER참석 | ✅ PASS | ATTENDING 응답 등록 |
| 9 | E2-멤버2참석 | ✅ PASS | ATTENDING 응답 등록 |
| 10 | E3-멤버3불참 | ✅ PASS | NOT_ATTENDING 응답 등록 |
| 11 | E4-응답현황 | ✅ PASS | 참석 2명, 불참 1명 |
| 12 | F1-참석→불참 | ✅ PASS | OWNER NOT_ATTENDING 변경 |
| 13 | F2-불참→참석 | ✅ PASS | OWNER ATTENDING 복원 |
| 14 | F3-응답마감 | ✅ PASS | OPEN → CLOSED 전환 |
| 15 | F4-마감확인 | ✅ PASS | 세션 상태 CLOSED 확인 |
| 16 | G1-라운드로빈 | ✅ PASS | 1건 대진 생성 (2명) |
| 17 | G2-경기목록 | ✅ PASS | 1건 조회, 상태: SCHEDULED |
| 18 | H1-P1결과보고 | ✅ PASS | player1: 6-4 보고 |
| 19 | H2-P2결과보고(일치) | ✅ PASS | player2: 4-6 보고 → COMPLETED |
| 20 | H3-결과확인 | ✅ PASS | status: COMPLETED, score: 6-4 |
| 21 | H4-분쟁경기생성 | ✅ PASS | match_id: 096707fb-028f-4c20-a625-b657d72a607e |
| 22 | H5-불일치→DISPUTED | ✅ PASS | P1: 6-4 vs P2: 6-3 → DISPUTED |
| 23 | H6-분쟁상태확인 | ✅ PASS | status: DISPUTED |
| 24 | H7-분쟁해결 | ✅ PASS | 관리자 결정: 6-4 (승자: OWNER) |
| 25 | I1-순위조회 | ✅ PASS | 2명 순위 데이터 (1위: E2E 테스터, 승률 100%) |
| 26 | I2-OWNER통계 | ✅ PASS | 경기 2, 승 2, 패 0, 승률 100% |
| 27 | I3-멤버2통계 | ✅ PASS | 경기 2, 승 0, 패 2, 승률 0% |
| 28 | J1-완료전상태 | ✅ PASS | CLOSED 상태 확인 |
| 29 | J2-완료처리 | ✅ PASS | CLOSED → COMPLETED 전환 |
| 30 | J3-완료확인 | ✅ PASS | status: COMPLETED |
| 31 | K1-취소용세션생성 | ✅ PASS | session_id: 909c9d79-8537-45e7-83d1-82f18e5cb44a |
| 32 | K2-세션취소 | ✅ PASS | OPEN → CANCELLED |
| 33 | K3-취소확인 | ✅ PASS | status: CANCELLED |
| 34 | L1-삭제용경기생성 | ✅ PASS | match_id: b55d355e-debb-40f5-81c8-59f698164b93 |
| 35 | L2-경기삭제 | ✅ PASS | SCHEDULED 경기 삭제 성공 |
| 36 | L3-삭제확인 | ✅ PASS | 경기 데이터 제거 확인 |

## 테스트 시나리오

1. **[A] 로그인 + 멤버 준비**: 테스트 계정 로그인, OWNER + 비가입 멤버 2명 생성
2. **[B] 세션 생성**: 내일 날짜로 세션 생성 (코트 2개, 정원 10명)
3. **[C] 세션 조회**: 목록 + 상세 조회
4. **[D] 세션 수정**: 제목, 메모 변경
5. **[E] 참석 응답**: OWNER 참석, 멤버2 참석, 멤버3 불참
6. **[F] 응답 수정/마감**: 참석↔불참 전환, RSVP 마감 (CLOSED)
7. **[G] 대진 생성**: 라운드로빈 자동 생성
8. **[H] 결과 보고**: 양측 일치 → COMPLETED, 불일치 → DISPUTED
9. **[H-2] 분쟁 해결**: 관리자가 최종 점수 결정
10. **[I] 통계 확인**: 순위, 승률, 경기수
11. **[J] 세션 완료**: CLOSED → COMPLETED (sessions_attended 갱신)
12. **[K] 세션 취소**: 새 세션 → CANCELLED
13. **[L] 경기 삭제**: SCHEDULED 경기 삭제
