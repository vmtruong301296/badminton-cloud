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
    <div className="max-w-5xl px-4 sm:px-0">
      <PageHeader
        title="So sánh chi phí thuê xe"
        description="Nhập chuyến đi và các phương án thuê để xem phương án nào rẻ hơn."
      />

      <div
        role="tablist"
        aria-label="So sánh chi phí thuê xe"
        className="tab-list"
      >
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className="tab"
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
