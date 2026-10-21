import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';

export default function SelectPaymentAccountDialog({ isOpen, onClose, onConfirm, paymentAccounts = [] }) {
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  const activeAccounts = paymentAccounts.filter((acc) => acc.is_active);

  // Tự động chọn tài khoản VPbank khi modal mở
  useEffect(() => {
    if (isOpen) {
      const activeAccounts = paymentAccounts.filter((acc) => acc.is_active);
      if (activeAccounts.length > 0) {
        const vpbankAccount = activeAccounts.find((acc) => acc.bank_name === 'VPBank');
        if (vpbankAccount) {
          setSelectedAccountId(vpbankAccount.id);
        } else {
          // Nếu không tìm thấy VPbank, chọn tài khoản đầu tiên
          setSelectedAccountId(activeAccounts[0].id);
        }
      }
    } else {
      // Reset khi đóng modal
      setSelectedAccountId(null);
    }
  }, [isOpen, paymentAccounts]);

  const handleConfirm = () => {
    if (selectedAccountId) {
      onConfirm(selectedAccountId);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chọn tài khoản thanh toán"
      size="md"
      footer={
        <div className="flex gap-2 sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-secondary flex-1 sm:flex-none">
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedAccountId || activeAccounts.length === 0}
            className="btn btn-primary flex-1 sm:flex-none"
          >
            Xác nhận
          </button>
        </div>
      }
    >
      {activeAccounts.length === 0 ? (
        <p className="text-sm text-slate-600">Không có tài khoản thanh toán nào đang hoạt động.</p>
      ) : (
        <div className="space-y-2">
          {activeAccounts.map((account) => (
            <label
              key={account.id}
              className={`flex min-h-[44px] cursor-pointer items-center rounded-xl border p-3 transition-colors ${
                selectedAccountId === account.id
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="paymentAccount"
                value={account.id}
                checked={selectedAccountId === account.id}
                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                className="mr-3 h-4 w-4 flex-shrink-0 accent-emerald-700"
              />
              <div className="min-w-0 flex-1">
                <div className="break-words font-medium text-slate-900">
                  {account.bank_name || `Tài khoản ${account.id}`}
                </div>
                {account.account_number && (
                  <div className="break-words text-sm text-slate-600">Số tài khoản: {account.account_number}</div>
                )}
                {account.note && (
                  <div className="mt-1 break-words text-xs text-slate-500">{account.note}</div>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
}
