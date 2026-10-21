import { useState, useEffect } from 'react';
import { menusApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyInput from '../../components/common/CurrencyInput';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { Plus, Inbox } from '../../components/ui/icons';

/** Nút gạt bật/tắt: món tắt không hiện trong ô "Chọn menu" khi tạo / sửa bill. */
function ActiveToggle({ active, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      disabled={disabled}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 disabled:opacity-60 sm:min-h-0 sm:py-1"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          active ? 'bg-emerald-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            active ? 'translate-x-5' : ''
          }`}
        />
      </span>
      <span className={`text-sm ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
        {active ? 'Đang dùng' : 'Đã tắt'}
      </span>
    </button>
  );
}

export default function MenusManagement() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMenu, setEditingMenu] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
  });

  useEffect(() => {
    loadMenus();
  }, []);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const response = await menusApi.getAll();
      setMenus(response.data);
    } catch (error) {
      console.error('Error loading menus:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (menu) => {
    setEditingMenu(menu);
    setFormData({ name: menu.name, price: menu.price });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingMenu) {
        await menusApi.update(editingMenu.id, formData);
      } else {
        await menusApi.create(formData);
      }
      setShowForm(false);
      setEditingMenu(null);
      setFormData({ name: '', price: 0 });
      loadMenus();
    } catch (error) {
      console.error('Error saving menu:', error);
      alert('Có lỗi xảy ra');
    }
  };

  /** Đổi ngay trên màn rồi mới gọi API; lỗi thì trả lại trạng thái cũ. */
  const handleToggleActive = async (menu) => {
    const wasActive = menu.is_active !== false;
    const setActive = (value) =>
      setMenus((prev) => prev.map((m) => (m.id === menu.id ? { ...m, is_active: value } : m)));

    setTogglingId(menu.id);
    setActive(!wasActive);
    try {
      await menusApi.update(menu.id, { is_active: !wasActive });
    } catch (error) {
      console.error('Error toggling menu:', error);
      setActive(wasActive);
      alert('Có lỗi xảy ra');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    try {
      await menusApi.delete(id);
      loadMenus();
    } catch (error) {
      console.error('Error deleting menu:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingMenu(null);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900">Quản lý Menu nước</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingMenu(null);
            setFormData({ name: '', price: 0 });
          }}
          className="btn btn-primary flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Thêm menu
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingMenu ? 'Sửa menu' : 'Thêm menu'}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button type="button" onClick={closeForm} className="btn btn-secondary flex-1 sm:flex-none">
              Hủy
            </button>
            <button type="submit" form="menu-form" className="btn btn-primary flex-1 sm:flex-none">
              Lưu
            </button>
          </div>
        }
      >
        <form id="menu-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="menu-name" className="field-label">Tên *</label>
            <input
              id="menu-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="menu-price" className="field-label">Giá (VND) *</label>
            <CurrencyInput
              id="menu-price"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              baseClassName="field-input"
            />
          </div>
        </form>
      </Modal>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>
      ) : menus.length === 0 ? (
        <EmptyState icon={Inbox} title="Chưa có menu" />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="card hidden overflow-hidden !p-0 md:block">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500">
                  <th className="px-6 py-3 text-left font-medium">Tên</th>
                  <th className="px-6 py-3 text-right font-medium">Giá</th>
                  <th className="px-6 py-3 text-left font-medium">Trạng thái</th>
                  <th className="px-6 py-3 text-left font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {menus.map((menu) => (
                  <tr
                    key={menu.id}
                    className={`border-t border-slate-100 hover:bg-slate-50/60 ${
                      menu.is_active === false ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    <td className="max-w-[18rem] px-6 py-3 text-sm font-medium">
                      <div className="truncate" title={menu.name}>{menu.name}</div>
                    </td>
                    <td className="font-tabular whitespace-nowrap px-6 py-3 text-right text-sm">
                      {formatCurrency(menu.price)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-2">
                      <ActiveToggle
                        active={menu.is_active !== false}
                        disabled={togglingId === menu.id}
                        onToggle={() => handleToggleActive(menu)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(menu)} className="btn btn-ghost btn-sm">
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(menu.id)}
                          className="btn btn-ghost btn-sm !text-rose-600 hover:!bg-rose-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {menus.map((menu) => (
              <div key={menu.id} className="card !p-4">
                <div
                  className={`mb-2 flex items-start justify-between gap-3 ${
                    menu.is_active === false ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  <h3 className="min-w-0 break-words font-semibold">{menu.name}</h3>
                  <span className="font-tabular flex-shrink-0 text-lg font-semibold">{formatCurrency(menu.price)}</span>
                </div>
                <div className="mb-3">
                  <ActiveToggle
                    active={menu.is_active !== false}
                    disabled={togglingId === menu.id}
                    onToggle={() => handleToggleActive(menu)}
                  />
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => handleEdit(menu)} className="btn btn-secondary btn-sm flex-1">
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(menu.id)}
                    className="btn btn-secondary btn-sm flex-1 !border-rose-200 !text-rose-600 hover:!bg-rose-50"
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
  );
}
