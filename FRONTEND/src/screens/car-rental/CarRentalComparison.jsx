import { useState } from "react";
import CarRentalCalculator from "./CarRentalCalculator";
import CarRentalHistory from "./CarRentalHistory";
import PageHeader from "../../components/ui/PageHeader";

const TABS = [
  { key: "calculator", label: "Tính toán" },
  { key: "history", label: "Lịch sử" },
];

export default function CarRentalComparison() {
  const [tab, setTab] = useState("calculator");
  const [editing, setEditing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleEdit = (comparison) => {
    setEditing(comparison);
    setTab("calculator");
  };

  const handleSaved = () => {
    setEditing(null);
    setReloadKey((key) => key + 1);
    setTab("history");
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-0">
      <PageHeader
        title="So sánh chi phí thuê xe"
        description="Nhập chuyến đi và các phương án thuê để xem phương án nào rẻ hơn."
      />

      <div
        role="tablist"
        aria-label="So sánh chi phí thuê xe"
        className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 sm:inline-flex"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`h-11 flex-1 rounded-lg px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:h-9 sm:flex-none ${
              tab === item.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "calculator" ? (
        <CarRentalCalculator
          editing={editing}
          onSaved={handleSaved}
          onCancelEdit={() => setEditing(null)}
        />
      ) : (
        <CarRentalHistory reloadKey={reloadKey} onEdit={handleEdit} />
      )}
    </div>
  );
}
