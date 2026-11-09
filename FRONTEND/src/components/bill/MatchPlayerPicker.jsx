import { useState } from "react";
import {
  MATCH_FORM_MESSAGES,
  pickerTeamAfterPick,
  teamCapacity,
  teamLabel,
  toggleTeamPlayer,
} from "../../utils/matchBill";
import PlayerPickerSheet from "./PlayerPickerSheet";

/**
 * Sheet "Chọn người chơi" cho một bên (Cặp A / Cặp B) của một trận, giống sheet chọn người
 * của bill con. Có `scopeIds` (bill con): chưa gõ thì chỉ hiện người của bill chính, gõ tìm
 * thì tìm trong mọi người chơi. `scopeIds` null (bill chính): hiện mọi người chơi. Bên đủ người
 * (đôi 2, đơn 1) thì không chọn thêm; chọn người đang ở bên kia thì chuyển sang bên này. Cả
 * hai trường hợp đều báo ngay trong sheet. Vừa chọn đủ một bên thì tự sang bên kia nếu bên kia
 * còn thiếu (sheet đóng rồi mở lại cho bên kia), cả hai đủ thì tự đóng — không cần bấm Xong.
 *
 * @param {{
 *   match: { size: number, teams: number[][] } | null,
 *   team: 0 | 1,
 *   number: number,
 *   scopeIds: number[] | null,
 *   allPlayers: ReturnType<typeof import("./useAllPlayers").default>,
 *   onChange: (match: object) => void,
 *   onPicked: (player: { user_id: number, name: string }) => void,
 *   onSwitchTeam: (team: 0 | 1) => void,
 *   onClose: () => void,
 * }} props
 */
export default function MatchPlayerPicker({
  match,
  team,
  number,
  scopeIds,
  allPlayers,
  onChange,
  onPicked,
  onSwitchTeam,
  onClose,
}) {
  const [notice, setNotice] = useState(null);
  const label = match ? teamLabel(match.size, team) : "";
  const capacity = match ? teamCapacity(match) : 0;

  const close = () => {
    setNotice(null);
    onClose();
  };

  const handleToggle = (player, nextSelected) => {
    setNotice(null);
    const ids = match.teams[team];
    if (nextSelected === ids.includes(player.id)) return;
    if (nextSelected && ids.length >= capacity) {
      setNotice(MATCH_FORM_MESSAGES.teamFull(label, capacity));
      return;
    }
    const next = toggleTeamPlayer(match, team, player.id);
    if (nextSelected) onPicked({ user_id: player.id, name: player.name });
    onChange(next);
    if (!nextSelected) return;

    const other = 1 - team;
    const moved = match.teams[other].includes(player.id)
      ? MATCH_FORM_MESSAGES.movedTeam(
          player.name,
          teamLabel(match.size, other),
          label,
        )
      : null;
    const nextTeam = pickerTeamAfterPick(next, team);
    if (nextTeam === null) {
      close();
    } else if (nextTeam !== team) {
      setNotice(
        moved ??
          MATCH_FORM_MESSAGES.nextTeam(label, teamLabel(match.size, nextTeam)),
      );
      onSwitchTeam(nextTeam);
    } else {
      setNotice(moved);
    }
  };

  return (
    <PlayerPickerSheet
      // Đổi bên thì dựng lại sheet: ô tìm trống, người đã chọn của bên mới lên đầu
      key={`${number}-${team}`}
      isOpen={Boolean(match)}
      onClose={close}
      players={allPlayers.players || []}
      selectedIds={match?.teams[team] ?? []}
      onToggle={handleToggle}
      loading={allPlayers.loading}
      error={allPlayers.error}
      onRetry={allPlayers.load}
      showRatio={false}
      scopeIds={scopeIds}
      searchPlaceholder={
        scopeIds
          ? "Tìm kiếm để chọn thêm người ngoài bill chính..."
          : "Tìm kiếm người chơi..."
      }
      title={`Chọn người chơi · Trận ${number} · ${label}`}
      doneLabel={(count) => `Xong · ${count}/${capacity} người`}
      notice={notice}
    />
  );
}
