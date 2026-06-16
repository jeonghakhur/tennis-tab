"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";

export interface EntryEditData {
  playerName: string;
  clubName: string;
  partnerName: string;
  partnerClub: string;
}

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entryId: string | null;
  initialData: EntryEditData | null;
  isDoubles: boolean;
  onSave: (entryId: string, data: EntryEditData) => Promise<void>;
}

export function EditEntryModal({
  isOpen,
  onClose,
  entryId,
  initialData,
  isDoubles,
  onSave,
}: EditEntryModalProps) {
  const [form, setForm] = useState<EntryEditData>({
    playerName: "",
    clubName: "",
    partnerName: "",
    partnerClub: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && initialData) {
      setForm(initialData);
    }
  }, [isOpen, initialData]);

  const handleSave = async () => {
    if (!entryId || !form.playerName.trim()) return;
    setSaving(true);
    await onSave(entryId, form);
    setSaving(false);
  };

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    required = false,
  ) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1 text-(--text-primary)">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-(--border-color) bg-(--bg-card) text-(--text-primary) text-sm"
      />
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="참가자 정보 수정"
      size="sm"
    >
      <Modal.Body>
        <div className="space-y-3">
          {field("clubName", "클럽명", form.clubName, (v) => setForm((p) => ({ ...p, clubName: v })))}
          {field("playerName", isDoubles ? "신청자 이름" : "이름", form.playerName, (v) => setForm((p) => ({ ...p, playerName: v })), true)}
          {isDoubles && (
            <>
              {field("partnerName", "파트너 이름", form.partnerName, (v) => setForm((p) => ({ ...p, partnerName: v })), true)}
              {field("partnerClub", "파트너 클럽", form.partnerClub, (v) => setForm((p) => ({ ...p, partnerClub: v })))}
            </>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) text-sm font-medium hover:bg-(--bg-card-hover) transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !form.playerName.trim()}
          className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </Modal.Footer>
    </Modal>
  );
}
