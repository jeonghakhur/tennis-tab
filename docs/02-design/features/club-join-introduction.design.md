# Design: 클럽 가입 신청 시 자기소개 기능

> Plan: `docs/01-plan/features/club-join-introduction.plan.md`

---

## 1. DB 마이그레이션

### 파일: `supabase/migrations/XX_add_club_member_introduction.sql`

```sql
-- 클럽 가입 신청 자기소개 컬럼 추가
ALTER TABLE club_members ADD COLUMN introduction TEXT;

-- 500자 제한
ALTER TABLE club_members ADD CONSTRAINT club_members_introduction_length
  CHECK (introduction IS NULL OR char_length(introduction) <= 500);
```

- nullable: OPEN 가입, 관리자 초대, 비가입 회원 등 자기소개 없는 케이스
- 기존 row에 영향 없음 (NULL 기본값)

---

## 2. 타입 변경

### 파일: `src/lib/clubs/types.ts`

`ClubMember` 인터페이스에 필드 추가:

```typescript
export interface ClubMember {
  // ... 기존 필드
  status_reason: string | null
  introduction: string | null    // ← 추가
  invited_by: string | null
  // ...
}
```

위치: `status_reason` 바로 아래 (`joined_at` 위).

---

## 3. Server Action 변경

### 파일: `src/lib/clubs/actions.ts`

#### 3.1 `joinClubAsRegistered` 시그니처 변경

**현재** (L460):
```typescript
export async function joinClubAsRegistered(clubId: string): Promise<{ error?: string }>
```

**변경**:
```typescript
export async function joinClubAsRegistered(
  clubId: string,
  introduction?: string
): Promise<{ error?: string }>
```

#### 3.2 introduction 처리 로직 추가

INSERT 직전에 검증 + 살균:

```typescript
// introduction 검증 (500자 제한)
let sanitizedIntro: string | null = null
if (introduction && introduction.trim()) {
  sanitizedIntro = sanitizeInput(introduction.trim())
  if (sanitizedIntro.length > 500) {
    return { error: '자기소개는 500자 이내로 작성해주세요.' }
  }
}
```

#### 3.3 INSERT에 introduction 포함

**현재** (L487-498):
```typescript
const { error } = await admin.from('club_members').insert({
  club_id: clubId,
  user_id: user.id,
  // ...
  status,
})
```

**변경**:
```typescript
const { error } = await admin.from('club_members').insert({
  club_id: clubId,
  user_id: user.id,
  // ...
  status,
  introduction: sanitizedIntro,
})
```

#### 3.4 import 추가

`sanitizeInput`이 이미 import되어 있는지 확인. 없으면 추가:
```typescript
import { sanitizeInput } from '@/lib/utils/validation'
```

---

## 4. UI: 가입 신청 모달

### 파일: `src/app/clubs/[id]/page.tsx`

#### 4.1 상태 추가

```typescript
const [joinModalOpen, setJoinModalOpen] = useState(false)
const [introduction, setIntroduction] = useState('')
```

#### 4.2 handleJoin 분기 변경

**현재** (L104-125):
```typescript
const handleJoin = async () => {
  if (!user) { router.push('/auth/login'); return }
  setActionLoading(true)
  const result = await joinClubAsRegistered(id)
  // ...
}
```

**변경**:
```typescript
const handleJoin = () => {
  if (!user) { router.push('/auth/login'); return }

  // APPROVAL 클럽: 모달 열기 / OPEN 클럽: 즉시 가입
  if (club?.join_type === 'APPROVAL') {
    setJoinModalOpen(true)
  } else {
    submitJoin()
  }
}

const submitJoin = async (intro?: string) => {
  setJoinModalOpen(false)
  setActionLoading(true)
  const result = await joinClubAsRegistered(id, intro || undefined)
  setActionLoading(false)

  if (result.error) {
    setAlert({ isOpen: true, message: result.error, type: 'error' })
    return
  }

  const message = club?.join_type === 'OPEN'
    ? '클럽에 가입되었습니다!'
    : '가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.'
  setToast({ isOpen: true, message, type: 'success' })
  setIntroduction('')
  loadClubData()
  checkMembership()
}
```

#### 4.3 모달 JSX

기존 `Modal` 컴포넌트를 사용하여 `ConfirmDialog` 아래에 추가:

```tsx
{/* 가입 신청 모달 (APPROVAL 클럽) */}
<Modal
  isOpen={joinModalOpen}
  onClose={() => setJoinModalOpen(false)}
  title="클럽 가입 신청"
  description={`${club.name}에 가입 신청합니다.`}
  size="md"
>
  <Modal.Body>
    <div>
      <label
        htmlFor="join-introduction"
        className="block text-sm font-medium mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        자기소개 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
      </label>
      <textarea
        id="join-introduction"
        value={introduction}
        onChange={(e) => setIntroduction(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder="테니스 경력, 활동 가능 시간 등을 간단히 소개해주세요."
        className="w-full px-3 py-2.5 rounded-lg text-sm resize-none"
        style={{
          backgroundColor: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
        }}
      />
      <p
        className="text-xs mt-1 text-right"
        style={{ color: 'var(--text-muted)' }}
      >
        {introduction.length} / 500
      </p>
    </div>
  </Modal.Body>
  <Modal.Footer>
    <button
      onClick={() => setJoinModalOpen(false)}
      className="flex-1 px-4 py-2 rounded-lg text-sm"
      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
    >
      취소
    </button>
    <button
      onClick={() => submitJoin(introduction)}
      className="flex-1 btn-primary btn-sm"
    >
      가입 신청
    </button>
  </Modal.Footer>
</Modal>
```

#### 4.4 import 추가

```typescript
import { Modal } from '@/components/common/Modal'  // 이미 없다면 추가
```

---

## 5. UI: 관리자 승인 대기 목록

### 파일: `src/components/clubs/ClubMemberList.tsx`

#### 5.1 PENDING 섹션에 자기소개 표시

**현재** (L239-260):
```tsx
{pendingMembers.map((m) => (
  <div key={m.id} className="flex items-center justify-between py-2 border-b ...">
    <div>
      <p className="text-sm font-medium ...">{m.name}</p>
      <p className="text-xs ...">{m.phone}</p>
    </div>
    <div className="flex gap-2">
      {/* 승인/거절 버튼 */}
    </div>
  </div>
))}
```

**변경**:
```tsx
{pendingMembers.map((m) => (
  <div key={m.id} className="py-3 border-b border-(--border-color) last:border-0">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-(--text-primary)">{m.name}</p>
        <p className="text-xs text-(--text-muted)">{m.phone}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleJoinResponse(m, true)}
          className="px-3 py-1 rounded text-xs font-medium bg-(--accent-color) text-(--bg-primary)"
        >
          승인
        </button>
        <button
          onClick={() => handleJoinResponse(m, false)}
          className="px-3 py-1 rounded text-xs font-medium text-red-500 border border-red-500/30 hover:bg-red-500/10"
        >
          거절
        </button>
      </div>
    </div>
    {/* 자기소개 */}
    {m.introduction && (
      <p
        className="mt-2 text-xs whitespace-pre-wrap rounded-lg px-3 py-2"
        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
      >
        {m.introduction}
      </p>
    )}
  </div>
))}
```

변경 포인트:
- 기존 `flex items-center justify-between` 구조를 유지하되, 전체를 `div`로 한 번 더 감쌈
- `m.introduction`이 있을 때만 하단에 소개글 표시
- 소개글 배경: `var(--bg-card-hover)`, 색상: `var(--text-secondary)`
- `whitespace-pre-wrap`으로 줄바꿈 보존

---

## 6. 수정 파일 목록 (구현 순서)

| 순서 | 파일 | 변경 유형 | 내용 |
|------|------|----------|------|
| 1 | `supabase/migrations/XX_add_club_member_introduction.sql` | 신규 | introduction 컬럼 + CHECK 제약 |
| 2 | `src/lib/clubs/types.ts` | 수정 | ClubMember에 `introduction` 필드 추가 |
| 3 | `src/lib/clubs/actions.ts` | 수정 | joinClubAsRegistered 파라미터 + 검증 + INSERT |
| 4 | `src/app/clubs/[id]/page.tsx` | 수정 | 가입 신청 모달 (Modal + textarea) |
| 5 | `src/components/clubs/ClubMemberList.tsx` | 수정 | PENDING 섹션에 자기소개 표시 |

---

## 7. 검증 체크리스트

- [ ] 마이그레이션 적용 후 `club_members.introduction` 컬럼 존재 확인
- [ ] APPROVAL 클럽 "가입 신청" 클릭 → 모달 표시
- [ ] 모달에서 자기소개 입력 후 "가입 신청" → DB 저장 확인
- [ ] 자기소개 비워두고 "가입 신청" → 정상 동작 (NULL 저장)
- [ ] 500자 초과 입력 → maxLength로 제한 + 서버 검증
- [ ] OPEN 클럽 "가입하기" → 기존과 동일 (모달 없음, 즉시 가입)
- [ ] 관리자 ClubMemberList 승인 대기 → 자기소개 표시됨
- [ ] 자기소개 없는 PENDING → 소개 영역 안 보임
- [ ] XSS 입력 → sanitizeInput으로 제거
- [ ] `tsc --noEmit` 통과
- [ ] `next build` 통과
