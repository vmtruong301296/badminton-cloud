import { useState, useEffect } from 'react';
import { paymentAccountsApi } from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import { Plus, Inbox } from '../../components/ui/icons';

export default function PaymentAccountsManagement() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, accountId: null });
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
    qr_code_image: null, // Will store base64 string
    is_active: true,
    note: '',
  });
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await paymentAccountsApi.getAll();
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (account = null) => {
    if (account) {
      setEditingAccount(account);
      setFormData({
        bank_name: account.bank_name || '',
        account_number: account.account_number || '',
        account_holder_name: account.account_holder_name || '',
        qr_code_image: account.qr_code_image || null, // base64 string from database
        is_active: account.is_active ?? true,
        note: account.note || '',
      });
      setPreviewImage(account.qr_code_image || null);
    } else {
      setEditingAccount(null);
      setFormData({
        bank_name: '',
        account_number: '',
        account_holder_name: '',
        qr_code_image: null,
        is_active: true,
        note: '',
      });
      setPreviewImage(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAccount(null);
    setFormData({
      bank_name: '',
      account_number: '',
      account_holder_name: '',
      qr_code_image: null,
      is_active: true,
      note: '',
    });
    setPreviewImage(null);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result; // This is already base64 data URL
        setFormData({ ...formData, qr_code_image: base64String });
        setPreviewImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare data with proper boolean conversion
      const submitData = {
        bank_name: formData.bank_name,
        account_number: formData.account_number,
        account_holder_name: formData.account_holder_name,
        is_active: formData.is_active === true || formData.is_active === 'true' || formData.is_active === 1,
        note: formData.note,
        qr_code_image: formData.qr_code_image || null, // base64 string or null
      };
      
      if (editingAccount) {
        await paymentAccountsApi.update(editingAccount.id, submitData);
        handleCloseModal();
        await loadAccounts();
      } else {
        await paymentAccountsApi.create(submitData);
        handleCloseModal();
        await loadAccounts();
      }
    } catch (error) {
      console.error('Error saving payment account:', error);
      alert('Có lỗi xảy ra khi lưu tài khoản: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteClick = (accountId) => {
    setDeleteConfirm({ isOpen: true, accountId });
  };

  const handleDeleteConfirm = async () => {
    try {
      await paymentAccountsApi.delete(deleteConfirm.accountId);
      setDeleteConfirm({ isOpen: false, accountId: null });
      loadAccounts();
    } catch (error) {
      console.error('Error deleting payment account:', error);
      alert('Có lỗi xảy ra khi xóa tài khoản');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, accountId: null });
  };

  // No longer needed - images are now base64 strings directly from database

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-lg font-semibold tracking-tight text-slate-900">Quản lý Tài khoản Nhận tiền</h2>
        <button
          type="button"
          onClick={() => handleOpenModal()}
          className="btn btn-primary flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Inbox} title="Chưa có tài khoản nào" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className={`card flex flex-col !p-4 ${
                account.is_active ? '!border-emerald-200' : 'opacity-70'
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-base font-semibold text-slate-900">{account.bank_name}</h3>
                  <p className="break-words text-sm text-slate-600">{account.account_holder_name}</p>
                  <p className="font-tabular break-all text-sm text-slate-700">{account.account_number}</p>
                </div>
                <span
                  className={`badge flex-shrink-0 ${
                    account.is_active ? 'badge-emerald' : 'badge-slate'
                  }`}
                >
                  {account.is_active ? 'Đang dùng' : 'Tạm khóa'}
                </span>
              </div>

              {account.qr_code_image && (
                <div className="mb-4">
                  <img
                    src={account.qr_code_image}
                    alt="QR Code"
                    className="mx-auto h-auto w-full max-w-[16rem] rounded-xl border border-slate-200"
                    onError={(e) => {
                      console.error('Error loading image');
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {account.note && (
                <p className="mb-4 break-words text-sm italic text-slate-600">{account.note}</p>
              )}

              <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => handleOpenModal(account)}
                  className="btn btn-secondary btn-sm flex-1"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteClick(account.id)}
                  className="btn btn-secondary btn-sm flex-1 !border-rose-200 !text-rose-600 hover:!bg-rose-50"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create/Edit */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingAccount ? 'Sửa tài khoản' : 'Thêm tài khoản mới'}
        size="lg"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={handleCloseModal}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="payment-account-form"
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {editingAccount ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        }
      >
        <form id="payment-account-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pa-bank" className="field-label">
              Tên ngân hàng *
            </label>
            <input
              id="pa-bank"
              type="text"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              className="field-input"
              required
            />
          </div>

          <div>
            <label htmlFor="pa-number" className="field-label">
              Số tài khoản *
            </label>
            <input
              id="pa-number"
              type="text"
              inputMode="numeric"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              className="field-input"
              required
            />
          </div>

          <div>
            <label htmlFor="pa-holder" className="field-label">
              Tên chủ tài khoản *
            </label>
            <input
              id="pa-holder"
              type="text"
              value={formData.account_holder_name}
              onChange={(e) =>
                setFormData({ ...formData, account_holder_name: e.target.value })
              }
              className="field-input"
              required
            />
          </div>

          <div>
            <label htmlFor="pa-qr" className="field-label">
              Ảnh QR Code
            </label>
            <input
              id="pa-qr"
              key={editingAccount ? `file-${editingAccount.id}-${editingAccount.updated_at || Date.now()}` : 'file-new'}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="block w-full rounded-xl border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:h-11 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 sm:file:h-10"
            />
            {previewImage && (
              <div className="mt-2">
                <img
                  key={previewImage}
                  src={previewImage}
                  alt="QR Code Preview"
                  className="h-48 w-48 rounded-xl border border-slate-200 object-contain"
                  onError={() => {
                    console.error('Error loading preview image:', previewImage);
                  }}
                />
              </div>
            )}
          </div>

          <label
            htmlFor="pa-active"
            className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-slate-700"
          >
            <input
              id="pa-active"
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-5 w-5 flex-shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600/40"
            />
            <span>Đang sử dụng</span>
          </label>

          <div>
            <label htmlFor="pa-note" className="field-label">Ghi chú</label>
            <textarea
              id="pa-note"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="field-input !h-auto py-2"
              rows={3}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa tài khoản"
        message="Bạn có chắc chắn muốn xóa tài khoản này? Hành động này không thể hoàn tác."
      />
    </div>
  );
}
