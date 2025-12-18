import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { billsApi, shuttlesApi } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import CurrencyInput from '../../components/common/CurrencyInput';
import NumberInput from '../../components/common/NumberInput';
import DatePicker from '../../components/common/DatePicker';
import PlayerSelector from '../../components/bill/PlayerSelector';
import ShuttleRow from '../../components/bill/ShuttleRow';
import MenuItemPicker from '../../components/bill/MenuItemPicker';
import BillSummary from '../../components/bill/BillSummary';

export default function EditBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [shuttleTypes, setShuttleTypes] = useState([]);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    note: '',
    court_total: 0,
    shuttles: [],
    players: [],
    parent_bill_id: null,
  });

  const [preview, setPreview] = useState(null);

  const loadInitialData = useCallback(async () => {
    try {
      setInitialLoading(true);
      const [shuttlesRes, billRes] = await Promise.all([
        shuttlesApi.getAll(),
        billsApi.getById(id),
      ]);

      const shuttleTypesData = shuttlesRes.data;
      const bill = billRes.data;

      // Map shuttles
      const mappedShuttles = (bill.bill_shuttles || []).map((s) => ({
        shuttle_type_id: s.shuttle_type_id,
        quantity: s.quantity,
        price: s.price_each,
      }));

      // Map players
      const mappedPlayers = (bill.bill_players || []).map((p) => ({
        user_id: p.user_id,
        name: p.user?.name,
        gender: p.user?.gender,
        ratio_value: p.ratio_value,
        default_ratio_value: p.ratio_value ?? 1.0,
        debt_amount: 0,
        debt_date: null,
        include_debt: false,
        menus: (p.bill_player_menus || []).map((m) => ({
          menu_id: m.menu_id,
          name: m.menu?.name,
          price: m.price_each,
          quantity: m.quantity,
          subtotal: m.subtotal,
        })),
      }));

      const newFormData = {
        date: bill.date ? formatDate(bill.date) : new Date().toISOString().split('T')[0],
        note: bill.note || '',
        court_total: bill.court_total || 0,
        shuttles: mappedShuttles,
        players: mappedPlayers,
        parent_bill_id: bill.parent_bill_id || null,
      };

      // Set cả shuttleTypes và formData cùng lúc để tránh race condition
      setShuttleTypes(shuttleTypesData);
      setFormData(newFormData);

      // Tính preview ngay sau khi có đầy đủ dữ liệu
      if (mappedPlayers.length > 0) {
        // Tính tổng tiền cầu
        const shuttlePrices = mappedShuttles
          .filter((s) => s.shuttle_type_id)
          .map((s) => {
            const type = shuttleTypesData.find((st) => st.id === s.shuttle_type_id);
            const price = type?.price || s.price || 0;
            return {
              price: price,
              quantity: s.quantity || 1,
            };
          });

        const totalShuttlePrice = shuttlePrices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
        const totalAmount = (bill.court_total || 0) + totalShuttlePrice;

        // Tính tổng mức tính
        const sumRatios = mappedPlayers.reduce((sum, p) => {
          const ratio = p.ratio_value ?? p.default_ratio_value ?? 1.0;
          return sum + ratio;
        }, 0);

        // Unit price
        const unitPrice = sumRatios > 0 ? totalAmount / sumRatios : 0;

        // Tính toán cho từng người chơi
        const playersWithAmounts = mappedPlayers.map((player) => {
          const ratioValue = player.ratio_value ?? player.default_ratio_value ?? 1.0;
          const shareAmount = Math.round(ratioValue * unitPrice);
          const menuTotal = (player.menus || []).reduce((sum, m) => sum + (m.subtotal || 0), 0);
          const debtAmount = 0;
          const playerTotalAmount = shareAmount + menuTotal + debtAmount;

          return {
            ...player,
            share_amount: shareAmount,
            menu_extra_total: menuTotal,
            debt_amount: debtAmount,
            total_amount: playerTotalAmount,
          };
        });

        // Tính chênh lệch làm tròn
        const calculatedShareTotal = playersWithAmounts.reduce((sum, p) => sum + p.share_amount, 0);
        const roundingDifference = totalAmount - calculatedShareTotal;

        setPreview({
          total_shuttle_price: totalShuttlePrice,
          total_amount: totalAmount,
          sum_ratios: sumRatios,
          unit_price: unitPrice,
          players: playersWithAmounts,
          rounding_difference: roundingDifference,
          court_total: bill.court_total || 0,
        });
      } else {
        setPreview(null);
      }
    } catch (error) {
      console.error('Error loading bill for edit:', error);
      alert('Không thể tải dữ liệu bill để sửa');
      navigate('/');
    } finally {
      setInitialLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const updatePreview = useCallback(() => {
    // Không tính preview nếu chưa có players hoặc đang loading
    if (initialLoading || formData.players.length === 0) {
      if (formData.players.length === 0) {
        setPreview(null);
      }
      return;
    }

    // Tính tổng tiền cầu từ shuttleTypes hoặc từ giá đã lưu trong formData
    const shuttlePrices = formData.shuttles
      .filter((s) => s.shuttle_type_id)
      .map((s) => {
        // Ưu tiên lấy giá từ shuttleTypes nếu có, nếu không thì dùng giá đã lưu trong formData
        const type = shuttleTypes.find((st) => st.id === s.shuttle_type_id);
        const price = type?.price || s.price || 0;
        return {
          price: price,
          quantity: s.quantity || 1,
        };
      });

    // Tính tổng tiền cầu
    const totalShuttlePrice = shuttlePrices.reduce((sum, s) => sum + (s.price * s.quantity), 0);
    
    // Tổng tiền = tiền sân + tiền cầu
    const totalAmount = Number(formData.court_total || 0) + totalShuttlePrice;

    // Tính tổng mức tính của tất cả người chơi
    const sumRatios = formData.players.reduce((sum, p) => {
      const ratio = Number(p.ratio_value ?? p.default_ratio_value ?? 1.0);
      return sum + ratio;
    }, 0);

    // Unit price = tổng tiền / tổng mức tính
    const unitPrice = sumRatios > 0 ? totalAmount / sumRatios : 0;

    // Tính toán cho từng người chơi
    const playersWithAmounts = formData.players.map((player) => {
      const ratioValue = player.ratio_value ?? player.default_ratio_value ?? 1.0;
      const shareAmount = Math.round(ratioValue * unitPrice);
      const menuTotal = (player.menus || []).reduce((sum, m) => sum + (m.subtotal || 0), 0);
      const debtAmount = 0; // Không tính debt khi edit
      const playerTotalAmount = shareAmount + menuTotal + debtAmount;

      return {
        ...player,
        share_amount: shareAmount,
        menu_extra_total: menuTotal,
        debt_amount: debtAmount,
        total_amount: playerTotalAmount,
      };
    });

    // Tính chênh lệch làm tròn
    const calculatedShareTotal = playersWithAmounts.reduce((sum, p) => sum + p.share_amount, 0);
    const roundingDifference = totalAmount - calculatedShareTotal;

    setPreview({
      total_shuttle_price: totalShuttlePrice,
      total_amount: totalAmount,
      sum_ratios: sumRatios,
      unit_price: unitPrice,
      players: playersWithAmounts,
      rounding_difference: roundingDifference,
      court_total: formData.court_total,
    });
  }, [formData, shuttleTypes, initialLoading]);

  useEffect(() => {
    // Chỉ update preview khi không phải đang loading ban đầu
    if (!initialLoading) {
      updatePreview();
    }
  }, [updatePreview, initialLoading]);

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

    if (formData.players.length === 0) {
      alert('Vui lòng chọn ít nhất một người chơi');
      return;
    }

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

      const response = await billsApi.update(id, payload);
      navigate(`/bills/${response.data.id}`);
    } catch (error) {
      console.error('Error updating bill:', error);
      alert('Có lỗi xảy ra khi cập nhật bill: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div className="text-center py-8">Đang tải dữ liệu bill...</div>;
  }

  return (
    <div className="px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-bold">
          Sửa Bill #{id}
        </h2>
        <button
          type="button"
          onClick={() => navigate(`/bills/${id}`)}
          className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm sm:text-base"
        >
          ← Về chi tiết Bill
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Basic Info and Shuttles */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Basic Info - Left */}
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

              {/* Shuttles - Right */}
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

              {/* Player selector */}
              <div className="mb-4 sm:mb-6">
                <PlayerSelector
                  selectedPlayers={formData.players}
                  onSelect={handleSelectPlayer}
                  onRemove={handleRemovePlayer}
                />
              </div>

              {/* Player details */}
              {formData.players.length > 0 && (
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t">
                  <h4 className="text-sm sm:text-md font-semibold mb-3 sm:mb-4 text-gray-700">
                    Chi tiết người chơi ({formData.players.length})
                  </h4>
                  <div className="space-y-3 sm:space-y-4">
                    {formData.players.map((player, index) => (
                      <div key={index} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                          {/* Left: basic info & ratio */}
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
                            </div>
                          </div>

                          {/* Right: menu items */}
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
                onClick={() => navigate(`/bills/${id}`)}
                className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm sm:text-base"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm sm:text-base"
              >
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
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


