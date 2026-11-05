import { useState } from "react";
import { playersApi } from "../../services/api";
import NumberInput from "../common/NumberInput";
import Modal from "../ui/Modal";
import { CircleAlert } from "../ui/icons";
import {
  ratioForGender,
  useGenderDefaultRatios,
} from "../../utils/genderRatio";

/**
 * Hộp "Thêm nhanh người chơi" của bill tiệc (chữ và cách lưu như cũ). Mở chồng lên sheet chọn
 * người được; lưu xong gọi onCreated(người chơi mới) để màn chọn luôn người đó.
 * Chỉ dựng phần thân khi mở nên mỗi lần mở là form mới, mang sẵn initialName (chữ vừa gõ ở ô tìm).
 */
function QuickAddModal({ initialName, onClose, onCreated }) {
  const genderRatios = useGenderDefaultRatios();
  const [newPlayer, setNewPlayer] = useState(() => ({
    name: initialName || "",
    gender: "male",
    default_ratio: ratioForGender(genderRatios, "male"),
  }));
  const [nameError, setNameError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Đổi giới tính -> mức tính tự nhảy về mặc định của giới tính đó (Nam 1, Nữ 0.7)
  const handleGenderChange = (gender) =>
    setNewPlayer((prev) => ({
      ...prev,
      gender,
      default_ratio: ratioForGender(genderRatios, gender),
    }));

  const handleCreatePlayer = async () => {
    if (!newPlayer.name.trim()) {
      setNameError("Nhập tên người chơi");
      document.getElementById("pbc-np-name")?.focus();
      return;
    }
    const slug = newPlayer.name.trim().toLowerCase().replace(/\s+/g, "");
    const email = `${slug || "player"}${Date.now()}@party.local`;
    setSaveError(null);
    setSaving(true);
    try {
      const payload = {
        name: newPlayer.name.trim(),
        gender: newPlayer.gender,
        default_ratio: newPlayer.default_ratio || 1,
        email,
        password: "password",
      };
      const res = await playersApi.create(payload);
      await onCreated({
        id: res.data.id,
        name: res.data.name,
        gender: res.data.gender,
      });
      onClose();
    } catch (error) {
      console.error("Create player error", error);
      setSaveError("Không thể tạo người chơi mới");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Thêm nhanh người chơi"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleCreatePlayer}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {saveError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
            {saveError}
          </p>
        )}
        <div>
          <label htmlFor="pbc-np-name" className="field-label">
            Tên
          </label>
          <input
            id="pbc-np-name"
            type="text"
            value={newPlayer.name}
            onChange={(e) => {
              setNameError(null);
              setNewPlayer({ ...newPlayer, name: e.target.value });
            }}
            className="field-input"
            placeholder="Tên người chơi"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? "pbc-np-name-err" : undefined}
          />
          {nameError && (
            <p id="pbc-np-name-err" className="field-error">
              <CircleAlert />
              {nameError}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="pbc-np-gender" className="field-label">
              Giới tính
            </label>
            <select
              id="pbc-np-gender"
              value={newPlayer.gender}
              onChange={(e) => handleGenderChange(e.target.value)}
              className="field-input"
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label htmlFor="pbc-np-ratio" className="field-label">
              Mức tính
            </label>
            <NumberInput
              id="pbc-np-ratio"
              value={newPlayer.default_ratio}
              onChange={(value) =>
                setNewPlayer({ ...newPlayer, default_ratio: value })
              }
              min={0}
              step={0.1}
              baseClassName="field-input"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function PartyQuickAddPlayer({
  isOpen,
  initialName = "",
  onClose,
  onCreated,
}) {
  if (!isOpen) return null;
  return (
    <QuickAddModal
      initialName={initialName}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}
