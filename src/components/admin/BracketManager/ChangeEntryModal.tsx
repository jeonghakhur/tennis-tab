"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Search, X } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import type { BracketMatch } from "./types";
import type { DivisionEntry } from "@/lib/bracket/actions";

interface ChangeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 교체 대상 경기 */
  match: BracketMatch | null;
  /** 교체할 슬롯 (1=team1, 2=team2) */
  slot: 1 | 2 | null;
  /** 가능한 엔트리 목록 */
  entries: DivisionEntry[];
  /** 복식 여부 (레이블 포맷 결정) */
  isTeamMatch?: boolean;
  onConfirm: (matchId: string, slot: 1 | 2, newEntryId: string) => void;
}

function getEntryLabel(entry: DivisionEntry, isTeamMatch?: boolean): string {
  if (entry.partner_data) {
    const club = entry.club_name || entry.partner_data.club || "";
    const clubPart = club ? `[${club}] ` : "";
    return `${clubPart}${entry.player_name} & ${entry.partner_data.name}`;
  }
  if (isTeamMatch) {
    const order = entry.team_order ? ` (${entry.team_order}팀)` : "";
    return `${entry.club_name || entry.player_name}${order}`;
  }
  return entry.club_name
    ? `[${entry.club_name}] ${entry.player_name}`
    : entry.player_name;
}

export function ChangeEntryModal({
  isOpen,
  onClose,
  match,
  slot,
  entries,
  isTeamMatch,
  onConfirm,
}: ChangeEntryModalProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      // 모달 열릴 때 검색창 포커스
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!match || !slot) return null;

  const currentEntryId =
    slot === 1 ? match.team1_entry_id : match.team2_entry_id;
  const isCompleted = match.status === "COMPLETED";

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const label = getEntryLabel(e, isTeamMatch).toLowerCase();
    return label.includes(search.toLowerCase());
  });

  const handleSelect = (entryId: string) => {
    onConfirm(match.id, slot, entryId);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`참가자 교체 — ${slot === 1 ? "팀 1" : "팀 2"}`}
      description={`경기 #${match.match_number}`}
      size="md"
    >
      <Modal.Body>
        <div className="space-y-4">
          {/* COMPLETED 경기 경고 */}
          {isCompleted && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-(--color-warning-subtle) border border-(--color-warning-border)">
              <AlertTriangle className="w-4 h-4 text-(--color-warning) shrink-0 mt-0.5" />
              <p className="text-sm text-(--color-warning) font-medium">
                결과가 입력된 경기입니다. 참가자 교체 시 이후 라운드 경기
                결과가 초기화됩니다.
              </p>
            </div>
          )}

          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-muted)" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 또는 클럽으로 검색"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-(--bg-card) border border-(--border-color) text-(--text-primary) text-sm placeholder:text-(--text-muted)"
              aria-label="참가자 검색"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-(--text-muted) hover:text-(--text-primary)"
                aria-label="검색어 지우기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 엔트리 목록 */}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-(--border-color) divide-y divide-(--border-color)">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-(--text-muted)">
                검색 결과가 없습니다.
              </p>
            ) : (
              filtered.map((entry) => {
                const isCurrent = entry.id === currentEntryId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSelect(entry.id)}
                    disabled={isCurrent}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      isCurrent
                        ? "bg-(--color-success-subtle) text-(--color-success) cursor-default font-medium"
                        : "hover:bg-(--bg-card-hover) text-(--text-primary)"
                    }`}
                  >
                    <span className="block truncate">
                      {getEntryLabel(entry, isTeamMatch)}
                    </span>
                    {isCurrent && (
                      <span className="text-sm text-(--color-success) opacity-70">
                        현재 배정됨
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-sm font-medium hover:bg-(--bg-card-hover) transition-colors"
        >
          취소
        </button>
      </Modal.Footer>
    </Modal>
  );
}
