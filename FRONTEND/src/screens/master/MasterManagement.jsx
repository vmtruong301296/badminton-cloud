import { useSearchParams } from 'react-router-dom';
import RatiosManagement from '../ratios/RatiosManagement';
import MenusManagement from '../menus/MenusManagement';
import ShuttlesManagement from '../shuttles/ShuttlesManagement';
import PaymentAccountsManagement from '../payment-accounts/PaymentAccountsManagement';
import PageHeader from '../../components/ui/PageHeader';

const TABS = [
  { id: 'ratios', label: 'Mức tính', component: RatiosManagement },
  { id: 'menus', label: 'Menu nước', component: MenusManagement },
  { id: 'shuttles', label: 'Loại cầu', component: ShuttlesManagement },
  { id: 'payment-accounts', label: 'TK nhận tiền', component: PaymentAccountsManagement },
];

export default function MasterManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'ratios';

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const ActiveComponent = TABS.find(tab => tab.id === activeTab)?.component || RatiosManagement;

  return (
    <div className="px-4 sm:px-0">
      <PageHeader title="Quản lý Master" />

      {/* Tabs: khung xám, tab đang chọn nền trắng; cuộn ngang được trên điện thoại */}
      <div
        role="tablist"
        aria-label="Quản lý Master"
        className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:inline-flex sm:max-w-full"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`master-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls="master-tabpanel"
              onClick={() => handleTabChange(tab.id)}
              className={`
                h-11 flex-1 whitespace-nowrap rounded-lg px-2 text-sm font-medium transition sm:h-9 sm:px-4 sm:flex-none
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40
                ${isActive
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
                }
              `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div id="master-tabpanel" role="tabpanel" aria-labelledby={`master-tab-${activeTab}`}>
        <ActiveComponent />
      </div>
    </div>
  );
}
