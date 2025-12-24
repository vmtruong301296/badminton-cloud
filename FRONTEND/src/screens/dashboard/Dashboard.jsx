import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { billsApi } from "../../services/api";
import { formatCurrencyRounded, formatDate, roundToNearestThousand } from "../../utils/formatters";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useAuth } from "../../contexts/AuthContext";

export default function Dashboard() {
	const { hasPermission } = useAuth();
	const [bills, setBills] = useState([]);
	const [allBills, setAllBills] = useState([]); // Store all bills for unpaid players calculation
	const [loading, setLoading] = useState(true);
	const [filters, setFilters] = useState({
		date_from: "",
		date_to: "",
		player_id: "",
		status: ["partial", "unpaid"], // Array of selected statuses: 'paid', 'partial', 'unpaid'
		limit: 10, // Limit number of main bills to display
	});
	const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, billId: null });
	const [markingPayment, setMarkingPayment] = useState(new Set()); // Track players being marked as paid
	const [currentPage, setCurrentPage] = useState(1);
	const [statsMonth, setStatsMonth] = useState(() => {
		// Default to current month (YYYY-MM format)
		const now = new Date();
		return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	});
	const [statsModalOpen, setStatsModalOpen] = useState(false);

	useEffect(() => {
		loadBills();
		setCurrentPage(1); // Reset to page 1 when filters change
	}, [filters]);

	// Adjust currentPage if it exceeds totalPages (e.g., when limit changes)
	useEffect(() => {
		const mainBills = bills.filter((bill) => !bill.parent_bill_id);
		const totalPagesCount = Math.ceil(mainBills.length / filters.limit);
		if (currentPage > totalPagesCount && totalPagesCount > 0) {
			setCurrentPage(totalPagesCount);
		}
	}, [bills, filters.limit, currentPage]);

	const loadBills = async () => {
		try {
			setLoading(true);
			const params = {};
			if (filters.date_from) params.date_from = filters.date_from;
			if (filters.date_to) params.date_to = filters.date_to;
			if (filters.player_id) params.player_id = filters.player_id;

			const response = await billsApi.getAll(params);
			let filteredBills = response.data;

			// Store all bills for unpaid players calculation (without status filter)
			setAllBills(response.data);

			// Filter by status on frontend (multiple statuses can be selected)
			if (filters.status && filters.status.length > 0) {
				filteredBills = filteredBills.filter((bill) => {
					const allPaid = bill.bill_players?.every((p) => p.is_paid) || false;
					const somePaid = bill.bill_players?.some((p) => p.is_paid) || false;

					// Check if bill matches any of the selected statuses
					return filters.status.some((status) => {
						if (status === "paid") return allPaid && bill.bill_players?.length > 0;
						if (status === "partial") return somePaid && !allPaid;
						if (status === "unpaid") return !somePaid;
						return false;
					});
				});
			}

			setBills(filteredBills);
		} catch (error) {
			console.error("Error loading bills:", error);
		} finally {
			setLoading(false);
		}
	};

	const getStatusColor = (bill) => {
		const allPaid = bill.bill_players?.every((p) => p.is_paid);
		const somePaid = bill.bill_players?.some((p) => p.is_paid);

		if (allPaid) return "bg-green-100 text-green-800";
		if (somePaid) return "bg-yellow-100 text-yellow-800";
		return "bg-gray-100 text-gray-800";
	};

	const getStatusText = (bill) => {
		const allPaid = bill.bill_players?.every((p) => p.is_paid);
		const somePaid = bill.bill_players?.some((p) => p.is_paid);

		if (allPaid) return "Đã thanh toán";
		if (somePaid) return "Thanh toán 1 phần";
		return "Chưa thanh toán";
	};

	// Check if bill is overdue (quá 7 ngày) and has unpaid players
	const isOverdueWarning = (bill) => {
		if (!bill.date) return false;

		const billDate = new Date(bill.date);
		billDate.setHours(0, 0, 0, 0); // Reset time to start of day

		const today = new Date();
		today.setHours(0, 0, 0, 0); // Reset time to start of day

		// Calculate difference in days
		const diffTime = today - billDate;
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		// Check if bill is 7 days or more old (quá 7 ngày)
		const isOverdue = diffDays >= 7;

		// Check if there are unpaid players
		const unpaidCount = bill.bill_players?.filter((p) => !p.is_paid).length || 0;
		const hasUnpaidPlayers = unpaidCount > 0;

		return isOverdue && hasUnpaidPlayers;
	};

	// Check if player has overdue bills (quá 7 ngày)
	const isPlayerOverdue = (player) => {
		if (!player.unpaidDates || player.unpaidDates.length === 0) return false;

		const today = new Date();
		today.setHours(0, 0, 0, 0); // Reset time to start of day

		// Check if any unpaid date is 7 days or more old
		return player.unpaidDates.some((dateItem) => {
			if (!dateItem.date) return false;

			const billDate = new Date(dateItem.date);
			billDate.setHours(0, 0, 0, 0); // Reset time to start of day

			// Calculate difference in days
			const diffTime = today - billDate;
			const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

			// Check if bill is 7 days or more old (quá 7 ngày)
			return diffDays >= 7;
		});
	};

	const handleDeleteClick = (billId) => {
		setDeleteConfirm({ isOpen: true, billId });
	};

	const handleDeleteConfirm = async () => {
		try {
			await billsApi.delete(deleteConfirm.billId);
			setDeleteConfirm({ isOpen: false, billId: null });
			loadBills(); // Reload bills after deletion
		} catch (error) {
			console.error("Error deleting bill:", error);
			alert("Có lỗi xảy ra khi xóa bill");
		}
	};

	const handleDeleteCancel = () => {
		setDeleteConfirm({ isOpen: false, billId: null });
	};

	// Mark payment for all unpaid bills of a player
	const handleMarkPlayerPayment = async (userId) => {
		try {
			setMarkingPayment((prev) => new Set(prev).add(userId));

			// Find all bills where this player hasn't paid
			const unpaidBills = allBills.filter((bill) => {
				const player = bill.bill_players?.find((p) => p.user_id === userId);
				return player && !player.is_paid;
			});

			// Mark payment for all unpaid bills
			const promises = unpaidBills.map(async (bill) => {
				try {
					const player = bill.bill_players?.find((p) => p.user_id === userId);
					if (player) {
						await billsApi.markPayment(bill.id, userId, {
							amount: (player.total_amount || 0) + (player.debt_amount || 0),
							is_paid: true,
						});
					}
				} catch (error) {
					console.error(`Error marking payment for bill ${bill.id}:`, error);
					throw error; // Re-throw to handle in outer catch
				}
			});

			await Promise.all(promises);

			// Update state directly without reloading
			setAllBills((prevBills) => {
				return prevBills.map((bill) => {
					const playerIndex = bill.bill_players?.findIndex((p) => p.user_id === userId);
					if (playerIndex !== undefined && playerIndex !== -1) {
						const updatedBill = { ...bill };
						updatedBill.bill_players = [...(bill.bill_players || [])];
						updatedBill.bill_players[playerIndex] = {
							...updatedBill.bill_players[playerIndex],
							is_paid: true,
						};
						return updatedBill;
					}
					return bill;
				});
			});

			setBills((prevBills) => {
				return prevBills.map((bill) => {
					const playerIndex = bill.bill_players?.findIndex((p) => p.user_id === userId);
					if (playerIndex !== undefined && playerIndex !== -1) {
						const updatedBill = { ...bill };
						updatedBill.bill_players = [...(bill.bill_players || [])];
						updatedBill.bill_players[playerIndex] = {
							...updatedBill.bill_players[playerIndex],
							is_paid: true,
						};
						return updatedBill;
					}
					return bill;
				});
			});
		} catch (error) {
			console.error("Error marking player payment:", error);
			alert("Có lỗi xảy ra khi đánh dấu thanh toán");
		} finally {
			setMarkingPayment((prev) => {
				const newSet = new Set(prev);
				newSet.delete(userId);
				return newSet;
			});
		}
	};

	// Format date to YYYY/MM/DD
	const formatDateForUnpaid = (date) => {
		if (!date) return "";
		const d = new Date(date);
		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${year}/${month}/${day}`;
	};

	// Calculate unpaid players list
	const unpaidPlayers = useMemo(() => {
		const playerMap = new Map();

		// Process all bills to collect unpaid players
		allBills.forEach((bill) => {
			if (!bill.bill_players) return;

			bill.bill_players.forEach((player) => {
				if (player.is_paid) return; // Skip paid players

				const userId = player.user_id;
				const userName = player.user?.name || "Unknown";

				if (!playerMap.has(userId)) {
					playerMap.set(userId, {
						userId,
						name: userName,
						totalAmount: 0,
						unpaidDates: [],
					});
				}

				const playerData = playerMap.get(userId);
				// Total amount includes both current bill amount and debt amount (đã làm tròn)
				const playerTotal = roundToNearestThousand((player.total_amount || 0) + (player.debt_amount || 0));
				playerData.totalAmount += playerTotal;

				// Add bill date if player hasn't paid (only current bill amount, debt được tách ở debt_details)
				if (bill.date && player.total_amount > 0) {
					playerData.unpaidDates.push({
						date: bill.date,
						// Làm tròn giống như tổng để tránh lệch giữa "Tổng tiền" và "DS ngày thiếu"
						amount: roundToNearestThousand(player.total_amount || 0),
						billId: bill.id,
					});
				}

				// Add debt details dates
				if (player.debt_details && Array.isArray(player.debt_details)) {
					player.debt_details.forEach((debt) => {
						if (debt.date) {
							let debtAmount = 0;
							if (debt.parent_amount !== null) {
								debtAmount += debt.parent_amount;
							}
							if (debt.sub_bills && Array.isArray(debt.sub_bills)) {
								debt.sub_bills.forEach((subBill) => {
									debtAmount += subBill.amount || 0;
								});
							}

							if (debtAmount > 0) {
								playerData.unpaidDates.push({
									date: debt.date,
									// Làm tròn cho từng mục nợ theo đúng cách hiển thị
									amount: roundToNearestThousand(debtAmount),
									billId: bill.id,
								});
							}
						}
					});
				}
			});
		});

		// Convert map to array and sort dates (newest first)
		return Array.from(playerMap.values())
			.map((player) => {
				// Sort dates: newest first (descending)
				const sortedDates = [...player.unpaidDates].sort((a, b) => {
					return new Date(b.date) - new Date(a.date);
				});

				// Group by date and sum amounts for same date
				const dateMap = new Map();
				sortedDates.forEach((item) => {
					const dateKey = item.date;
					if (!dateMap.has(dateKey)) {
						dateMap.set(dateKey, { date: dateKey, amount: 0 });
					}
					dateMap.get(dateKey).amount += item.amount;
				});

				return {
					...player,
					unpaidDates: Array.from(dateMap.values()).sort((a, b) => {
						return new Date(b.date) - new Date(a.date);
					}),
				};
			})
			.filter((player) => player.totalAmount > 0)
			.sort((a, b) => {
				// Sort by latest unpaid date (descending - newest first)
				const aLatestDate = a.unpaidDates && a.unpaidDates.length > 0 ? new Date(a.unpaidDates[0].date) : new Date(0);
				const bLatestDate = b.unpaidDates && b.unpaidDates.length > 0 ? new Date(b.unpaidDates[0].date) : new Date(0);
				return bLatestDate - aLatestDate; // Descending order (newest first)
			});
	}, [allBills]);

	// Calculate displayed bills and total main bills count
	const { billGroups, totalMainBillsCount, totalPages } = useMemo(() => {
		// Sort all bills by date descending (newest first)
		const sortedBills = [...bills].sort((a, b) => {
			const dateA = a.date ? new Date(a.date) : new Date(0);
			const dateB = b.date ? new Date(b.date) : new Date(0);
			return dateB - dateA; // Descending order (newest first)
		});

		// Separate main bills and sub bills (after sorting)
		const mainBills = sortedBills.filter((bill) => !bill.parent_bill_id);
		const subBills = sortedBills.filter((bill) => bill.parent_bill_id);

		// Calculate total pages
		const totalPagesCount = Math.ceil(mainBills.length / filters.limit);

		// Calculate pagination: get main bills for current page
		const startIndex = (currentPage - 1) * filters.limit;
		const endIndex = startIndex + filters.limit;
		const paginatedMainBills = mainBills.slice(startIndex, endIndex);

		// Get all sub bills that belong to the paginated main bills
		const mainBillIds = new Set(paginatedMainBills.map((bill) => bill.id));
		const relatedSubBills = subBills.filter((bill) => mainBillIds.has(bill.parent_bill_id));

		// Group sub bills by parent bill ID
		const subBillsByParent = new Map();
		relatedSubBills.forEach((subBill) => {
			const parentId = subBill.parent_bill_id;
			if (!subBillsByParent.has(parentId)) {
				subBillsByParent.set(parentId, []);
			}
			subBillsByParent.get(parentId).push(subBill);
		});

		// Sort sub bills by date (newest first) within each parent group
		subBillsByParent.forEach((subs) => {
			subs.sort((a, b) => {
				const dateA = a.date ? new Date(a.date) : new Date(0);
				const dateB = b.date ? new Date(b.date) : new Date(0);
				return dateB - dateA;
			});
		});

		// Build bill groups: each group contains main bill and its sub bills
		const groups = paginatedMainBills.map((mainBill) => ({
			mainBill,
			subBills: subBillsByParent.get(mainBill.id) || [],
		}));

		return {
			billGroups: groups,
			totalMainBillsCount: mainBills.length,
			totalPages: totalPagesCount,
		};
	}, [bills, filters.limit, currentPage]);

	// Calculate monthly statistics
	const monthlyStats = useMemo(() => {
		if (!allBills || allBills.length === 0) {
			return {
				shuttles: [],
				players: [],
			};
		}

		// Parse selected month
		const [year, month] = statsMonth.split('-').map(Number);
		const startDate = new Date(year, month - 1, 1);
		const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month

		// Filter bills in selected month
		const billsInMonth = allBills.filter((bill) => {
			if (!bill.date) return false;
			const billDate = new Date(bill.date);
			return billDate >= startDate && billDate <= endDate;
		});

		// Calculate shuttle statistics
		const shuttleMap = new Map(); // { shuttleTypeId: { name, totalQuantity } }
		billsInMonth.forEach((bill) => {
			if (bill.bill_shuttles && Array.isArray(bill.bill_shuttles)) {
				bill.bill_shuttles.forEach((shuttle) => {
					const shuttleTypeId = shuttle.shuttle_type_id;
					const shuttleTypeName = shuttle.shuttle_type?.name || 'Unknown';
					const quantity = shuttle.quantity || 0;

					if (!shuttleMap.has(shuttleTypeId)) {
						shuttleMap.set(shuttleTypeId, {
							name: shuttleTypeName,
							totalQuantity: 0,
						});
					}

					const current = shuttleMap.get(shuttleTypeId);
					current.totalQuantity += quantity;
				});
			}
		});

		// Convert shuttle map to array and sort by name
		const shuttles = Array.from(shuttleMap.values()).sort((a, b) => 
			a.name.localeCompare(b.name)
		);

		// Calculate player statistics
		const playerMap = new Map(); // { userId: { name, totalAmount, billCount } }
		billsInMonth.forEach((bill) => {
			// Only count main bills (not sub-bills)
			if (bill.parent_bill_id) return;

			if (bill.bill_players && Array.isArray(bill.bill_players)) {
				bill.bill_players.forEach((player) => {
					const userId = player.user_id;
					const userName = player.user?.name || 'Unknown';
					// Total amount includes both current bill amount and debt amount
					const playerTotal = roundToNearestThousand((player.total_amount || 0) + (player.debt_amount || 0));

					if (!playerMap.has(userId)) {
						playerMap.set(userId, {
							name: userName,
							totalAmount: 0,
							billCount: 0,
						});
					}

					const current = playerMap.get(userId);
					current.totalAmount += playerTotal;
					current.billCount += 1; // Count this bill for this player
				});
			}
		});

		// Convert player map to array and sort by total amount (descending)
		const players = Array.from(playerMap.values())
			.filter((p) => p.totalAmount > 0)
			.sort((a, b) => b.totalAmount - a.totalAmount);

		// Calculate total shuttles for "ống cầu" calculation
		const totalShuttles = shuttles.reduce((sum, s) => sum + s.totalQuantity, 0);
		const totalOngCau = Math.floor(totalShuttles / 12); // 1 ống cầu = 12 quả
		const remainingShuttles = totalShuttles % 12;

		return {
			shuttles,
			players,
			totalShuttles,
			totalOngCau,
			remainingShuttles,
		};
	}, [allBills, statsMonth]);

	return (
		<div className="px-2 sm:px-0">
			<div className="flex flex-row justify-between items-center mb-6 gap-4">
				<h2 className="text-xl sm:text-2xl font-bold text-gray-900">Danh sách Bills</h2>
				<div className="flex items-center gap-3">
					<button
						onClick={() => setStatsModalOpen(true)}
						className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm sm:text-base flex items-center gap-2 whitespace-nowrap">
						📊 Xem thống kê tháng
					</button>
					{hasPermission('bills.create') && (
						<Link to="/bills/create" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm sm:text-base whitespace-nowrap">
							➕ Tạo Bill
						</Link>
					)}
				</div>
			</div>

			{/* Filters */}
			<div className="bg-white p-4 rounded-lg shadow mb-6">
				{/* Mobile Layout */}
				<div className="sm:hidden space-y-4">
					{/* Row 1: Từ ngày bên trái, Đến ngày bên phải */}
					<div className="flex gap-4">
						<div className="flex-1">
							<label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
							<input
								type="date"
								value={filters.date_from}
								onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
								className="w-full px-3 py-2 border border-gray-300 rounded-md"
							/>
						</div>
						<div className="flex-1">
							<label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
							<input
								type="date"
								value={filters.date_to}
								onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
								className="w-full px-3 py-2 border border-gray-300 rounded-md"
							/>
						</div>
					</div>
					{/* Row 2: Trạng thái bên trái, Số bill hiển thị và Nút xóa bộ lọc bên phải */}
					<div className="flex gap-4">
						<div className="flex-1">
							<label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
							<div className="space-y-2">
								<label className="flex items-center">
									<input
										type="checkbox"
										checked={filters.status.includes("paid")}
										onChange={(e) => {
											if (e.target.checked) {
												setFilters({ ...filters, status: [...filters.status, "paid"] });
											} else {
												setFilters({ ...filters, status: filters.status.filter((s) => s !== "paid") });
											}
										}}
										className="mr-2"
									/>
									<span className="text-sm text-gray-700">Đã thanh toán</span>
								</label>
								<label className="flex items-center">
									<input
										type="checkbox"
										checked={filters.status.includes("partial")}
										onChange={(e) => {
											if (e.target.checked) {
												setFilters({ ...filters, status: [...filters.status, "partial"] });
											} else {
												setFilters({ ...filters, status: filters.status.filter((s) => s !== "partial") });
											}
										}}
										className="mr-2"
									/>
									<span className="text-sm text-gray-700">Thanh toán 1 phần</span>
								</label>
								<label className="flex items-center">
									<input
										type="checkbox"
										checked={filters.status.includes("unpaid")}
										onChange={(e) => {
											if (e.target.checked) {
												setFilters({ ...filters, status: [...filters.status, "unpaid"] });
											} else {
												setFilters({ ...filters, status: filters.status.filter((s) => s !== "unpaid") });
											}
										}}
										className="mr-2"
									/>
									<span className="text-sm text-gray-700">Chưa thanh toán</span>
								</label>
							</div>
						</div>
						<div className="flex-1 flex flex-col gap-2">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">Số bill hiển thị</label>
								<select
									value={filters.limit}
									onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
									className="w-full px-3 py-2 border border-gray-300 rounded-md">
									<option value={10}>10</option>
									<option value={20}>20</option>
									<option value={30}>30</option>
									<option value={40}>40</option>
									<option value={50}>50</option>
								</select>
							</div>
							<div className="flex items-end">
								<button
									onClick={() => setFilters({ date_from: "", date_to: "", player_id: "", status: [], limit: 10 })}
									className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
									Xóa bộ lọc
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Desktop Layout */}
				<div className="hidden sm:grid grid-cols-2 lg:grid-cols-5 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
						<input
							type="date"
							value={filters.date_from}
							onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
							className="w-full px-3 py-2 border border-gray-300 rounded-md"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
						<input
							type="date"
							value={filters.date_to}
							onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
							className="w-full px-3 py-2 border border-gray-300 rounded-md"
						/>
					</div>
					<div className="sm:col-span-2 lg:col-span-1">
						<label className="block text-sm font-medium text-gray-700 mb-2">Trạng thái</label>
						<div className="space-y-2">
							<label className="flex items-center">
								<input
									type="checkbox"
									checked={filters.status.includes("paid")}
									onChange={(e) => {
										if (e.target.checked) {
											setFilters({ ...filters, status: [...filters.status, "paid"] });
										} else {
											setFilters({ ...filters, status: filters.status.filter((s) => s !== "paid") });
										}
									}}
									className="mr-2"
								/>
								<span className="text-sm text-gray-700">Đã thanh toán</span>
							</label>
							<label className="flex items-center">
								<input
									type="checkbox"
									checked={filters.status.includes("partial")}
									onChange={(e) => {
										if (e.target.checked) {
											setFilters({ ...filters, status: [...filters.status, "partial"] });
										} else {
											setFilters({ ...filters, status: filters.status.filter((s) => s !== "partial") });
										}
									}}
									className="mr-2"
								/>
								<span className="text-sm text-gray-700">Thanh toán 1 phần</span>
							</label>
							<label className="flex items-center">
								<input
									type="checkbox"
									checked={filters.status.includes("unpaid")}
									onChange={(e) => {
										if (e.target.checked) {
											setFilters({ ...filters, status: [...filters.status, "unpaid"] });
										} else {
											setFilters({ ...filters, status: filters.status.filter((s) => s !== "unpaid") });
										}
									}}
									className="mr-2"
								/>
								<span className="text-sm text-gray-700">Chưa thanh toán</span>
							</label>
						</div>
					</div>
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Số bill hiển thị</label>
						<select
							value={filters.limit}
							onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
							className="w-full px-3 py-2 border border-gray-300 rounded-md">
							<option value={10}>10</option>
							<option value={20}>20</option>
							<option value={30}>30</option>
							<option value={40}>40</option>
							<option value={50}>50</option>
						</select>
					</div>
					<div className="sm:col-span-2 lg:col-span-1 flex items-end">
						<button
							onClick={() => setFilters({ date_from: "", date_to: "", player_id: "", status: [], limit: 10 })}
							className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
							Xóa bộ lọc
						</button>
					</div>
				</div>
			</div>

			{/* Main Content: Bills Table and Unpaid Players */}
			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
				{/* Bills Table - Left Side (3/4 width) */}
				<div className="lg:col-span-3">
					{loading ? (
						<div className="text-center py-8">Đang tải...</div>
					) : billGroups.length === 0 ? (
						<div className="text-center py-8 text-gray-500">Chưa có bill nào</div>
					) : (
						<div className="bg-white shadow rounded-lg overflow-hidden">
							{/* Desktop Table View */}
							<div className="hidden md:block space-y-4">
								{billGroups.map((group) => {
									const mainBill = group.mainBill;
									const subBills = group.subBills;
									const mainBillWarning = isOverdueWarning(mainBill);
									const mainBillAllPaid = mainBill.bill_players?.every((p) => p.is_paid) && mainBill.bill_players?.length > 0;

									return (
										<div
											key={mainBill.id}
											className={`border-2 rounded-lg overflow-hidden ${mainBillWarning ? 'border-red-300' : mainBillAllPaid ? 'border-green-300' : 'border-gray-300'
												}`}>
											<table className="min-w-full divide-y divide-gray-200">
												<thead className="bg-gray-50">
													<tr>
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày</th>
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tổng tiền</th>
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chưa TT</th>
														<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
													</tr>
												</thead>
												<tbody className="bg-white divide-y divide-gray-200">
													{/* Main Bill Row */}
													<tr
														className={`hover:bg-gray-50 ${mainBillWarning
																? "bg-red-100 hover:bg-red-200"
																: mainBillAllPaid
																	? "bg-green-50 hover:bg-green-100"
																	: ""
															}`}>
														<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(mainBill.date)}</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Bill chính #{mainBill.id}</span>
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrencyRounded(mainBill.total_amount)}</td>
														<td className="px-6 py-4 whitespace-nowrap">
															<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(mainBill)}`}>{getStatusText(mainBill)}</span>
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
															{mainBill.bill_players?.filter((p) => !p.is_paid).length || 0}
														</td>
														<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
															<div className="flex space-x-3">
																{hasPermission('bills.view') && (
																	<Link to={`/bills/${mainBill.id}`} className="text-blue-600 hover:text-blue-900">
																		Chi tiết
																	</Link>
																)}
																{hasPermission('bills.delete') && (
																	<button type="button" onClick={() => handleDeleteClick(mainBill.id)} className="text-red-600 hover:text-red-900">
																		Xóa
																	</button>
																)}
															</div>
														</td>
													</tr>
													{/* Sub Bills Rows */}
													{subBills.map((subBill) => {
														const subBillWarning = isOverdueWarning(subBill);
														const subBillAllPaid = subBill.bill_players?.every((p) => p.is_paid) && subBill.bill_players?.length > 0;
														return (
															<tr
																key={subBill.id}
																className={`hover:bg-gray-50 bg-blue-50 ${subBillWarning
																		? "bg-red-100 hover:bg-red-200"
																		: subBillAllPaid
																			? "bg-green-50 hover:bg-green-100"
																			: ""
																	}`}>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{/* {formatDate(subBill.date)} */}
																</td>
																<td className="px-6 py-4 whitespace-nowrap">
																	<div className="flex items-center space-x-2">
																		<span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Bill con</span>
																		<span className="text-xs text-gray-600">
																			của Bill #{mainBill.id}
																		</span>
																	</div>
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{formatCurrencyRounded(subBill.total_amount)}</td>
																<td className="px-6 py-4 whitespace-nowrap">
																	<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(subBill)}`}>{getStatusText(subBill)}</span>
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
																	{subBill.bill_players?.filter((p) => !p.is_paid).length || 0}
																</td>
																<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
																	<div className="flex space-x-3">
																		{hasPermission('bills.view') && (
																			<Link to={`/bills/${subBill.id}`} className="text-blue-600 hover:text-blue-900">
																				Chi tiết
																			</Link>
																		)}
																		{hasPermission('bills.delete') && (
																			<button type="button" onClick={() => handleDeleteClick(subBill.id)} className="text-red-600 hover:text-red-900">
																				Xóa
																			</button>
																		)}
																	</div>
																</td>
															</tr>
														);
													})}
												</tbody>
											</table>
										</div>
									);
								})}
							</div>

							{/* Mobile Card View */}
							<div className="md:hidden space-y-4">
								{billGroups.map((group, groupIndex) => {
									const mainBill = group.mainBill;
									const subBills = group.subBills;
									const mainBillWarning = isOverdueWarning(mainBill);
									const mainBillAllPaid = mainBill.bill_players?.every((p) => p.is_paid) && mainBill.bill_players?.length > 0;

									return (
										<div key={mainBill.id} className={`border-2 rounded-lg overflow-hidden ${groupIndex < billGroups.length - 1 ? 'mb-4' : ''} ${mainBillWarning ? 'border-red-300' : mainBillAllPaid ? 'border-green-300' : 'border-gray-300'}`}>
											{/* Main Bill Card */}
											<div
												className={`p-4 ${mainBillWarning
														? "bg-red-100"
														: mainBillAllPaid
															? "bg-green-50"
															: "bg-white"
													}`}>
												<div className="flex items-start justify-between mb-3">
													<div className="flex-1">
														<div className="text-sm font-medium text-gray-900 mb-1">{formatDate(mainBill.date)}</div>
														<div className="flex items-center gap-2 mb-2 flex-wrap">
															<span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Bill chính #{mainBill.id}</span>
														</div>
														<div className="text-lg font-semibold text-gray-900">{formatCurrencyRounded(mainBill.total_amount)}</div>
													</div>
													<div className="flex flex-col items-end gap-2">
														<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(mainBill)}`}>{getStatusText(mainBill)}</span>
														<div className="text-xs text-gray-600">
															Chưa TT: {mainBill.bill_players?.filter((p) => !p.is_paid).length || 0}
														</div>
													</div>
												</div>
												<div className="flex gap-3 pt-2 border-t border-gray-200">
													{hasPermission('bills.view') && (
														<Link
															to={`/bills/${mainBill.id}`}
															className="flex-1 text-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
															Chi tiết
														</Link>
													)}
													{hasPermission('bills.delete') && (
														<button
															type="button"
															onClick={() => handleDeleteClick(mainBill.id)}
															className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
															Xóa
														</button>
													)}
												</div>
											</div>

											{/* Sub Bills Cards */}
											{subBills.map((subBill) => {
												const subBillWarning = isOverdueWarning(subBill);
												const subBillAllPaid = subBill.bill_players?.every((p) => p.is_paid) && subBill.bill_players?.length > 0;
												return (
													<div
														key={subBill.id}
														className={`p-4 pl-6 border-l-4 border-blue-400 border-t border-gray-200 ${subBillWarning
																? "bg-red-100"
																: subBillAllPaid
																	? "bg-green-50"
																	: "bg-blue-50"
															}`}>
														<div className="flex items-start justify-between mb-3">
															<div className="flex-1">
																<div className="text-sm font-medium text-gray-900 mb-1">{formatDate(subBill.date)}</div>
																<div className="flex items-center gap-2 mb-2 flex-wrap">
																	<span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Bill con</span>
																	<span className="text-xs text-gray-600">
																		của Bill #{mainBill.id}
																	</span>
																</div>
																<div className="text-lg font-semibold text-gray-900">{formatCurrencyRounded(subBill.total_amount)}</div>
															</div>
															<div className="flex flex-col items-end gap-2">
																<span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(subBill)}`}>{getStatusText(subBill)}</span>
																<div className="text-xs text-gray-600">
																	Chưa TT: {subBill.bill_players?.filter((p) => !p.is_paid).length || 0}
																</div>
															</div>
														</div>
														<div className="flex gap-3 pt-2 border-t border-gray-200">
															{hasPermission('bills.view') && (
																<Link
																	to={`/bills/${subBill.id}`}
																	className="flex-1 text-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
																	Chi tiết
																</Link>
															)}
															{hasPermission('bills.delete') && (
																<button
																	type="button"
																	onClick={() => handleDeleteClick(subBill.id)}
																	className="flex-1 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
																	Xóa
																</button>
															)}
														</div>
													</div>
												);
											})}
										</div>
									);
								})}
							</div>

							{/* Legend/Chú thích */}
							<div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
								<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 text-sm">
									<div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-4">
										<div className="flex items-center space-x-2">
											<div className="w-4 h-4 bg-red-100 border border-red-300 rounded flex-shrink-0"></div>
											<span className="text-gray-700 text-xs sm:text-sm">Bill quá hạn 1 tuần và còn người chưa thanh toán</span>
										</div>
										<div className="flex items-center space-x-2">
											<div className="w-4 h-4 bg-green-50 border border-green-200 rounded flex-shrink-0"></div>
											<span className="text-gray-700 text-xs sm:text-sm">Bill đã thanh toán</span>
										</div>
										<div className="flex items-center space-x-2">
											<div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded flex-shrink-0"></div>
											<span className="text-gray-700 text-xs sm:text-sm">Bill con</span>
										</div>
									</div>
									<div className="text-xs sm:text-sm font-semibold text-gray-700">
										Tổng số bill: {totalMainBillsCount}
									</div>
								</div>
							</div>

							{/* Pagination */}
							{totalPages > 1 && (
								<div className="bg-white px-4 sm:px-6 py-4 border-t border-gray-200">
									<div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
										<div className="text-xs sm:text-sm text-gray-700">
											Trang {currentPage} / {totalPages}
										</div>
										<div className="flex items-center space-x-1 sm:space-x-2">
											<button
												onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
												disabled={currentPage === 1}
												className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
												Trước
											</button>
											{/* Page numbers */}
											<div className="flex items-center space-x-1">
												{Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
													// Show first page, last page, current page, and pages around current
													if (
														page === 1 ||
														page === totalPages ||
														(page >= currentPage - 1 && page <= currentPage + 1)
													) {
														return (
															<button
																key={page}
																onClick={() => setCurrentPage(page)}
																className={`px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded-md ${currentPage === page
																		? "bg-blue-600 text-white border-blue-600"
																		: "border-gray-300 hover:bg-gray-50"
																	}`}>
																{page}
															</button>
														);
													} else if (page === currentPage - 2 || page === currentPage + 2) {
														return (
															<span key={page} className="px-1 sm:px-2 text-gray-500 text-xs sm:text-sm">
																...
															</span>
														);
													}
													return null;
												})}
											</div>
											<button
												onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
												disabled={currentPage === totalPages}
												className="px-2 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
												Sau
											</button>
										</div>
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				{/* Unpaid Players List - Right Side (1/4 width) */}
				<div className="lg:col-span-1">
					<div className="bg-white shadow rounded-lg overflow-hidden">
						<div className="px-4 sm:px-6 py-4 bg-gray-50 border-b border-gray-200">
							<h3 className="text-base sm:text-lg font-semibold text-gray-900">
								DS chưa thanh toán ({unpaidPlayers.length})
							</h3>
						</div>
						<div className="divide-y divide-gray-200 max-h-[calc(100vh-300px)] overflow-y-auto">
							{loading ? (
								<div className="px-4 sm:px-6 py-8 text-center text-gray-500 text-sm">Đang tải...</div>
							) : unpaidPlayers.length === 0 ? (
								<div className="px-4 sm:px-6 py-8 text-center text-gray-500 text-sm">Không có người chơi nào chưa thanh toán</div>
							) : (
								unpaidPlayers.map((player) => {
									const isMarking = markingPayment.has(player.userId);
									const isOverdue = isPlayerOverdue(player);
									return (
										<div
											key={player.userId}
											className={`px-4 sm:px-6 py-3 relative ${isOverdue
													? "bg-red-100 hover:bg-red-200"
													: "hover:bg-gray-50"
												}`}>
											<div className="pr-14 sm:pr-8 mb-2">
												<div className="text-xs sm:text-sm font-semibold text-gray-900">
													{player.name}: <span className="text-red-600">{formatCurrencyRounded(player.totalAmount)}</span>
												</div>
											</div>
											<div className="text-xs sm:text-sm pr-14 sm:pr-8">
												<div className="text-gray-700 font-medium mb-1">DS ngày thiếu:</div>
												<div className="space-y-1 pl-2">
													{player.unpaidDates.map((dateItem, idx) => (
														<div key={idx} className="text-gray-600">
															{formatDateForUnpaid(dateItem.date)} : {formatCurrencyRounded(dateItem.amount)}
														</div>
													))}
												</div>
											</div>
											{hasPermission('bills.mark_payment') && (
												<div className="absolute top-3 right-4 sm:right-4">
													<input
														type="checkbox"
														checked={false}
														onChange={() => handleMarkPlayerPayment(player.userId)}
														disabled={isMarking}
														className="w-6 h-6 sm:w-5 sm:h-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
														title="Đánh dấu thanh toán tất cả bills"
													/>
												</div>
											)}
											{isMarking && (
												<div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
													<div className="text-xs sm:text-sm text-gray-600">Đang xử lý...</div>
												</div>
											)}
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>
			</div>

			<ConfirmDialog
				isOpen={deleteConfirm.isOpen}
				onClose={handleDeleteCancel}
				onConfirm={handleDeleteConfirm}
				title="Xác nhận xóa bill"
				message="Bạn có chắc chắn muốn xóa bill này? Hành động này không thể hoàn tác."
			/>

			{/* Statistics Modal */}
			{statsModalOpen && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[90vh] overflow-y-auto">
						<div className="p-6">
							<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
								<h3 className="text-xl font-semibold text-gray-900">Thống kê tháng</h3>
								<div className="flex items-center gap-3">
									<label className="text-sm font-medium text-gray-700">Chọn tháng:</label>
									<input
										type="month"
										value={statsMonth}
										onChange={(e) => setStatsMonth(e.target.value)}
										className="px-3 py-2 border border-gray-300 rounded-md text-sm"
									/>
									<button
										onClick={() => setStatsModalOpen(false)}
										className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm">
										Đóng
									</button>
								</div>
							</div>

							<div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
								{/* Shuttle Statistics - Chiếm 4 phần */}
								<div className="lg:col-span-4 bg-gray-50 p-4 rounded-lg">
									<h4 className="text-base font-semibold mb-3 text-gray-900">Tổng số lượng cầu</h4>
									{monthlyStats.shuttles.length === 0 ? (
										<div className="text-sm text-gray-500">Không có dữ liệu cầu trong tháng này</div>
									) : (
										<div className="space-y-2">
											{monthlyStats.shuttles.map((shuttle, index) => (
												<div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
													<span className="text-sm font-medium text-gray-700">{shuttle.name}</span>
													<span className="text-sm font-semibold text-gray-900">{shuttle.totalQuantity} quả</span>
												</div>
											))}
											<div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-gray-400">
												<span className="text-sm font-bold text-gray-900">Tổng cộng:</span>
												<span className="text-sm font-bold text-gray-900">
													{monthlyStats.totalShuttles} quả
												</span>
											</div>
											{/* Ổng cầu */}
											<div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-blue-400 bg-blue-50 px-2 py-2 rounded">
												<span className="text-sm font-bold text-blue-900">Tổng ống cầu:</span>
												<span className="text-sm font-bold text-blue-900">
													{monthlyStats.totalOngCau} ống
													{monthlyStats.remainingShuttles > 0 && (
														<span className="text-xs text-gray-600 ml-1">
															({monthlyStats.remainingShuttles} quả lẻ)
														</span>
													)}
												</span>
											</div>
											<div className="text-xs text-gray-500 mt-1 italic">
												* 1 ống cầu = 12 quả
											</div>
										</div>
									)}
								</div>

								{/* Player Statistics - Chiếm 6 phần */}
								<div className="lg:col-span-6 bg-gray-50 p-4 rounded-lg">
									<h4 className="text-base font-semibold mb-3 text-gray-900">
										Tổng tiền theo người chơi ({monthlyStats.players.length})
									</h4>
									{monthlyStats.players.length === 0 ? (
										<div className="text-sm text-gray-500">Không có dữ liệu người chơi trong tháng này</div>
									) : (
										<div className="space-y-2 max-h-[600px] overflow-y-auto">
											{monthlyStats.players.map((player, index) => (
												<div key={index} className="py-2 border-b border-gray-200 last:border-0 mr-4">
													<div className="flex justify-between items-center">
														<span className="text-sm font-medium text-gray-700">#{index + 1} {player.name}</span>
														<span className="text-sm font-semibold text-gray-900">{formatCurrencyRounded(player.totalAmount)}</span>
													</div>
													<div className="flex justify-end mt-1">
														<span className="text-xs text-gray-500">Số bill: {player.billCount || 0}</span>
													</div>
												</div>
											))}
											<div className="flex justify-between items-center pt-2 mt-2 border-t-2 border-gray-400 sticky bottom-0 bg-gray-50">
												<span className="text-sm font-bold text-gray-900">Tổng cộng:</span>
												<span className="text-sm font-bold text-gray-900">
													{formatCurrencyRounded(monthlyStats.players.reduce((sum, p) => sum + p.totalAmount, 0))}
												</span>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
