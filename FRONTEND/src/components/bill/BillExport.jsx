import { useMemo } from "react";
import { formatCurrencyRounded, formatDate, formatDateDisplay, formatRatio, roundToNearestThousand } from "../../utils/formatters";

export default function BillExport({ bill, paymentAccounts = [], paymentAccountImages = {} }) {
	// Get active payment accounts (memoized to avoid re-renders)
	// Must be called before any early returns to comply with React Hooks rules
	const activeAccounts = useMemo(() => {
		return paymentAccounts.filter((acc) => acc.is_active);
	}, [paymentAccounts]);

	if (!bill) return null;

	// Helper function to render bill content
	const renderBillContent = (billData, showTitle = true, subBills = null) => {
		// Tính Tiền/người = Tổng tiền / Tổng mức tính
		const sumRatios = (billData.bill_players || []).reduce((sum, p) => {
			const ratio = p.ratio_value ?? 1.0;
			return sum + Number(ratio);
		}, 0);
		const totalAmount = Number(billData.total_amount || 0);
		const perPersonAmount = sumRatios > 0 ? Math.round(totalAmount / sumRatios) : 0;

		return (
			<div>
				{showTitle && (
					<div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
						<h1 className="text-3xl font-bold mb-2">Bill Ngày: {formatDate(billData.date)}</h1>
					</div>
				)}

				{/* Bill Info */}
				<div className="mb-6 grid grid-cols-5 gap-4 bg-gray-50 p-4 rounded-lg">
					<div className="col-span-1">
						<div className="text-sm text-gray-600 mb-1">Tổng tiền sân</div>
						<div className="text-lg font-semibold">{formatCurrencyRounded(billData.court_total)}</div>
					</div>
					<div className="col-span-2">
						<div className="text-sm text-gray-600 mb-1">Tổng tiền cầu</div>
						<div className="text-lg font-semibold">
							{billData.bill_shuttles && billData.bill_shuttles.length > 0 ? (
								<div className="space-y-1">
									{billData.bill_shuttles.map((shuttle, index) => (
										<div key={index}>
											{shuttle.shuttle_type?.name} × {shuttle.quantity} = {formatCurrencyRounded(shuttle.subtotal)}
										</div>
									))}
								</div>
							) : (
								formatCurrencyRounded(billData.total_shuttle_price)
							)}
						</div>
					</div>
					<div className="col-span-1">
						<div className="text-sm text-gray-600 mb-1">Tổng tiền</div>
						<div className="text-xl font-bold text-blue-600">{formatCurrencyRounded(billData.total_amount)}</div>
					</div>
					<div className="col-span-1">
						<div className="text-sm text-gray-600 mb-1">Tiền/người</div>
						<div className="text-lg font-semibold text-green-600">{formatCurrencyRounded(perPersonAmount)}</div>
					</div>
				</div>

			{/* Players Table */}
			<div className="mb-6">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="bg-gray-100">
							<th className="border border-gray-300 px-2 py-2 w-10 text-center">TT</th>
							<th className="border border-gray-300 px-3 py-2 text-left">Tên</th>
							<th className="border border-gray-300 px-2 py-2 w-14 text-right">Mức tính</th>
							<th className="border border-gray-300 px-3 py-2 text-right">Chi phí thêm</th>
							<th className="border border-gray-300 px-3 py-2 text-right">Tiền nợ</th>
							<th className="border border-gray-300 px-3 py-2 text-right">Tổng tiền</th>
							{subBills && subBills.length > 0 && (
								<th className="border border-gray-300 px-3 py-2 text-right">TT + Bill sau</th>
							)}
						</tr>
					</thead>
					<tbody>
						{(() => {
							// Sort players: unpaid males -> unpaid females -> paid males -> paid females
							const sortedPlayers = [...(billData.bill_players || [])].sort((a, b) => {
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
							
							return sortedPlayers.map((player, index) => {
								// Kiểm tra xem bill con có tiền dương không (dùng cho cả 2 cột)
								const hasSubBillWithMoney = subBills && subBills.length > 0 ? subBills.some((subBill) => {
									const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === player.user_id);
									if (subBillPlayer) {
										const subBillTotalAmount = (subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0);
										return subBillTotalAmount > 0;
									}
									return false;
								}) : false;
								
								// Xác định màu cho cột "Tổng tiền": 
								// - Chỉ áp dụng cho bill chính (khi subBills không null và có giá trị)
								// - Xanh khi không có subBill nào có tiền hoặc khi không có subBills
								const isMainBill = subBills !== null && subBills !== undefined;
								const shouldShowGreenForTotal = isMainBill && (!subBills.length || (!hasSubBillWithMoney && subBills.length > 0));
								
								return (
								<tr key={player.id}>
									<td className="border border-gray-300 px-2 py-2 text-center">{index + 1}</td>
									<td className="border border-gray-300 px-3 py-2 font-medium">{player.user?.name}</td>
									<td className="border border-gray-300 px-2 py-2 text-right">{formatRatio(player.ratio_value)}</td>
									<td className="border border-gray-300 px-3 py-2 text-right">
										{player.bill_player_menus && player.bill_player_menus.length > 0 ? (
											<div className="text-right">
												<div className="font-semibold mb-1">{formatCurrencyRounded(player.menu_extra_total || 0)}</div>
												<div className="text-xs text-gray-600 space-y-1">
													{player.bill_player_menus.map((menuItem, idx) => (
														<div key={idx} className="text-right">
															{menuItem.menu?.name} × {menuItem.quantity} = {formatCurrencyRounded(menuItem.subtotal)}
														</div>
													))}
												</div>
											</div>
										) : (
											"-"
										)}
									</td>
									<td className="border border-gray-300 px-3 py-2 text-right">
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
											"-"
										)}
									</td>
									<td className={`border border-gray-300 px-3 py-2 text-right font-semibold ${shouldShowGreenForTotal ? 'text-green-600' : ''}`}>
										{formatCurrencyRounded((player.total_amount || 0) + (player.debt_amount || 0))}
									</td>
									{subBills && subBills.length > 0 && (
										<td className="border border-gray-300 px-3 py-2 text-right font-semibold text-green-600">
											{(() => {
												// Nếu không có bill con nào có tiền dương, hiển thị rỗng
												if (!hasSubBillWithMoney) {
													return '';
												}
												
												// Lấy giá trị cột "Tổng tiền" trong bill chính (total_amount + debt_amount)
												// Làm tròn từng giá trị trước khi cộng để nhất quán với hiển thị
												const mainBillTotalAmount = roundToNearestThousand((player.total_amount || 0) + (player.debt_amount || 0));
												
												// Lấy tổng giá trị cột "Tổng tiền" trong tất cả bill phụ
												// Làm tròn từng giá trị trước khi cộng để nhất quán với hiển thị
												const subBillsTotalAmount = subBills.reduce((sum, subBill) => {
													const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === player.user_id);
													if (subBillPlayer) {
														// Giá trị cột "Tổng tiền" của player trong bill phụ
														const subBillTotalAmount = roundToNearestThousand((subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0));
														return sum + subBillTotalAmount;
													}
													return sum;
												}, 0);
												
												// Tổng tiền 2 bill = Tổng tiền bill chính + Tổng tiền bill phụ
												return formatCurrencyRounded(mainBillTotalAmount + subBillsTotalAmount);
											})()}
										</td>
									)}
								</tr>
								);
							});
						})()}
					</tbody>
				</table>
			</div>
		</div>
	);
	};

	// Render payment accounts section
	const renderPaymentAccounts = () => {
		if (activeAccounts.length === 0) return null;

		return (
			<div>
				<div className="space-y-4">
					{activeAccounts.map((account) => {
						// Check if qr_code_image is already a base64 string (starts with data:image/)
						const isBase64 = account.qr_code_image && account.qr_code_image.startsWith('data:image/');
						
						// Use base64 from paymentAccountImages (preloaded), or direct base64 from account, or fallback to old URL method
						const base64Image = paymentAccountImages[account.id];
						const imageSrc = base64Image || (isBase64 ? account.qr_code_image : null) || 
							(account.qr_code_image_url || (account.qr_code_image ? `${window.location.origin}/storage/${account.qr_code_image}` : null));

						return (
							<div key={account.id} className="text-center p-4 bg-gray-50 rounded-lg border">
								{account.qr_code_image && imageSrc && (
									<div className="mt-3 w-full">
										<img
											src={imageSrc}
											alt="QR Code"
											className="w-full h-auto object-contain border-2 border-gray-300 rounded bill-export-image"
											crossOrigin={isBase64 || base64Image ? undefined : "anonymous"}
											loading="eager"
											style={{ maxHeight: "500px" }}
										/>
									</div>
								)}
								{account.note && <div className="mt-2 text-xs text-gray-600 italic">{account.note}</div>}
							</div>
						);
					})}
				</div>
			</div>
		);
	};

	// Check if bill has sub_bills
	const hasSubBills = bill.sub_bills && bill.sub_bills.length > 0;

	// Layout khi có bill phụ: Bill chính trái, Bill phụ phải, QR dưới bill phụ
	if (hasSubBills) {
		return (
			<div id="bill-export" className="bg-white p-6 mx-auto" style={{ fontFamily: "Arial, sans-serif", maxWidth: "1728px" }}>
				<div className="grid grid-cols-[3fr_2fr] gap-6">
					{/* Cột trái: Bill chính */}
					<div>{renderBillContent(bill, true, bill.sub_bills || [])}</div>

					{/* Cột phải: Bill phụ và QR thanh toán */}
					<div>
						<div className="border-l-2 border-gray-800 pl-6">
							{/* Bill phụ */}
							{bill.sub_bills.map((subBill) => (
								<div key={subBill.id} className="mb-6">
									<div className="text-center mb-4 border-b-2 border-gray-600 pb-2">
										<h2 className="text-2xl font-bold mb-1">Bill: {subBill.note || "sau 9h"}</h2>
									</div>
									{renderBillContent(subBill, false)}
								</div>
							))}

							{/* QR thanh toán dưới bill phụ */}
							{activeAccounts.length > 0 && <div className="mt-6 pt-6 border-t-2 border-gray-600">{renderPaymentAccounts()}</div>}
						</div>
					</div>
				</div>
			</div>
		);
	}

	// Layout khi không có bill phụ: Bill trái, QR phải (như hiện tại)
	return (
		<div id="bill-export" className="bg-white p-6 max-w-6xl mx-auto" style={{ fontFamily: "Arial, sans-serif" }}>
			<div className="grid grid-cols-3 gap-6">
				{/* Cột trái: Nội dung phiếu thu */}
				<div className="col-span-2">{renderBillContent(bill, true, bill.sub_bills || [])}</div>

				{/* Cột phải: Thông tin thanh toán */}
				{activeAccounts.length > 0 && (
					<div className="col-span-1">
						<div className="border-l-2 border-gray-800 pl-6">{renderPaymentAccounts()}</div>
					</div>
				)}
			</div>
		</div>
	);
}
