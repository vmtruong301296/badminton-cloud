import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { playerListsApi, tournamentPlayersApi, bracketsApi } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { Download, Plus, Target, Upload, Users, Trophy } from '../../components/ui/icons';

export default function TournamentBrackets() {
  const [playerLists, setPlayerLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [brackets, setBrackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showOrganizeModal, setShowOrganizeModal] = useState(false);
  const [activeTab, setActiveTab] = useState('players'); // 'players' or 'brackets'

  const [playerFormData, setPlayerFormData] = useState({
    name: '',
    gender: 'male',
    level: '',
  });
  const bracketsContainerRef = useRef(null);
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
          alert('Lỗi khi tạo danh sách mặc định: ' + (createError.response?.data?.message || createError.message));
        }
      }
    } catch (error) {
      console.error('Error loading player lists:', error);
      alert('Lỗi khi tải danh sách: ' + (error.response?.data?.message || error.message));
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
      alert('Lỗi khi tải VĐV: ' + (error.response?.data?.message || error.message));
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
        alert('Lỗi khi tải bảng: ' + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleCreateList = async () => {
    const name = prompt('Nhập tên danh sách mới:');
    if (!name) return;

    try {
      await playerListsApi.create({ name, is_default: false });
      await loadPlayerLists();
    } catch (error) {
      alert('Lỗi khi tạo danh sách: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleAddPlayer = async (e) => {
    e.preventDefault();
    
    // Đảm bảo có danh sách được chọn
    let listId = selectedListId;
    if (!listId) {
      // Nếu chưa có danh sách, tạo danh sách mặc định
      try {
        const newListResponse = await playerListsApi.create({ 
          name: 'Danh sách mặc định', 
          is_default: true 
        });
        listId = newListResponse.data.id;
        setSelectedListId(listId);
        await loadPlayerLists(); // Reload để cập nhật danh sách
      } catch (createError) {
        alert('Vui lòng tạo danh sách trước khi thêm VĐV: ' + (createError.response?.data?.message || createError.message));
        return;
      }
    }

    try {
      await tournamentPlayersApi.create({
        ...playerFormData,
        player_list_id: listId,
      });
      setShowAddPlayerForm(false);
      setPlayerFormData({ name: '', gender: 'male', level: '' });
      await loadPlayers();
    } catch (error) {
      alert('Lỗi khi thêm VĐV: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeletePlayer = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa VĐV này?')) return;

    try {
      await tournamentPlayersApi.delete(id);
      await loadPlayers();
    } catch (error) {
      alert('Lỗi khi xóa VĐV: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Đảm bảo có danh sách được chọn
    let listId = selectedListId;
    if (!listId) {
      // Nếu chưa có danh sách, tạo danh sách mặc định
      try {
        const newListResponse = await playerListsApi.create({ 
          name: 'Danh sách mặc định', 
          is_default: true 
        });
        listId = newListResponse.data.id;
        setSelectedListId(listId);
        await loadPlayerLists(); // Reload để cập nhật danh sách
      } catch (createError) {
        alert('Vui lòng tạo danh sách trước khi import VĐV: ' + (createError.response?.data?.message || createError.message));
        return;
      }
    }

    try {
      const response = await tournamentPlayersApi.import(listId, file);
      alert(`Đã import ${response.data.imported} VĐV thành công`);
      if (response.data.errors && response.data.errors.length > 0) {
        console.warn('Import errors:', response.data.errors);
      }
      setShowImportModal(false);
      await loadPlayers();
    } catch (error) {
      alert('Lỗi khi import: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleOrganizeBrackets = async (e) => {
    e.preventDefault();
    
    // Đảm bảo có danh sách được chọn
    let listId = selectedListId;
    if (!listId) {
      // Nếu chưa có danh sách, tạo danh sách mặc định
      try {
        const newListResponse = await playerListsApi.create({ 
          name: 'Danh sách mặc định', 
          is_default: true 
        });
        listId = newListResponse.data.id;
        setSelectedListId(listId);
        await loadPlayerLists(); // Reload để cập nhật danh sách
      } catch (createError) {
        alert('Vui lòng tạo danh sách trước khi xếp bảng: ' + (createError.response?.data?.message || createError.message));
        return;
      }
    }

    try {
      // Đảm bảo player_list_id được gửi trong body
      const requestData = {
        ...organizeFormData,
        player_list_id: listId,
      };
      const response = await bracketsApi.organize(listId, requestData);
      alert(response.data.message);
      setShowOrganizeModal(false);
      await loadBrackets();
      setActiveTab('brackets');
    } catch (error) {
      alert('Lỗi khi xếp bảng: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteBrackets = async () => {
    if (!confirm('Bạn có chắc muốn xóa tất cả các bảng? Điều này sẽ không xóa VĐV.')) return;

    try {
      await bracketsApi.deleteAll(selectedListId);
      await loadBrackets();
    } catch (error) {
      alert('Lỗi khi xóa bảng: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleExportBrackets = async () => {
    if (!bracketsContainerRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(bracketsContainerRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = 'bang-thi-dau.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Export image error', error);
      alert('Xuất ảnh bảng thi đấu thất bại. Vui lòng thử lại.');
    }
  };

  const availablePlayers = players.filter(p => !p.brackets || p.brackets.length === 0);
  const assignedPlayers = players.filter(p => p.brackets && p.brackets.length > 0);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-sm text-slate-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 sm:px-0">
      {/* Header */}
      <PageHeader
        title="Quản lý & Xếp bảng thi đấu"
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
                onClick={handleCreateList}
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
              onClick={() => setShowAddPlayerForm(true)}
              className="btn btn-primary w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Thêm VĐV thủ công
            </button>
            <button
              onClick={() => setShowImportModal(true)}
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
                            onClick={() => handleDeletePlayer(player.id)}
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

              {/* Players cards (mobile) */}
              <div className="space-y-3 md:hidden">
                {players.map((player, idx) => (
                  <div
                    key={player.id}
                    className={`card !p-4 ${player.gender === 'male' ? '!bg-sky-50/50' : '!bg-rose-50/40'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="font-tabular mt-0.5 w-6 flex-shrink-0 text-sm font-semibold text-slate-500">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h3 className="break-words text-base font-semibold text-slate-900">{player.name}</h3>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {player.gender === 'male' ? 'Nam' : 'Nữ'} · Level{' '}
                            <span className="font-tabular">{player.level || '-'}</span>
                          </p>
                        </div>
                      </div>
                      {player.brackets && player.brackets.length > 0 ? (
                        <span className="badge badge-emerald flex-shrink-0">Đã xếp bảng</span>
                      ) : (
                        <span className="badge badge-amber flex-shrink-0">Chưa xếp</span>
                      )}
                    </div>
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <button
                        onClick={() => handleDeletePlayer(player.id)}
                        disabled={player.brackets && player.brackets.length > 0}
                        className="btn btn-danger-soft btn-sm w-full"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Brackets Tab */}
      {activeTab === 'brackets' && (
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => setShowOrganizeModal(true)}
              className="btn btn-primary w-full sm:w-auto"
              disabled={!canOrganize || availablePlayers.length === 0}
            >
              <Target className="h-4 w-4" />
              Xếp bảng
            </button>
            {brackets.length > 0 && (
              <button
                onClick={handleDeleteBrackets}
                className="btn btn-danger w-full sm:w-auto"
                disabled={!canDeleteBrackets}
              >
                Xóa tất cả
              </button>
            )}
            {brackets.length > 0 && (
              <button
                onClick={handleExportBrackets}
                className="btn btn-secondary w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Xuất bảng
              </button>
            )}
          </div>

          {/* Brackets Grid */}
          {brackets.length > 0 ? (
            <div ref={bracketsContainerRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {([...brackets].sort((a, b) => {
                const order = { male_only: 0, female_only: 1, mixed: 2 };
                return (order[a.gender_distribution] ?? 3) - (order[b.gender_distribution] ?? 3);
              })).map((bracket) => {
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
        </div>
      )}

      {/* Add Player Form Modal */}
      <Modal
        isOpen={showAddPlayerForm}
        onClose={() => setShowAddPlayerForm(false)}
        title="Thêm VĐV"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowAddPlayerForm(false)}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="add-tournament-player-form"
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
        </div>
      </Modal>

      {/* Organize Brackets Modal */}
      <Modal
        isOpen={showOrganizeModal}
        onClose={() => setShowOrganizeModal(false)}
        title="Xếp bảng thi đấu"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowOrganizeModal(false)}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="organize-brackets-form"
              className="btn btn-primary flex-1 sm:flex-none"
            >
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
              <option value="mixed">Chia đều giới tính</option>
              <option value="male_only">Chỉ nam</option>
              <option value="female_only">Chỉ nữ</option>
            </select>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p>Lưu ý: Chỉ các VĐV chưa được xếp bảng mới được xếp vào bảng mới.</p>
            <p className="mt-1">Hiện có {availablePlayers.length} VĐV chưa xếp bảng.</p>
          </div>
        </form>
      </Modal>
    </div>
  );
}
