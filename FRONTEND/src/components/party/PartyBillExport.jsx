import { useMemo } from "react";
import { formatCurrencyRounded, formatDate, formatDateDisplay, formatRatio } from "../../utils/formatters";

export default function PartyBillExport({ bill, paymentAccounts = [], paymentAccountImages = {} }) {
	// Get active payment accounts (memoized to avoid re-renders)
	const activeAccounts = useMemo(() => {
		return paymentAccounts.filter((acc) => acc.is_active);
	}, [paymentAccounts]);

	if (!bill) return null;

	return (
		<div id="bill-export" className="bg-white p-6 max-w-6xl mx-auto" style={{ fontFamily: "Arial, sans-serif" }}>
			<div className="grid grid-cols-3 gap-6">
				{/* Cột trái: Nội dung phiếu thu tiệc */}
				<div className="col-span-2">
					<div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
						<h1 className="text-3xl font-bold mb-2">Bill Ngày: {formatDate(bill.date)}</h1>
					</div>

					{/* Bill Info */}
					<div className="mb-6 grid grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
						<div className="col-span-1">
							<div className="text-sm text-gray-600 mb-1">Tổng tiền tiệc</div>
							<div className="text-lg font-semibold">{formatCurrencyRounded(bill.base_amount || 0)}</div>
						</div>
						<div className="col-span-1">
							<div className="text-sm text-gray-600 mb-1">Tổng chi phí thêm</div>
							<div className="text-lg font-semibold">{formatCurrencyRounded(bill.total_extra || 0)}</div>
							{bill.extras && bill.extras.length > 0 && (
								<div className="text-xs text-gray-600 mt-2 space-y-1">
									{bill.extras.map((ex) => (
										<div key={ex.id} className="flex justify-between">
											<span>{ex.name}</span>
											<span>{formatCurrencyRounded(ex.amount)}</span>
										</div>
									))}
								</div>
							)}
						</div>
						<div className="col-span-1 text-right">
							<div className="text-sm text-gray-600 mb-1">Tổng tiền</div>
							<div className="text-xl font-bold text-blue-600">{formatCurrencyRounded(bill.total_amount || 0)}</div>
						</div>
						<div className="col-span-1 text-right">
							<div className="text-sm text-gray-600 mb-1">Số tiền/người</div>
							<div className="text-lg font-semibold text-green-600">{formatCurrencyRounded(bill.unit_price || 0)}</div>
						</div>
					</div>

					{/* Participants Table */}
					<div className="mb-6">
						<table className="w-full border-collapse text-sm">
							<thead>
								<tr className="bg-gray-100">
									<th className="border border-gray-300 px-3 py-2 text-left">STT</th>
									<th className="border border-gray-300 px-3 py-2 text-left">Tên</th>
									<th className="border border-gray-300 px-3 py-2 text-right">Đã chi</th>
									<th className="border border-gray-300 px-3 py-2 text-right">Chi phí thêm</th>
									<th className="border border-gray-300 px-3 py-2 text-left">Ghi chú</th>
									<th className="border border-gray-300 px-3 py-2 text-right">Nợ</th>
									<th className="border border-gray-300 px-3 py-2 text-right">Tổng tiền</th>
									<th className="border border-gray-300 px-3 py-2 text-center">Đã TT</th>
								</tr>
							</thead>
							<tbody>
								{(() => {
									// Sort participants: unpaid first, then paid
									const sortedParticipants = [...(bill.participants || [])].sort((a, b) => {
										const aIsPaid = a.is_paid || false;
										const bIsPaid = b.is_paid || false;
										// Unpaid first (false < true)
										return aIsPaid === bIsPaid ? 0 : aIsPaid ? 1 : -1;
									});

									return sortedParticipants.map((participant, index) => {
										const shareAmount = participant.share_amount || 0;
										const foodAmount = participant.food_amount || 0;
										const paidAmount = participant.paid_amount || 0;
										const totalAmount = shareAmount + foodAmount - paidAmount;

										return (
											<tr key={participant.id}>
												<td className="border border-gray-300 px-3 py-2">{index + 1}</td>
												<td className="border border-gray-300 px-3 py-2">
													<div className="font-medium">{participant.name}</div>
													<div className="text-xs text-gray-600 mt-1">Mức: {formatRatio(participant.ratio_value || 1)}</div>
												</td>
												<td className="border border-gray-300 px-3 py-2 text-right">
													{formatCurrencyRounded(paidAmount)}
												</td>
												<td className="border border-gray-300 px-3 py-2 text-right">
													{formatCurrencyRounded(foodAmount)}
												</td>
												<td className="border border-gray-300 px-3 py-2 text-left text-xs">
													{participant.note || "-"}
												</td>
												<td className="border border-gray-300 px-3 py-2 text-right">
													{participant.debt_amount > 0 ? (
														<div>
															<div className="font-semibold mb-1">{formatCurrencyRounded(participant.debt_amount || 0)}</div>
															{participant.debt_details && participant.debt_details.length > 0 && (
																<div className="text-xs text-gray-600 space-y-2">
																	{participant.debt_details.map((debt, idx) => (
																		<div key={idx} className="text-right border border-gray-300 rounded p-1.5 bg-gray-50">
																			<div className="font-medium">
																				{formatDateDisplay(debt.date)}: {formatCurrencyRounded(debt.amount)}
																			</div>
																		</div>
																	))}
																</div>
															)}
														</div>
													) : (
														"-"
													)}
												</td>
												<td className="border border-gray-300 px-3 py-2 text-right font-semibold">
													{formatCurrencyRounded(totalAmount + (participant.debt_amount || 0))}
												</td>
												<td className="border border-gray-300 px-3 py-2 text-center">{participant.is_paid ? "✓" : ""}</td>
											</tr>
										);
									});
								})()}
							</tbody>
						</table>
					</div>

					{/* Note */}
					{bill.note && (
						<div className="mb-4 text-sm text-gray-600">
							<div className="font-semibold">Ghi chú:</div>
							<div>{bill.note}</div>
						</div>
					)}
				</div>

				{/* Cột phải: Thông tin thanh toán */}
				{activeAccounts.length > 0 && (
					<div className="col-span-1">
						<div className="border-l-2 border-gray-800 pl-6">
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
					</div>
				)}
			</div>
		</div>
	);
}

