import { useState } from "react";

/** Người tham gia mới từ một người chơi (mức tính luôn 1 như màn cũ, không theo mức mặc định). */
export const participantFromPlayer = (player) => ({
  user_id: player.id,
  name: player.name,
  gender: player.gender,
  ratio_value: 1,
  default_ratio_value: player.default_ratio_value ?? player.default_ratio ?? 1,
  paid_amount: 0,
  food_amount: 0,
  note: "",
});

/**
 * State form tạo / sửa bill tiệc (dùng chung CreatePartyBill, EditPartyBill): cập nhật theo
 * state mới nhất để chọn nhiều người liên tục trong sheet không mất người.
 */
export default function usePartyBillForm(initialForm) {
  const [form, setForm] = useState(initialForm);

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateExtra = (index, key, value) =>
    setForm((prev) => {
      const extras = [...prev.extras];
      extras[index] = { ...extras[index], [key]: value };
      return { ...prev, extras };
    });

  const addExtra = () =>
    setForm((prev) => ({
      ...prev,
      extras: [...prev.extras, { name: "", amount: 0 }],
    }));

  const removeExtra = (index) =>
    setForm((prev) => ({
      ...prev,
      extras: prev.extras.filter((_, i) => i !== index),
    }));

  const updateParticipant = (index, key, value) =>
    setForm((prev) => {
      const participants = [...prev.participants];
      participants[index] = { ...participants[index], [key]: value };
      return { ...prev, participants };
    });

  const removeParticipant = (index) =>
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index),
    }));

  // Người đã có trong bill thì bỏ qua (chạm hai lần / thêm nhanh trùng).
  const selectPlayer = (player) =>
    setForm((prev) =>
      prev.participants.some((p) => p.user_id === player.id)
        ? prev
        : {
            ...prev,
            participants: [...prev.participants, participantFromPlayer(player)],
          },
    );

  const unselectPlayer = (playerId) =>
    setForm((prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p.user_id !== playerId),
    }));

  return {
    form,
    setForm,
    updateField,
    updateExtra,
    addExtra,
    removeExtra,
    updateParticipant,
    removeParticipant,
    selectPlayer,
    unselectPlayer,
  };
}
