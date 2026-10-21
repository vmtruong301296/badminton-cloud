import { useState, useEffect } from 'react';
import { ratiosApi } from '../../services/api';
import { formatRatio } from '../../utils/formatters';
import NumberInput from '../../components/common/NumberInput';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { Plus, Inbox } from '../../components/ui/icons';

export default function RatiosManagement() {
  const [ratios, setRatios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRatio, setEditingRatio] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    value: 1.0,
    is_default: false,
  });

  useEffect(() => {
    loadRatios();
  }, []);

  const loadRatios = async () => {
    try {
      setLoading(true);
      const response = await ratiosApi.getAll();
      setRatios(response.data);
    } catch (error) {
      console.error('Error loading ratios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (ratio) => {
    setEditingRatio(ratio);
    setFormData({
      name: ratio.name,
      gender: ratio.gender || '',
      value: ratio.value,
      is_default: ratio.is_default || false,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingRatio) {
        await ratiosApi.update(editingRatio.id, formData);
      } else {
        await ratiosApi.create(formData);
      }
      setShowForm(false);
      setEditingRatio(null);
      setFormData({ name: '', gender: '', value: 1.0, is_default: false });
      loadRatios();
    } catch (error) {
      console.error('Error saving ratio:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Bạn có chắc muốn xóa?')) return;
    try {
      await ratiosApi.delete(id);
      loadRatios();
    } catch (error) {
      console.error('Error deleting ratio:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRatio(null);
  };

  const genderLabel = (gender) =>
    gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : 'Chung';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900">Quản lý Mức tính</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingRatio(null);
            setFormData({ name: '', gender: '', value: 1.0, is_default: false });
          }}
          className="btn btn-primary flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Thêm mức tính
        </button>
      </div>

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingRatio ? 'Sửa mức tính' : 'Thêm mức tính'}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button type="button" onClick={closeForm} className="btn btn-secondary flex-1 sm:flex-none">
              Hủy
            </button>
            <button type="submit" form="ratio-form" className="btn btn-primary flex-1 sm:flex-none">
              Lưu
            </button>
          </div>
        }
      >
        <form id="ratio-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ratio-name" className="field-label">Tên *</label>
            <input
              id="ratio-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="ratio-gender" className="field-label">Giới tính</label>
            <select
              id="ratio-gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              className="field-input"
            >
              <option value="">Chung</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label htmlFor="ratio-value" className="field-label">Giá trị *</label>
            <NumberInput
              id="ratio-value"
              value={formData.value}
              onChange={(value) => setFormData({ ...formData, value })}
              min={0}
              step={0.1}
              className="field-input"
            />
          </div>
          <label
            htmlFor="ratio-default"
            className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-slate-700"
          >
            <input
              id="ratio-default"
              type="checkbox"
              checked={formData.is_default}
              onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
              className="h-5 w-5 flex-shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600/40"
            />
            <span>Mặc định cho giới tính</span>
          </label>
        </form>
      </Modal>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>
      ) : ratios.length === 0 ? (
        <EmptyState icon={Inbox} title="Chưa có mức tính" />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="card hidden overflow-hidden !p-0 md:block">
            <table className="min-w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-6 py-3 font-medium">Tên</th>
                  <th className="px-6 py-3 font-medium">Giới tính</th>
                  <th className="px-6 py-3 font-medium">Giá trị</th>
                  <th className="px-6 py-3 font-medium">Mặc định</th>
                  <th className="px-6 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {ratios.map((ratio) => (
                  <tr key={ratio.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="max-w-[18rem] px-6 py-3 text-sm font-medium text-slate-900">
                      <div className="truncate" title={ratio.name}>{ratio.name}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm text-slate-700">
                      {genderLabel(ratio.gender)}
                    </td>
                    <td className="font-tabular whitespace-nowrap px-6 py-3 text-sm text-slate-700">
                      {formatRatio(ratio.value)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-sm">
                      {ratio.is_default ? (
                        <span className="font-semibold text-emerald-700">✓</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(ratio)} className="btn btn-ghost btn-sm">
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(ratio.id)}
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
            {ratios.map((ratio) => (
              <div key={ratio.id} className="card !p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-slate-900">{ratio.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{genderLabel(ratio.gender)}</p>
                  </div>
                  {ratio.is_default && (
                    <span className="badge badge-emerald flex-shrink-0">Mặc định</span>
                  )}
                </div>
                <div className="mb-3 text-sm text-slate-600">
                  Giá trị: <span className="font-tabular font-medium text-slate-900">{formatRatio(ratio.value)}</span>
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button onClick={() => handleEdit(ratio)} className="btn btn-secondary btn-sm flex-1">
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(ratio.id)}
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
