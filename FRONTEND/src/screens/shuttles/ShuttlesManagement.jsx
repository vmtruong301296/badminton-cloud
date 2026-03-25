import { useState, useEffect } from 'react';
import { shuttlesApi } from '../../services/api';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useAuth } from '../../contexts/AuthContext';

const BALLS_PER_TUBE = 12;

function todayInputDate() {
  return new Date().toISOString().split('T')[0];
}

export default function ShuttlesManagement() {
  const { hasPermission } = useAuth();
  const [shuttles, setShuttles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingShuttle, setEditingShuttle] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
  });

  const [stockModalShuttle, setStockModalShuttle] = useState(null);
  const [stockForm, setStockForm] = useState({ tubes: 0, balls: 0, entered_at: todayInputDate() });
  const [stockSaving, setStockSaving] = useState(false);

  const [historyModalShuttle, setHistoryModalShuttle] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadShuttles();
  }, []);

  const loadShuttles = async () => {
    try {
      setLoading(true);
      const response = await shuttlesApi.getAll();
      setShuttles(response.data);
    } catch (error) {
      console.error('Error loading shuttles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (shuttle) => {
    setEditingShuttle(shuttle);
    setFormData({ name: shuttle.name, price: shuttle.price });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingShuttle) {
        await shuttlesApi.update(editingShuttle.id, formData);
      } else {
        await shuttlesApi.create(formData);
      }
      setShowForm(false);
      setEditingShuttle(null);
      setFormData({ name: '', price: 0 });
      loadShuttles();
    } catch (error) {
      console.error('Error saving shuttle:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    try {
      await shuttlesApi.delete(id);
      loadShuttles();
    } catch (error) {
      console.error('Error deleting shuttle:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const openStockModal = (shuttle) => {
    setStockForm({ tubes: 0, balls: 0, entered_at: todayInputDate() });
    setStockModalShuttle(shuttle);
  };

  const submitStock = async (e) => {
    e.preventDefault();
    if (!stockModalShuttle) return;
    const tubes = Number(stockForm.tubes) || 0;
    const balls = Number(stockForm.balls) || 0;
    if (tubes * BALLS_PER_TUBE + balls <= 0) {
      alert('Nhập ít nhất số ống hoặc số quả.');
      return;
    }
    try {
      setStockSaving(true);
      await shuttlesApi.addStockEntry(stockModalShuttle.id, {
        tubes,
        balls,
        entered_at: stockForm.entered_at || undefined,
      });
      setStockModalShuttle(null);
      loadShuttles();
    } catch (error) {
      console.error('Error adding stock:', error);
      const msg = error.response?.data?.message || error.response?.data?.error || 'Có lỗi xảy ra';
      alert(msg);
    } finally {
      setStockSaving(false);
    }
  };

  const openHistoryModal = async (shuttle) => {
    setHistoryModalShuttle(shuttle);
    setHistoryEntries([]);
    try {
      setHistoryLoading(true);
      const res = await shuttlesApi.getStockEntries(shuttle.id);
      setHistoryEntries(res.data || []);
    } catch (error) {
      console.error('Error loading stock history:', error);
      alert('Không tải được lịch sử nhập kho');
    } finally {
      setHistoryLoading(false);
    }
  };

  const stockPreviewTotal = (tubes, balls) =>
    (Number(tubes) || 0) * BALLS_PER_TUBE + (Number(balls) || 0);

  const canEditStock = hasPermission('shuttles.update');

  return (
    <div className="px-2 sm:px-0">
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold">Quản lý Loại quả cầu</h2>
        {hasPermission('shuttles.create') && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingShuttle(null);
              setFormData({ name: '', price: 0 });
            }}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base whitespace-nowrap"
          >
            + Thêm loại cầu
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">
              {editingShuttle ? 'Sửa loại cầu' : 'Thêm loại cầu'}
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
                    setEditingShuttle(null);
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

      {stockModalShuttle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-1">Nhập kho — {stockModalShuttle.name}</h3>
            <p className="text-sm text-gray-600 mb-4">1 ống = {BALLS_PER_TUBE} quả</p>
            <form onSubmit={submitStock} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Số ống</label>
                  <input
                    type="number"
                    min={0}
                    value={stockForm.tubes}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, tubes: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Số quả (lẻ)</label>
                  <input
                    type="number"
                    min={0}
                    value={stockForm.balls}
                    onChange={(e) =>
                      setStockForm({ ...stockForm, balls: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ngày nhập</label>
                <input
                  type="date"
                  value={stockForm.entered_at}
                  onChange={(e) => setStockForm({ ...stockForm, entered_at: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Tổng nhập:{' '}
                <strong>{formatNumber(stockPreviewTotal(stockForm.tubes, stockForm.balls))}</strong> quả
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setStockModalShuttle(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                  disabled={stockSaving}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={stockSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {stockSaving ? 'Đang lưu...' : 'Lưu nhập kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyModalShuttle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-start mb-4 gap-2">
              <h3 className="text-lg font-semibold">Lịch sử nhập kho — {historyModalShuttle.name}</h3>
              <button
                type="button"
                onClick={() => setHistoryModalShuttle(null)}
                className="text-gray-500 hover:text-gray-800 px-2"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="py-8 text-center text-gray-500">Đang tải...</div>
              ) : historyEntries.length === 0 ? (
                <div className="py-8 text-center text-gray-500">Chưa có lịch sử nhập</div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="py-2 pr-2">Ngày nhập</th>
                      <th className="py-2 pr-2">Ống</th>
                      <th className="py-2 pr-2">Quả lẻ</th>
                      <th className="py-2 pr-2">Tổng quả</th>
                      <th className="py-2">Người nhập</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyEntries.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 whitespace-nowrap">{row.entered_at}</td>
                        <td className="py-2 pr-2">{row.tubes}</td>
                        <td className="py-2 pr-2">{row.balls}</td>
                        <td className="py-2 pr-2 font-medium">{formatNumber(row.total_balls)}</td>
                        <td className="py-2 text-gray-700">{row.creator?.name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">Đang tải...</div>
      ) : (
        <>
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
                    Tồn kho (quả)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shuttles.map((shuttle) => (
                  <tr key={shuttle.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{shuttle.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(shuttle.price)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-semibold text-gray-900">{formatNumber(shuttle.stock_quantity ?? 0)}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {canEditStock && (
                        <>
                          <button
                            type="button"
                            onClick={() => openStockModal(shuttle)}
                            className="text-green-600 hover:text-green-900 mr-2"
                          >
                            Nhập kho
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistoryModal(shuttle)}
                            className="text-gray-700 hover:text-gray-900 mr-2"
                          >
                            Lịch sử
                          </button>
                        </>
                      )}
                      {hasPermission('shuttles.update') && (
                        <button
                          type="button"
                          onClick={() => handleEdit(shuttle)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          Sửa
                        </button>
                      )}
                      {hasPermission('shuttles.delete') && (
                        <button
                          type="button"
                          onClick={() => handleDelete(shuttle.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {shuttles.map((shuttle) => (
              <div key={shuttle.id} className="bg-white shadow rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900">{shuttle.name}</h3>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(shuttle.price)}</span>
                </div>
                <div className="text-sm text-gray-700 mb-3">
                  Tồn kho: <strong>{formatNumber(shuttle.stock_quantity ?? 0)}</strong> quả
                </div>
                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200">
                  {canEditStock && (
                    <>
                      <button
                        type="button"
                        onClick={() => openStockModal(shuttle)}
                        className="flex-1 min-w-[100px] px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      >
                        Nhập kho
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistoryModal(shuttle)}
                        className="flex-1 min-w-[100px] px-3 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm"
                      >
                        Lịch sử
                      </button>
                    </>
                  )}
                  {hasPermission('shuttles.update') && (
                    <button
                      type="button"
                      onClick={() => handleEdit(shuttle)}
                      className="flex-1 min-w-[100px] px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Sửa
                    </button>
                  )}
                  {hasPermission('shuttles.delete') && (
                    <button
                      type="button"
                      onClick={() => handleDelete(shuttle.id)}
                      className="flex-1 min-w-[100px] px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
