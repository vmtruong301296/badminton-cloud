import { useState, useEffect } from 'react';
import { menusApi } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import CurrencyInput from '../../components/common/CurrencyInput';

/** Nút gạt bật/tắt: món tắt không hiện trong ô "Chọn menu" khi tạo / sửa bill. */
function ActiveToggle({ active, disabled, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={onToggle}
      disabled={disabled}
      className="inline-flex items-center gap-2 py-1 disabled:opacity-60"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          active ? 'bg-green-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            active ? 'translate-x-5' : ''
          }`}
        />
      </span>
      <span className={`text-sm ${active ? 'text-green-700' : 'text-gray-500'}`}>
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

  return (
    <div className="px-2 sm:px-0">
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold">Quản lý Menu nước</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingMenu(null);
            setFormData({ name: '', price: 0 });
          }}
          className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base whitespace-nowrap"
        >
          + Thêm menu
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {editingMenu ? 'Sửa menu' : 'Thêm menu'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tên *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Giá (VND) *</label>
                <CurrencyInput
                  value={formData.price}
                  onChange={(value) => setFormData({ ...formData, price: value })}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingMenu(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Đang tải...</div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Giá
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {menus.map((menu) => (
                  <tr key={menu.id} className={menu.is_active === false ? 'text-gray-400' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{menu.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(menu.price)}</td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <ActiveToggle
                        active={menu.is_active !== false}
                        disabled={togglingId === menu.id}
                        onToggle={() => handleToggleActive(menu)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(menu)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(menu.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {menus.map((menu) => (
              <div key={menu.id} className="bg-white shadow rounded-lg p-4">
                <div
                  className={`flex justify-between items-start mb-2 ${
                    menu.is_active === false ? 'text-gray-400' : 'text-gray-900'
                  }`}
                >
                  <h3 className="font-semibold">{menu.name}</h3>
                  <span className="text-lg font-bold">{formatCurrency(menu.price)}</span>
                </div>
                <div className="mb-3">
                  <ActiveToggle
                    active={menu.is_active !== false}
                    disabled={togglingId === menu.id}
                    onToggle={() => handleToggleActive(menu)}
                  />
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleEdit(menu)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(menu.id)}
                    className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
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

