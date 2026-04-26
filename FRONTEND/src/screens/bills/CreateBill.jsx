import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { billsApi, shuttlesApi } from '../../services/api';
import {
  calculateBillPreview,
  formatCurrencyRounded,
  formatDate,
  formatRatio,
  shuttleUnitPrice,
} from '../../utils/formatters';
import CurrencyInput from '../../components/common/CurrencyInput';
import NumberInput from '../../components/common/NumberInput';
import DatePicker from '../../components/common/DatePicker';
import PlayerSelector from '../../components/bill/PlayerSelector';
import ShuttleRow from '../../components/bill/ShuttleRow';
import MenuItemPicker from '../../components/bill/MenuItemPicker';
import BillSummary from '../../components/bill/BillSummary';

export default function CreateBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentBillId = searchParams.get('parent_id');
  const [loading, setLoading] = useState(false);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [parentBill, setParentBill] = useState(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    note: '',
    court_total: 0,
    shuttles: [],
    players: [],
    parent_bill_id: parentBillId || null,
  });

  const [preview, setPreview] = useState(null);
  const [shuttleTypesLoading, setShuttleTypesLoading] = useState(true);
  const shuttlesDefaultedRef = useRef(false);

  const loadShuttleTypesForBillDate = async (asOfDate) => {
    try {
      setShuttleTypesLoading(true);
      const response = await shuttlesApi.getAll({ params: { as_of: asOfDate } });
      setShuttleTypes(response.data);
    } catch (error) {
      console.error('Error loading shuttle types:', error);
    } finally {
      setShuttleTypesLoading(false);
    }
  };

  useEffect(() => {
    loadShuttleTypesForBillDate(formData.date);
  }, [formData.date]);

  useEffect(() => {
    if (parentBillId) {
      loadParentBill();
    }
  }, [parentBillId]);

  useEffect(() => {
    if (shuttlesDefaultedRef.current || shuttleTypes.length === 0) return;
    const s70Shuttle = shuttleTypes.find((st) => st.name === 'Cầu S70');
    shuttlesDefaultedRef.current = true;
    setFormData((prev) => {
      if (prev.shuttles.length > 0) return prev;
      return {
        ...prev,
        shuttles: s70Shuttle
          ? [
              {
                shuttle_type_id: s70Shuttle.id,
                quantity: 12,
                price: shuttleUnitPrice(s70Shuttle),
              },
            ]
          : [],
      };
    });
  }, [shuttleTypes]);

  useEffect(() => {
    updatePreview();
  }, [formData, shuttleTypes]);

  const loadParentBill = async () => {
    try {
      const response = await billsApi.getById(parentBillId);
      setParentBill(response.data);
      // Set date same as parent bill (format to YYYY-MM-DD)
      const parentDate = response.data.date;
      const formattedDate = parentDate ? formatDate(parentDate) : new Date().toISOString().split('T')[0];
      setFormData((prev) => ({
        ...prev,
        date: formattedDate,
      }));
    } catch (error) {
      console.error('Error loading parent bill:', error);
    }
  };

  const updatePreview = () => {
    // Chỉ cần players để hiển thị preview, shuttles đã có mặc định
    if (formData.players.length === 0) {
      setPreview(null);
      return;
    }

    const previewData = calculateBillPreview(
      formData.court_total,
      formData.shuttles
        .filter((s) => s.shuttle_type_id)
        .map((s) => {
          const type = shuttleTypes.find((st) => st.id === s.shuttle_type_id);
          return {
            price: shuttleUnitPrice(type),
            quantity: s.quantity || 1,
          };
        }),
      formData.players.map((p) => ({
        ...p,
        ratio_value: p.ratio_value ?? p.default_ratio_value ?? 1.0,
        menus: p.menus || [],
        debt_amount: 0,
      }))
    );
    setPreview({
      ...previewData,
      court_total: formData.court_total,
    });
  };

  const handleAddShuttle = () => {
    setFormData({
      ...formData,
      shuttles: [
        ...formData.shuttles,
        { shuttle_type_id: null, quantity: 1, price: 0 },
      ],
    });
  };

  const handleUpdateShuttle = (index, updated) => {
    const newShuttles = [...formData.shuttles];
    newShuttles[index] = updated;
    setFormData({ ...formData, shuttles: newShuttles });
  };

  const handleRemoveShuttle = (index) => {
    setFormData({
      ...formData,
      shuttles: formData.shuttles.filter((_, i) => i !== index),
    });
  };

  const handleSelectPlayer = (player) => {
    setFormData({
      ...formData,
      players: [...formData.players, player],
    });
  };

  const handleRemovePlayer = (index) => {
    setFormData({
      ...formData,
      players: formData.players.filter((_, i) => i !== index),
    });
  };

  const handleUpdatePlayer = (index, updated) => {
    const newPlayers = [...formData.players];
    newPlayers[index] = updated;
    setFormData({ ...formData, players: newPlayers });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.players.length === 0) {
      alert('Vui lòng chọn ít nhất một người chơi');
      return;
    }

    // Kiểm tra shuttles (đã có mặc định nên thường sẽ có)
    const validShuttles = formData.shuttles.filter((s) => s.shuttle_type_id);
    if (validShuttles.length === 0) {
      alert('Vui lòng thêm ít nhất một loại cầu hợp lệ');
      return;
    }

    const sumRatios = formData.players.reduce((sum, p) => {
      const ratio = p.ratio_value ?? p.default_ratio_value ?? 1.0;
      return sum + ratio;
    }, 0);
    if (sumRatios === 0) {
      alert('Tổng mức tính phải lớn hơn 0');
      return;
    }

    try {
      setLoading(true);
      
      const payload = {
        date: formData.date,
        note: formData.note || null,
        court_total: formData.court_total,
        parent_bill_id: formData.parent_bill_id || null,
        shuttles: formData.shuttles
          .filter((s) => s.shuttle_type_id)
          .map((s) => ({
            shuttle_type_id: s.shuttle_type_id,
            quantity: s.quantity || 1,
          })),
        players: formData.players.map((p) => ({
          user_id: p.user_id,
          ratio_value: p.ratio_value || null,
          menus: (p.menus || []).map((m) => ({
            menu_id: m.menu_id,
            quantity: m.quantity,
          })),
        })),
      };

      const response = await billsApi.create(payload);
      navigate(`/bills/${response.data.id}`);
    } catch (error) {
      console.error('Error creating bill:', error);
      alert('Có lỗi xảy ra khi tạo bill: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold">
          {parentBill ? `Tạo Bill con cho Bill #${parentBill.id}` : 'Tạo Bill mới'}
        </h2>
        {parentBill && (
          <button
            type="button"
            onClick={() => navigate(`/bills/${parentBill.id}`)}
            className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm sm:text-base"
          >
            ← Về Bill chính
          </button>
        )}
      </div>

      {parentBill && (
        <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6 border-2 border-blue-200">
          <p className="text-xs sm:text-sm text-blue-900">
            <strong>Bill chính:</strong> Bill #{parentBill.id} | 
            Ngày: {formatDate(parentBill.date)} | 
            Tổng tiền: {formatCurrencyRounded(parentBill.total_amount)} | 
            {parentBill.bill_players?.length || 0} người chơi
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Basic Info and Shuttles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Basic Info - Bên trái */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow md:col-span-1">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Thông tin cơ bản</h3>
                <div className="space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Ngày đánh *
                    </label>
                    <DatePicker
                      value={formData.date}
                      onChange={(value) => setFormData({ ...formData, date: value })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Tổng tiền sân (VND) *
                    </label>
                    <CurrencyInput
                      value={formData.court_total}
                      onChange={(value) => setFormData({ ...formData, court_total: value })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Ghi chú
                    </label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      rows={1}
                    />
                  </div>
                </div>
              </div>

              {/* Shuttles - Bên phải */}
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow md:col-span-2">
                <div className="flex flex-row justify-between items-center mb-3 sm:mb-4 gap-2 sm:gap-0">
                  <h3 className="text-base sm:text-lg font-semibold">Loại cầu</h3>
                  <button
                    type="button"
                    onClick={handleAddShuttle}
                    className="px-3 sm:px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm sm:text-base whitespace-nowrap"
                  >
                    + Thêm cầu
                  </button>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  {formData.shuttles.map((shuttle, index) => (
                    <ShuttleRow
                      key={index}
                      shuttle={shuttle}
                      shuttleTypes={shuttleTypes}
                      typesLoading={shuttleTypesLoading}
                      onUpdate={(updated) => handleUpdateShuttle(index, updated)}
                      onRemove={() => handleRemoveShuttle(index)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Players */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Người chơi</h3>
              
              {/* Phần chọn người chơi - 2 cột */}
              <div className="mb-4 sm:mb-6">
                <PlayerSelector
                  selectedPlayers={formData.players}
                  onSelect={handleSelectPlayer}
                  onRemove={handleRemovePlayer}
                />
              </div>

              {/* Phần chi tiết từng người chơi đã chọn */}
              {formData.players.length > 0 && (
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
                  <h4 className="text-sm sm:text-md font-semibold mb-3 sm:mb-4 text-gray-700">
                    Chi tiết người chơi ({formData.players.length})
                  </h4>
                  <div className="space-y-3 sm:space-y-4">
                    {formData.players.map((player, index) => (
                      <div key={index} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                          {/* Bên trái: Tên, giới tính, mức tính */}
                          <div className="md:col-span-1">
                            <div className="mb-3 sm:mb-4">
                              <h4 className="font-semibold text-base sm:text-lg text-gray-900 mb-2">{player.name}</h4>
                              <div className="text-xs sm:text-sm text-gray-600 mb-3">
                                <span className="mr-3">
                                  Giới tính: <span className="font-medium">{player.gender === 'male' ? 'Nam' : player.gender === 'female' ? 'Nữ' : '-'}</span>
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                                Mức tính (override)
                              </label>
                              <NumberInput
                                value={player.ratio_value ?? player.default_ratio_value ?? 1.0}
                                onChange={(value) =>
                                  handleUpdatePlayer(index, { ...player, ratio_value: value })
                                }
                                min={0}
                                step={0.1}
                                className="w-full"
                              />
                              <div className="text-xs text-gray-500 mt-1">
                                Mặc định: {formatRatio(player.default_ratio_value ?? 1.0)}
                              </div>
                            </div>
                          </div>

                          {/* Bên phải: Menu nước */}
                          <div className="md:col-span-2">
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                              Menu nước
                            </label>
                            <MenuItemPicker
                              player={player}
                              onUpdate={(updated) => handleUpdatePlayer(index, updated)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm sm:text-base"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Đang tạo...' : 'Tạo Bill'}
              </button>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <BillSummary preview={preview} />
          </div>
        </div>
      </form>
    </div>
  );
}

