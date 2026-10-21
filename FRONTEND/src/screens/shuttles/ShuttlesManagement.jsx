import { useState, useEffect } from "react";
import { shuttlesApi } from "../../services/api";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import CurrencyInput from "../../components/common/CurrencyInput";
import { useAuth } from "../../contexts/AuthContext";
import Modal from "../../components/ui/Modal";
import EmptyState from "../../components/ui/EmptyState";
import { Plus, Inbox, CircleAlert } from "../../components/ui/icons";

const BALLS_PER_TUBE = 12;
// Ngưỡng cảnh báo sắp hết cầu: TỔNG tồn dưới 10 ống
const LOW_STOCK_TUBES = 10;
const LOW_STOCK_BALLS = LOW_STOCK_TUBES * BALLS_PER_TUBE;

function todayInputDate() {
  return new Date().toISOString().split("T")[0];
}

export default function ShuttlesManagement() {
  const { hasPermission } = useAuth();
  const [shuttles, setShuttles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingShuttle, setEditingShuttle] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    price: 0,
  });

  const [stockModalShuttle, setStockModalShuttle] = useState(null);
  const [stockForm, setStockForm] = useState({
    tubes: 0,
    balls: 0,
    entered_at: todayInputDate(),
  });
  const [stockSaving, setStockSaving] = useState(false);

  const [historyModalShuttle, setHistoryModalShuttle] = useState(null);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [priceModalShuttle, setPriceModalShuttle] = useState(null);
  const [priceRows, setPriceRows] = useState([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [newPriceForm, setNewPriceForm] = useState({
    effective_from: todayInputDate(),
    price: 0,
  });

  useEffect(() => {
    loadShuttles();
  }, []);

  const loadShuttles = async () => {
    try {
      setLoading(true);
      const response = await shuttlesApi.getAll();
      setShuttles(response.data);
    } catch (error) {
      console.error("Error loading shuttles:", error);
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
      setFormData({ name: "", price: 0 });
      loadShuttles();
    } catch (error) {
      console.error("Error saving shuttle:", error);
      alert("Có lỗi xảy ra");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Bạn có chắc muốn xóa?")) return;
    try {
      await shuttlesApi.delete(id);
      loadShuttles();
    } catch (error) {
      console.error("Error deleting shuttle:", error);
      alert("Có lỗi xảy ra");
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
      alert("Nhập ít nhất số ống hoặc số quả.");
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
      console.error("Error adding stock:", error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Có lỗi xảy ra";
      alert(msg);
    } finally {
      setStockSaving(false);
    }
  };

  const openPriceModal = async (shuttle) => {
    setPriceModalShuttle(shuttle);
    setPriceRows([]);
    setNewPriceForm({
      effective_from: todayInputDate(),
      price: shuttle.price || 0,
    });
    try {
      setPriceLoading(true);
      const res = await shuttlesApi.getPrices(shuttle.id);
      setPriceRows(res.data || []);
    } catch (error) {
      console.error("Error loading price tiers:", error);
      alert("Không tải được lịch giá");
    } finally {
      setPriceLoading(false);
    }
  };

  const submitNewPrice = async (e) => {
    e.preventDefault();
    if (!priceModalShuttle) return;
    try {
      setPriceSaving(true);
      await shuttlesApi.addPrice(priceModalShuttle.id, {
        effective_from: newPriceForm.effective_from,
        price: Number(newPriceForm.price) || 0,
      });
      const res = await shuttlesApi.getPrices(priceModalShuttle.id);
      setPriceRows(res.data || []);
      await loadShuttles();
    } catch (error) {
      console.error("Error saving price tier:", error);
      const msg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Có lỗi xảy ra";
      alert(msg);
    } finally {
      setPriceSaving(false);
    }
  };

  const deletePriceTier = async (priceId) => {
    if (!priceModalShuttle || !confirm("Xóa mốc giá này?")) return;
    try {
      await shuttlesApi.deletePrice(priceModalShuttle.id, priceId);
      const res = await shuttlesApi.getPrices(priceModalShuttle.id);
      setPriceRows(res.data || []);
      await loadShuttles();
    } catch (error) {
      console.error("Error deleting price tier:", error);
      alert("Không xóa được mốc giá");
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
      console.error("Error loading stock history:", error);
      alert("Không tải được lịch sử nhập kho");
    } finally {
      setHistoryLoading(false);
    }
  };

  const stockPreviewTotal = (tubes, balls) =>
    (Number(tubes) || 0) * BALLS_PER_TUBE + (Number(balls) || 0);

  const canEditStock = hasPermission("shuttles.update");

  const closeForm = () => {
    setShowForm(false);
    setEditingShuttle(null);
  };

  const totalStock = shuttles.reduce(
    (sum, s) => sum + (Number(s.stock_quantity) || 0),
    0,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900">
          Quản lý Loại quả cầu
        </h2>
        {hasPermission("shuttles.create") && (
          <button
            onClick={() => {
              setShowForm(true);
              setEditingShuttle(null);
              setFormData({ name: "", price: 0 });
            }}
            className="btn btn-primary flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Thêm loại cầu
          </button>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingShuttle ? "Sửa loại cầu" : "Thêm loại cầu"}
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
              form="shuttle-form"
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Lưu
            </button>
          </div>
        }
      >
        <form id="shuttle-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="shuttle-name" className="field-label">
              Tên *
            </label>
            <input
              id="shuttle-name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="shuttle-price" className="field-label">
              Giá (VND) *
            </label>
            <CurrencyInput
              id="shuttle-price"
              value={formData.price}
              onChange={(value) => setFormData({ ...formData, price: value })}
              baseClassName="field-input"
            />
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(stockModalShuttle)}
        onClose={() => setStockModalShuttle(null)}
        title={`Nhập kho — ${stockModalShuttle?.name ?? ""}`}
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setStockModalShuttle(null)}
              className="btn btn-secondary flex-1 sm:flex-none"
              disabled={stockSaving}
            >
              Hủy
            </button>
            <button
              type="submit"
              form="stock-form"
              disabled={stockSaving}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {stockSaving ? "Đang lưu..." : "Lưu nhập kho"}
            </button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-slate-500">1 ống = {BALLS_PER_TUBE} quả</p>
        <form id="stock-form" onSubmit={submitStock} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="stock-tubes" className="field-label">
                Số ống
              </label>
              <input
                id="stock-tubes"
                type="number"
                inputMode="numeric"
                min={0}
                value={stockForm.tubes}
                onChange={(e) =>
                  setStockForm({
                    ...stockForm,
                    tubes: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="stock-balls" className="field-label">
                Số quả (lẻ)
              </label>
              <input
                id="stock-balls"
                type="number"
                inputMode="numeric"
                min={0}
                value={stockForm.balls}
                onChange={(e) =>
                  setStockForm({
                    ...stockForm,
                    balls: parseInt(e.target.value, 10) || 0,
                  })
                }
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="stock-date" className="field-label">
              Ngày nhập
            </label>
            <input
              id="stock-date"
              type="date"
              value={stockForm.entered_at}
              onChange={(e) =>
                setStockForm({ ...stockForm, entered_at: e.target.value })
              }
              className="field-input"
            />
          </div>
          <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
            Tổng nhập:{" "}
            <strong className="font-tabular">
              {formatNumber(stockPreviewTotal(stockForm.tubes, stockForm.balls))}
            </strong>{" "}
            quả
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(priceModalShuttle)}
        onClose={() => setPriceModalShuttle(null)}
        title={`Lên giá — ${priceModalShuttle?.name ?? ""}`}
        size="lg"
      >
        <p className="mb-4 text-sm text-slate-500">
          Bill dùng <strong className="text-slate-700">ngày đánh</strong> để chọn mốc giá: áp dụng mốc
          có ngày hiệu lực mới nhất không sau ngày đó.
        </p>
        {priceLoading ? (
          <div className="py-6 text-center text-sm text-slate-500">Đang tải...</div>
        ) : (
          <>
            <div className="mb-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs text-slate-500">
                    <th className="px-2 py-2 sm:px-3 font-medium">Áp dụng từ</th>
                    <th className="px-2 py-2 sm:px-3 text-right font-medium">Giá</th>
                    {hasPermission("shuttles.update") && (
                      <th className="w-16 px-2 py-2 sm:px-3" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {priceRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="font-tabular whitespace-nowrap px-3 py-1.5 text-slate-700">
                        {row.effective_from}
                      </td>
                      <td className="font-tabular px-3 py-1.5 text-right text-slate-900">
                        {formatCurrency(row.price)}
                      </td>
                      {hasPermission("shuttles.update") && (
                        <td className="px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => deletePriceTier(row.id)}
                            className="btn btn-ghost btn-sm !text-rose-600 hover:!bg-rose-50"
                          >
                            Xóa
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasPermission("shuttles.update") && (
              <form
                onSubmit={submitNewPrice}
                className="space-y-3 border-t border-slate-100 pt-4"
              >
                <p className="text-sm font-medium text-slate-900">
                  Thêm / cập nhật mốc giá
                </p>
                <div>
                  <label htmlFor="price-effective" className="field-label">
                    Ngày hiệu lực *
                  </label>
                  <input
                    id="price-effective"
                    type="date"
                    value={newPriceForm.effective_from}
                    onChange={(e) =>
                      setNewPriceForm({
                        ...newPriceForm,
                        effective_from: e.target.value,
                      })
                    }
                    required
                    className="field-input"
                  />
                </div>
                <div>
                  <label htmlFor="price-value" className="field-label">
                    Giá (VND) *
                  </label>
                  <CurrencyInput
                    id="price-value"
                    value={newPriceForm.price}
                    onChange={(value) =>
                      setNewPriceForm({ ...newPriceForm, price: value })
                    }
                    baseClassName="field-input"
                  />
                </div>
                <button
                  type="submit"
                  disabled={priceSaving}
                  className="btn btn-primary w-full"
                >
                  {priceSaving ? "Đang lưu..." : "Lưu mốc giá"}
                </button>
              </form>
            )}
          </>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(historyModalShuttle)}
        onClose={() => setHistoryModalShuttle(null)}
        title={`Lịch sử nhập kho — ${historyModalShuttle?.name ?? ""}`}
        size="xl"
      >
        {historyLoading ? (
          <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>
        ) : historyEntries.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Chưa có lịch sử nhập
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-2 py-2 sm:px-3 font-medium">Ngày nhập</th>
                  <th className="px-2 py-2 sm:px-3 text-right font-medium">Ống</th>
                  <th className="px-2 py-2 sm:px-3 text-right font-medium">Quả lẻ</th>
                  <th className="px-2 py-2 sm:px-3 text-right font-medium">Tổng quả</th>
                  <th className="px-2 py-2 sm:px-3 font-medium">Người nhập</th>
                </tr>
              </thead>
              <tbody>
                {historyEntries.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="font-tabular whitespace-nowrap px-2 py-2 sm:px-3 text-slate-700">
                      {row.entered_at}
                    </td>
                    <td className="font-tabular px-2 py-2 sm:px-3 text-right">{row.tubes}</td>
                    <td className="font-tabular px-2 py-2 sm:px-3 text-right">{row.balls}</td>
                    <td className="font-tabular px-2 py-2 sm:px-3 text-right font-medium text-slate-900">
                      {formatNumber(row.total_balls)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 sm:px-3 text-slate-700">
                      {row.creator?.name || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>
      ) : (
        <>
          {totalStock < LOW_STOCK_BALLS && (
            <div
              role="alert"
              className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-4"
            >
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-rose-700">
                    Cảnh báo: Sắp hết cầu — cần nhập thêm!
                  </h3>
                  <p className="mt-1 text-sm text-rose-700">
                    Tổng số lượng cầu còn lại{" "}
                    <strong className="font-tabular">
                      {formatNumber(totalStock)} quả
                    </strong>{" "}
                    — dưới {LOW_STOCK_TUBES} ống. Vui lòng bấm{" "}
                    <strong>“Nhập kho”</strong> để bổ sung.
                  </p>
                </div>
              </div>
            </div>
          )}
          {shuttles.length === 0 ? (
            <EmptyState icon={Inbox} title="Chưa có loại cầu" />
          ) : (
            <>
              <div className="card hidden overflow-hidden !p-0 md:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50">
                    <tr className="text-xs text-slate-500">
                      <th className="px-6 py-3 text-left font-medium">Tên</th>
                      <th className="px-6 py-3 text-right font-medium">Giá</th>
                      <th className="px-6 py-3 text-right font-medium">Tồn kho (quả)</th>
                      <th className="px-6 py-3 text-left font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shuttles.map((shuttle) => (
                      <tr
                        key={shuttle.id}
                        className="border-t border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="max-w-[16rem] px-6 py-3 text-sm font-medium text-slate-900">
                          <div className="truncate" title={shuttle.name}>
                            {shuttle.name}
                          </div>
                        </td>
                        <td className="font-tabular whitespace-nowrap px-6 py-3 text-right text-sm text-slate-700">
                          {formatCurrency(shuttle.price)}
                        </td>
                        <td className="font-tabular whitespace-nowrap px-6 py-3 text-right text-sm font-semibold text-slate-900">
                          {formatNumber(shuttle.stock_quantity ?? 0)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2">
                          <div className="flex items-center gap-1">
                            {canEditStock && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openStockModal(shuttle)}
                                  className="btn btn-ghost btn-sm !text-emerald-700 hover:!bg-emerald-50"
                                >
                                  Nhập kho
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openHistoryModal(shuttle)}
                                  className="btn btn-ghost btn-sm"
                                >
                                  Lịch sử
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPriceModal(shuttle)}
                                  className="btn btn-ghost btn-sm"
                                >
                                  Lên giá
                                </button>
                              </>
                            )}
                            {hasPermission("shuttles.update") && (
                              <button
                                type="button"
                                onClick={() => handleEdit(shuttle)}
                                className="btn btn-ghost btn-sm"
                              >
                                Sửa
                              </button>
                            )}
                            {hasPermission("shuttles.delete") && (
                              <button
                                type="button"
                                onClick={() => handleDelete(shuttle.id)}
                                className="btn btn-ghost btn-sm !text-rose-600 hover:!bg-rose-50"
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {shuttles.map((shuttle) => (
                  <div key={shuttle.id} className="card !p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words font-semibold text-slate-900">
                        {shuttle.name}
                      </h3>
                      <span className="font-tabular flex-shrink-0 text-lg font-semibold text-slate-900">
                        {formatCurrency(shuttle.price)}
                      </span>
                    </div>
                    <div className="mb-3 text-sm text-slate-600">
                      Tồn kho:{" "}
                      <strong className="font-tabular text-slate-900">
                        {formatNumber(shuttle.stock_quantity ?? 0)}
                      </strong>{" "}
                      quả
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      {canEditStock && (
                        <>
                          <button
                            type="button"
                            onClick={() => openStockModal(shuttle)}
                            className="btn btn-primary btn-sm min-w-[100px] flex-1"
                          >
                            Nhập kho
                          </button>
                          <button
                            type="button"
                            onClick={() => openHistoryModal(shuttle)}
                            className="btn btn-secondary btn-sm min-w-[100px] flex-1"
                          >
                            Lịch sử
                          </button>
                          <button
                            type="button"
                            onClick={() => openPriceModal(shuttle)}
                            className="btn btn-secondary btn-sm min-w-[100px] flex-1"
                          >
                            Lên giá
                          </button>
                        </>
                      )}
                      {hasPermission("shuttles.update") && (
                        <button
                          type="button"
                          onClick={() => handleEdit(shuttle)}
                          className="btn btn-secondary btn-sm min-w-[100px] flex-1"
                        >
                          Sửa
                        </button>
                      )}
                      {hasPermission("shuttles.delete") && (
                        <button
                          type="button"
                          onClick={() => handleDelete(shuttle.id)}
                          className="btn btn-secondary btn-sm min-w-[100px] flex-1 !border-rose-200 !text-rose-600 hover:!bg-rose-50"
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
        </>
      )}
    </div>
  );
}
