import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { playerListsApi, tournamentPlayersApi, bracketsApi } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import ActionBar from '../../components/ui/ActionBar';
import useToast from '../../components/ui/useToast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BracketsExport from '../../components/tournament/BracketsExport';
import { formatDateDisplay } from '../../utils/formatters';
import { nodeToPng } from '../../utils/exportImage';
import {
  GENDER_DISTRIBUTION_LABELS,
  genderLabel,
  orderBracketPlayers,
  playerBracketName,
  sortBrackets,
} from '../../utils/tournamentBrackets';
import { Check, CircleAlert, Download, Loader, Plus, Target, Trash2, Upload, Users, Trophy } from '../../components/ui/icons';

const errorText = (error) => error.response?.data?.message || error.message;

const isAssigned = (player) => Boolean(player.brackets && player.brackets.length > 0);

/** Lỗi khi đang mở sheet: hiện ngay trong sheet (thông báo M8 nằm dưới lớp nền mờ). */
function SheetError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="sheet-alert">
      <CircleAlert />
      <span>{message}</span>
    </p>
  );
}

function AssignedBadge({ player }) {
  if (!isAssigned(player)) {
    return <span className="badge badge-amber flex-shrink-0">Chưa xếp</span>;
  }
  return (
    <span className="badge badge-emerald flex-shrink-0">
      {playerBracketName(player) || 'Đã xếp bảng'}
    </span>
  );
}

export default function TournamentBrackets() {
  const [playerLists, setPlayerLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showOrganizeModal, setShowOrganizeModal] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [activeTab, setActiveTab] = useState('players'); // 'players' or 'brackets'
  // Lỗi của sheet đang mở (mỗi lúc một sheet) và trạng thái đang gửi của sheet đó.
  const [sheetError, setSheetError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // "Thêm VĐV" không đóng sau mỗi người: tên người vừa thêm để biết đã vào danh sách.
  const [recentlyAdded, setRecentlyAdded] = useState('');
  // Điện thoại: chạm hàng VĐV mở sheet có nút Xóa.
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [deletePlayerTarget, setDeletePlayerTarget] = useState(null);
  const [deletingPlayer, setDeletingPlayer] = useState(false);
  const [confirmDeleteBrackets, setConfirmDeleteBrackets] = useState(false);
  const [deletingBrackets, setDeletingBrackets] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [playerFormData, setPlayerFormData] = useState({
    name: '',
    gender: 'male',
    level: '',
  });
  const exportRef = useRef(null);
  const nameInputRef = useRef(null);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreateList = hasPermission('tournament_brackets.create_list');
  const canOrganize = hasPermission('tournament_brackets.organize');
  const canDeleteBrackets = hasPermission('tournament_brackets.delete');

  const [organizeFormData, setOrganizeFormData] = useState({
    number_of_brackets: 4,
    gender_distribution: 'mixed',
  });

  useEffect(() => {
    loadPlayerLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadPlayers();
      loadBrackets();
    }
  }, [selectedListId]);

  const loadPlayerLists = async () => {
    try {
      setLoading(true);
      const response = await playerListsApi.getAll();
      setPlayerLists(response.data);
      
      // Auto-select default list or first list
      if (response.data.length > 0) {
        const defaultList = response.data.find(list => list.is_default) || response.data[0];
        setSelectedListId(defaultList.id);
      } else {
        // Nếu chưa có danh sách nào, tự động tạo danh sách mặc định
        try {
          const newListResponse = await playerListsApi.create({ 
            name: 'Danh sách mặc định', 
            is_default: true 
          });
          setPlayerLists([newListResponse.data]);
          setSelectedListId(newListResponse.data.id);
        } catch (createError) {
          console.error('Error creating default list:', createError);
          setLoadError('Lỗi khi tạo danh sách mặc định: ' + errorText(createError));
        }
      }
    } catch (error) {
      console.error('Error loading player lists:', error);
      setLoadError('Lỗi khi tải danh sách: ' + errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    if (!selectedListId) return;
    try {
      const response = await tournamentPlayersApi.getAll({ player_list_id: selectedListId });
      setPlayers(response.data);
    } catch (error) {
      console.error('Error loading players:', error);
      setLoadError('Lỗi khi tải VĐV: ' + errorText(error));
    }
  };

  const loadBrackets = async () => {
    if (!selectedListId) return;
    try {
      const response = await bracketsApi.getAll(selectedListId);
      setBrackets(response.data);
    } catch (error) {
      console.error('Error loading brackets:', error);
      // Don't show error if no brackets exist yet
      if (error.response?.status !== 404) {
        setLoadError('Lỗi khi tải bảng: ' + errorText(error));
      }
    }
  };

  // Lỗi tải trang (M13): tải lại cả danh sách lẫn VĐV / bảng của danh sách đang chọn.
  const retryLoad = async () => {
    setLoadError('');
    await loadPlayerLists();
    if (selectedListId) {
      await Promise.all([loadPlayers(), loadBrackets()]);
    }
  };

  // Chưa có danh sách nào được chọn: tạo danh sách mặc định trước (như cũ). Lỗi hiện trong sheet.
  const ensureListId = async (errorPrefix) => {
    if (selectedListId) return selectedListId;
    try {
      const newListResponse = await playerListsApi.create({
        name: 'Danh sách mặc định',
        is_default: true
      });
      setSelectedListId(newListResponse.data.id);
      await loadPlayerLists(); // Reload để cập nhật danh sách
      return newListResponse.data.id;
    } catch (createError) {
      setSheetError(errorPrefix + errorText(createError));
      return null;
    }
  };

  const openSheet = (setOpen) => {
    setSheetError('');
    setOpen(true);
  };

  const openCreateList = () => {
    setNewListName('');
    openSheet(setShowCreateList);
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name || submitting) return;

    setSubmitting(true);
    try {
      await playerListsApi.create({ name, is_default: false });
      setShowCreateList(false);
      await loadPlayerLists();
    } catch (error) {
      setSheetError('Lỗi khi tạo danh sách: ' + errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  const closeAddPlayer = () => {
    setShowAddPlayerForm(false);
    setRecentlyAdded('');
    setPlayerFormData({ name: '', gender: 'male', level: '' });
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSheetError('');

    const listId = await ensureListId('Vui lòng tạo danh sách trước khi thêm VĐV: ');
    if (!listId) return;

    setSubmitting(true);
    try {
      await tournamentPlayersApi.create({
        ...playerFormData,
        player_list_id: listId,
      });
      // Không đóng hộp: xóa tên, giữ giới tính + level cho người kế, con trỏ về ô Họ Tên.
      setRecentlyAdded(playerFormData.name);
      setPlayerFormData((prev) => ({ ...prev, name: '' }));
      nameInputRef.current?.focus();
      await loadPlayers();
    } catch (error) {
      setSheetError('Lỗi khi thêm VĐV: ' + errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlayer = async () => {
    const player = deletePlayerTarget;
    const fromSheet = selectedPlayerId === player.id;

    setDeletingPlayer(true);
    try {
      await tournamentPlayersApi.delete(player.id);
      setSelectedPlayerId(null);
      await loadPlayers();
    } catch (error) {
      const message = 'Lỗi khi xóa VĐV: ' + errorText(error);
      if (fromSheet) setSheetError(message);
      else toast.error(message);
    } finally {
      setDeletingPlayer(false);
      setDeletePlayerTarget(null);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSheetError('');

    const listId = await ensureListId('Vui lòng tạo danh sách trước khi import VĐV: ');
    if (!listId) return;

    try {
      const response = await tournamentPlayersApi.import(listId, file);
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Import errors:', response.data.errors);
      }
      setShowImportModal(false);
      toast.success(`Đã import ${response.data.imported} VĐV thành công`);
      await loadPlayers();
    } catch (error) {
      setSheetError('Lỗi khi import: ' + errorText(error));
    }
  };

  const handleOrganizeBrackets = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSheetError('');

    const listId = await ensureListId('Vui lòng tạo danh sách trước khi xếp bảng: ');
    if (!listId) return;

    setSubmitting(true);
    try {
      // Đảm bảo player_list_id được gửi trong body
      const requestData = {
        ...organizeFormData,
        player_list_id: listId,
      };
      const response = await bracketsApi.organize(listId, requestData);
      setShowOrganizeModal(false);
      toast.success(response.data.message);
      // Tải lại cả VĐV để nhãn "Bảng n" / "Chưa xếp" và nút Xếp bảng đúng ngay.
      await Promise.all([loadBrackets(), loadPlayers()]);
      setActiveTab('brackets');
    } catch (error) {
      setSheetError('Lỗi khi xếp bảng: ' + errorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBrackets = async () => {
    setDeletingBrackets(true);
    try {
      await bracketsApi.deleteAll(selectedListId);
      await Promise.all([loadBrackets(), loadPlayers()]);
    } catch (error) {
      toast.error('Lỗi khi xóa bảng: ' + errorText(error));
    } finally {
      setDeletingBrackets(false);
      setConfirmDeleteBrackets(false);
    }
  };

  // Chụp khung ẩn 720 px (BracketsExport) chứ không chụp lưới đang hiện: ảnh giống nhau trên mọi máy.
  // Dùng nodeToPng (html-to-image, như ảnh bill): html2canvas vẽ chữ lệch xuống so với đường kẻ hàng.
  const handleExportBrackets = async () => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const dataUrl = await nodeToPng(exportRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = 'bang-thi-dau.png';
      link.href = dataUrl;
      link.click();
      toast.success('Đã tải ảnh bảng thi đấu');
    } catch (error) {
      console.error('Export image error', error);
      toast.error('Xuất ảnh bảng thi đấu thất bại. Vui lòng thử lại.', { onRetry: handleExportBrackets });
    } finally {
      setExporting(false);
    }
  };

  const availablePlayers = players.filter(p => !p.brackets || p.brackets.length === 0);
  const assignedPlayers = players.filter(p => p.brackets && p.brackets.length > 0);
  const sortedBrackets = sortBrackets(brackets);
  const selectedList = playerLists.find(list => list.id === selectedListId);
  const selectedPlayer = players.find(p => p.id === selectedPlayerId) ?? null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-500">Đang tải...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 pb-8 sm:px-0">
        <PageHeader title="Xếp bảng" />
        <EmptyState tone="error" title={loadError} onRetry={retryLoad} />
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 sm:px-0">
      {/* Header */}
      <PageHeader
        title="Xếp bảng"
        menuTitle="Thao tác khác"
        menu={
          activeTab === 'brackets' && brackets.length > 0 && canDeleteBrackets
            ? [{ label: 'Xóa tất cả', icon: Trash2, danger: true, onClick: () => setConfirmDeleteBrackets(true) }]
            : undefined
        }
        actions={
          <>
            <div className="w-full sm:w-auto">
              <label htmlFor="tournament-list" className="sr-only">
                Danh sách VĐV
              </label>
              <select
                id="tournament-list"
                value={selectedListId || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedListId(value ? Number(value) : null);
                }}
                className="field-input sm:w-auto sm:min-w-[12rem]"
              >
                {playerLists.length === 0 ? (
                  <option value="">Chưa có danh sách</option>
                ) : (
                  playerLists.map(list => (
                    <option key={list.id} value={list.id}>
                      {list.name} {list.is_default && '(Mặc định)'}
                    </option>
                  ))
                )}
              </select>
            </div>
            {canCreateList && (
              <button
                onClick={openCreateList}
                className="btn btn-secondary w-full sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Tạo danh sách VĐV
              </button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Quản lý & Xếp bảng thi đấu"
        className="tab-list"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'players'}
          onClick={() => setActiveTab('players')}
          className="tab"
        >
          Danh sách VĐV ({players.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'brackets'}
          onClick={() => setActiveTab('brackets')}
          className="tab"
        >
          Bảng thi đấu ({brackets.length})
        </button>
      </div>

      {/* Players Tab */}
      {activeTab === 'players' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => openSheet(setShowAddPlayerForm)}
              className="btn btn-primary w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Thêm VĐV thủ công
            </button>
            <button
              onClick={() => openSheet(setShowImportModal)}
              className="btn btn-secondary w-full sm:w-auto"
            >
              <Upload className="h-4 w-4" />
              Import Excel/CSV
            </button>
          </div>

          {/* Stats - wrap on small screens, hide descriptions on mobile */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card !p-3 sm:!p-4">
              <div className="text-xs font-medium text-slate-500">Tổng VĐV</div>
              <div className="font-tabular mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{players.length}</div>
              <p className="mt-1 hidden text-xs text-slate-500 sm:block">Tất cả VĐV trong danh sách</p>
            </div>
            <div className="card !p-3 sm:!p-4">
              <div className="text-xs font-medium text-slate-500">Chưa xếp bảng</div>
              <div className="font-tabular mt-1 text-2xl font-semibold text-amber-600 sm:text-3xl">{availablePlayers.length}</div>
              <p className="mt-1 hidden text-xs text-slate-500 sm:block">Sẵn sàng để xếp</p>
            </div>
            <div className="card !p-3 sm:!p-4">
              <div className="text-xs font-medium text-slate-500">Đã xếp bảng</div>
              <div className="font-tabular mt-1 text-2xl font-semibold text-emerald-700 sm:text-3xl">{assignedPlayers.length}</div>
              <p className="mt-1 hidden text-xs text-slate-500 sm:block">Đang nằm trong bảng thi đấu</p>
            </div>
          </div>

          {players.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Chưa có VĐV nào"
              description="Hãy thêm VĐV để bắt đầu."
            />
          ) : (
            <>
              {/* Players Table (desktop) */}
              <div className="card hidden overflow-hidden !p-0 md:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs text-slate-500">
                      <th className="px-4 py-3 font-medium">STT</th>
                      <th className="px-6 py-3 font-medium">Họ Tên</th>
                      <th className="px-6 py-3 font-medium">Giới tính</th>
                      <th className="px-6 py-3 font-medium">Level</th>
                      <th className="px-6 py-3 font-medium">Trạng thái</th>
                      <th className="px-6 py-3 text-right font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, idx) => (
                      <tr
                        key={player.id}
                        className={`border-t border-slate-100 ${player.gender === 'male' ? 'bg-sky-50/50' : 'bg-rose-50/40'}`}
                      >
                        <td className="font-tabular whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="max-w-[18rem] px-6 py-3 text-sm font-medium text-slate-900">
                          <div className="truncate" title={player.name}>{player.name}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-600">
                          {player.gender === 'male' ? 'Nam' : 'Nữ'}
                        </td>
                        <td className="font-tabular whitespace-nowrap px-6 py-3 text-sm text-slate-600">
                          {player.level || '-'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-3 text-sm">
                          {player.brackets && player.brackets.length > 0 ? (
                            <span className="badge badge-emerald">Đã xếp bảng</span>
                          ) : (
                            <span className="badge badge-amber">Chưa xếp</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right">
                          <button
                            onClick={() => setDeletePlayerTarget(player)}
                            disabled={player.brackets && player.brackets.length > 0}
                            className="btn btn-danger-ghost btn-sm"
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Players rows (mobile, M3): cả hàng mở sheet VĐV, Xóa nằm trong sheet */}
              <ul className="list-card md:hidden">
                {players.map((player, idx) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSheetError('');
                        setSelectedPlayerId(player.id);
                      }}
                      aria-haspopup="dialog"
                      className={`list-row ${player.gender === 'male' ? 'bg-sky-50/50' : 'bg-rose-50/40'}`}
                    >
                      <span className="font-tabular w-6 flex-none text-sm font-semibold text-slate-500">
                        {idx + 1}
                      </span>
                      <div className="list-row-text">
                        <div className="list-row-title line-clamp-2 whitespace-normal">{player.name}</div>
                        <div className="list-row-sub">
                          {genderLabel(player.gender)} · Level{' '}
                          <span className="font-tabular">{player.level || '-'}</span>
                        </div>
                      </div>
                      <AssignedBadge player={player} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Brackets Tab */}
      {activeTab === 'brackets' && (
        <div className="space-y-4">
          {/* Actions — điện thoại: "Xóa tất cả" vào ⋯ trên thanh, "Xuất bảng" ở thanh đáy */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => openSheet(setShowOrganizeModal)}
              className="btn btn-primary w-full sm:w-auto"
              disabled={!canOrganize || availablePlayers.length === 0}
            >
              <Target className="h-4 w-4" />
              Xếp bảng
            </button>
            {brackets.length > 0 && (
              <button
                onClick={() => setConfirmDeleteBrackets(true)}
                className="btn btn-danger hidden sm:inline-flex sm:w-auto"
                disabled={!canDeleteBrackets}
              >
                Xóa tất cả
              </button>
            )}
            {brackets.length > 0 && (
              <button
                onClick={handleExportBrackets}
                disabled={exporting}
                className="btn btn-secondary hidden sm:inline-flex sm:w-auto"
              >
                {exporting ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Xuất bảng
              </button>
            )}
          </div>

          {/* Brackets (mobile): 1 cột, hàng gọn — tên bên trái, giới tính · level bên phải */}
          {brackets.length > 0 && (
            <div className="space-y-3 sm:hidden">
              {sortedBrackets.map((bracket) => (
                <div key={bracket.id} className="card !px-4 !py-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <h3 className="min-w-0 break-words text-base font-semibold text-slate-900">{bracket.name}</h3>
                    <span className="badge badge-sky flex-shrink-0">
                      {bracket.players.length} VĐV
                    </span>
                  </div>
                  {orderBracketPlayers(bracket.players).map((player) => (
                    <div key={player.id} className="flex items-baseline justify-between gap-3 border-t border-slate-100 py-2 text-sm">
                      <span className="min-w-0 break-words text-slate-900">{player.name}</span>
                      <span className="flex-shrink-0 whitespace-nowrap text-slate-500">
                        {genderLabel(player.gender)} · Level {player.level || '-'}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Brackets Grid */}
          {brackets.length > 0 ? (
            <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedBrackets.map((bracket) => {
                const playersByGender = bracket.players.reduce((acc, p) => {
                  if (!acc[p.gender]) acc[p.gender] = [];
                  acc[p.gender].push(p);
                  return acc;
                }, {});

                return (
                  <div key={bracket.id} className="card flex flex-col gap-3 !p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold text-slate-900">{bracket.name}</h3>
                        {/* <p className="text-xs text-gray-500">Seed: {bracket.random_seed?.slice(-6) || 'N/A'}</p> */}
                      </div>
                      <span className="badge badge-sky flex-shrink-0">
                        {bracket.players.length} VĐV
                      </span>
                    </div>
                    <div className="space-y-3">
                      {playersByGender.male && playersByGender.male.length > 0 && (
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-800">
                              Nam ({playersByGender.male.length})
                            </div>
                            <span className="text-xs text-slate-400">Level</span>
                          </div>
                          <div className="space-y-1">
                            {playersByGender.male.map((player) => (
                              <div key={player.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <span className="text-slate-400">•</span>
                                <span className="min-w-0 break-words font-medium">{player.name}</span>
                                <span className="ml-auto flex-shrink-0 text-xs text-slate-500">{player.level ? `Level ${player.level}` : 'No level'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {playersByGender.female && playersByGender.female.length > 0 && (
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-800">
                              Nữ ({playersByGender.female.length})
                            </div>
                            <span className="text-xs text-slate-400">Level</span>
                          </div>
                          <div className="space-y-1">
                            {playersByGender.female.map((player) => (
                              <div key={player.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                <span className="text-slate-400">•</span>
                                <span className="min-w-0 break-words font-medium">{player.name}</span>
                                <span className="ml-auto flex-shrink-0 text-xs text-slate-500">{player.level ? `Level ${player.level}` : 'No level'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="Chưa có bảng nào"
              description={'Hãy bấm "Xếp bảng" để tạo bảng thi đấu.'}
            />
          )}

          {/* Điện thoại (M2): "Xuất bảng" dính đáy, ngay trên thanh tab */}
          {brackets.length > 0 && (
            <ActionBar overTab>
              <button
                type="button"
                onClick={handleExportBrackets}
                disabled={exporting}
                className="btn btn-primary flex-1"
              >
                {exporting ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Xuất bảng
              </button>
            </ActionBar>
          )}
        </div>
      )}

      {/* Khung ảnh "Xuất bảng" 720 px, 2 cột — luôn dựng sẵn ngoài màn hình để bấm là chụp được */}
      {brackets.length > 0 && (
        <div
          aria-hidden
          style={{ position: 'fixed', top: 0, left: '-10000px', pointerEvents: 'none' }}
        >
          <div ref={exportRef}>
            <BracketsExport
              listName={selectedList?.name}
              brackets={sortedBrackets}
              exportDate={formatDateDisplay(new Date())}
            />
          </div>
        </div>
      )}

      {/* Create List Modal (thay prompt) */}
      <Modal
        isOpen={showCreateList}
        onClose={() => setShowCreateList(false)}
        title="Tạo danh sách VĐV"
        dismissible={!submitting}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowCreateList(false)}
              disabled={submitting}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="create-player-list-form"
              disabled={submitting || !newListName.trim()}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {submitting && <Loader className="h-4 w-4 animate-spin" />}
              Tạo danh sách VĐV
            </button>
          </div>
        }
      >
        <form id="create-player-list-form" onSubmit={handleCreateList} className="space-y-4">
          <div>
            <label htmlFor="tp-list-name" className="field-label">
              Tên danh sách
            </label>
            <input
              id="tp-list-name"
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="field-input"
            />
          </div>
          <SheetError message={sheetError} />
        </form>
      </Modal>

      {/* Add Player Form Modal — không đóng sau mỗi người, "Xong" để đóng */}
      <Modal
        isOpen={showAddPlayerForm}
        onClose={closeAddPlayer}
        title="Thêm VĐV"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={closeAddPlayer}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Xong
            </button>
            <button
              type="submit"
              form="add-tournament-player-form"
              disabled={submitting}
              // Không lấy focus khỏi ô Họ Tên: bàn phím điện thoại không sập giữa hai người.
              onMouseDown={(e) => e.preventDefault()}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Thêm
            </button>
          </div>
        }
      >
        <form id="add-tournament-player-form" onSubmit={handleAddPlayer} className="space-y-4">
          <div>
            <label htmlFor="tp-name" className="field-label">
              Họ Tên *
            </label>
            <input
              id="tp-name"
              ref={nameInputRef}
              type="text"
              required
              value={playerFormData.name}
              onChange={(e) => setPlayerFormData({ ...playerFormData, name: e.target.value })}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="tp-gender" className="field-label">
              Giới tính *
            </label>
            <select
              id="tp-gender"
              required
              value={playerFormData.gender}
              onChange={(e) => setPlayerFormData({ ...playerFormData, gender: e.target.value })}
              className="field-input"
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label htmlFor="tp-level" className="field-label">
              Level *
            </label>
            <input
              id="tp-level"
              type="number"
              inputMode="numeric"
              required
              min={1}
              step={1}
              value={playerFormData.level}
              onChange={(e) => setPlayerFormData({ ...playerFormData, level: e.target.value })}
              className="field-input"
              placeholder="Nhập level (1, 2, 3...)"
            />
          </div>
          {recentlyAdded && (
            <p role="status" className="flex items-start gap-1.5 text-sm text-slate-600">
              <Check className="mt-0.5 h-4 w-4 flex-none text-emerald-700" />
              <span className="min-w-0 break-words">Vừa thêm: {recentlyAdded}</span>
            </p>
          )}
          <SheetError message={sheetError} />
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import VĐV từ file"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowImportModal(false)}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Đóng
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="text-sm text-slate-600">
            <p className="mb-2 font-semibold text-slate-800">Định dạng file hỗ trợ: Excel (.xlsx, .xls) hoặc CSV</p>
            <p className="mb-2">Cấu trúc file (dòng đầu tiên là tiêu đề, có thể bỏ qua):</p>
            <div className="space-y-2 rounded-xl bg-slate-100 p-3 text-xs">
              <div>
                <p className="mb-1 font-semibold">Cột 1: Họ Tên (bắt buộc)</p>
                <p className="mb-1 font-semibold">Cột 2: Giới tính (bắt buộc)</p>
                <p className="mb-1 font-semibold">Cột 3: Level (bắt buộc, chỉ nhập số 1,2,3,...)</p>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <p className="mb-1 font-semibold">Ví dụ:</p>
                <pre className="overflow-x-auto whitespace-pre-wrap">
Họ Tên,Giới tính,Level{'\n'}
Nguyễn Văn A,male,1{'\n'}
Trần Thị B,female,2{'\n'}
Lê Văn C,nam,1{'\n'}
Phạm Thị D,nữ,3
                </pre>
              </div>
            </div>
            <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs">
              <p className="mb-1 font-semibold text-sky-900">Lưu ý về Giới tính:</p>
              <p className="text-sky-800">Chấp nhận: "male" hoặc "nam" (Nam), "female" hoặc "nữ" (Nữ)</p>
            </div>
          </div>
          <div>
            <label htmlFor="tp-import-file" className="sr-only">
              Import VĐV từ file
            </label>
            <input
              id="tp-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleImportFile}
              className="block w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:h-11 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 sm:file:h-10"
            />
          </div>
          <SheetError message={sheetError} />
        </div>
      </Modal>

      {/* Organize Brackets Modal */}
      <Modal
        isOpen={showOrganizeModal}
        onClose={() => setShowOrganizeModal(false)}
        title="Xếp bảng thi đấu"
        dismissible={!submitting}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowOrganizeModal(false)}
              disabled={submitting}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="organize-brackets-form"
              disabled={submitting}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {submitting && <Loader className="h-4 w-4 animate-spin" />}
              Xếp bảng
            </button>
          </div>
        }
      >
        <form id="organize-brackets-form" onSubmit={handleOrganizeBrackets} className="space-y-4">
          <div>
            <label htmlFor="org-count" className="field-label">
              Số bảng *
            </label>
            <input
              id="org-count"
              type="number"
              inputMode="numeric"
              required
              min="1"
              max="50"
              value={organizeFormData.number_of_brackets}
              onChange={(e) => setOrganizeFormData({ ...organizeFormData, number_of_brackets: Number(e.target.value) })}
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="org-gender" className="field-label">
              Phân bổ giới tính *
            </label>
            <select
              id="org-gender"
              required
              value={organizeFormData.gender_distribution}
              onChange={(e) => setOrganizeFormData({ ...organizeFormData, gender_distribution: e.target.value })}
              className="field-input"
            >
              {Object.entries(GENDER_DISTRIBUTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>Lưu ý: Chỉ các VĐV chưa được xếp bảng mới được xếp vào bảng mới.</p>
            <p className="mt-1">Hiện có {availablePlayers.length} VĐV chưa xếp bảng.</p>
          </div>
          <SheetError message={sheetError} />
        </form>
      </Modal>

      {/* Player sheet (mobile): thông tin VĐV + Xóa (VĐV đã xếp bảng thì không xóa được, như cũ) */}
      <Modal
        isOpen={Boolean(selectedPlayer)}
        onClose={() => setSelectedPlayerId(null)}
        title={selectedPlayer?.name}
        initialFocus="panel"
        footer={
          selectedPlayer && (
            <button
              type="button"
              onClick={() => setDeletePlayerTarget(selectedPlayer)}
              disabled={isAssigned(selectedPlayer)}
              className="btn btn-danger-soft w-full"
            >
              Xóa
            </button>
          )
        }
      >
        {selectedPlayer && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                {genderLabel(selectedPlayer.gender)} · Level{' '}
                <span className="font-tabular">{selectedPlayer.level || '-'}</span>
              </span>
              <AssignedBadge player={selectedPlayer} />
            </div>
            <SheetError message={sheetError} />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deletePlayerTarget)}
        busy={deletingPlayer}
        onClose={() => setDeletePlayerTarget(null)}
        onConfirm={handleDeletePlayer}
        title="Xóa VĐV"
        message="Bạn có chắc muốn xóa VĐV này?"
      />

      <ConfirmDialog
        isOpen={confirmDeleteBrackets}
        busy={deletingBrackets}
        onClose={() => setConfirmDeleteBrackets(false)}
        onConfirm={handleDeleteBrackets}
        title="Xóa tất cả bảng thi đấu"
        message="Bạn có chắc muốn xóa tất cả các bảng? Điều này sẽ không xóa VĐV."
        confirmLabel="Xóa tất cả"
      />
    </div>
  );
}
