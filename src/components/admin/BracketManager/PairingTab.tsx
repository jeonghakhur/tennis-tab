"use client";

import { useState, useEffect, useCallback, useMemo, useId } from "react";
import { Link2, Link2Off, Shuffle, Lock, RotateCcw } from "lucide-react";
import { ConfirmDialog, Toast } from "@/components/common/AlertDialog";
import { LoadingOverlay } from "@/components/common/LoadingOverlay";
import { Badge } from "@/components/common/Badge";
import {
  getSoloPairingState,
  pairSoloEntries,
  autoPairSoloEntries,
  unpairSoloEntries,
  type SoloPairingState,
} from "@/lib/bracket/actions";
import {
  summarizePairing,
  formatPairingEntryLabel,
  PAIRING_STRATEGY_LABELS,
  type PairingStrategy,
  type SoloPairingEntry,
} from "@/lib/bracket/pairing";

interface PairingTabProps {
  divisionId: string;
  /** 마감 대회 등 상위에서 읽기 전용 강제 */
  readOnly?: boolean;
  onError: (message: string) => void;
  /** 페어 변경 후 상위(조편성 등) 데이터 재조회 */
  onChanged?: () => Promise<void> | void;
}

/** 수동 편성 시 선택 가능한 최대 인원 */
const MANUAL_SELECT_LIMIT = 2;

type ConfirmAction =
  | { kind: "auto"; strategy: PairingStrategy }
  | { kind: "unpair"; captainId: string; label: string }
  | { kind: "unpairAll" };

export function PairingTab({ divisionId, readOnly, onError, onChanged }: PairingTabProps) {
  const [state, setState] = useState<SoloPairingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<PairingStrategy>("RANDOM");
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [toast, setToast] = useState({ isOpen: false, message: "" });
  const strategySelectId = useId();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await getSoloPairingState(divisionId);
      if (error || !data) {
        onError(error ?? "페어 정보를 불러오지 못했습니다.");
        return;
      }
      setState(data);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  }, [divisionId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(
    () => summarizePairing(state?.entries ?? []),
    [state?.entries],
  );

  const editable = !!state?.editable && !readOnly;
  const lockReason = readOnly ? "마감된 대회는 페어를 변경할 수 없습니다." : state?.lockReason ?? null;

  const showSuccess = (message: string) => setToast({ isOpen: true, message });

  /** 서버 액션 공통 실행: 로딩 오버레이 → 결과 반영 → 재조회 */
  const run = async (message: string, action: () => Promise<{ error: string | null } & Record<string, unknown>>) => {
    setBusyMessage(message);
    try {
      const result = await action();
      if (result.error) {
        onError(result.error);
        return null;
      }
      await load();
      await onChanged?.();
      return result;
    } catch {
      onError("처리 중 오류가 발생했습니다.");
      return null;
    } finally {
      setBusyMessage(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length >= MANUAL_SELECT_LIMIT) return prev;
      return [...prev, id];
    });
  };

  const handleManualPair = async () => {
    if (selectedIds.length !== MANUAL_SELECT_LIMIT) return;
    const [captainId, partnerId] = selectedIds;
    const result = await run("페어 편성 중...", () => pairSoloEntries(divisionId, captainId, partnerId));
    if (result) showSuccess("페어가 편성되었습니다.");
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const action = confirm;
    setConfirm(null);

    if (action.kind === "auto") {
      const result = await run("자동 편성 중...", () => autoPairSoloEntries(divisionId, action.strategy));
      if (result) {
        const leftover = result.leftoverName as string | null | undefined;
        showSuccess(
          leftover
            ? `${result.pairedCount}쌍이 편성되었습니다. ${leftover} 님은 인원이 홀수라 미편성으로 남았습니다.`
            : `${result.pairedCount}쌍이 편성되었습니다.`,
        );
      }
      return;
    }

    if (action.kind === "unpair") {
      const result = await run("페어 해제 중...", () => unpairSoloEntries(divisionId, [action.captainId]));
      if (result) showSuccess("페어가 해제되었습니다.");
      return;
    }

    const result = await run("전체 해제 중...", () => unpairSoloEntries(divisionId, null));
    if (result) showSuccess(`${result.unpairedCount}쌍이 해제되었습니다.`);
  };

  const confirmContent = (() => {
    if (!confirm) return { title: "", message: "" };
    if (confirm.kind === "auto") {
      return {
        title: "자동 페어 편성",
        message: `미편성 ${summary.unpaired.length}명을 "${PAIRING_STRATEGY_LABELS[confirm.strategy].label}" 방식으로 편성합니다.\n기존 페어는 유지됩니다.`,
      };
    }
    if (confirm.kind === "unpair") {
      return { title: "페어 해제", message: `${confirm.label} 페어를 해제하시겠습니까?` };
    }
    return { title: "전체 페어 해제", message: `편성된 ${summary.pairs.length}쌍을 모두 해제하시겠습니까?` };
  })();

  if (loading && !state) {
    return <p className="py-8 text-center text-sm text-(--text-muted)">페어 정보를 불러오는 중...</p>;
  }

  const total = state?.entries.length ?? 0;

  return (
    <div className="space-y-6">
      {busyMessage && <LoadingOverlay message={busyMessage} />}

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-display text-base font-bold text-(--text-primary)">복식 페어 편성</h3>
          <p className="text-sm text-(--text-muted)">
            개인 접수 인원을 2명씩 묶어 복식 팀을 만듭니다. 조편성은 편성된 페어 단위로 생성됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-(--border-color) text-(--text-secondary) hover:bg-(--bg-card-hover) disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          새로고침
        </button>
      </div>

      {/* ── 요약 ── */}
      <dl className="grid grid-cols-3 gap-3">
        {[
          { label: "승인 인원", value: `${total}명` },
          { label: "편성 완료", value: `${summary.pairs.length}쌍` },
          { label: "미편성", value: `${summary.unpaired.length}명` },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl p-4"
            style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
          >
            <dt className="text-sm text-(--text-muted)">{item.label}</dt>
            <dd className="mt-1 text-xl font-bold text-(--text-primary)">{item.value}</dd>
          </div>
        ))}
      </dl>

      {/* ── 잠금 안내 ── */}
      {!editable && lockReason && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl p-4 bg-subtle-warning text-sm"
        >
          <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <p>{lockReason}</p>
        </div>
      )}

      {summary.orphans.length > 0 && (
        <div role="alert" className="rounded-xl p-4 bg-subtle-danger text-sm">
          대표 엔트리를 찾을 수 없는 파트너 행이 {summary.orphans.length}건 있습니다. 전체 해제 후 다시 편성하세요.
        </div>
      )}

      {/* ── 자동 편성 ── */}
      {editable && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-48">
              <label htmlFor={strategySelectId} className="block text-sm font-medium text-(--text-secondary) mb-1">
                자동 편성 방식
              </label>
              <select
                id={strategySelectId}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as PairingStrategy)}
                className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-primary) text-sm text-(--text-primary)"
              >
                {(Object.keys(PAIRING_STRATEGY_LABELS) as PairingStrategy[]).map((key) => (
                  <option key={key} value={key}>
                    {PAIRING_STRATEGY_LABELS[key].label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setConfirm({ kind: "auto", strategy })}
              disabled={summary.unpaired.length < MANUAL_SELECT_LIMIT}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: "var(--accent-color)", color: "var(--bg-primary)" }}
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" />
              미편성 {summary.unpaired.length}명 자동 편성
            </button>
            {summary.pairs.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirm({ kind: "unpairAll" })}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-red-500/40 text-red-500 hover:bg-red-500/10"
              >
                <Link2Off className="w-4 h-4" aria-hidden="true" />
                전체 해제
              </button>
            )}
          </div>
          <p className="text-sm text-(--text-muted)">{PAIRING_STRATEGY_LABELS[strategy].description}</p>
        </div>
      )}

      {/* ── 미편성 명단 (수동 편성) ── */}
      <section aria-labelledby="pairing-unpaired-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 id="pairing-unpaired-heading" className="text-sm font-bold text-(--text-primary)">
            미편성 ({summary.unpaired.length}명)
          </h4>
          {editable && summary.unpaired.length > 0 && (
            <button
              type="button"
              onClick={handleManualPair}
              disabled={selectedIds.length !== MANUAL_SELECT_LIMIT}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-(--accent-color) text-(--accent-color) hover:bg-(--accent-color)/10 disabled:opacity-40"
            >
              <Link2 className="w-4 h-4" aria-hidden="true" />
              선택한 {selectedIds.length}/{MANUAL_SELECT_LIMIT}명 페어 편성
            </button>
          )}
        </div>

        {summary.unpaired.length === 0 ? (
          <p className="text-sm text-(--text-muted)">미편성 인원이 없습니다.</p>
        ) : (
          <ul role="list" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.unpaired.map((entry) => (
              <UnpairedItem
                key={entry.id}
                entry={entry}
                checked={selectedIds.includes(entry.id)}
                disabled={!editable || (!selectedIds.includes(entry.id) && selectedIds.length >= MANUAL_SELECT_LIMIT)}
                onToggle={() => toggleSelect(entry.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* ── 편성된 페어 ── */}
      <section aria-labelledby="pairing-pairs-heading" className="space-y-3">
        <h4 id="pairing-pairs-heading" className="text-sm font-bold text-(--text-primary)">
          편성된 페어 ({summary.pairs.length}쌍)
        </h4>
        {summary.pairs.length === 0 ? (
          <p className="text-sm text-(--text-muted)">아직 편성된 페어가 없습니다.</p>
        ) : (
          <ul role="list" className="grid gap-2 sm:grid-cols-2">
            {summary.pairs.map((pair, index) => {
              const label = `${pair.captain.player_name} & ${pair.partner.player_name}`;
              return (
                <li
                  key={pair.captain.id}
                  className="flex items-center justify-between gap-3 rounded-xl p-4"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-(--text-primary) truncate">
                      <span className="text-(--text-muted) mr-2">{index + 1}</span>
                      {label}
                    </p>
                    <p className="text-sm text-(--text-muted) truncate">
                      {formatPairingEntryLabel(pair.captain)} · {formatPairingEntryLabel(pair.partner)}
                    </p>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setConfirm({ kind: "unpair", captainId: pair.captain.id, label })}
                      aria-label={`${label} 페어 해제`}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-red-500 hover:bg-red-500/10"
                    >
                      <Link2Off className="w-4 h-4" aria-hidden="true" />
                      해제
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
        title={confirmContent.title}
        message={confirmContent.message}
        type={confirm?.kind === "auto" ? "info" : "warning"}
        confirmText={confirm?.kind === "auto" ? "편성" : "해제"}
      />
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type="success"
      />
    </div>
  );
}

/** 미편성 1명 — 체크박스 라벨 전체가 클릭 영역 */
function UnpairedItem({
  entry,
  checked,
  disabled,
  onToggle,
}: {
  entry: SoloPairingEntry;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const inputId = `pairing-entry-${entry.id}`;
  return (
    <li>
      <label
        htmlFor={inputId}
        className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-(--bg-card-hover)"
        }`}
        style={{
          backgroundColor: "var(--bg-card)",
          border: checked ? "1.5px solid var(--accent-color)" : "1px solid var(--border-color)",
        }}
      >
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="w-5 h-5 rounded border-(--border-color)"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-(--text-primary) truncate">{entry.player_name}</span>
          <span className="block text-sm text-(--text-muted) truncate">
            {entry.club_name ?? "클럽 미입력"}
            {entry.player_rating !== null ? ` · ${entry.player_rating}점` : ""}
          </span>
        </span>
        {checked && <Badge variant="info">선택</Badge>}
      </label>
    </li>
  );
}
