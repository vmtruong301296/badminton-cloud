import { useState, useEffect } from 'react';
import { playersApi, rolesApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatRatio } from '../../utils/formatters';
import CurrencyInput from '../../components/common/CurrencyInput';
import NumberInput from '../../components/common/NumberInput';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { Plus, Search, Trash2, Users } from '../../components/ui/icons';

// Màu nhãn giới tính trên thẻ điện thoại, cùng màu với thẻ người chơi ở màn bill (PlayerBillCard)
const GENDER_BADGE = {
  male: 'bg-sky-100 text-sky-700',
  female: 'bg-pink-100 text-pink-700',
};

export default function PlayersManagement() {
  const { hasPermission } = useAuth();
  // Ẩn nút theo quyền route backend (routes/api.php); Thêm giữ nguyên vì POST /players nhận cả users.view.
  const canUpdate = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');
  const canAssignRoles = hasPermission('roles.assign');
  const hasRowActions = canUpdate || canAssignRoles || canDelete;
  const [players, setPlayers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [filters, setFilters] = useState({ search: '', gender: '' });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    gender: '',
    default_ratio: '',
    phone: '',
  });
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    name: '',
    gender: 'male',
    default_ratio: 1,
  });

  useEffect(() => {
    loadPlayers();
  }, [filters]);

  // Danh sách vai trò chỉ dùng cho hộp gán vai trò; GET /roles cần roles.view hoặc roles.assign.
  useEffect(() => {
    if (!canAssignRoles) return;
    rolesApi
      .getAll()
      .then((response) => setRoles(response.data))
      .catch((error) => console.error('Error loading roles:', error));
  }, [canAssignRoles]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.gender) params.gender = filters.gender;

      const response = await playersApi.getAll(params);
      setPlayers(response.data);
    } catch (error) {
      console.error('Error loading players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (player) => {
    setEditingPlayer(player);
    setFormData({
      name: player.name,
      email: player.email,
      gender: player.gender || '',
      default_ratio: player.default_ratio || '',
      phone: player.phone || '',
      password: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!payload.password) delete payload.password;
      
      // Convert empty string to null for nullable fields
      if (payload.phone === '') {
        payload.phone = null;
      }

      if (editingPlayer) {
        await playersApi.update(editingPlayer.id, payload);
      } else {
        // Tự động tạo email và password khi thêm mới
        const slug = payload.name.trim().toLowerCase().replace(/\s+/g, '');
        payload.email = `${slug || 'player'}${Date.now()}@badminton.local`;
        payload.password = 'password';
        await playersApi.create(payload);
      }
      setShowForm(false);
      setEditingPlayer(null);
      setFormData({
        name: '',
        email: '',
        password: '',
        gender: '',
        default_ratio: '',
        phone: '',
      });
      loadPlayers();
    } catch (error) {
      console.error('Error saving player:', error);
      alert('Có lỗi xảy ra: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!quickAddData.name.trim()) {
      alert('Vui lòng nhập tên người chơi');
      return;
    }

    const slug = quickAddData.name.trim().toLowerCase().replace(/\s+/g, '');
    const email = `${slug || 'player'}${Date.now()}@badminton.local`;

    try {
      const payload = {
        name: quickAddData.name.trim(),
        gender: quickAddData.gender,
        default_ratio: quickAddData.default_ratio,
        email,
        password: 'password',
      };
      await playersApi.create(payload);
      setShowQuickAdd(false);
      setQuickAddData({
        name: '',
        gender: 'male',
        default_ratio: 1,
      });
      loadPlayers();
    } catch (error) {
      console.error('Error creating player:', error);
      alert('Không thể tạo người chơi mới. Vui lòng thử lại.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa người chơi này?')) return;
    try {
      await playersApi.delete(id);
      loadPlayers();
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const handleAssignRoles = (player) => {
    setSelectedPlayer(player);
    setSelectedRoleIds(player.roles?.map((r) => r.id) || []);
    setShowRoleModal(true);
  };

  const handleRoleSubmit = async (e) => {
    e.preventDefault();
    try {
      await playersApi.assignRoles(selectedPlayer.id, selectedRoleIds);
      setShowRoleModal(false);
      setSelectedPlayer(null);
      setSelectedRoleIds([]);
      loadPlayers();
    } catch (error) {
      console.error('Error assigning roles:', error);
      alert('Có lỗi xảy ra khi gán quyền');
    }
  };

  const toggleRole = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPlayer(null);
  };

  const closeRoleModal = () => {
    setShowRoleModal(false);
    setSelectedPlayer(null);
    setSelectedRoleIds([]);
  };

  const genderLabel = (gender) =>
    gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : '-';

  const renderRoles = (player, emptyClass) =>
    player.roles && player.roles.length > 0 ? (
      player.roles.map((role) => (
        <span key={role.id} className="badge badge-sky">
          {role.display_name}
        </span>
      ))
    ) : (
      <span className={emptyClass}>Chưa có quyền</span>
    );

  const hasFilter = Boolean(filters.search || filters.gender);

  return (
    <div className="px-4 sm:px-0">
      <PageHeader
        title="Người chơi"
        actions={
          <>
            <button
              onClick={() => {
                setShowQuickAdd(true);
                setQuickAddData({
                  name: '',
                  gender: 'male',
                  default_ratio: 1,
                });
              }}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              Thêm nhanh
            </button>
            <button
              onClick={() => {
                setShowForm(true);
                setEditingPlayer(null);
                setFormData({
                  name: '',
                  email: '',
                  password: '',
                  gender: '',
                  default_ratio: '',
                  phone: '',
                });
              }}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              Thêm
            </button>
          </>
        }
      />

      {/* Filters: điện thoại một hàng (ô tìm + ô giới tính), không khung thẻ; từ md giữ thẻ 2 cột */}
      <div className="mb-4 md:card md:mb-5 md:!p-4">
        <div className="flex gap-2 md:grid md:grid-cols-2 md:gap-4">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="player-search" className="sr-only">
              Tìm kiếm tên
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="player-search"
              type="text"
              placeholder="Tìm kiếm tên..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="field-input !pl-9"
            />
          </div>
          <div>
            <label htmlFor="player-gender-filter" className="sr-only">
              Giới tính
            </label>
            <select
              id="player-gender-filter"
              value={filters.gender}
              onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
              className="field-input w-auto md:w-full"
            >
              <option value="">Tất cả giới tính</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Add Modal */}
      <Modal
        isOpen={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        title="Thêm nhanh người chơi"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="quick-add-form"
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Lưu
            </button>
          </div>
        }
      >
        <form id="quick-add-form" onSubmit={handleQuickAdd} className="space-y-4">
          <div>
            <label htmlFor="quick-add-name" className="field-label">Tên</label>
            <input
              id="quick-add-name"
              type="text"
              value={quickAddData.name}
              onChange={(e) => setQuickAddData({ ...quickAddData, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAdd(e);
                }
              }}
              className="field-input"
              placeholder="Nhập tên người chơi"
              autoFocus
              required
            />
          </div>
          <div>
            <label htmlFor="quick-add-gender" className="field-label">Giới tính</label>
            <select
              id="quick-add-gender"
              value={quickAddData.gender}
              onChange={(e) => setQuickAddData({ ...quickAddData, gender: e.target.value })}
              className="field-input"
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label htmlFor="quick-add-ratio" className="field-label">Mức tính mặc định</label>
            <NumberInput
              id="quick-add-ratio"
              value={quickAddData.default_ratio}
              onChange={(value) => setQuickAddData({ ...quickAddData, default_ratio: value })}
              min={0}
              step={0.1}
              baseClassName="field-input"
            />
          </div>
          <p className="text-xs text-slate-500">
            Ghi chú: tài khoản tạo nhanh dùng mật khẩu mặc định "password".
          </p>
        </form>
      </Modal>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingPlayer ? 'Sửa người chơi' : 'Thêm người chơi'}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={closeForm}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="player-form"
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Lưu
            </button>
          </div>
        }
      >
        <form id="player-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="player-name" className="field-label">Tên *</label>
            <input
              id="player-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="field-input"
            />
          </div>
          {editingPlayer && (
            <>
              <div>
                <label htmlFor="player-email" className="field-label">Email *</label>
                <input
                  id="player-email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="field-input"
                  placeholder="Nhập email"
                />
                {editingPlayer.email && (
                  <p className="mt-1 break-all text-xs text-slate-500">Email hiện tại: {editingPlayer.email}</p>
                )}
              </div>
              <div>
                <label htmlFor="player-password" className="field-label">Mật khẩu mới (để trống nếu không đổi)</label>
                <input
                  id="player-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="field-input"
                  placeholder="Nhập mật khẩu mới"
                />
              </div>
            </>
          )}
          <div>
            <label htmlFor="player-gender" className="field-label">Giới tính</label>
            <select
              id="player-gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="field-input"
            >
              <option value="">Chọn giới tính</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label htmlFor="player-ratio" className="field-label">Mức tính mặc định</label>
            <NumberInput
              id="player-ratio"
              value={formData.default_ratio}
              onChange={(value) => setFormData({ ...formData, default_ratio: value })}
              min={0}
              step={0.1}
              baseClassName="field-input"
            />
          </div>
          {editingPlayer && (
            <div>
              <label htmlFor="player-phone" className="field-label">Số điện thoại</label>
              <input
                id="player-phone"
                type="text"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="field-input"
              />
            </div>
          )}
        </form>
      </Modal>

      {/* Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>
      ) : players.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilter ? 'Không tìm thấy người chơi' : 'Chưa có người chơi'}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="card hidden overflow-hidden !p-0 md:block">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-6 py-3 font-medium">Tên</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Giới tính</th>
                  <th className="px-6 py-3 font-medium">Mức tính</th>
                  <th className="px-6 py-3 font-medium">Quyền</th>
                  {hasRowActions && <th className="px-6 py-3 font-medium">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {players.map((player) => (
                  <tr key={player.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="max-w-[16rem] px-6 py-3 text-sm font-medium text-slate-900">
                      <div className="truncate" title={player.name}>{player.name}</div>
                    </td>
                    <td className="max-w-[16rem] px-6 py-3 text-sm text-slate-600">
                      <div className="truncate" title={player.email || ''}>{player.email || '-'}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-700">
                      {genderLabel(player.gender)}
                    </td>
                    <td className="font-tabular whitespace-nowrap px-6 py-3 text-sm text-slate-700">
                      {player.default_ratio ? formatRatio(player.default_ratio) : 'Mặc định'}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1">
                        {renderRoles(player, 'text-sm text-slate-400')}
                      </div>
                    </td>
                    {hasRowActions && (
                      <td className="whitespace-nowrap px-6 py-3">
                        <div className="flex items-center gap-1">
                          {canUpdate && (
                            <button
                              onClick={() => handleEdit(player)}
                              className="btn btn-ghost btn-sm"
                            >
                              Sửa
                            </button>
                          )}
                          {canAssignRoles && (
                            <button
                              onClick={() => handleAssignRoles(player)}
                              className="btn btn-ghost btn-sm"
                            >
                              Quyền
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(player.id)}
                              className="btn btn-danger-ghost btn-sm"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View: tên + mức tính, một hàng nhãn (giới tính, nợ, quyền), một hàng nút */}
          <div className="space-y-3 md:hidden">
            {players.map((player) => (
              <div key={player.id} className="card !p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 break-words text-base font-semibold text-slate-900">{player.name}</h3>
                  {player.default_ratio ? (
                    <span className="font-tabular flex-shrink-0 text-sm font-semibold text-slate-900">
                      ×{formatRatio(player.default_ratio)}
                    </span>
                  ) : (
                    <span className="flex-shrink-0 text-sm text-slate-500">Mặc định</span>
                  )}
                </div>
                {(GENDER_BADGE[player.gender] || player.current_debt_amount > 0 || player.roles?.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {GENDER_BADGE[player.gender] && (
                      <span className={`badge ${GENDER_BADGE[player.gender]}`}>{genderLabel(player.gender)}</span>
                    )}
                    {player.current_debt_amount > 0 && (
                      <span className="font-tabular text-sm font-medium text-rose-600">
                        Nợ: {formatCurrency(player.current_debt_amount)}
                      </span>
                    )}
                    {player.roles?.map((role) => (
                      <span key={role.id} className="badge badge-slate">
                        {role.display_name}
                      </span>
                    ))}
                  </div>
                )}
                {hasRowActions && (
                  <div className="mt-3 flex gap-2">
                    {canUpdate && (
                      <button
                        onClick={() => handleEdit(player)}
                        className="btn btn-secondary btn-sm flex-1"
                      >
                        Sửa
                      </button>
                    )}
                    {canAssignRoles && (
                      <button
                        onClick={() => handleAssignRoles(player)}
                        className="btn btn-secondary btn-sm flex-1"
                      >
                        Quyền
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(player.id)}
                        className="btn btn-danger-soft btn-sm btn-icon"
                        aria-label={`Xóa ${player.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Role Assignment Modal */}
      <Modal
        isOpen={showRoleModal && Boolean(selectedPlayer)}
        onClose={closeRoleModal}
        title={`Gán quyền cho: ${selectedPlayer?.name ?? ''}`}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={closeRoleModal}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="role-assign-form"
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Lưu
            </button>
          </div>
        }
      >
        <form id="role-assign-form" onSubmit={handleRoleSubmit}>
          <div className="space-y-1">
            {roles.map((role) => (
              <label
                key={role.id}
                htmlFor={`assign-role-${role.id}`}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl p-2 hover:bg-slate-50"
              >
                <input
                  id={`assign-role-${role.id}`}
                  type="checkbox"
                  checked={selectedRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                  className="h-5 w-5 flex-shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600/40"
                />
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{role.display_name}</div>
                  {role.description && (
                    <div className="text-sm text-slate-500">{role.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  );
}
