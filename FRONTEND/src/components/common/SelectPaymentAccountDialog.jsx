import { useEffect, useEffectEvent, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import BillImageZoom from '../bill/BillImageZoom';
import { CircleAlert, Download, Loader, RotateCcw, Search, Send } from '../ui/icons';
import {
  activePaymentAccounts,
  apiErrorDetail,
  defaultPaymentAccountId,
  pickImageSaveMethod,
} from '../../utils/billImageShare';

// Giữ URL của file tải về một lúc để trình duyệt kịp đọc rồi mới thu hồi.
const DOWNLOAD_URL_TTL_MS = 60000;

function AccountOption({ account, checked, onChange }) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-center rounded-xl border p-3 transition-colors ${
        checked
          ? 'border-emerald-600 bg-emerald-50'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <input
        type="radio"
        name="paymentAccount"
        value={account.id}
        checked={checked}
        onChange={(e) => onChange(Number(e.target.value))}
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
  );
}

const NO_ACCOUNT_TEXT = 'Không có tài khoản thanh toán nào đang hoạt động.';

/** Hộp chọn tài khoản như cũ (chưa truyền buildImage): chọn rồi bấm nút xác nhận. */
function AccountPicker({ onClose, onConfirm, paymentAccounts, confirmLabel }) {
  // Chỉ lưu lựa chọn của người dùng; chưa chọn thì dùng tài khoản mặc định (VPBank / đầu tiên).
  const [chosenId, setChosenId] = useState(null);
  const activeAccounts = activePaymentAccounts(paymentAccounts);
  const selectedAccountId = chosenId ?? defaultPaymentAccountId(paymentAccounts);

  const handleConfirm = () => {
    if (selectedAccountId) {
      onConfirm(selectedAccountId);
    }
  };

  return (
    <Modal
      isOpen
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
            {confirmLabel}
          </button>
        </div>
      }
    >
      {activeAccounts.length === 0 ? (
        <p className="text-sm text-slate-600">{NO_ACCOUNT_TEXT}</p>
      ) : (
        <div className="space-y-2">
          {activeAccounts.map((account) => (
            <AccountOption
              key={account.id}
              account={account}
              checked={selectedAccountId === account.id}
              onChange={setChosenId}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_TTL_MS);
}

/**
 * Lưu ảnh: điện thoại chia sẻ được file thì mở bảng chia sẻ của máy, không thì tải file.
 * Gọi ngay trong lần chạm (ảnh đã dựng sẵn) vì navigator.share cần thao tác vừa xảy ra.
 * Trả "shared" | "downloaded" | "cancelled" (đóng bảng chia sẻ).
 */
async function saveImageFile(blob, fileName) {
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  let canShareFiles = false;
  try {
    canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch (error) {
    // Vài trình duyệt ném lỗi thay vì trả false: coi như không chia sẻ được, tải file.
    console.warn('navigator.canShare failed:', error);
  }
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;

  if (pickImageSaveMethod({ coarsePointer, canShareFiles }) === 'share') {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      console.error('Share bill image failed, downloading instead:', error);
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}

function PreviewBox({ status, url, alt, onRetry, onZoom, zoomButtonRef }) {
  if (status === 'loading') {
    return (
      <div role="status" className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
        <Loader className="h-5 w-5 animate-spin" />
        Đang tạo ảnh…
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div role="alert" className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 text-center text-sm text-rose-700">
        <span className="inline-flex items-center gap-1.5">
          <CircleAlert className="h-4 w-4 flex-none" />
          Có lỗi xảy ra khi xuất bill
        </span>
        <button type="button" onClick={onRetry} className="btn btn-secondary">
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </button>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <img src={url} alt={alt} className="mx-auto block max-h-[45vh] w-auto max-w-full" />
      <button
        ref={zoomButtonRef}
        type="button"
        onClick={onZoom}
        aria-haspopup="dialog"
        className="absolute bottom-2 right-2 inline-flex h-11 items-center gap-1.5 rounded-full bg-slate-900/80 px-4 text-sm font-semibold text-white active:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/60"
      >
        <Search className="h-4 w-4" />
        Phóng to
      </button>
    </div>
  );
}

/** Hộp "Gửi ảnh bill": chọn tài khoản + xem trước ảnh + Xuất Bill / Gửi Telegram. */
function BillImageSheet({ onClose, paymentAccounts, buildImage, fileName, onSendTelegram, primaryAction, title }) {
  const [chosenId, setChosenId] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null); // { key, blob, url } | { key, error }
  const [busy, setBusy] = useState(null); // null | "download" | "telegram"
  const [actionError, setActionError] = useState(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomButtonRef = useRef(null);

  const activeAccounts = activePaymentAccounts(paymentAccounts);
  const accountId = chosenId ?? defaultPaymentAccountId(paymentAccounts);
  const buildKey = accountId === null ? null : `${accountId}:${attempt}`;
  const runBuild = useEffectEvent((id) => buildImage(id));

  // Dựng ảnh một lần khi mở và mỗi lần đổi tài khoản / bấm Thử lại; kết quả cũ bị bỏ qua.
  useEffect(() => {
    if (accountId === null) return undefined;
    let cancelled = false;
    const key = `${accountId}:${attempt}`;
    runBuild(accountId)
      .then((blob) => {
        if (!blob) throw new Error('Không tạo được file PNG');
        if (!cancelled) setResult({ key, blob, url: URL.createObjectURL(blob) });
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error building bill image:', error);
        setResult({ key, error });
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, attempt]);

  const previewUrl = result?.url;
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const current = result && result.key === buildKey ? result : null;
  const status = !current ? 'loading' : current.error ? 'error' : 'ready';
  const ready = status === 'ready';
  const previewAlt = 'Ảnh bill xem trước';

  const handleExport = async () => {
    if (!ready || busy) return;
    setActionError(null);
    setBusy('download');
    try {
      const outcome = await saveImageFile(current.blob, fileName);
      if (outcome !== 'cancelled') onClose();
    } catch (error) {
      console.error('Error exporting bill:', error);
      setActionError('Có lỗi xảy ra khi xuất bill');
    } finally {
      setBusy(null);
    }
  };

  const handleSendTelegram = async () => {
    if (!ready || busy) return;
    setActionError(null);
    setBusy('telegram');
    try {
      await onSendTelegram(current.blob, accountId);
      onClose();
    } catch (error) {
      console.error('Error sending bill to Telegram:', error);
      setActionError('Gửi Telegram thất bại: ' + apiErrorDetail(error));
    } finally {
      setBusy(null);
    }
  };

  const closeZoom = () => {
    setZoomOpen(false);
    zoomButtonRef.current?.focus();
  };

  const showAccounts = activeAccounts.length > 1;
  const exportButton = (
    <button
      key="download"
      type="button"
      onClick={handleExport}
      disabled={!ready || Boolean(busy)}
      className={`btn ${primaryAction === 'download' ? 'btn-primary' : 'btn-secondary'} flex-1 sm:flex-none`}
    >
      {busy === 'download' ? <Loader className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy === 'download' ? 'Đang xuất…' : 'Xuất Bill'}
    </button>
  );
  const telegramButton = (
    <button
      key="telegram"
      type="button"
      onClick={handleSendTelegram}
      disabled={!ready || Boolean(busy)}
      className={`btn ${primaryAction === 'download' ? 'btn-secondary' : 'btn-primary'} flex-1 sm:flex-none`}
    >
      {busy === 'telegram' ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      {busy === 'telegram' ? 'Đang gửi…' : 'Gửi Telegram'}
    </button>
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={title}
      size={showAccounts ? 'xl' : 'lg'}
      initialFocus="panel"
      dismissible={!busy}
      footer={
        <div className="flex gap-2 sm:justify-end">
          {primaryAction === 'download' ? [telegramButton, exportButton] : [exportButton, telegramButton]}
        </div>
      }
    >
      {accountId === null ? (
        <p className="text-sm text-slate-600">{NO_ACCOUNT_TEXT}</p>
      ) : (
        <div className={showAccounts ? 'space-y-3 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:items-start sm:gap-5 sm:space-y-0' : ''}>
          {showAccounts && (
            <fieldset disabled={Boolean(busy)}>
              <legend className="field-label">Chọn tài khoản thanh toán</legend>
              <div className="space-y-2">
                {activeAccounts.map((account) => (
                  <AccountOption
                    key={account.id}
                    account={account}
                    checked={accountId === account.id}
                    onChange={setChosenId}
                  />
                ))}
              </div>
            </fieldset>
          )}
          <PreviewBox
            status={status}
            url={current?.url}
            alt={previewAlt}
            onRetry={() => setAttempt((n) => n + 1)}
            onZoom={() => setZoomOpen(true)}
            zoomButtonRef={zoomButtonRef}
          />
        </div>
      )}
      {actionError && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
          <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
          <span className="min-w-0 break-words">{actionError}</span>
        </p>
      )}
      {zoomOpen && ready && <BillImageZoom url={current.url} alt={previewAlt} onClose={closeZoom} />}
    </Modal>
  );
}

/**
 * Chọn tài khoản nhận tiền in lên ảnh bill — bill cầu và bill tiệc dùng chung.
 *
 * Như cũ (không truyền buildImage): isOpen, onClose, onConfirm(accountId), paymentAccounts;
 * tùy chọn confirmLabel (mặc định "Xác nhận").
 *
 * Hộp "Gửi ảnh bill" (truyền buildImage): mở là dựng ảnh ngay, xem trước, phóng to, rồi
 * Xuất Bill (điện thoại: bảng chia sẻ của máy nếu có — quyết định 11) hoặc Gửi Telegram.
 * - buildImage(accountId) => Promise<Blob>: dựng PNG với tài khoản đó; gọi lại khi đổi tài khoản.
 * - fileName: tên file khi lưu / chia sẻ.
 * - onSendTelegram(blob, accountId) => Promise: gửi ảnh; ném lỗi thì hộp hiện
 *   "Gửi Telegram thất bại: …" và mở nguyên; xong thì hộp tự gọi onClose (màn tự báo thành công).
 * - primaryAction: "telegram" (mặc định) | "download" — nút chính (bên phải).
 * - title: mặc định "Gửi ảnh bill".
 * Chỉ một tài khoản đang bật thì không hiện danh sách chọn (quyết định 12). Màn dùng hộp như cũ muốn
 * bỏ qua bước chọn thì gọi onlyActivePaymentAccountId (utils/billImageShare.js) trước khi mở.
 */
export default function SelectPaymentAccountDialog({
  isOpen,
  onClose,
  onConfirm,
  paymentAccounts = [],
  confirmLabel = 'Xác nhận',
  buildImage,
  fileName,
  onSendTelegram,
  primaryAction = 'telegram',
  title = 'Gửi ảnh bill',
}) {
  if (!isOpen) return null;
  if (buildImage) {
    return (
      <BillImageSheet
        onClose={onClose}
        paymentAccounts={paymentAccounts}
        buildImage={buildImage}
        fileName={fileName}
        onSendTelegram={onSendTelegram}
        primaryAction={primaryAction}
        title={title}
      />
    );
  }
  return (
    <AccountPicker
      onClose={onClose}
      onConfirm={onConfirm}
      paymentAccounts={paymentAccounts}
      confirmLabel={confirmLabel}
    />
  );
}
