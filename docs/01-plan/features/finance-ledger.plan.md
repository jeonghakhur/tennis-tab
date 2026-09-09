# Plan: 협회 재정 관리 (Finance Ledger)

> **구현 상태**: Phase 1 + Phase 2 구현 완료 (2026-09-09) — 설계: `docs/02-design/features/finance-ledger.design.md`. Phase 3 미착수
> **원본 자료**: `2026년월별수지결산서 2.xlsx` (28개 시트) 분석 기반

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | finance-ledger (협회 재정 관리) |
| 작성일 | 2026-09-09 |
| 대상 사용자 | 협회 총무·회장 (시스템 ADMIN 이상) |
| 대체 대상 | 엑셀 수기 결산서 (통장 2개 × 12개월 + 요약 4시트) |
| 예상 규모 | Phase 1: 테이블 4, Server Action ~12, 화면 3 / Phase 2: 화면 2 + 엑셀 입출력 |

| 관점 | 내용 |
|------|------|
| **Problem** | 거래를 월별 시트에 적고, 같은 숫자를 요약 시트·클럽 납부표에 다시 옮겨 적는 3중 입력. 이월잔액을 손으로 연결하고, 클럽 약칭·분류 오타가 섞여 집계 신뢰도가 낮음 |
| **Solution** | 거래 1건만 입력하면 월 요약·연간 결산·클럽별 납부 현황·예산 달성률이 자동 계산되는 원장(ledger) 시스템. 통장을 계정으로 모델링하고 잔액은 항상 계산값 |
| **Function / UX** | 월별 원장(입력·수정), 연간 대시보드, 클럽 납부 매트릭스, 기존 엑셀 1회 가져오기 + 결산 양식 내보내기 |
| **Core Value** | 총무 교체 시에도 이어지는 회계 기록, 언제든 확인 가능한 실시간 잔액·미납 현황, 대의원총회 보고 자료 자동 생성 |

---

## 개요

마포구테니스협회의 자금 흐름을 관리자 페이지에서 기록·집계·보고하는 기능.
현재 엑셀 파일 1개로 관리 중인 **위탁통장(코트 위탁운영)** 과 **협회통장(협회 운영)** 의 거래 원장을 DB로 옮기고,
엑셀에서 수식·수기로 만들던 월별 수지결산, 연간 결산, 클럽별 납부 현황, 운영계획 대비 실적을 자동 산출한다.

---

## 원본 엑셀 분석

### 시트 구성 (28개)

| 그룹 | 시트 | 내용 | 비고 |
|------|------|------|------|
| 위탁통장 원장 | `1월` ~ `12월` | 상단: 분류별 수입/지출 요약 (수식) / 하단: 거래 목록 (일시·적요·분류·입금·출금·비고·잔액) | 1~8월 입력됨, 월 300건 규모 |
| 협회통장 원장 | `협회1월` ~ `협회12월` | 동일 구조. 컬럼 순서가 다름 (구분·적요·출금·입금·잔액·비고) | 1~8월 입력, 148건. 날짜가 Excel 일련번호 |
| 연간 요약 | `월별수지결산` | 통장별 월 수입/지출/순이익/잔액 표 + 분류별 연간 합계 + **2025년 운영계획 대비 실적(달성률)** + 대회별 수지 | 전부 월 시트 참조 수식 |
| 클럽 납부 | `나들목 클럽 납부내역` | 클럽 × 월 매트릭스 2개 (월 임대료 = 동호회 코트비, 발전기금). 시간대 그룹(조기/주중오전/…) | 20개 클럽, 수기 전기 |
| 이사회비 | `이사회비` | 이사 개인별 연회비 10만원 입금 목록 | 이월금 포함, 별도 자금 |
| 협회비 | `협회비` | 35개 클럽 회장·총무 연락처 + 연회비 10만원 입금·날짜 | **이미 `club_fee_payments`로 구현됨** |

### 분류 체계

| 통장 | 수입 분류 | 지출 분류 |
|------|-----------|-----------|
| 위탁통장 | 이월잔액, 동호회코트비(=동호회), 개인 코트비(=개인, 토스 정산), 이자 | 인건비, 시설운영비, 수도광열비, 물품구입비, 기타운영비, 위탁료 |
| 협회통장 | 이월잔액, 발전기금, 레슨코트비, 협회비, 찬조, 참가비, 이자, 대회별 수입 | 식비, 기타, 체육회비, 대회별 지출(협회장기·구청장기·서울시장기·체육회장배·시니어) |

### 발견된 데이터 품질 문제 → 설계에 반영

1. **3중 입력**: 거래 → 월 요약(수식) → 클럽 납부표(수기). 클럽 납부표는 거래와 어긋날 수 있음 (예: 5월 한사랑 0, 6월 400,000 = 두 달치 합산 수기 반영)
2. **이월잔액 수동 연결**: 매월 첫 행에 전월 잔액을 손으로 입력. 잔액은 저장하지 않고 **항상 계산**해야 함
3. **분류 오타**: `동회회`, 공백, 헤더 문자열 `분류`가 데이터로 섞여 있음 → 분류는 **FK로 강제**
4. **클럽 약칭 불일치**: 비고의 `테마인`/`에이클`/`마테동`은 DB 클럽명 `테니스마인드`/`A클래스`/`마테동`과 다름. `협회비` 시트의 `마포구청`은 코트비 시트의 `마테동`과 같은 클럽 → **가져오기 시 별칭 매핑 단계 필요**
5. **적요만으로 클럽 식별**: `김현희`(목우회), `이수현`(일레븐)처럼 입금자명이 적요에 오고 클럽은 비고에 적힘 → 거래에 `club_id` 명시 컬럼 필요
6. **협회통장 날짜 형식**: Excel 일련번호(46023 = 2026-01-01, 46032 = 2026-01-10) + `6월27일` 한글 표기 혼재 → 가져오기 변환 필요
7. **운영계획(예산) 시트는 2025년 기준**으로 2026년 실적과 비교 중 → 연도별 예산 테이블 필요

---

## 문제 정의

1. **입력 중복과 불일치**: 같은 거래를 세 곳에 옮겨 적어 합계가 어긋나도 알 수 없음
2. **잔액 신뢰성**: 이월잔액 수동 연결, 행 삽입/삭제 시 잔액 수식 깨짐
3. **공유·인수인계**: 엑셀 파일이 총무 개인 PC에 있어 회장·감사가 실시간으로 볼 수 없고, 임원 교체 시 유실 위험
4. **미납 파악 지연**: 어느 클럽이 몇 월 코트비·발전기금을 안 냈는지 수기 표를 봐야 알 수 있음
5. **보고 자료 재작성**: 대의원총회·감사용 결산서를 매번 엑셀 서식으로 다시 정리
6. **기존 시스템과 단절**: 클럽 연회비(`club_fee_payments`)·토스 개인 코트비 결제 데이터가 이미 시스템에 있는데 재정에는 수기로 옮김

---

## 기능 범위

### Phase 1 — 원장 핵심 (Must Have)

#### 계정·분류 관리
- [x] `finance_accounts`: 통장(계정) 등록 — 위탁통장, 협회통장, 이사회비 (기초잔액·기초일 포함)
- [x] `finance_categories`: 계정별 수입/지출 분류 관리 (정렬순서, 비활성화). 엑셀 분류 체계로 시드
- [x] 분류 추가·이름변경·비활성화 (삭제 대신 비활성화 — 과거 거래 보존)

#### 거래 원장
- [x] `finance_transactions`: 거래 CRUD — 일시, 적요, 분류, 입금/출금 금액, 비고, 클럽(선택), 계정
- [x] 월별 원장 화면 `/admin/finance/[accountId]?year=2026&month=8`
  - 거래 테이블: 일시·적요·분류·클럽·입금·출금·**누적 잔액(계산)**·비고
  - 상단 요약 카드: 이월잔액 · 분류별 수입/지출 소계 · 당월 순이익 · 월말 잔액 (엑셀 상단 표와 동일 구성)
  - 인라인 추가 폼 + 행 수정/삭제 (ConfirmDialog)
  - 월 이동 (이전/다음), 통장 탭 전환
- [x] 잔액은 저장하지 않음: `기초잔액 + Σ(해당 시점까지 입금 − 출금)`으로 서버에서 계산
- [x] 클럽 연결: 동호회 코트비·발전기금·협회비 거래는 클럽 선택(초성 검색 콤보박스) → 납부 매트릭스 자동 집계의 기반
- [x] 입력 검증: 금액 양의 정수(원 단위), 입금·출금 중 하나만, 적요 필수, 분류 FK (3-Layer Validation 패턴 적용)

#### 엑셀 1회 가져오기 (초기 데이터 이관)
- [x] `/admin/finance/import`: 기존 결산서 업로드 → 시트별 파싱 미리보기 → 확인 후 일괄 insert
- [x] 분류 매핑 단계: 엑셀 분류 문자열 → `finance_categories` (오타 `동회회` 등을 UI에서 수동 매핑)
- [x] 클럽 별칭 매핑 단계: 비고의 약칭 → `clubs` (매핑 결과를 `finance_club_aliases`에 저장해 재사용)
- [x] 협회통장 시트의 Excel 일련번호 날짜 변환, 컬럼 순서 차이 흡수
- [x] 중복 방지: 같은 (계정, 일시, 적요, 금액) 재가져오기 시 건너뜀

#### 권한
- [x] 시스템 **ADMIN 이상만** 접근 (`/admin/finance` 미들웨어 + Server Action 검증 + RLS)
- [x] 어드민 사이드바에 "재정 관리" 메뉴 추가

### Phase 2 — 집계·보고 (Should Have)

- [x] **연간 대시보드** `/admin/finance?year=2026`: 통장별 월 수입/지출/순이익/잔액 표 + 분류별 연간 합계 (엑셀 `월별수지결산` 대체)
- [x] **클럽 납부 매트릭스** `/admin/finance/clubs`: 클럽 × 월, 항목 탭(코트비 / 발전기금). 거래의 `club_id`+분류로 자동 집계, 미납 셀 강조, 클럽별 연 합계. 시간대 그룹은 `clubs`에 `court_slot`(조기/주중오전/…) 컬럼 추가해 그룹핑
- [x] **운영계획(예산) 대비 실적**: `finance_budgets`(연도·항목·계획금액) 입력 → 실적·달성률 자동 계산
- [x] **엑셀 내보내기**: 기존 결산서와 같은 양식으로 월별 시트 + 연간 요약 생성 (대의원총회·감사 제출용, `xlsx` 라이브러리 재사용)
- [x] **클럽 연회비 연동**: `club_fee_payments` 납부 처리 시 협회통장에 `협회비` 거래 자동 생성 (역방향은 안 함)
- [ ] 대회별 수지: 거래에 `tournament_id` 선택 연결 → 대회별 수입/지출 소계 (컬럼만 준비, 입력 UI·집계는 미구현)

### Phase 3 — 자동화 (Could Have)

- [ ] 토스페이먼츠 개인 코트비 정산 내역 자동 취합 (위탁통장 `개인` 수입)
- [ ] 미납 클럽 카카오 알림톡 안내 (기존 Solapi 모듈 재사용)
- [ ] 이사회비: 이사 명단(`profiles`/직책)과 연결해 개인별 납부 체크
- [ ] 감사용 읽기 전용 공유 링크 또는 `AUDITOR` 열람 권한

### Won't Have

- 은행 API 연동(오픈뱅킹) — 거래 자동 수집은 범위 밖
- 복식부기(차변/대변) — 단식 현금출납부 수준으로 충분
- 영수증 이미지 첨부 — 커뮤니티 첨부 인프라 재사용 가능하나 Phase 3 이후 검토

---

## 데이터 모델

```sql
-- 통장(계정)
finance_accounts (
  id UUID PK,
  name TEXT NOT NULL,                 -- 위탁통장, 협회통장, 이사회비
  account_type TEXT NOT NULL,         -- CONSIGNMENT | ASSOCIATION | BOARD
  opening_balance BIGINT NOT NULL DEFAULT 0,  -- 기초잔액 (원)
  opening_date DATE NOT NULL,         -- 기초잔액 기준일 (이 날 이전 거래 없음)
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
)

-- 수입/지출 분류 (계정별)
finance_categories (
  id UUID PK,
  account_id UUID FK → finance_accounts,
  kind TEXT NOT NULL CHECK (kind IN ('INCOME','EXPENSE')),
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE (account_id, kind, name)
)

-- 거래 원장
finance_transactions (
  id UUID PK,
  account_id UUID FK → finance_accounts,
  category_id UUID FK → finance_categories,
  occurred_at TIMESTAMPTZ NOT NULL,   -- 거래 일시
  description TEXT NOT NULL,          -- 적요 (입금자명·내용)
  amount BIGINT NOT NULL CHECK (amount > 0),  -- 원 단위, 방향은 category.kind로 결정
  memo TEXT,                          -- 비고
  club_id UUID FK → clubs NULL,       -- 동호회 코트비·발전기금·협회비 등
  tournament_id UUID FK → tournaments NULL,  -- Phase 2 대회별 수지
  source TEXT NOT NULL DEFAULT 'MANUAL',      -- MANUAL | IMPORT | CLUB_FEE | TOSS
  import_key TEXT,                    -- 가져오기 중복 방지 해시 (UNIQUE, NULL 허용)
  created_by UUID FK → profiles,
  created_at, updated_at
)
INDEX (account_id, occurred_at), INDEX (club_id), INDEX (category_id)

-- 클럽 약칭 매핑 (엑셀 가져오기·적요 자동 인식용)
finance_club_aliases (
  alias TEXT PK,                      -- 테마인, 에이클, 마포구청 …
  club_id UUID FK → clubs
)

-- 연간 운영계획(예산) — Phase 2
finance_budgets (
  id UUID PK,
  year SMALLINT NOT NULL,
  account_id UUID FK,
  label TEXT NOT NULL,                -- 총수입, 인건비, 위탁사용료 …
  category_ids UUID[],                -- 실적 집계에 포함할 분류 (복수)
  planned_amount BIGINT NOT NULL,
  memo TEXT,
  UNIQUE (year, account_id, label)
)
```

**설계 원칙**
- **잔액은 저장하지 않는다.** 월말 잔액·이월잔액·누적 잔액 모두 `opening_balance + Σ(수입) − Σ(지출)`로 계산. 엑셀의 이월잔액 수동 연결 오류를 구조적으로 제거
- **금액은 부호 없는 정수 + 분류의 kind로 방향 결정.** 입금/출금 두 컬럼 대신 단일 `amount` — 합계 쿼리가 단순해지고 "둘 다 입력" 오류가 사라짐
- **분류·클럽은 FK.** 자유 텍스트였던 분류/비고를 참조 무결성으로 강제
- **삭제는 hard delete + `created_by` 기록.** 회계 감사 요구가 생기면 Phase 3에서 soft delete/이력 테이블로 확장

---

## 화면 구성

| 경로 | 화면 | Phase |
|------|------|-------|
| `/admin/finance` | 연간 대시보드 (통장별 월 표, 분류 합계, 예산 달성률) | 2 (Phase 1에서는 계정 목록 + 현재 잔액만) |
| `/admin/finance/[accountId]` | 월별 원장 (요약 카드 + 거래 테이블 + 입력) | 1 |
| `/admin/finance/clubs` | 클럽 납부 매트릭스 (코트비 / 발전기금 탭) | 2 |
| `/admin/finance/import` | 엑셀 가져오기 (파싱 미리보기 → 매핑 → 확정) | 1 |
| `/admin/finance/settings` | 계정·분류·클럽 별칭 관리 | 1 |

**월별 원장 UX 메모**
- 엑셀 사용자에게 익숙하도록 상단 요약표는 엑셀 상단 표와 같은 순서(수입 분류 → 지출 분류 → 합계)
- 거래 추가는 테이블 맨 아래 인라인 폼, Enter로 연속 입력 (총무가 통장 내역을 보며 빠르게 타이핑하는 흐름)
- 적요에 클럽 별칭이 포함되면 `finance_club_aliases`로 클럽 자동 제안
- 금액 표시는 `toLocaleString('ko-KR')`, 출금은 붉은색, 잔액은 굵게
- 모바일: 테이블은 `overflow-x-auto`, 요약 카드는 2열 그리드

---

## 기술 설계 포인트

- **Server Actions**: `src/lib/finance/actions.ts` — `getLedger(accountId, year, month)`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `getAnnualSummary(year)`, `getClubPaymentMatrix(year, categoryKind)`, `importExcel(rows)` 등. 모두 `hasMinimumRole(role, 'ADMIN')` 검증
- **왕복 최소화** (DB 원격 리전): 월별 원장은 1 RPC로 요약+거래+이월잔액을 한 번에 반환하는 Postgres 함수 `finance_month_ledger(account_id, year, month)` 검토. 연간 요약도 `GROUP BY month, category` 단일 쿼리
- **KST 기준 월 경계**: `occurred_at`은 TIMESTAMPTZ, 월 필터는 KST로 변환 (`getCurrentKSTYear` 패턴 확장)
- **엑셀 파싱**: 서버 Route Handler에서 `xlsx`로 파싱 (기존 export 라우트와 동일 라이브러리). 시트명 규칙(`N월`, `협회N월`)으로 계정 자동 판별
- **검증**: `validateTransactionInput` + `sanitizeObject` (3-Layer Validation), DEV 더미 데이터 생성기 추가
- **UI 재사용**: `Modal`, `ConfirmDialog`, `Toast`, `Badge`, `Switch`, 클럽 콤보박스(`AssociationCombobox` 패턴), 초성 검색

---

## 마이그레이션 계획 (기존 엑셀 → DB)

1. 계정 3개 생성: 위탁통장(기초잔액 7,091,243 / 2026-01-01), 협회통장(13,505,114 / 2026-01-01), 이사회비(1,586,393)
2. 분류 시드: 위탁 4수입·6지출, 협회 8수입·9지출 (위 분류 체계)
3. 클럽 별칭 시드: 테마인→테니스마인드, 에이클→A클래스, 마포구청→마테동, 나머지는 동일명 매핑
4. `/admin/finance/import`로 1~8월 위탁·협회 거래 가져오기 (약 450건)
5. 가져온 뒤 검증: 각 월말 잔액이 엑셀 `월별수지결산`의 잔액 컬럼과 일치하는지 자동 비교 리포트 출력 (불일치 시 어느 달부터 어긋나는지 표시)
6. 클럽 납부 매트릭스가 엑셀 `나들목 클럽 납부내역`과 같은지 대조 → 수기 오류 발견 시 거래 수정

---

## 결정이 필요한 사항

| # | 질문 | 제안 |
|---|------|------|
| 1 | 이사회비를 별도 통장(계정)으로 둘지, 협회통장의 분류로 둘지 | 엑셀처럼 **별도 계정**. 이월금이 따로 관리되고 이사 개인 단위라 성격이 다름 |
| 2 | 거래 삭제를 허용할지 (감사 관점) | Phase 1은 ADMIN 삭제 허용 + `created_by` 기록. 감사 요구 시 Phase 3에서 이력 테이블 |
| 3 | 개인 코트비(토스 정산)를 건별로 넣을지, 정산일 합계로 넣을지 | 엑셀과 동일하게 **정산일 합계 1건** (`tosspaymen` 행). 건별은 결제 테이블에 이미 있음 |
| 4 | 회계연도 시작 | 1월 1일 (KST). 연회비와 동일 |
| 5 | 클럽 시간대 그룹(조기/주중오전…)을 어디에 저장할지 | `clubs.court_slot` 컬럼. 코트 배정 정보라 클럽 속성이 맞음 |
| 6 | 2025년 데이터도 이관할지 | 2026년만 우선. 필요 시 같은 가져오기 도구로 추가 |

---

## 일정 (제안)

| 단계 | 내용 | 산출물 |
|------|------|--------|
| Design | 데이터 모델 확정, 화면 와이어(원장·가져오기), Server Action 시그니처 | `finance-ledger.design.md` |
| Phase 1 | 마이그레이션 + 계정/분류/거래 CRUD + 월별 원장 + 가져오기 + 사이드바 | 총무가 9월부터 시스템에 직접 입력 가능 |
| 검증 | 1~8월 엑셀 가져오기 후 월말 잔액 대조 | 불일치 0건 |
| Phase 2 | 연간 대시보드, 클럽 매트릭스, 예산, 엑셀 내보내기, 연회비 연동 | 연말 결산·총회 보고 자동화 |
