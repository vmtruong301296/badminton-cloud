import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billsApi, paymentAccountsApi } from '../../services/api';
import { formatCurrency, formatCurrencyRounded, formatDate, formatDateDisplay, formatRatio } from '../../utils/formatters';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PayOldBillsDialog from '../../components/common/PayOldBillsDialog';
import SelectPaymentAccountDialog from '../../components/common/SelectPaymentAccountDialog';
import BillContent from '../../components/bill/BillContent';
import BillExport from '../../components/bill/BillExport';
import html2canvas from 'html2canvas';

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [uncheckPaymentConfirm, setUncheckPaymentConfirm] = useState({ isOpen: false, playerId: null, playerName: '' });
  const [payOldBillsConfirm, setPayOldBillsConfirm] = useState({ isOpen: false, playerId: null, playerName: '', debtAmount: 0, oldBillIds: [] });
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountImages, setPaymentAccountImages] = useState({}); // Store base64 images: { accountId: base64 }
  const [exporting, setExporting] = useState(false);
  const [selectAccountDialog, setSelectAccountDialog] = useState({ isOpen: false });
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const exportRef = useRef(null);

  useEffect(() => {
    loadBill();
    loadPaymentAccounts();
  }, [id]);

  const loadBill = async () => {
    try {
      setLoading(true);
      const response = await billsApi.getById(id);
      setBill(response.data);
    } catch (error) {
      console.error('Error loading bill:', error);
      alert('Không tìm thấy bill');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPayment = async (playerId, isPaid) => {
    // Nếu đang uncheck (từ checked -> unchecked), hiển thị confirm dialog
    if (!isPaid) {
      const player = bill.bill_players?.find((p) => p.user_id === playerId);
      if (player) {
        setUncheckPaymentConfirm({
          isOpen: true,
          playerId,
          playerName: player.user?.name || '',
        });
        return;
      }
    }

    // Nếu đang check (từ unchecked -> checked)
    const player = bill.bill_players?.find((p) => p.user_id === playerId);
    if (player && player.debt_amount > 0 && isPaid) {
      // Nếu có tiền nợ, hiển thị confirm dialog hỏi có thanh toán bill cũ không
      const oldBillIdsSet = new Set();
      if (player.debt_details && player.debt_details.length > 0) {
        player.debt_details.forEach((debt) => {
          if (debt.parent_bill_id) {
            oldBillIdsSet.add(debt.parent_bill_id);
          }
          if (debt.sub_bills && debt.sub_bills.length > 0) {
            debt.sub_bills.forEach((subBill) => {
              if (subBill.bill_id) {
                oldBillIdsSet.add(subBill.bill_id);
              }
            });
          }
        });
      }
      
      setPayOldBillsConfirm({
        isOpen: true,
        playerId,
        playerName: player.user?.name || '',
        debtAmount: player.debt_amount,
        oldBillIds: Array.from(oldBillIdsSet),
      });
      return;
    }

    // Nếu không có tiền nợ hoặc đang uncheck, gọi API trực tiếp
    await executeMarkPayment(playerId, isPaid);
  };

  const executeMarkPayment = async (playerId, isPaid, oldBillIds = []) => {
    try {
      // Mark payment cho bill hiện tại
      await billsApi.markPayment(id, playerId, {
        amount: bill.bill_players.find((p) => p.user_id === playerId)?.total_amount,
        is_paid: isPaid,
      });

      // Nếu bill hiện tại là parent bill và đang mark as paid, mark payment cho tất cả sub-bills
      if (!bill.parent_bill_id && bill.sub_bills && bill.sub_bills.length > 0 && isPaid) {
        const promises = bill.sub_bills.map(async (subBill) => {
          try {
            // Tìm player trong sub-bill
            const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === playerId);
            if (subBillPlayer) {
              await billsApi.markPayment(subBill.id, playerId, {
                amount: subBillPlayer.total_amount,
                is_paid: true,
              });
            }
          } catch (error) {
            console.error(`Error marking payment for sub-bill ${subBill.id}:`, error);
          }
        });
        await Promise.all(promises);
      }

      // Nếu có bill cũ cần thanh toán, mark payment cho từng bill
      if (oldBillIds.length > 0 && isPaid) {
        const player = bill.bill_players?.find((p) => p.user_id === playerId);
        if (player) {
          // Lấy thông tin bill cũ từ debt_details để lấy bill_id và user_id
          const promises = oldBillIds.map(async (oldBillId) => {
            try {
              // Lấy bill cũ để lấy user_id của player trong bill đó
              const oldBillResponse = await billsApi.getById(oldBillId);
              const oldBill = oldBillResponse.data;
              const oldBillPlayer = oldBill.bill_players?.find((p) => p.user_id === playerId);
              if (oldBillPlayer) {
                await billsApi.markPayment(oldBillId, playerId, {
                  amount: oldBillPlayer.total_amount,
                  is_paid: true,
                });
              }
            } catch (error) {
              console.error(`Error marking payment for old bill ${oldBillId}:`, error);
      }
          });
          await Promise.all(promises);
        }
      }

      // Reload bill để lấy đầy đủ thông tin debt_amount và debt_details được tính lại
      // vì khi is_paid thay đổi, các bill trước đó có thể không còn được tính vào debt nữa
      await loadBill();
    } catch (error) {
      console.error('Error marking payment:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const handleUncheckPaymentConfirm = async () => {
    await executeMarkPayment(uncheckPaymentConfirm.playerId, false);
    setUncheckPaymentConfirm({ isOpen: false, playerId: null, playerName: '' });
  };

  const handleUncheckPaymentCancel = () => {
    setUncheckPaymentConfirm({ isOpen: false, playerId: null, playerName: '' });
    // Reload để đảm bảo checkbox trở về trạng thái ban đầu
    loadBill();
  };

  const handlePayOldBillsConfirm = async () => {
    await executeMarkPayment(
      payOldBillsConfirm.playerId,
      true,
      payOldBillsConfirm.oldBillIds
    );
    setPayOldBillsConfirm({ isOpen: false, playerId: null, playerName: '', debtAmount: 0, oldBillIds: [] });
  };

  const handlePayOldBillsCancel = async () => {
    // Chỉ thanh toán bill hiện tại, không thanh toán bill cũ
    await executeMarkPayment(payOldBillsConfirm.playerId, true, []);
    setPayOldBillsConfirm({ isOpen: false, playerId: null, playerName: '', debtAmount: 0, oldBillIds: [] });
  };

  const handleDeleteClick = () => {
    setDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await billsApi.delete(id);
      navigate('/');
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Có lỗi xảy ra khi xóa bill');
      setDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(false);
  };

  // Helper to convert image URL to base64 using fetch API (bypasses CORS)
  const loadImageAsBase64 = async (url) => {
    try {
      console.log('loadImageAsBase64 - Starting for URL:', url);

      // Convert storage URL to API route if needed
      let apiUrl = url;
      if (url.includes('/storage/')) {
        // Extract path after /storage/
        const pathMatch = url.match(/\/storage\/(.+?)(?:\?|$)/);
        if (pathMatch && pathMatch[1]) {
          const cleanPath = pathMatch[1];
          // If URL is absolute (starts with http), extract just the path
          if (url.startsWith('http')) {
            apiUrl = `/api/images/${cleanPath}`;
          } else {
            apiUrl = `/api/images/${cleanPath}`;
          }
          console.log('loadImageAsBase64 - Converted to API route:', apiUrl);
        } else {
          console.warn('loadImageAsBase64 - Could not extract path from URL:', url);
        }
      }

      // Use fetch to get image as blob
      const response = await fetch(apiUrl, {
        mode: 'cors',
        credentials: 'omit',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('loadImageAsBase64 - Blob received, size:', blob.size, 'type:', blob.type);

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          console.log('loadImageAsBase64 - Converted to base64, length:', base64.length);
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error('loadImageAsBase64 - FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('loadImageAsBase64 - Error:', error, 'URL:', url);
      throw error;
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      const response = await paymentAccountsApi.getAll({ is_active: true });
      console.log('BillDetail - Payment accounts loaded:', response.data);

      setPaymentAccounts(response.data);

      // Preload and convert images to base64
      // If qr_code_image is already a base64 string (starts with data:image/), use it directly
      const imageMap = {};
      const imagePromises = response.data
        .filter(acc => acc.is_active && acc.qr_code_image)
        .map(async (acc) => {
          try {
            // Check if qr_code_image is already a base64 string
            if (acc.qr_code_image.startsWith('data:image/')) {
              // Already base64, use directly
              imageMap[acc.id] = acc.qr_code_image;
              console.log(`Account ${acc.id}: Using direct base64 image`);
              return;
            }

            // Otherwise, it's a file path, need to load and convert
            const imageUrl = acc.qr_code_image_url ||
              (acc.qr_code_image ? `${window.location.origin}/storage/${acc.qr_code_image}` : null);

            if (imageUrl) {
              console.log(`Preloading image for account ${acc.id}:`, imageUrl);
              const base64 = await loadImageAsBase64(imageUrl);
              imageMap[acc.id] = base64;
              console.log(`Account ${acc.id}: Image preloaded successfully`);
            }
          } catch (error) {
            console.error(`Failed to preload image for account ${acc.id}:`, error);
          }
        });

      await Promise.all(imagePromises);
      setPaymentAccountImages(imageMap);
      console.log('All payment account images preloaded:', Object.keys(imageMap));
    } catch (error) {
      console.error('Error loading payment accounts:', error);
    }
  };

  const handleExportBill = () => {
    if (!bill) return;
    // Mở modal chọn tài khoản
    setSelectAccountDialog({ isOpen: true });
  };

  const handleSelectAccountConfirm = async (accountId) => {
    setSelectAccountDialog({ isOpen: false });
    // Gọi hàm xuất với tài khoản đã chọn (hàm này sẽ set selectedAccountId)
    await executeExportBill(accountId);
  };

  const handleSelectAccountCancel = () => {
    setSelectAccountDialog({ isOpen: false });
  };

  const executeExportBill = async (accountId) => {
    if (!bill) return;

    // Đảm bảo selectedAccountId đã được set và component đã render
    setSelectedAccountId(accountId);
    // Đợi component re-render với tài khoản mới
    await new Promise(resolve => setTimeout(resolve, 300));

    if (!exportRef.current) {
      console.error('Export ref not available');
      setExporting(false);
      return;
    }

    try {
      setExporting(true);

      // Ensure all payment account images are preloaded before export
      // If qr_code_image is already base64, use it directly
      const accountsNeedingPreload = paymentAccounts
        .filter(acc => acc.is_active && acc.qr_code_image && !paymentAccountImages[acc.id]);

      if (accountsNeedingPreload.length > 0) {
        console.log('Preloading missing images before export:', accountsNeedingPreload.length);
        const imageMap = { ...paymentAccountImages };

        await Promise.all(accountsNeedingPreload.map(async (acc) => {
          try {
            // Check if qr_code_image is already a base64 string
            if (acc.qr_code_image.startsWith('data:image/')) {
              // Already base64, use directly
              imageMap[acc.id] = acc.qr_code_image;
              console.log(`Account ${acc.id}: Using direct base64 image for export`);
              return;
            }

            // Otherwise, it's a file path, need to load and convert
            const imageUrl = acc.qr_code_image_url ||
              (acc.qr_code_image ? `${window.location.origin}/storage/${acc.qr_code_image}` : null);

            if (imageUrl) {
              console.log(`Preloading image for account ${acc.id} before export:`, imageUrl);
              const base64 = await loadImageAsBase64(imageUrl);
              imageMap[acc.id] = base64;
              console.log(`Account ${acc.id}: Image preloaded before export`);
            }
          } catch (error) {
            console.error(`Failed to preload image for account ${acc.id} before export:`, error);
          }
        }));

        setPaymentAccountImages(imageMap);
        // Wait a bit for state to update and component to re-render
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Images should now be preloaded as base64, wait for DOM to be ready
      const images = exportRef.current.querySelectorAll('img.bill-export-image');
      console.log('Found QR code images for export:', images.length);

      // Log image sources
      Array.from(images).forEach((img, index) => {
        console.log(`Image ${index}: src type:`, img.src.startsWith('data:') ? 'base64' : 'URL', 'complete:', img.complete);
      });

      // Wait for all images to be ready
      const imageReadyPromises = Array.from(images).map((img, index) => {
        return new Promise((resolve) => {
          if (img.complete && img.naturalHeight > 0) {
            console.log(`Image ${index}: Ready (base64: ${img.src.startsWith('data:')})`);
            resolve();
            return;
          }

          img.onload = () => {
            console.log(`Image ${index}: Loaded`);
            resolve();
          };

          img.onerror = () => {
            console.error(`Image ${index}: Failed to load`);
            resolve(); // Continue even if image fails
          };

          // Timeout after 5 seconds
          setTimeout(() => {
            console.warn(`Image ${index}: Timeout`);
            resolve();
          }, 5000);
        });
      });

      await Promise.all(imageReadyPromises);

      // Additional delay to ensure everything is rendered
      await new Promise(resolve => setTimeout(resolve, 1000));

      const canvas = await html2canvas(exportRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true, // Allow taint since we're using base64
      });

      // Convert canvas to image and download
      const link = document.createElement('a');
      link.download = `Bill_${bill.id}_${formatDate(bill.date).replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      setExporting(false);
    } catch (error) {
      console.error('Error exporting bill:', error);
      alert('Có lỗi xảy ra khi xuất bill');
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  if (!bill) {
    return <div className="text-center py-8">Không tìm thấy bill</div>;
  }

  return (
    <div className="px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">
            Chi tiết Bill #{bill.id}
          </h2>
          <p className="text-sm sm:text-base text-gray-600">Ngày: {formatDate(bill.date)}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportBill}
            disabled={exporting}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {exporting ? 'Đang xuất...' : '📄 Xuất Bill'}
          </button>
          {(() => {
            // Kiểm tra xem có người nào đã thanh toán chưa
            const hasPaidPlayers = bill.bill_players?.some((p) => p.is_paid) || false;
            if (hasPaidPlayers) {
              return null; // Không hiển thị nút sửa nếu đã có người thanh toán
            }
            return (
              <button
                type="button"
                onClick={() => navigate(`/bills/${id}/edit`)}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm sm:text-base"
              >
                ✏️ Sửa bill
              </button>
            );
          })()}
          {!bill.parent_bill_id && (
            <button
              type="button"
              onClick={() => navigate(`/bills/create?parent_id=${id}`)}
              className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm sm:text-base"
            >
              + Tạo Bill con
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteClick}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm sm:text-base"
          >
            Xóa bill
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm sm:text-base"
          >
            ← Quay lại
          </button>
        </div>
      </div>

      {/* Layout 2 cột nếu có sub-bills, 1 cột nếu không */}
      {!bill.parent_bill_id && bill.sub_bills && bill.sub_bills.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:h-[calc(100vh-200px)]">
          {/* Cột trái: Bill chính */}
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg shadow border-2 border-blue-200 flex flex-col">
            <div className="mb-3 pb-3 border-b border-blue-300">
              <h3 className="text-base sm:text-lg font-bold text-blue-900">Bill chính #{bill.id}</h3>
            </div>
            <BillContent
              bill={bill}
              showHeader={false}
              onMarkPayment={handleMarkPayment}
              isMainBill={true}
              subBills={bill.sub_bills}
            />
          </div>

          {/* Cột phải: Bill con */}
          <div className="space-y-3 sm:space-y-4 lg:overflow-y-auto">
            {bill.sub_bills.map((subBill) => (
              <div key={subBill.id} className="bg-gray-50 p-3 sm:p-4 rounded-lg shadow border-2 border-green-200 flex flex-col">
                <div className="mb-3 pb-3 border-b border-green-300">
                  <h3 className="text-base sm:text-lg font-bold text-green-900">
                    Bill con #{subBill.id}{subBill.note ? ` - ${subBill.note}` : ''}
                  </h3>
                  <p className="text-xs text-gray-600">Ngày: {formatDate(subBill.date)}</p>
                </div>
                <BillContent bill={subBill} showHeader={false} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Bill Info và Shuttles - Layout 2 cột */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Bill Info - Bên trái */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Thông tin Bill</h3>
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div>
                <div className="text-xs sm:text-sm text-gray-600">Tổng tiền sân</div>
                <div className="text-base sm:text-lg font-semibold">{formatCurrencyRounded(bill.court_total)}</div>
              </div>
              <div>
                <div className="text-xs sm:text-sm text-gray-600">Tổng tiền cầu</div>
                <div className="text-base sm:text-lg font-semibold">{formatCurrencyRounded(bill.total_shuttle_price)}</div>
              </div>
              <div>
                <div className="text-xs sm:text-sm text-gray-600">Tổng tiền</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrencyRounded(bill.total_amount)}</div>
              </div>
            </div>
            {bill.note && (
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                <div className="text-xs sm:text-sm text-gray-600">Ghi chú:</div>
                <div className="text-sm sm:text-base text-gray-900">{bill.note}</div>
              </div>
            )}
          </div>

            {/* Shuttles - Bên phải */}
          {bill.bill_shuttles && bill.bill_shuttles.length > 0 && (
              <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Chi tiết cầu</h3>
                <div className="overflow-x-auto">
              <table className="min-w-full text-sm sm:text-base">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 text-xs sm:text-sm">Loại cầu</th>
                    <th className="text-right py-2 text-xs sm:text-sm">Số lượng</th>
                    <th className="text-right py-2 text-xs sm:text-sm">Đơn giá</th>
                    <th className="text-right py-2 text-xs sm:text-sm">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.bill_shuttles.map((shuttle, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 text-xs sm:text-sm">{shuttle.shuttle_type?.name}</td>
                      <td className="text-right py-2 text-xs sm:text-sm">{shuttle.quantity}</td>
                      <td className="text-right py-2 text-xs sm:text-sm">{formatCurrencyRounded(shuttle.price_each)}</td>
                      <td className="text-right py-2 font-semibold text-xs sm:text-sm">
                        {formatCurrencyRounded(shuttle.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                </div>
            </div>
          )}
          </div>

          {/* Players Table */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Chi tiết người chơi</h3>
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">STT</th>
                    <th className="text-left py-2">Tên</th>
                    <th className="text-right py-2">Mức tính</th>
                    <th className="text-right py-2">Chi phí thêm</th>
                    <th className="text-right py-2">Tiền nợ</th>
                    <th className="text-right py-2">Tổng tiền</th>
                    <th className="text-center py-2">Đã thanh toán</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Sort players: unpaid males -> unpaid females -> paid males -> paid females
                    const sortedPlayers = [...(bill.bill_players || [])].sort((a, b) => {
                      const aIsPaid = a.is_paid || false;
                      const bIsPaid = b.is_paid || false;
                      const aGender = a.user?.gender || '';
                      const bGender = b.user?.gender || '';
                      
                      // First sort by payment status: unpaid first (false < true)
                      if (aIsPaid !== bIsPaid) {
                        return aIsPaid ? 1 : -1;
                      }
                      
                      // If same payment status, sort by gender: male first
                      if (aGender !== bGender) {
                        if (aGender === 'male') return -1;
                        if (bGender === 'male') return 1;
                      }
                      
                      return 0;
                    });
                    
                    return sortedPlayers.map((player, index) => (
                    <tr 
                      key={player.id} 
                      className={`border-b ${!player.is_paid ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-3">{index + 1}</td>
                      <td className="py-3 font-medium">{player.user?.name}</td>
                      <td className="text-right py-3">{formatRatio(player.ratio_value)}</td>
                      <td className="text-right py-3">
                        {player.menu_extra_total > 0 ? (
                          <div className="text-right">
                            <div className="font-semibold mb-1">
                              {formatCurrencyRounded(player.menu_extra_total)}
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              {player.bill_player_menus?.map((menuItem, idx) => (
                                <div key={idx} className="text-right">
                                  {menuItem.menu?.name} × {menuItem.quantity} = {formatCurrency(menuItem.subtotal)}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="text-right py-3">
                        {player.debt_amount > 0 ? (
                          <div>
                            <div className="font-semibold mb-1">{formatCurrencyRounded(player.debt_amount)}</div>
                            {player.debt_details && player.debt_details.length > 0 && (
                              <div className="text-xs text-gray-600 space-y-2">
                                {player.debt_details.map((debt, idx) => (
                                  <div key={idx} className="text-right border border-gray-300 rounded p-1.5 bg-gray-50">
                                    {debt.parent_amount !== null && (
                                      <div className="font-medium">
                                        {formatDateDisplay(debt.date)}: {formatCurrencyRounded(debt.parent_amount)}
                                      </div>
                                    )}
                                    {debt.sub_bills && debt.sub_bills.length > 0 && debt.sub_bills.map((subBill, subIdx) => (
                                      <div key={subIdx} className="pl-2 mt-0.5">
                                        {subBill.note || 'Bill con'}: {formatCurrencyRounded(subBill.amount)}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="text-right py-3 font-semibold text-green-600">
                        {formatCurrencyRounded((player.total_amount || 0) + (player.debt_amount || 0))}
                      </td>
                      <td className="text-center py-3">
                        <input
                          type="checkbox"
                          checked={player.is_paid || false}
                          onChange={(e) => {
                            // Nếu đang uncheck, prevent default và hiển thị dialog
                            if (player.is_paid && !e.target.checked) {
                              e.preventDefault();
                              handleMarkPayment(player.user_id, false);
                            } else {
                              // Nếu đang check, cho phép update ngay
                              handleMarkPayment(player.user_id, e.target.checked);
                            }
                          }}
                          className="w-5 h-5 cursor-pointer"
                        />
                        {player.paid_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(player.paid_at).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan="5" className="py-3 text-right">Tổng cộng:</td>
                    <td className="text-right py-3">
                      {formatCurrencyRounded(
                        bill.bill_players?.reduce((sum, p) => sum + (p.total_amount || 0) + (p.debt_amount || 0), 0) || 0
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {(() => {
                // Sort players: unpaid males -> unpaid females -> paid males -> paid females
                const sortedPlayers = [...(bill.bill_players || [])].sort((a, b) => {
                  const aIsPaid = a.is_paid || false;
                  const bIsPaid = b.is_paid || false;
                  const aGender = a.user?.gender || '';
                  const bGender = b.user?.gender || '';
                  
                  // First sort by payment status: unpaid first (false < true)
                  if (aIsPaid !== bIsPaid) {
                    return aIsPaid ? 1 : -1;
                  }
                  
                  // If same payment status, sort by gender: male first
                  if (aGender !== bGender) {
                    if (aGender === 'male') return -1;
                    if (bGender === 'male') return 1;
                  }
                  
                  return 0;
                });
                
                return sortedPlayers.map((player, index) => (
                  <div
                    key={player.id}
                    className={`border rounded-lg p-3 ${
                      !player.is_paid ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                          <h4 className="font-semibold text-gray-900">{player.user?.name}</h4>
                        </div>
                        <div className="text-xs text-gray-600">
                          Mức tính: {formatRatio(player.ratio_value)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {formatCurrencyRounded((player.total_amount || 0) + (player.debt_amount || 0))}
                        </span>
                        <input
                          type="checkbox"
                          checked={player.is_paid || false}
                          onChange={(e) => {
                            if (player.is_paid && !e.target.checked) {
                              e.preventDefault();
                              handleMarkPayment(player.user_id, false);
                            } else {
                              handleMarkPayment(player.user_id, e.target.checked);
                            }
                          }}
                          className="w-5 h-5 cursor-pointer"
                        />
                      </div>
                    </div>
                    
                    {player.menu_extra_total > 0 && (
                      <div className="mb-2 pb-2 border-b border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Chi phí thêm:</div>
                        <div className="text-sm font-semibold mb-1">
                          {formatCurrencyRounded(player.menu_extra_total)}
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {player.bill_player_menus?.map((menuItem, idx) => (
                            <div key={idx}>
                              {menuItem.menu?.name} × {menuItem.quantity} = {formatCurrency(menuItem.subtotal)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {player.debt_amount > 0 && (
                      <div className="mb-2 pb-2 border-b border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Tiền nợ:</div>
                        <div className="text-sm font-semibold mb-1">
                          {formatCurrencyRounded(player.debt_amount)}
                        </div>
                        {player.debt_details && player.debt_details.length > 0 && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {player.debt_details.map((debt, idx) => (
                              <div key={idx} className="border border-gray-300 rounded p-1.5 bg-gray-50">
                                {debt.parent_amount !== null && (
                                  <div className="font-medium">
                                    {formatDateDisplay(debt.date)}: {formatCurrencyRounded(debt.parent_amount)}
                                  </div>
                                )}
                                {debt.sub_bills && debt.sub_bills.length > 0 && debt.sub_bills.map((subBill, subIdx) => (
                                  <div key={subIdx} className="pl-2 mt-0.5">
                                    {subBill.note || 'Bill con'}: {formatCurrencyRounded(subBill.amount)}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {player.paid_at && (
                      <div className="text-xs text-gray-500 mt-2">
                        Đã thanh toán: {new Date(player.paid_at).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>
                ));
              })()}
              
              {/* Total Summary */}
              <div className="border-t-2 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">Tổng cộng:</span>
                  <span className="font-bold text-gray-900">
                    {formatCurrencyRounded(
                      bill.bill_players?.reduce((sum, p) => sum + (p.total_amount || 0) + (p.debt_amount || 0), 0) || 0
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Parent Bill Info - Only show if this is a sub-bill */}
      {bill.parent_bill_id && bill.parent_bill && (
        <div className="bg-blue-50 p-4 sm:p-6 rounded-lg shadow mt-4 sm:mt-6 border-2 border-blue-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-blue-900 mb-2">Bill con của</h3>
              <p className="text-xs sm:text-sm text-gray-700">
                Bill chính #{bill.parent_bill.id} |
                Ngày: {formatDate(bill.parent_bill.date)} |
                Tổng tiền: {formatCurrencyRounded(bill.parent_bill.total_amount)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/bills/${bill.parent_bill.id}`)}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base"
            >
              Xem Bill chính
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa bill"
        message="Bạn có chắc chắn muốn xóa bill này? Hành động này không thể hoàn tác."
      />

      <ConfirmDialog
        isOpen={uncheckPaymentConfirm.isOpen}
        onClose={handleUncheckPaymentCancel}
        onConfirm={handleUncheckPaymentConfirm}
        title="Xác nhận hủy thanh toán"
        message={`Bạn có chắc chắn muốn hủy trạng thái "Đã thanh toán" cho ${uncheckPaymentConfirm.playerName}?`}
      />

      <PayOldBillsDialog
        isOpen={payOldBillsConfirm.isOpen}
        onClose={() => setPayOldBillsConfirm({ isOpen: false, playerId: null, playerName: '', debtAmount: 0, oldBillIds: [] })}
        onPayCurrentOnly={handlePayOldBillsCancel}
        onPayAll={handlePayOldBillsConfirm}
        playerName={payOldBillsConfirm.playerName}
        debtAmount={payOldBillsConfirm.debtAmount}
      />

      {/* Hidden export component for image generation */}
      {selectedAccountId && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <div ref={exportRef}>
            <BillExport 
              bill={bill} 
              paymentAccounts={paymentAccounts.filter(acc => acc.id === selectedAccountId)} 
              paymentAccountImages={paymentAccountImages} 
            />
          </div>
        </div>
      )}

      <SelectPaymentAccountDialog
        isOpen={selectAccountDialog.isOpen}
        onClose={handleSelectAccountCancel}
        onConfirm={handleSelectAccountConfirm}
        paymentAccounts={paymentAccounts}
      />
    </div>
  );
}

