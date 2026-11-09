import { useState } from "react";
import { MATCH_FORM_MESSAGES, toggleMatchPlayer } from "../../utils/matchBill";
import PlayerPickerSheet from "./PlayerPickerSheet";

/**
 * Sheet "Chọn người chơi" của một trận (giống sheet chọn người của bill con). Có `scopeIds`
 * (bill con): chưa gõ thì chỉ hiện người của bill chính, gõ tìm thì tìm trong mọi người chơi.
 * `scopeIds` null (bill chính): hiện mọi người chơi. Trận đủ người (đôi 4, đơn 2) thì không
 * chọn thêm, báo ngay trong sheet.
 *
 * @param {{
 *   match: { size: number, player_ids: number[] } | null,
 *   number: number,
 *   scopeIds: number[] | null,
 *   allPlayers: ReturnType<typeof import("./useAllPlayers").default>,
 *   onChange: (match: object) => void,
 *   onPicked: (player: { user_id: number, name: string }) => void,
 *   onClose: () => void,
 * }} props
 */
export default function MatchPlayerPicker({
  match,
  number,
  scopeIds,
  allPlayers,
  onChange,
  onPicked,
  onClose,
}) {
  const [notice, setNotice] = useState(null);

  const close = () => {
    setNotice(null);
    onClose();
  };

  const handleToggle = (player, nextSelected) => {
    setNotice(null);
    if (nextSelected === match.player_ids.includes(player.id)) return;
    if (nextSelected && match.player_ids.length >= match.size) {
      setNotice(MATCH_FORM_MESSAGES.matchFull(number, match.size));
      return;
    }
    if (nextSelected) onPicked({ user_id: player.id, name: player.name });
    onChange(toggleMatchPlayer(match, player.id));
  };

  return (
    <PlayerPickerSheet
      isOpen={Boolean(match)}
      onClose={close}
      players={allPlayers.players || []}
      selectedIds={match?.player_ids ?? []}
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
      title={`Chọn người chơi · Trận ${number}`}
      doneLabel={(count) => `Xong · ${count}/${match?.size ?? 0} người`}
      notice={notice}
    />
  );
}
