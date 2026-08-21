import { useState } from "react";
import CarRentalCalculator from "./CarRentalCalculator";
import CarRentalHistory from "./CarRentalHistory";

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
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          🚗 So sánh chi phí thuê xe
        </h1>
        <p className="text-gray-600 mt-1">
          Nhập chuyến đi và các phương án thuê để xem phương án nào rẻ hơn.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
              tab === item.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
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
