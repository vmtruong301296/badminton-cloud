import { useState } from "react";
import { playersApi } from "../../services/api";

const LOAD_ERROR = "Không tải được danh sách người chơi.";

/**
 * Danh sách người chơi (GET /players) cho sheet chọn người của trận. Màn gọi `loadOnce()`
 * khi mở sheet lần đầu; tải lỗi thì sheet hiện nút thử lại (`load`).
 *
 * @returns {{ players: object[] | null, loading: boolean, error: string | null,
 *   load: () => Promise<void>, loadOnce: () => void }}
 */
export default function useAllPlayers() {
  const [state, setState] = useState({
    players: null,
    loading: false,
    error: null,
  });

  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await playersApi.getAll();
      setState({ players: response.data || [], loading: false, error: null });
    } catch (error) {
      console.error("Error loading players:", error);
      setState({ players: null, loading: false, error: LOAD_ERROR });
    }
  };

  const loadOnce = () => {
    if (!state.players && !state.loading) load();
  };

  return { ...state, load, loadOnce };
}
