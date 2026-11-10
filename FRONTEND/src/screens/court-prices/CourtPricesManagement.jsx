import { useEffect, useState } from "react";
import { courtPricesApi } from "../../services/api";
import { courtPriceForDate } from "../../utils/courtTimeFee";
import { serverErrorMessage } from "../../utils/billFormErrors";
import { formatCurrency, formatDate } from "../../utils/formatters";
import CurrencyInput from "../../components/common/CurrencyInput";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../contexts/AuthContext";
import useToast from "../../components/ui/useToast";
import { CircleAlert } from "../../components/ui/icons";

/** Mốc mặc định do migration tạo: áp dụng cho mọi ngày từ trước tới nay. */
const FIRST_TIER_DATE = "1970-01-01";

const tierDateLabel = (date) =>
  date === FIRST_TIER_DATE ? "Từ đầu" : date.split("-").reverse().join("/");

/**
 * Tab Master → Giá sân: giá một sân / 2 giờ cho bảng "Tính theo giờ" của bill con, lên giá theo
 * ngày áp dụng như loại cầu. Lên giá / xoá mốc dùng quyền sửa loại cầu (shuttles.update); luôn
 * giữ ít nhất một mốc (máy chủ chặn xoá mốc cuối).
 */
export default function CourtPricesManagement() {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission("shuttles.update");
  const toast = useToast();
  const today = formatDate(new Date());

  const [prices, setPrices] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState({ effective_from: today, price: null });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    setLoadError(null);
    try {
      const res = await courtPricesApi.getAll();
      setPrices(res.data || []);
    } catch (error) {
      console.error("Error loading court prices:", error);
      setLoadError("Không tải được giá sân.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentPrice = courtPriceForDate(prices, today);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    try {
      setSaving(true);
      const res = await courtPricesApi.create({
        effective_from: form.effective_from,
        price: Number(form.price) || 0,
      });
      setPrices(res.data || []);
      toast.success("Đã lưu mốc giá sân");
    } catch (error) {
      console.error("Error saving court price:", error);
      toast.error(`Không lưu được mốc giá: ${serverErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const tier = deleting;
    setDeleting(null);
    try {
      const res = await courtPricesApi.delete(tier.id);
      setPrices(res.data || []);
      toast.success("Đã xoá mốc giá sân");
    } catch (error) {
      console.error("Error deleting court price:", error);
      toast.error(`Không xoá được mốc giá: ${serverErrorMessage(error)}`);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Giá sân
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Giá một sân cho 2 giờ, dùng cho bảng &quot;Tính theo giờ&quot; của
          bill con. Bill dùng{" "}
          <strong className="text-slate-700">ngày đánh</strong> để chọn mốc giá:
          mốc mới nhất không sau ngày đó.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <p className="field-error mt-0">
            <CircleAlert />
            {loadError}
          </p>
          <button
            type="button"
            onClick={load}
            className="btn btn-secondary mt-3"
          >
            Thử lại
          </button>
        </div>
      ) : prices === null ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Đang tải...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-sm text-slate-500">Đang áp dụng hôm nay</p>
              <p className="font-tabular mt-0.5 text-xl font-bold text-emerald-700">
                {currentPrice === null ? "—" : formatCurrency(currentPrice)}
                <span className="ml-1 text-sm font-medium text-slate-500">
                  / 2h / sân
                </span>
              </p>
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-2 font-medium">Áp dụng từ</th>
                  <th className="px-4 py-2 text-right font-medium">Giá / 2h</th>
                  {canUpdate && <th className="w-16 px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {prices.map((tier) => (
                  <tr key={tier.id} className="border-t border-slate-100">
                    <td className="font-tabular whitespace-nowrap px-4 py-2 text-slate-700">
                      {tierDateLabel(tier.effective_from)}
                    </td>
                    <td className="font-tabular px-4 py-2 text-right text-slate-900">
                      {formatCurrency(tier.price)}
                    </td>
                    {canUpdate && (
                      <td className="px-2 py-1 text-right">
                        {prices.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setDeleting(tier)}
                            className="btn btn-danger-ghost btn-sm"
                          >
                            Xóa
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {canUpdate && (
            <form
              onSubmit={submit}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
            >
              <p className="text-base font-semibold text-slate-900">Lên giá</p>
              <div>
                <label htmlFor="court-price-effective" className="field-label">
                  Ngày áp dụng *
                </label>
                <input
                  id="court-price-effective"
                  type="date"
                  value={form.effective_from}
                  onChange={(e) =>
                    setForm({ ...form, effective_from: e.target.value })
                  }
                  required
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="court-price-value" className="field-label">
                  Giá một sân / 2 giờ (VND) *
                </label>
                <CurrencyInput
                  id="court-price-value"
                  value={form.price}
                  onChange={(value) => setForm({ ...form, price: value })}
                  placeholder={currentPrice ? currentPrice.toLocaleString("vi-VN") : "0"}
                  allowNegative={false}
                  selectOnFocus
                  required
                  baseClassName="field-input"
                />
              </div>
              <p className="text-[13px] leading-[18px] text-slate-500">
                Trùng ngày áp dụng với mốc đã có thì sửa giá của mốc đó.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary w-full"
              >
                {saving ? "Đang lưu..." : "Lưu mốc giá"}
              </button>
            </form>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Xoá mốc giá sân?"
        message={
          deleting
            ? `Mốc ${tierDateLabel(deleting.effective_from)} — ${formatCurrency(deleting.price)} / 2h. Bill trong khoảng ngày này sẽ tính theo mốc trước đó.`
            : ""
        }
        confirmLabel="Xoá mốc"
      />
    </div>
  );
}
