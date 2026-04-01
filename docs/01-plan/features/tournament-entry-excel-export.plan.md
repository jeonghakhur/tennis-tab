## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 대회 참가 신청 데이터를 시스템에서 직접 확인해야 하며, 외부 공유·정산·인쇄 등 후속 작업이 어렵다 |
| **Solution** | 관리자가 버튼 한 번으로 참가신청 전체 데이터를 xlsx 파일로 다운로드 |
| **Function UX Effect** | 어드민 엔트리 목록 상단 "엑셀 다운로드" 버튼 → 즉시 파일 저장 |
| **Core Value** | 대회 운영 효율화 — 참가자 연락처/상태 일괄 정리, 외부 공유 가능 |

---

# Plan: 대회 참가신청 엑셀 내보내기 (tournament-entry-excel-export)

## 개요

대회 어드민 페이지에서 해당 대회의 모든 참가 신청 내역을 xlsx 파일로 다운로드하는 기능.
운영자가 참가자 명단을 외부 공유하거나 정산, 인쇄 용도로 활용할 수 있다.

## 배경 및 목적

- 대회 참가자 연락처, 상태, 결제 내역 등을 외부 공유하거나 정산에 활용해야 하는 운영 니즈
- 시스템에서 직접 다운로드하면 별도 데이터 추출 없이 즉시 업무 활용 가능
- 복식/단체전 파트너·팀원 정보도 포함하여 부문별 통합 관리 지원

## 범위 (Scope)

### In-Scope
- API route (`GET /api/admin/tournaments/[id]/entries/export`) → xlsx blob 반환
- 인증·권한 검사 (MANAGER 이상 + 대회 소유자 확인)
- 부문별 컬럼 분기: 개인전 / 복식(파트너 정보) / 단체전(팀원 목록)
- 참가자 전화번호 복호화 (`decryptProfile`)
- 파일명: `{대회명}_참가신청내역_{YYYYMMDD}.xlsx`

### Out-of-Scope
- CSV 내보내기 (xlsx만 지원)
- 필터링된 목록만 다운로드 (항상 전체 다운로드)
- 이메일 발송

## 구현 명세

### API Route
```
GET /api/admin/tournaments/[id]/entries/export
```

**인증·권한:**
1. 로그인 여부 확인
2. 프로필 role 조회 → `canManageTournaments(role)` 체크
3. MANAGER는 자신이 만든 대회만 (`tournament.organizer_id === user.id`)
4. ADMIN/SUPER_ADMIN은 모든 대회 접근 가능

**쿼리:**
```sql
SELECT
  tournament_entries.*,
  profiles.name, profiles.email, profiles.phone, profiles.club,
  tournament_divisions.name AS division_name
FROM tournament_entries
LEFT JOIN profiles ON profiles.id = tournament_entries.user_id
LEFT JOIN tournament_divisions ON tournament_divisions.id = tournament_entries.division_id
WHERE tournament_entries.tournament_id = :id
ORDER BY created_at ASC, id ASC
```

**엑셀 컬럼 구성:**

| 컬럼 | 소스 | 비고 |
|------|------|------|
| 순번 | index + 1 | |
| 신청일 | `created_at` | YYYY-MM-DD |
| 부문 | `tournament_divisions.name` | |
| 신청자명 | `player_name` → `profiles.name` | fallback |
| 이메일 | `profiles.email` | |
| 전화번호 | `phone` → `profiles.phone` (복호화) | fallback |
| 클럽 | `club_name` → `profiles.club` | fallback |
| 파트너 | `partner_data.name` | 복식만 |
| 파트너 클럽 | `partner_data.club` | 복식만 |
| 팀원1~N | `team_members[i].name` | 단체전만 |
| 참가상태 | `status` → 한글 | |
| 결제상태 | `payment_status` → 한글 | |
| 입금자명 | `refund_holder` | 값 있을 때만 |

**응답 헤더:**
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename*=UTF-8''{encoded-filename}
```

### 클라이언트 (EntriesManager)
이미 구현 완료:
- `handleExcelDownload()`: fetch → blob → anchor click으로 파일 저장
- "엑셀 다운로드" 버튼 (Download 아이콘, `excelDownloading` 상태로 비활성화)
- `Content-Disposition` 파싱 → `filename*=UTF-8''` 패턴 추출

## 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| xlsx 라이브러리 | SheetJS (`xlsx@0.18.5`) | 이미 설치됨 |
| API | Next.js Route Handler (GET) | 파일 스트리밍에 적합 |
| 전화번호 복호화 | `decryptProfile` | 기존 패턴 재사용 |

## 구현 순서

1. ✅ `src/app/api/admin/tournaments/[id]/entries/export/route.ts` 생성
2. ✅ 인증·권한 검사
3. ✅ 대회 정보 + 참가신청 데이터 쿼리
4. ✅ 부문 타입에 따른 컬럼 분기 (개인전/복식/단체전)
5. ✅ XLSX 워크북 생성 → Buffer 반환
6. ✅ 파일명 생성 + Content-Disposition 헤더

> **현황**: 구현 완료. `/pdca analyze tournament-entry-excel-export`로 검증 진행 권장.

## 상태 매핑

```ts
const ENTRY_STATUS_LABELS = {
  PENDING: '승인 대기',
  CONFIRMED: '승인됨',
  APPROVED: '승인됨',
  WAITLISTED: '대기자',
  REJECTED: '거절됨',
  CANCELLED: '취소됨',
}

const PAYMENT_STATUS_LABELS = {
  PENDING: '미결제',
  COMPLETED: '결제완료',
  FAILED: '실패',
  CANCELLED: '취소',
}
```
