import { useState } from "react";
import PlayerSelector from "./PlayerSelector";
import PlayerBillCard, { PlayerBillRow } from "./PlayerBillCard";
import QuickAddMenu from "./QuickAddMenu";
import { CircleAlert, Plus, Users } from "../ui/icons";

// Lỗi in hai chỗ (điện thoại / desktop, một chỗ bị ẩn) nên hai id riêng
const PLAYERS_ERROR_ID = "bill-players-err";

function PlayersError({ id = PLAYERS_ERROR_ID, message, className = "" }) {
  return (
    <p id={id} className={`field-error ${className}`}>
      <CircleAlert />
      {message}
    </p>
  );
}

/**
 * Khối "Người chơi" của form tạo / sửa bill cầu.
 * - Điện thoại: đầu khối "Người chơi (N)" dính dưới thanh trên + nút "Chọn người chơi" (mở
 *   PlayerPickerSheet); mỗi người một hàng mở tại chỗ (PlayerBillRow, mỗi lúc một hàng).
 * - Desktop: giữ hai cột chọn người + "Chi tiết người chơi" với thẻ PlayerBillCard như cũ.
 *
 * `previewPlayers`: preview.players (cùng thứ tự `players`) để in số tiền trên hàng.
 * `error`: lỗi kiểm form của khối (M14). Hàng tự hiện "Đã TT" khi player.is_paid (màn sửa).
 */
export default function BillPlayersSection({
  players,
  previewPlayers = [],
  menus,
  allMenus,
  onMenuAdded,
  onSelect,
  onRemove,
  onUpdate,
  parentPlayerIds,
  showDefault = false,
  error,
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const count = players.length;

  const openPicker = () => setPickerOpen(true);
  const removeAt = (index) => {
    if (players[index]?.user_id === expandedId) setExpandedId(null);
    onRemove(index);
  };

  return (
    <section
      className={`overflow-clip rounded-2xl border bg-white shadow-card sm:overflow-hidden ${
        error ? "border-rose-300 ring-2 ring-rose-500/15" : "border-slate-200"
      }`}
    >
      <div className="sticky top-[calc(var(--app-bar-h)+env(safe-area-inset-top))] z-10 flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-3 sm:static sm:bg-transparent sm:px-5 sm:py-4">
        <h2 className="whitespace-nowrap text-base font-semibold text-slate-900">
          Người chơi
          {count > 0 && (
            <span className="ml-1.5 font-tabular font-normal text-slate-500 sm:hidden">
              ({count})
            </span>
          )}
        </h2>
        {count > 0 && (
          <span className="hidden font-tabular text-xs text-slate-500 sm:inline">
            {count} người
          </span>
        )}
        {count > 0 && (
          <button
            type="button"
            onClick={openPicker}
            data-field="players"
            aria-describedby={error ? PLAYERS_ERROR_ID : undefined}
            className="btn btn-secondary btn-sm gap-1.5 px-2.5 sm:hidden"
          >
            <Plus className="h-4 w-4" />
            Chọn người chơi
          </button>
        )}
      </div>

      <div className="sm:p-5">
        {/* Điện thoại */}
        {count === 0 ? (
          <div className="flex flex-col items-center px-4 py-8 text-center sm:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-[15px] font-medium text-slate-700">
              Chưa chọn người chơi nào
            </p>
            <button
              type="button"
              onClick={openPicker}
              data-field="players"
              aria-describedby={error ? PLAYERS_ERROR_ID : undefined}
              className="btn btn-primary mt-4"
            >
              <Plus className="h-4 w-4" />
              Chọn người chơi
            </button>
            {error && <PlayersError message={error} className="mt-3" />}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-200/70 sm:hidden">
              {players.map((player, index) => (
                <PlayerBillRow
                  key={player.user_id}
                  player={player}
                  index={index}
                  menus={menus}
                  allMenus={allMenus}
                  onMenuAdded={onMenuAdded}
                  onUpdate={(updated) => onUpdate(index, updated)}
                  onRemove={() => removeAt(index)}
                  amount={previewPlayers[index]?.total_amount}
                  expanded={expandedId === player.user_id}
                  onToggle={() =>
                    setExpandedId((prev) =>
                      prev === player.user_id ? null : player.user_id,
                    )
                  }
                  showDefault={showDefault}
                />
              ))}
            </ul>
            {error && (
              <PlayersError
                message={error}
                className="border-t border-slate-100 px-4 py-3 sm:hidden"
              />
            )}
          </>
        )}

        {/* Desktop: lỗi ngay trên hai cột chọn người (ô tìm được đặt con trỏ) */}
        {error && (
          <PlayersError
            id="bill-players-err-desktop"
            message={error}
            className="mb-3 mt-0 hidden sm:flex"
          />
        )}
        {/* Desktop: hai cột chọn người như cũ; điện thoại chỉ dùng sheet của nó */}
        <PlayerSelector
          selectedPlayers={players}
          onSelect={onSelect}
          onRemove={removeAt}
          parentPlayerIds={parentPlayerIds}
          pickerOpen={pickerOpen}
          onPickerClose={() => setPickerOpen(false)}
        />

        {count > 0 && (
          <div className="mt-5 hidden border-t border-slate-100 pt-5 sm:mt-6 sm:block sm:pt-6">
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Chi tiết người chơi ({count})
              </h2>
              <QuickAddMenu menus={allMenus} onCreated={onMenuAdded} />
            </div>
            <div className="space-y-3 sm:space-y-4">
              {players.map((player, index) => (
                <PlayerBillCard
                  key={player.user_id}
                  player={player}
                  index={index}
                  menus={menus}
                  onUpdate={(updated) => onUpdate(index, updated)}
                  showDefault={showDefault}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
